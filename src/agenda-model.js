export const EVENT_TYPES={meet:'Meet',show:'Show',track:'Trackday',drift:'Drift',street:'Street',club:'Clubmoment'};
export const ATTENDANCE={confirmed:'Kaijuclub aanwezig',planned:'Aanwezigheid in planning',cancelled:'Deelname geannuleerd'};
export const AGENDA_FIELDS=['id','title','kind','date','endDate','startTime','endTime','location','address','description','website','attendance'];
const fail=message=>{throw new Error(message);};
export const emptyEvents=()=>({schemaVersion:1,revision:0,events:[]});
export function newEvent(){return {id:'agenda-'+crypto.randomUUID(),title:'',kind:'meet',date:'',endDate:'',startTime:'',endTime:'',location:'',address:'',description:'',website:'',attendance:'confirmed',published:null,archived:false};}
export function validDate(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!value.startsWith('0000')&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
export function safeEventURL(value){if(typeof value!=='string'||value.length>500||/[\u0000-\u0020\\]/.test(value))return false;try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password;}catch{return false;}}
export function validateEvent(event,required=false){
 if(!event||typeof event!=='object'||Array.isArray(event)||!/^(agenda-)[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(event.id)||!Object.hasOwn(EVENT_TYPES,event.kind)||!Object.hasOwn(ATTENDANCE,event.attendance))fail('Het agenda-event is ongeldig.');
 if(Object.keys(event).some(key=>![...AGENDA_FIELDS,'published','archived'].includes(key))||AGENDA_FIELDS.some(key=>!Object.hasOwn(event,key)))fail('Het event bevat onbekende of ontbrekende gegevens.');
 for(const [key,max] of [['title',160],['date',10],['endDate',10],['startTime',5],['endTime',5],['location',180],['address',300],['description',3000],['website',500]])if(typeof event[key]!=='string'||event[key].length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(event[key]))fail('Controleer de naam, locatie en praktische informatie.');
 for(const key of ['date','endDate'])if(event[key]&&!validDate(event[key]))fail('Vul een geldige datum in.');
 if(event.endDate&&(!event.date||event.endDate<event.date))fail('De einddatum moet op of na de begindatum liggen.');
 for(const key of ['startTime','endTime'])if(event[key]&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(event[key]))fail('Vul een geldig tijdstip in.');
 if(event.endTime&&!event.startTime)fail('Vul ook een begintijd in, of laat beide tijden leeg.');
 if(event.startTime&&event.endTime&&(!event.endDate||event.endDate===event.date)&&event.endTime<=event.startTime)fail('De eindtijd moet na de begintijd liggen. Voor een nacht-event vul je ook de einddatum in.');
 if(event.website&&!safeEventURL(event.website))fail('Gebruik een volledige HTTPS-link voor de eventwebsite.');
 if(required&&(!event.title.trim()||!event.date||!event.location.trim()))fail('Naam, datum en locatie zijn nodig om te publiceren.');
 return event;
}
export const cleanEvent=event=>Object.fromEntries(AGENDA_FIELDS.map(key=>[key,structuredClone(event[key])]));
export function validateEvents(manager){
 if(!manager||Object.keys(manager).sort().join(',')!=='events,revision,schemaVersion'||manager.schemaVersion!==1||!Number.isSafeInteger(manager.revision)||manager.revision<0||!Array.isArray(manager.events)||manager.events.length>300)fail('Het agendabestand is ongeldig.');
 const ids=new Set();for(const event of manager.events){if(Object.keys(event).sort().join(',')!==[...AGENDA_FIELDS,'published','archived'].sort().join(',')||typeof event.archived!=='boolean')fail('Het agenda-event bevat ongeldige gegevens.');validateEvent(event);if(ids.has(event.id))fail('Dit event staat dubbel in de agenda.');ids.add(event.id);if(event.published!==null){if(!event.published||Object.keys(event.published).sort().join(',')!==[...AGENDA_FIELDS].sort().join(','))fail('De opgeslagen publicatie is ongeldig.');validateEvent(event.published,true);if(event.published.id!==event.id)fail('De publicatie hoort bij een ander event.');}}
 return manager;
}
export function validatePublicAgenda(data){if(!data||Object.keys(data).sort().join(',')!=='events,schemaVersion'||data.schemaVersion!==1||!Array.isArray(data.events)||data.events.length>300)fail('De agenda kon niet worden gelezen.');const ids=new Set();for(const event of data.events){if(Object.keys(event).sort().join(',')!==[...AGENDA_FIELDS].sort().join(','))fail('Ongeldige publicatie.');validateEvent(event,true);if(ids.has(event.id))fail('Dubbel event.');ids.add(event.id);}return data;}
export function publicEvents(manager){validateEvents(manager);return {schemaVersion:1,events:manager.events.filter(event=>event.published&&!event.archived).map(event=>structuredClone(event.published)).sort((a,b)=>a.date.localeCompare(b.date)||a.startTime.localeCompare(b.startTime)||a.title.localeCompare(b.title))};}
export function updateEvent(manager,event,action){validateEvents(manager);validateEvent(event,action==='publish');if(!['draft','publish','archive'].includes(action))fail('Ongeldige beheeractie.');const old=manager.events.find(item=>item.id===event.id);if(action==='archive'&&!old?.published)fail('Dit event is nog niet gepubliceerd.');const clean=cleanEvent(event),record={...clean,published:action==='publish'?structuredClone(clean):structuredClone(old?.published||null),archived:action==='archive'?true:action==='publish'?false:old?.archived||false},events=manager.events.map(item=>item.id===record.id?record:structuredClone(item));if(!old)events.push(record);return validateEvents({schemaVersion:1,revision:manager.revision+1,events});}
export function brusselsToday(now=new Date()){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Brussels',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);return ['year','month','day'].map(type=>parts.find(part=>part.type===type).value).join('-');}
export function splitAgenda(events,today=brusselsToday()){const ordered=[...events].sort((a,b)=>a.date.localeCompare(b.date)||a.startTime.localeCompare(b.startTime)||a.title.localeCompare(b.title));return {upcoming:ordered.filter(event=>(event.endDate||event.date)>=today),past:ordered.filter(event=>(event.endDate||event.date)<today).reverse()};}
