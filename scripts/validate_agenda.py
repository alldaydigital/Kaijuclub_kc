"""Validate calendar records and immutable publication snapshots before deployment."""
import json
import re
from datetime import date
from pathlib import Path
from urllib.parse import urlsplit
FIELDS={'id','title','kind','date','endDate','startTime','endTime','location','address','description','website','attendance'}
KINDS={'club','meet','show','track','drift','street'}
STATUSES={'confirmed','planned','cancelled'}
def require(condition,message):
    if not condition: raise ValueError(message)
def valid_date(value):
    try: return bool(re.fullmatch(r'\d{4}-\d{2}-\d{2}',value)) and date.fromisoformat(value).isoformat()==value
    except ValueError: return False
def validate_event(event,required=False):
    require(isinstance(event,dict) and set(event) in [FIELDS,FIELDS|{'published','archived'}],'Invalid calendar fields')
    require(isinstance(event['id'],str) and re.fullmatch(r'agenda-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}',event['id']),'Invalid calendar ID')
    require(isinstance(event['kind'],str) and event['kind'] in KINDS and isinstance(event['attendance'],str) and event['attendance'] in STATUSES,'Invalid attendance or event kind')
    for key,limit in [('title',160),('date',10),('endDate',10),('startTime',5),('endTime',5),('location',180),('address',300),('description',3000),('website',500)]:
        value=event[key]
        require(isinstance(value,str) and len(value.encode('utf-16-le',errors='surrogatepass'))//2<=limit and not re.search(r'[\x00-\x08\x0b\x0c\x0e-\x1f]',value),'Invalid calendar text')
    for key in ['date','endDate']: require(not event[key] or valid_date(event[key]),'Invalid date')
    require(not event['endDate'] or bool(event['date']) and event['endDate']>=event['date'],'End date precedes start')
    for key in ['startTime','endTime']:require(not event[key] or re.fullmatch(r'([01]\d|2[0-3]):[0-5]\d',event[key]),'Invalid time')
    require(not event['endTime'] or bool(event['startTime']),'Missing start time')
    if event['startTime'] and event['endTime'] and (not event['endDate'] or event['endDate']==event['date']): require(event['endTime']>event['startTime'],'End time precedes start')
    if event['website']:
        value=event['website']
        try:
            url=urlsplit(value);require(not re.search(r'[\x00-\x20\\]',value) and url.scheme=='https' and bool(url.hostname) and not url.username and not url.password,'Unsafe event website')
            _=url.port
        except ValueError: raise ValueError('Unsafe event website') from None
    if required:require(bool(event['title'].strip()) and bool(event['date']) and bool(event['location'].strip()),'Missing name, date or location')
    return event
def validate_agenda(root):
    root=Path(root);manager=json.loads((root/'cms/agenda.json').read_text());public=json.loads((root/'public/data/agenda.json').read_text())
    require(isinstance(manager,dict) and set(manager)=={'schemaVersion','revision','events'} and type(manager['schemaVersion']) is int and manager['schemaVersion']==1 and type(manager['revision']) is int and 0<=manager['revision']<=9007199254740991 and isinstance(manager['events'],list) and len(manager['events'])<=300,'Invalid calendar manager')
    ids=set();snapshots=[]
    for event in manager['events']:
        require(isinstance(event,dict) and set(event)==FIELDS|{'published','archived'} and type(event['archived']) is bool,'Invalid calendar record')
        validate_event(event);require(event['id'] not in ids,'Duplicate calendar ID');ids.add(event['id'])
        if event['published'] is not None:
            snapshot=event['published'];require(isinstance(snapshot,dict) and set(snapshot)==FIELDS,'Invalid calendar snapshot');validate_event(snapshot,True);require(snapshot['id']==event['id'],'Snapshot identity mismatch')
            if not event['archived']:snapshots.append(snapshot)
    require(isinstance(public,dict) and set(public)=={'schemaVersion','events'} and type(public['schemaVersion']) is int and public['schemaVersion']==1 and isinstance(public['events'],list),'Invalid public calendar')
    # Ties are order-independent; client supplies its localized title ordering.
    require(len(public['events'])==len(snapshots) and {item['id']:item for item in public['events']}=={item['id']:item for item in snapshots},'Public calendar differs from published snapshots')
    for event in public['events']:validate_event(event,True)
    require([(item['date'],item['startTime']) for item in public['events']]==sorted((item['date'],item['startTime']) for item in public['events']),'Public calendar dates are not ordered')
    return len(public['events'])
if __name__=='__main__':print(f'Agenda valid: {validate_agenda(Path(__file__).resolve().parents[1])} published events')
