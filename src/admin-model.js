export const REPOSITORY = 'alldaydigital/Kaijuclub_kc';
export const BRANCH = 'main';
export const MAX_PHOTOS = 12;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const CATEGORIES = ['street', 'stance', 'track', 'drift'];
export const MEDIA_PATTERN = /^cms\/media\/(\d+)\/([a-f0-9]{64})\.(jpg|png|webp)$/;
export const PUBLIC_PATTERN = /^\/images\/vehicles\/(\d+)\/([a-f0-9]{64})\.(jpg|png|webp)$/;
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export function newVehicle() {
  const random = crypto.getRandomValues(new Uint32Array(1))[0] % 100000;
  return {id:`club-${Date.now()}${String(random).padStart(5,'0')}`, name:'', category:'street', series:'', origin:'', story:'', specs:[], photos:[], featured:false, position:'50% 50%', published:null, archived:false, updatedAt:null};
}
export function editableFields(record) {
  return {id:record.id, name:record.name, category:record.category, series:record.series||'', origin:record.origin||'', story:record.story||'', specs:record.specs||[], photos:record.photos||[], featured:!!record.featured, position:record.position||'50% 50%'};
}
export function cleanPhoto(photo) {
  const clean={path:photo.path,digest:photo.digest,extension:photo.extension,width:photo.width,height:photo.height,alt:photo.alt||''};
  if(photo.blobSha)clean.blobSha=photo.blobSha;
  return clean;
}
export function cleanFields(record) {
  return {...editableFields(record), photos:(record.photos||[]).map(cleanPhoto), specs:(record.specs||[]).map(spec=>({label:String(spec.label||''),value:String(spec.value||'')}))};
}
export function fingerprint(record) { const fields=cleanFields(record);fields.photos=fields.photos.map(({blobSha,...photo})=>photo);return JSON.stringify(fields); }
export function validateFields(record, publish=false) {
  if(!/^club-\d{1,24}$/.test(record.id)||!CATEGORIES.includes(record.category))throw new Error('Deze wagenfiche is ongeldig.');
  for(const [key,limit,label] of [['name',120,'Wagennaam'],['series',120,'Serie'],['origin',80,'Herkomst'],['story',10000,'Verhaal']]) {
    if(typeof record[key]!=='string'||record[key].length>limit)throw new Error(`${label} mag maximaal ${limit} tekens bevatten.`);
  }
  if(publish&&!record.name.trim())throw new Error('Geef je wagen een naam voordat je publiceert.');
  if(!Array.isArray(record.photos)||record.photos.length>MAX_PHOTOS||(publish&&!record.photos.length))throw new Error('Voeg 1 tot 12 foto’s toe voordat je publiceert.');
  for(const photo of record.photos) {
    const match=MEDIA_PATTERN.exec(photo.path||'');
    if(!match||match[1]!==record.id.slice(5)||match[2]!==photo.digest||match[3]!==photo.extension||!Number.isInteger(photo.width)||!Number.isInteger(photo.height)||photo.width<1||photo.height<1||photo.width*photo.height>40_000_000)throw new Error('Een foto is ongeldig of groter dan 40 megapixels.');
    if(photo.blobSha&&!/^[a-f0-9]{40}$/.test(photo.blobSha))throw new Error('Een opgeslagen foto is ongeldig.');
    if(typeof photo.alt!=='string'||photo.alt.length>180)throw new Error('Een fotobeschrijving mag maximaal 180 tekens bevatten.');
  }
  if(!Array.isArray(record.specs)||record.specs.length>20)throw new Error('Voeg maximaal 20 specificaties toe.');
  for(const spec of record.specs) {
    if(typeof spec.label!=='string'||typeof spec.value!=='string'||spec.label.length>60||spec.value.length>180||(publish&&(!spec.label.trim()||!spec.value.trim())))throw new Error('Vul bij elke specificatie een naam en waarde in.');
  }
  if(!/^(100|\d{1,2})% (100|\d{1,2})%$/.test(record.position||''))throw new Error('De uitsnede van de foto is ongeldig.');
  return record;
}
export function validateManagerCatalog(data) {
  if(data?.schemaVersion!==1||!Number.isInteger(data.revision)||data.revision<0||!Array.isArray(data.vehicles)||data.vehicles.length>1000)throw new Error('De opgeslagen collectie kon niet veilig worden geopend.');
  const ids=new Set();
  for(const record of data.vehicles) {
    validateFields(record);
    if(ids.has(record.id))throw new Error('Er staan dubbele wagenfiches in de collectie.');ids.add(record.id);
    if(record.published){validateFields(record.published,true);if(record.published.id!==record.id)throw new Error('De gepubliceerde fiche hoort bij een andere wagen.');}
  }
  return data;
}
export function photoPublicPath(photo) { return '/images/vehicles/'+photo.path.slice('cms/media/'.length); }
export function vehicleForSite(record,{preview=false}={}) {
  const paragraphs=(record.story||'').split(/\n\s*\n/).map(text=>text.trim()).filter(Boolean);
  const photos=(record.photos||[]).map((photo,index)=>({src:preview?(photo.previewUrl||photo.remoteUrl||photoPublicPath(photo)):photoPublicPath(photo),alt:photo.alt||`${record.name||'Jouw wagen'} — foto ${index+1}`,width:photo.width,height:photo.height}));
  const cover=photos[0];
  return {id:record.id,name:record.name||'Jouw wagen',category:record.category,series:record.series||'',origin:record.origin||'',model:[record.series,record.category.toUpperCase()].filter(Boolean).join(' / '),featured:!!record.featured,position:record.position||'50% 50%',gallery:photos,image:cover?.src,alt:cover?.alt,width:cover?.width,height:cover?.height,title:record.name||'Het verhaal van deze wagen.',intro:paragraphs[0]||'',paragraphs:paragraphs.slice(1),specs:(record.specs||[]).filter(spec=>spec.label&&spec.value),teaser:Array.from(paragraphs[0]||'Ontdek deze clubwagen van dichtbij.').slice(0,240).join(''),credit:'',focus:[],reference:false};
}
export function publicCatalog(manager,previousMode='reference') {
  const records=manager.vehicles.filter(record=>record.published&&!record.archived).map(record=>record.published).sort((a,b)=>Number(b.featured)-Number(a.featured));
  return {schemaVersion:1,mode:records.length||previousMode==='managed'?'managed':'reference',source:'site-editor',updatedAt:manager.updatedAt,vehicles:records.map(record=>vehicleForSite(record))};
}
export function rawPhotoUrl(path,ref=BRANCH) {
  if(!MEDIA_PATTERN.test(path))throw new Error('Ongeldig fotopad.');
  return `https://raw.githubusercontent.com/${REPOSITORY}/${ref}/${path}`;
}
