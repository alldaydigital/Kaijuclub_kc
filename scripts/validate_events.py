"""Validate event reports, immutable public snapshots and actual photo bytes."""
import hashlib
import json
from datetime import date
from pathlib import Path
import re
from PIL import Image
from validate_site import checked_file

def utf16_length(value):
    return len(value.encode('utf-16-le',errors='surrogatepass'))//2
FIELDS={'id','title','kind','date','location','description','story','photos'}
PHOTO_FIELDS={'src','alt','caption','credit','width','height','positionDesktop','positionMobile'}
KINDS={'club','meet','show','track','drift','street'}

def require(condition,message):
    if not condition: raise ValueError(message)

def validate_photo(root,photo,published=False):
    require(isinstance(photo,dict) and set(photo)==PHOTO_FIELDS,'Invalid event photo fields')
    match=re.fullmatch(r'/images/events/([a-f0-9]{64})\.(webp|png|jpg)',photo.get('src',''))
    require(match,'Unsafe or temporary event photo')
    for key in ['alt','caption','credit']:
        value=photo[key];require(isinstance(value,str) and utf16_length(value)<=500 and not re.search(r'[\x00-\x08\x0b\x0c\x0e-\x1f]',value),'Invalid photo copy')
    for key in ['width','height']:require(type(photo[key]) is int and 0<photo[key]<=12000,'Invalid photo dimensions')
    require(photo['width']*photo['height']<=40000000,'Oversized photo')
    for key in ['positionDesktop','positionMobile']:
        value=photo[key];require(isinstance(value,str) and re.fullmatch(r'(?:100|\d{1,2})(?:\.\d+)?% (?:100|\d{1,2})(?:\.\d+)?%',value) and all(float(n[:-1])<=100 for n in value.split()),'Invalid crop')
    path=checked_file(root,'cms/event-media/'+match[1]+'.'+match[2]);content=path.read_bytes();require(len(content)<=1500000 and hashlib.sha256(content).hexdigest()==match[1],'Event photo checksum mismatch')
    with Image.open(path) as image:
        require(image.format=={'png':'PNG','jpg':'JPEG','webp':'WEBP'}[match[2]],'Image format mismatch');require(image.size==(photo['width'],photo['height']),'Photo dimensions do not match bytes');image.verify()
    with Image.open(path) as image:image.load()
    if published:require(checked_file(root,'public'+photo['src']).read_bytes()==content,'Published photo differs from saved media')

def validate_record(root,record,required=False):
    require(isinstance(record,dict) and re.fullmatch(r'moment-\d{8,30}',record.get('id','')),'Invalid event ID')
    require(record.get('kind') in KINDS,'Invalid event type')
    for key,limit in [('title',160),('date',10),('location',180),('description',500),('story',12000)]:
        value=record.get(key);require(isinstance(value,str) and utf16_length(value)<=limit and not re.search(r'[\x00-\x08\x0b\x0c\x0e-\x1f]',value),'Invalid event copy')
    if record['date']:
        require(re.fullmatch(r'\d{4}-\d{2}-\d{2}',record['date']),'Invalid event date');date.fromisoformat(record['date'])
    require(isinstance(record.get('photos'),list) and len(record['photos'])<=24,'Too many event photos')
    if required:require(record['title'].strip() and record['photos'],'Title and photo required for publication')
    for photo in record['photos']:validate_photo(root,photo)

def validate(root):
    manager=json.loads((root/'cms/events.json').read_text());public=json.loads((root/'public/data/events.json').read_text())
    require(set(manager)=={'schemaVersion','revision','events'} and manager['schemaVersion']==1 and type(manager['revision']) is int and manager['revision']>=0,'Invalid event manager')
    require(isinstance(manager['events'],list) and len(manager['events'])<=100,'Invalid event collection')
    ids=set();expected=[]
    for record in manager['events']:
        require(set(record)==FIELDS|{'published','archived'} and type(record['archived']) is bool,'Invalid manager fields');validate_record(root,record);require(record['id'] not in ids,'Duplicate report');ids.add(record['id'])
        if record['published'] is not None:
            published=record['published'];require(isinstance(published,dict) and set(published)==FIELDS and published['id']==record['id'],'Invalid published snapshot');validate_record(root,published,True)
            if not record['archived']:
                expected.append(published)
                for photo in published['photos']:validate_photo(root,photo,True)
    expected.sort(key=lambda item:item['date'],reverse=True)
    require(public=={'schemaVersion':1,'events':expected},'Public events do not match the immutable published snapshots')
    return len(expected)

if __name__=='__main__':
    print(f'Validated {validate(Path(__file__).resolve().parents[1])} published event report(s) and actual media.')
