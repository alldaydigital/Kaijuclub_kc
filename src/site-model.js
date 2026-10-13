import schema from './site-schema.json' with {type:'json'};
export const CONTENT_GROUPS=schema.groups;
export const SECTION_IDS=schema.sections;
export const SITE_FIELDS=CONTENT_GROUPS.flatMap(group=>group.fields);
export const defaultSiteContent=Object.fromEntries(SITE_FIELDS.map(field=>[field.key,structuredClone(field.value)]));
export function upgradeSiteContent(content){const next=structuredClone(content);if(!next||typeof next!=='object'||Array.isArray(next))return next;for(const field of CONTENT_GROUPS.filter(group=>['eventsArchive','agenda'].includes(group.id)).flatMap(group=>group.fields).concat(SITE_FIELDS.filter(field=>['nav_4_label','nav_4_link'].includes(field.key))))if(!Object.hasOwn(next,field.key))next[field.key]=structuredClone(field.value);if(next.nav_2_link==='/#events'||next.nav_2_link==='#events')next.nav_2_link='/events/';return next;}
const fail=message=>{throw new Error(message);};
export function safeSiteLink(value){
 if(typeof value!=='string'||value.length>500||/[\u0000-\u0020\\]/.test(value))return false;
 if(/^\/(?:#[A-Za-z][\w-]*|(?:partners|events|agenda)\/(?:#[A-Za-z][\w-]*)?)?$/.test(value)||/^#[A-Za-z][\w-]*$/.test(value))return true;
 try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password||url.protocol==='mailto:'&&!url.search&&!url.hash&&/^[^\s<>"\\@]+@[^\s<>"\\@]+\.[^\s<>"\\@]+$/.test(url.pathname)||url.protocol==='tel:'&&!url.search&&!url.hash&&/^\+?[0-9()-]+$/.test(url.pathname);}catch{return false;}
}
export function validateImage(image,{preview=false}={}){
 if(!image||typeof image!=='object'||Array.isArray(image))fail('Kies een geldige foto.');
 if(Object.keys(image).some(key=>!['src','alt','width','height','positionDesktop','positionMobile','credit'].includes(key)))fail('De foto bevat onbekende gegevens.');
 const src=image.src;
 const local=typeof src==='string'&&/^\/images\/[A-Za-z0-9/_-]+\.(?:png|jpg|jpeg|webp)$/.test(src)&&!src.includes('..')&&(!src.startsWith('/images/site/')||/^\/images\/site\/[a-f0-9]{64}\.(?:png|jpg|webp)$/.test(src));
 const upload=typeof src==='string'&&/^data:image\/(?:webp|png|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(src)&&src.length<=2000000;
 const raw=preview&&typeof src==='string'&&/^https:\/\/raw\.githubusercontent\.com\/alldaydigital\/Kaijuclub_kc\/[a-f0-9]{40}\/cms\/site-media\/[a-f0-9]{64}\.(?:webp|png|jpg)$/.test(src);
 if(!local&&!upload&&!raw)fail('Gebruik een geüploade PNG-, JPG- of WebP-foto.');
 if(!Number.isInteger(image.width)||!Number.isInteger(image.height)||image.width<1||image.height<1||image.width*image.height>40000000||image.width>12000||image.height>12000)fail('De afmetingen van de foto zijn ongeldig.');
 for(const key of ['alt','credit'])if(typeof image[key]!=='string'||image[key].length>500)fail('Foto-omschrijving of bronvermelding is te lang.');
 for(const key of ['positionDesktop','positionMobile'])if(typeof image[key]!=='string'||!/^((?:100|\d{1,2})(?:\.\d+)?)% ((?:100|\d{1,2})(?:\.\d+)?)%$/.test(image[key])||image[key].split(' ').some(n=>parseFloat(n)>100))fail('Kies een uitsnede tussen 0 en 100 procent.');
 return image;
}
export function validateContent(content,options={}){
 if(!content||typeof content!=='object'||Array.isArray(content))fail('De website-inhoud is ongeldig.');
 if(Object.keys(content).some(key=>!SITE_FIELDS.some(field=>field.key===key)))fail('De website bevat onbekende instellingen.');
 for(const field of SITE_FIELDS){const value=content[field.key];
  if(field.type==='boolean'){if(typeof value!=='boolean')fail(field.label+': kies tonen of verbergen.');}
  else if(field.type==='image')validateImage(value,options);
  else if(field.type==='sectionOrder'){if(!Array.isArray(value)||value.length!==SECTION_IDS.length||new Set(value).size!==SECTION_IDS.length||value.some(id=>!SECTION_IDS.includes(id)))fail('De volgorde moet elk onderdeel precies één keer bevatten.');}
  else if(field.type==='color'){if(typeof value!=='string'||!/^#[a-fA-F0-9]{6}$/.test(value))fail(field.label+': kies een geldige kleur.');}
  else if(field.type==='select'){if(!field.options.some(option=>option.value===value))fail(field.label+': kies een beschikbare optie.');}
  else if(field.type==='range'){if(!Number.isFinite(value)||value<field.min||value>field.max)fail(field.label+': kies een geldige waarde.');}
  else{if(typeof value!=='string'||value.length>(field.maxLength||500)||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))fail(field.label+': tekst is te lang of ongeldig.');if(field.type==='url'&&!safeSiteLink(value))fail(field.label+': gebruik HTTPS of een link naar een websiteonderdeel.');if(field.type==='email'&&!/^[^\s<>"\\@]+@[^\s<>"\\@]+\.[^\s<>"\\@]+$/.test(value))fail('Vul een geldig e-mailadres in.');}
 }
 return content;
}
const timestamp=value=>value===null||typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString()===(/\.\d{3}Z$/.test(value)?value:value.replace(/Z$/,'.000Z'));
export function validateSiteManager(manager){
 if(!manager||Object.keys(manager).sort().join(',')!=='content,history,published,revision,schemaVersion,updatedAt'||manager.schemaVersion!==1||!Number.isInteger(manager.revision)||manager.revision<0||!timestamp(manager.updatedAt)||!Array.isArray(manager.history)||manager.history.length>5)fail('Het websitebeheerbestand is ongeldig.');
 validateContent(manager.content);
 const persisted=content=>{if(SITE_FIELDS.some(field=>field.type==='image'&&content[field.key].src.startsWith('data:')))fail('Bewaar de foto als websitebestand voordat je het concept opslaat.');};
 persisted(manager.content);
 if(manager.published!==null&&(!manager.published||typeof manager.published!=='object'))fail('De opgeslagen publicatie is ongeldig.');
 for(const item of [manager.published,...manager.history].filter(Boolean)){if(Object.keys(item).sort().join(',')!=='content,publishedAt,revision'||!Number.isInteger(item.revision)||item.revision<0||item.revision>manager.revision||!timestamp(item.publishedAt)||item.publishedAt===null&&item.revision!==0)fail('De publicatiegeschiedenis is ongeldig.');validateContent(item.content);persisted(item.content);}
 if(manager.history.some(item=>!item||typeof item!=='object'))fail('De publicatiegeschiedenis is ongeldig.');
 return manager;
}
export function newSiteManager(){return {schemaVersion:1,revision:0,updatedAt:null,content:structuredClone(defaultSiteContent),published:{content:structuredClone(defaultSiteContent),publishedAt:null,revision:0},history:[]};}
export function updateSiteManager(manager,content,action='draft'){
 validateSiteManager(manager);validateContent(content);if(!['draft','publish'].includes(action))fail('Ongeldige websiteactie.');
 const next=structuredClone(manager);next.revision++;next.updatedAt=new Date().toISOString();next.content=structuredClone(content);
 if(action==='publish'){if(next.published)next.history=[structuredClone(next.published),...next.history].slice(0,5);next.published={content:structuredClone(content),publishedAt:next.updatedAt,revision:next.revision};}
 return validateSiteManager(next);
}
export function publicSiteContent(manager){validateSiteManager(manager);const published=manager.published||{content:defaultSiteContent,revision:0,publishedAt:null};return {schemaVersion:1,revision:published.revision,publishedAt:published.publishedAt,content:structuredClone(published.content)};}
