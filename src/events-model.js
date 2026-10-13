export const EVENT_TYPES={club:'Clubmoment',meet:'Meet',show:'Show',track:'Trackday',drift:'Drift',street:'Street'};
export const MAX_EVENT_PHOTOS=24;
const fields=['id','title','kind','date','location','description','story','photos'];
const fail=message=>{throw new Error(message);};
export const emptyEvents=()=>({schemaVersion:1,revision:0,events:[]});
export function newEvent(){return {id:'moment-'+Date.now()+String(crypto.getRandomValues(new Uint32Array(1))[0]%100000),title:'',kind:'club',date:'',location:'',description:'',story:'',photos:[],published:null,archived:false};}
export const eventMediaName=src=>typeof src==='string'?/^\/images\/events\/([a-f0-9]{64}\.(?:webp|png|jpg))$/.exec(src)?.[1]||null:null;
export function validateEventPhoto(photo,{preview=false,persisted=false}={}){
 if(!photo||Object.keys(photo).sort().join(',')!=='alt,caption,credit,height,positionDesktop,positionMobile,src,width')fail('De foto bevat ongeldige gegevens.');
 const upload=!persisted&&typeof photo.src==='string'&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(photo.src)&&photo.src.length<=2000000;
 const remote=preview&&typeof photo.src==='string'&&/^https:\/\/raw\.githubusercontent\.com\/alldaydigital\/Kaijuclub_kc\/[a-f0-9]{40}\/cms\/event-media\/[a-f0-9]{64}\.(?:png|jpg|webp)$/.test(photo.src);
 if(!eventMediaName(photo.src)&&!upload&&!remote)fail('Voeg een geldige PNG-, JPG- of WebP-foto toe.');
 if(!Number.isInteger(photo.width)||!Number.isInteger(photo.height)||photo.width<1||photo.height<1||photo.width>12000||photo.height>12000||photo.width*photo.height>40000000)fail('De foto heeft ongeldige afmetingen.');
 for(const key of ['alt','caption','credit'])if(typeof photo[key]!=='string'||photo[key].length>500||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(photo[key]))fail('Controleer de foto-omschrijving en het onderschrift.');
 for(const key of ['positionDesktop','positionMobile'])if(typeof photo[key]!=='string'||!/^((?:100|\d{1,2})(?:\.\d+)?)% ((?:100|\d{1,2})(?:\.\d+)?)%$/.test(photo[key])||photo[key].split(' ').some(value=>parseFloat(value)>100))fail('Kies een uitsnede tussen 0 en 100 procent.');
 return photo;
}
export function validateEvent(event,required=false,options={}){
 if(!event||!/^moment-\d{8,30}$/.test(event.id)||!Object.hasOwn(EVENT_TYPES,event.kind))fail('De reportage is ongeldig.');
 for(const [key,max] of [['title',160],['date',10],['location',180],['description',500],['story',12000]])if(typeof event[key]!=='string'||event[key].length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(event[key]))fail('Controleer de titel, plaats en het verhaal.');
 if(event.date&&(event.date.startsWith('0000')||!/^\d{4}-\d{2}-\d{2}$/.test(event.date)||Number.isNaN(Date.parse(event.date))||new Date(event.date).toISOString().slice(0,10)!==event.date))fail('Vul een geldige datum in.');
 if(!Array.isArray(event.photos)||event.photos.length>MAX_EVENT_PHOTOS)fail(`Voeg maximaal ${MAX_EVENT_PHOTOS} foto's toe.`);
 if(event.photos.reduce((total,photo)=>total+(typeof photo?.src==='string'&&photo.src.startsWith('data:')?photo.src.length:0),0)>20000000)fail('De reportage is te groot. Gebruik minder foto’s of kleinere beelden.');
 for(const photo of event.photos)validateEventPhoto(photo,options);
 if(required&&(!event.title.trim()||!event.photos.length))fail('Een titel en minstens één foto zijn nodig om te publiceren.');
 return event;
}
export function cleanEvent(event){return Object.fromEntries(fields.map(key=>[key,structuredClone(event[key])]));}
export function validateEvents(manager){
 if(!manager||Object.keys(manager).sort().join(',')!=='events,revision,schemaVersion'||manager.schemaVersion!==1||!Number.isSafeInteger(manager.revision)||manager.revision<0||!Array.isArray(manager.events)||manager.events.length>100)fail('Het eventbestand is ongeldig.');
 const ids=new Set();for(const event of manager.events){if(Object.keys(event).sort().join(',')!==[...fields,'published','archived'].sort().join(',')||typeof event.archived!=='boolean')fail('De reportage bevat onbekende gegevens.');validateEvent(event,false,{persisted:true});if(ids.has(event.id))fail('Deze reportage komt meer dan één keer voor.');ids.add(event.id);if(event.published!==null){if(!event.published||Object.keys(event.published).sort().join(',')!==[...fields].sort().join(','))fail('De opgeslagen publicatie is ongeldig.');validateEvent(event.published,true,{persisted:true});if(event.published.id!==event.id)fail('De publicatie hoort bij een andere reportage.');}}
 return manager;
}
export function publicEvents(manager){validateEvents(manager);return {schemaVersion:1,events:manager.events.filter(item=>item.published&&!item.archived).map(item=>structuredClone(item.published)).sort((a,b)=>(b.date||'').localeCompare(a.date||''))};}
export function updateEvent(manager,event,action){
 validateEvents(manager);validateEvent(event,action==='publish',{persisted:true});if(!['draft','publish','archive'].includes(action))fail('Ongeldige beheeractie.');
 const old=manager.events.find(item=>item.id===event.id);if(action==='archive'&&!old?.published)fail('Deze reportage is nog niet gepubliceerd.');
 const clean=cleanEvent(event);const record={...clean,published:action==='publish'?structuredClone(clean):structuredClone(old?.published||null),archived:action==='archive'?true:action==='publish'?false:old?.archived||false};
 const events=manager.events.map(item=>item.id===record.id?record:structuredClone(item));if(!old)events.unshift(record);
 return validateEvents({schemaVersion:1,revision:manager.revision+1,events});
}
