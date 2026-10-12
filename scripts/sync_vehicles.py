#!/usr/bin/env python3
"""Publish authorized vehicle forms to a validated, atomic static catalog."""
from __future__ import annotations
import argparse
from dataclasses import dataclass
import hashlib
import io
import json
import os
from pathlib import Path
import re
import sys
import tempfile
from urllib import error, parse, request
import warnings
from PIL import Image

MAX_BYTES = 10 * 1024 * 1024
MAX_PIXELS = 40_000_000
CATEGORIES = {'street','stance','track','drift'}
ASSOCIATIONS = {'OWNER','MEMBER','COLLABORATOR'}

class ValidationError(ValueError):
    pass

@dataclass(frozen=True)
class ImageAsset:
    data: bytes
    extension: str
    width: int
    height: int
    digest: str


def parse_issue_body(body):
    result = {}
    for match in re.finditer(r'^### ([^\n]+)\n(.*?)(?=^### |\Z)', body or '', re.M | re.S):
        label, value = match.group(1).strip(), match.group(2).strip()
        if label in result:
            raise ValidationError('Een veld staat meerdere keren in de fiche.')
        result[label] = '' if value == '_No response_' else value
    return result


def is_managed_issue(issue, test_mode=False):
    labels = {label['name'] if isinstance(label,dict) else label for label in issue.get('labels',[])}
    return 'wagen' in labels and 'pull_request' not in issue and (test_mode or 'cms-test' not in labels)


def field(fields, *labels, limit=3000):
    value = next((fields[label] for label in labels if label in fields),'').strip()
    if len(value) > limit:
        raise ValidationError(f'Veld {labels[0]} is te lang (maximaal {limit} tekens).')
    return value


def validate_image_url(url, repository):
    p = parse.urlsplit(url)
    if p.scheme != 'https' or p.username or p.password or p.port not in (None,443) or p.fragment:
        raise ValidationError('Foto moet een veilige HTTPS GitHub-upload zijn.')
    host = p.hostname or ''
    decoded = parse.unquote(p.path)
    if '..' in decoded.split('/') or '\\' in decoded:
        raise ValidationError('Ongeldig fotopad.')
    allowed = False
    if host == 'github.com':
        allowed = bool(re.fullmatch(r'/user-attachments/assets/[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}',p.path))
    elif host == 'user-images.githubusercontent.com':
        allowed = bool(re.fullmatch(r'/[0-9]+/[^/]+',p.path))
    elif host == 'raw.githubusercontent.com':
        allowed = p.path.startswith(f'/{repository}/main/public/images/') and '%' not in p.path
    elif host == 'github-production-user-asset-6210df.s3.amazonaws.com':
        allowed = bool(p.path and p.path != '/')
    if not allowed:
        raise ValidationError('Gebruik foto’s die via GitHub in het wagenformulier zijn geüpload.')
    return url


class SafeRedirect(request.HTTPRedirectHandler):
    def __init__(self, repository):
        self.repository = repository
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        validate_image_url(newurl,self.repository)
        return super().redirect_request(req,fp,code,msg,headers,newurl)


def fetch_image(url, repository, opener=None):
    validate_image_url(url,repository)
    opener = opener or request.build_opener(SafeRedirect(repository))
    try:
        response = opener.open(request.Request(url,headers={'User-Agent':'Kaijuclub vehicle CMS'}),timeout=30)
        with response:
            validate_image_url(response.geturl(),repository)
            length = response.headers.get('Content-Length')
            if length and int(length) > MAX_BYTES:
                raise ValidationError('Een foto is groter dan 10 MB.')
            data = response.read(MAX_BYTES+1)
            if len(data) > MAX_BYTES:
                raise ValidationError('Een foto is groter dan 10 MB.')
        with warnings.catch_warnings():
            warnings.simplefilter('error',Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as image:
                if image.format not in ('JPEG','PNG','WEBP'):
                    raise ValidationError('Alleen JPEG, PNG en WebP foto’s worden ondersteund.')
                width,height = image.size
                if width < 1 or height < 1 or width*height > MAX_PIXELS:
                    raise ValidationError('De foto heeft ongeldige of te grote afmetingen.')
                extension = {'JPEG':'jpg','PNG':'png','WEBP':'webp'}[image.format]
                image.verify()
            with Image.open(io.BytesIO(data)) as image:
                image.load()
        return ImageAsset(data,extension,width,height,hashlib.sha256(data).hexdigest())
    except ValidationError:
        raise
    except Exception as exc:
        raise ValidationError('Een foto kon niet veilig worden geladen of is geen geldig beeld.') from exc


def authorized(issue, can_write):
    return issue.get('author_association') in ASSOCIATIONS and bool(can_write(issue.get('user',{}).get('login','')))


def validate_issue(issue, repository, can_write, test_mode=False):
    if not is_managed_issue(issue,test_mode) or not authorized(issue,can_write) or issue.get('state') != 'open':
        return None
    fields = parse_issue_body(issue.get('body',''))
    status = field(fields,'Status','Publicatie',limit=30)
    if status in ('','Concept','Archiveren'):
        return None
    if status != 'Publiceren':
        raise ValidationError(f"Wagen {issue['number']}: onbekende publicatiestatus.")
    name = field(fields,'Wagen',limit=120)
    category = field(fields,'Discipline',limit=20).lower()
    photos = field(fields,'Fotos',"Foto's",limit=20000)
    if not name or category not in CATEGORIES or not photos:
        raise ValidationError(f"Wagen {issue['number']}: vul wagen, discipline en foto’s in.")
    urls = list(dict.fromkeys(re.findall(r'https://[^\s<>\)\]]+',photos)))
    if not 1 <= len(urls) <= 12:
        raise ValidationError('Upload 1 tot 12 foto’s per wagen.')
    for url in urls:
        validate_image_url(url,repository)
    story = field(fields,'Verhaal',limit=10000)
    paragraphs = [part.strip() for part in re.split(r'\n\s*\n',story) if part.strip()]
    specs = []
    for line in field(fields,'Specificaties',limit=3000).splitlines():
        if not line.strip():
            continue
        if ':' not in line:
            raise ValidationError('Specificaties gebruiken één regel per item: Label: waarde.')
        label,value = (part.strip() for part in line.split(':',1))
        if not label or not value or len(label)>60 or len(value)>180 or len(specs)>=20:
            raise ValidationError('Een specificatie is leeg, te lang of er zijn meer dan 20 items.')
        specs.append({'label':label,'value':value})
    number = int(issue['number'])
    if number < 1:
        raise ValidationError('Ongeldig wagennummer.')
    return {'id':f'club-{number}','issueNumber':number,'name':name,'series':field(fields,'Serie','Serie / model',limit=120),'origin':field(fields,'Herkomst',limit=80),'category':category,'photoUrls':urls,'paragraphs':paragraphs,'specs':specs,'featured':field(fields,'Uitgelicht',limit=20)=='Ja','updatedAt':issue.get('updated_at',''),'reference':False}


def sync_catalog(issues, public_root, repository, can_write, image_fetcher=fetch_image, dry_run=False, test_mode=False):
    public_root = Path(public_root)
    if public_root.is_symlink():
        raise ValidationError('De uitvoermap mag geen symlink zijn.')
    old_path = public_root/'data'/'vehicles.json'
    if old_path.is_symlink() or not old_path.parent.resolve().is_relative_to(public_root.resolve()):
        raise ValidationError('Onveilig collectiepad in de uitvoermap.')
    old = json.loads(old_path.read_text()) if old_path.exists() else {}
    managed = [item for item in issues if is_managed_issue(item,test_mode) and authorized(item,can_write)]
    candidates = [car for item in issues if (car:=validate_issue(item,repository,can_write,test_mode))]
    candidates.sort(key=lambda car:(not car['featured'],car['issueNumber']))
    vehicles, assets = [], {}
    for car in candidates:
        gallery = []
        for index,url in enumerate(car.pop('photoUrls')):
            asset = image_fetcher(url,repository)
            relative = f"images/vehicles/{car['issueNumber']}/{asset.digest}.{asset.extension}"
            gallery.append({'src':'/'+relative,'alt':f"{car['name']} — foto {index+1}",'width':asset.width,'height':asset.height})
            assets[relative] = asset.data
        primary = gallery[0]
        paragraphs = car.pop('paragraphs')
        intro = paragraphs[0] if paragraphs else ''
        vehicle = {**car,'model':' / '.join(part for part in (car['series'],car['category'].upper()) if part),'image':primary['src'],'gallery':gallery,'alt':primary['alt'],'width':primary['width'],'height':primary['height'],'credit':'','title':car['name'],'intro':intro,'paragraphs':paragraphs[1:],'focus':[],'teaser':intro[:240] if intro else 'Ontdek deze clubwagen van dichtbij.'}
        vehicles.append(vehicle)
    result = {'schemaVersion':1,'mode':'managed' if managed or old.get('mode')=='managed' else 'reference','updatedAt':max((item.get('updated_at','') for item in managed),default=old.get('updatedAt')),'vehicles':vehicles}
    if dry_run:
        return result
    # All inputs and downloads are validated before touching retained files.
    for relative,data in assets.items():
        target = public_root/relative
        parent = target.parent
        if parent.resolve().is_relative_to(public_root.resolve()) is False or target.is_symlink():
            raise ValidationError('Onveilig fotopad in de uitvoermap.')
        parent.mkdir(parents=True,exist_ok=True)
        if target.exists() and target.read_bytes()==data:
            continue
        with tempfile.NamedTemporaryFile(dir=parent,delete=False) as temporary:
            temporary.write(data)
            temporary_path = temporary.name
        os.replace(temporary_path,target)
    old_path.parent.mkdir(parents=True,exist_ok=True)
    text = json.dumps(result,ensure_ascii=False,indent=2)+'\n'
    if not old_path.exists() or old_path.read_text()!=text:
        with tempfile.NamedTemporaryFile(mode='w',encoding='utf-8',dir=old_path.parent,delete=False) as temporary:
            temporary.write(text)
            temporary_path = temporary.name
        os.replace(temporary_path,old_path)
    return result


class GitHub:
    def __init__(self, token, repository):
        self.token,self.repository = token,repository
        self.permissions = {}
    def get(self,path):
        req = request.Request('https://api.github.com/'+path,headers={'Authorization':'Bearer '+self.token,'Accept':'application/vnd.github+json','User-Agent':'Kaijuclub vehicle CMS','X-GitHub-Api-Version':'2022-11-28'})
        with request.urlopen(req,timeout=30) as response:
            return json.load(response)
    def can_write(self,username):
        if username not in self.permissions:
            if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9-]{0,38}',username):
                return False
            try:
                data=self.get(f'repos/{self.repository}/collaborators/{username}/permission')
                self.permissions[username]=data.get('permission') in ('write','maintain','admin') or data.get('user',{}).get('permissions',{}).get('push',False)
            except error.HTTPError as exc:
                if exc.code == 404:
                    self.permissions[username]=False
                else:
                    raise ValidationError('GitHub kon de beheerdersrechten niet controleren. De bestaande collectie blijft behouden.') from exc
        return self.permissions[username]
    def issues(self):
        items=[]
        for page in range(1,11):
            batch=self.get(f'repos/{self.repository}/issues?state=all&labels=wagen&per_page=100&page={page}')
            items.extend(batch)
            if len(batch)<100:
                return items
        raise ValidationError('De beheerlijst bevat te veel fiches voor één publicatie.')


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--repo',default=os.environ.get('GITHUB_REPOSITORY','alldaydigital/Kaijuclub_kc'))
    parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1]/'public')
    parser.add_argument('--issues-file',type=Path)
    parser.add_argument('--test-issue',type=int)
    parser.add_argument('--output-dir',type=Path)
    args=parser.parse_args()
    if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+',args.repo):
        raise ValidationError('Ongeldige repository.')
    token=os.environ.get('GH_TOKEN') or os.environ.get('GITHUB_TOKEN')
    if args.issues_file:
        issues=json.loads(args.issues_file.read_text())
        can_write=lambda username:username==args.repo.split('/')[0]
    else:
        if not token:
            raise ValidationError('GitHub-authenticatie ontbreekt op de server.')
        github=GitHub(token,args.repo)
        issues=[github.get(f'repos/{args.repo}/issues/{args.test_issue}')] if args.test_issue else github.issues()
        can_write=github.can_write
    if args.test_issue:
        if not is_managed_issue(issues[0],test_mode=True) or not any(label.get('name')=='cms-test' for label in issues[0].get('labels',[])):
            raise ValidationError('Een test gebruikt uitsluitend een cms-test fiche.')
        result=sync_catalog(issues,args.root,args.repo,can_write,dry_run=True,test_mode=True)
        if len(result['vehicles']) != 1:
            raise ValidationError('De testfiche kon niet als één gepubliceerde wagen worden gevalideerd.')
        if args.output_dir:
            args.output_dir.mkdir(parents=True,exist_ok=True)
            (args.output_dir/'vehicles.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    else:
        result=sync_catalog(issues,args.root,args.repo,can_write)
    print(f"Validated {len(result['vehicles'])} published vehicle(s); mode={result['mode']}.")

if __name__=='__main__':
    try:
        main()
    except Exception as exc:
        print('CMS publication failed: '+str(exc),file=sys.stderr)
        raise SystemExit(1)
