#!/usr/bin/env python3
"""Validate the on-site manager and its public projection before deployment."""
from __future__ import annotations
import hashlib, io, json, re, sys, warnings
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
CATEGORIES={'street','stance','track','drift'}
MEDIA=re.compile(r'^cms/media/(\d+)/([a-f0-9]{64})\.(jpg|png|webp)$')
PUBLIC=re.compile(r'^/images/vehicles/(\d+)/([a-f0-9]{64})\.(jpg|png|webp)$')
class ValidationError(ValueError): pass

def check(condition,message):
    if not condition: raise ValidationError(message)

def text(value,limit,label,required=False):
    check(isinstance(value,str) and len(value)<=limit and (not required or value.strip()),f'Invalid {label}.')

def validate_image(root,path,metadata,pattern=MEDIA):
    match=pattern.fullmatch(path)
    check(bool(match),'Invalid image path.')
    relative=path if pattern is MEDIA else 'public'+path
    file=root/relative
    check(not file.is_symlink() and file.resolve().is_relative_to(root.resolve()),'Unsafe image path.')
    data=file.read_bytes()
    check(0<len(data)<=10*1024*1024,'Image exceeds 10 MB.')
    check(hashlib.sha256(data).hexdigest()==match[2],'Image checksum mismatch.')
    with warnings.catch_warnings():
        warnings.simplefilter('error',Image.DecompressionBombWarning)
        with Image.open(io.BytesIO(data)) as image:
            check(image.format in ('JPEG','PNG','WEBP'),'Unsupported image format.')
            check({'JPEG':'jpg','PNG':'png','WEBP':'webp'}[image.format]==match[3],'Image extension mismatch.')
            width,height=image.size
            check(0<width*height<=40_000_000,'Image exceeds 40 megapixels.')
            declared=(metadata.get('width'),metadata.get('height'))
            check(all(isinstance(v,int) and not isinstance(v,bool) for v in declared),'Invalid image dimensions.')
            image.verify()
        with Image.open(io.BytesIO(data)) as image:
            image.load()
            orientation=image.getexif().get(274,1)
            check(declared==(width,height) or (orientation in (5,6,7,8) and declared==(height,width)),'Image dimensions mismatch.')
    return data

def validate_fields(record,root,publish=False,cache=None):
    cache=cache if cache is not None else {}
    check(bool(re.fullmatch(r'club-\d{1,24}',record.get('id',''))),'Invalid vehicle ID.')
    check(record.get('category') in CATEGORIES,'Invalid discipline.')
    for key,limit in [('name',120),('series',120),('origin',80),('story',10000)]:text(record.get(key,''),limit,key,required=publish and key=='name')
    check(isinstance(record.get('featured'),bool),'Invalid featured value.')
    check(bool(re.fullmatch(r'(100|\d{1,2})% (100|\d{1,2})%',record.get('position',''))),'Invalid cover crop.')
    photos=record.get('photos');check(isinstance(photos,list) and len(photos)<=12 and (not publish or len(photos)>0),'Invalid photo count.')
    for photo in photos:
        match=MEDIA.fullmatch(photo.get('path',''));check(match and match[1]==record['id'][5:],'Photo belongs to another vehicle.')
        check(photo.get('digest')==match[2] and photo.get('extension')==match[3],'Invalid image reference.')
        check(bool(re.fullmatch('[a-f0-9]{40}',photo.get('blobSha',''))),'Missing image storage reference.')
        text(photo.get('alt',''),180,'photo description')
        if photo['path'] not in cache:cache[photo['path']]=validate_image(root,photo['path'],photo)
        else:validate_image(root,photo['path'],photo)
    specs=record.get('specs');check(isinstance(specs,list) and len(specs)<=20,'Invalid specification count.')
    for spec in specs:text(spec.get('label'),60,'specification label',publish);text(spec.get('value'),180,'specification value',publish)

def projection(record):
    paragraphs=[part.strip() for part in re.split(r'\n\s*\n',record['story']) if part.strip()]
    gallery=[{'src':'/images/vehicles/'+photo['path'][len('cms/media/'):],'alt':photo.get('alt') or f"{record['name']} — foto {index+1}",'width':photo['width'],'height':photo['height']} for index,photo in enumerate(record['photos'])]
    primary=gallery[0]
    return {'id':record['id'],'name':record['name'],'category':record['category'],'series':record['series'],'origin':record['origin'],'model':' / '.join(filter(None,[record['series'],record['category'].upper()])),'featured':record['featured'],'position':record['position'],'gallery':gallery,'image':primary['src'],'alt':primary['alt'],'width':primary['width'],'height':primary['height'],'title':record['name'],'intro':paragraphs[0] if paragraphs else '', 'paragraphs':paragraphs[1:],'specs':[spec for spec in record['specs'] if spec['label'] and spec['value']], 'teaser':(paragraphs[0] if paragraphs else 'Ontdek deze clubwagen van dichtbij.')[:240],'credit':'','focus':[],'reference':False}

def validate_collection(root=ROOT):
    root=Path(root);manager_path=root/'cms/catalog.json';public_path=root/'public/data/vehicles.json'
    public=json.loads(public_path.read_text())
    check(public.get('schemaVersion')==1 and public.get('mode') in ('reference','managed') and isinstance(public.get('vehicles'),list),'Invalid public collection.')
    if not manager_path.exists():return len(public['vehicles'])
    manager=json.loads(manager_path.read_text());check(manager.get('schemaVersion')==1 and isinstance(manager.get('revision'),int) and manager['revision']>=0 and isinstance(manager.get('vehicles'),list) and len(manager['vehicles'])<=1000,'Invalid manager collection.')
    ids=set();cache={};live=[]
    for record in manager['vehicles']:
        validate_fields(record,root,cache=cache);check(record['id'] not in ids,'Duplicate vehicle.');ids.add(record['id'])
        check(isinstance(record.get('archived'),bool),'Invalid archive status.')
        if record.get('published'):
            snapshot=record['published'];check(snapshot.get('id')==record['id'],'Invalid published snapshot.');validate_fields(snapshot,root,True,cache)
            if not record['archived']:live.append(snapshot)
    if public.get('source')=='site-editor':
        check(public.get('updatedAt')==manager.get('updatedAt'),'Collection revision mismatch.')
        expected=[projection(record) for record in sorted(live,key=lambda record:not record['featured'])]
        check(expected==public['vehicles'],'The public collection does not match the published versions.')
        check(not expected or public['mode']=='managed','Published cars require managed mode.')
        check(not any(record.get('published') for record in manager['vehicles']) or public['mode']=='managed','Archived real cars must not restore reference mode.')
        for vehicle in public['vehicles']:
            for photo in vehicle['gallery']:
                validate_image(root,photo['src'],photo,PUBLIC)
    else:
        check(not manager['vehicles'],'A populated site editor must own its public collection.')
        # Existing Issue Form records remain valid during migration; their media still need verification.
        for vehicle in public['vehicles']:
            for photo in vehicle.get('gallery',[]):validate_image(root,photo['src'],photo,PUBLIC)
    return len(live)

if __name__=='__main__':
    try:print(f'Validated site editor and {validate_collection()} published vehicle(s).')
    except Exception as error:print('Collection validation failed: '+str(error),file=sys.stderr);raise SystemExit(1)
