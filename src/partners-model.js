export const emptyPartners=()=>({schemaVersion:1,revision:0,partners:[]});
export function safeWebsite(value){if(!value)return '';try{const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password)throw new Error();return url.href;}catch{throw new Error('Gebruik een volledige https:// website-link.');}}
export function validatePartner(item,required=false){
  if(!/^partner-\d+$/.test(item.id)||typeof item.name!=='string'||item.name.length>120||(required&&!item.name.trim()))throw new Error('Vul een geldige partnernaam in.');
  if(!['partner','sponsor'].includes(item.kind)||typeof item.description!=='string'||item.description.length>1200)throw new Error('Controleer de partnergegevens.');
  safeWebsite(item.website);
  if(typeof item.logo!=='string'||(item.logo&&!/^data:image\/(png|webp|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(item.logo))||item.logo.length>700000)throw new Error('Voeg een kleiner PNG-, JPEG- of WebP-logo toe.');
}
export function validatePartners(data){
  if(data?.schemaVersion!==1||!Number.isSafeInteger(data.revision)||data.revision<0||!Array.isArray(data.partners)||data.partners.length>60)throw new Error('Het partnerbestand heeft een ongeldige indeling.');
  const ids=new Set();for(const item of data.partners){validatePartner(item);if(ids.has(item.id))throw new Error('Dubbele partner.');ids.add(item.id);if(item.published){validatePartner(item.published,true);if(item.published.id!==item.id)throw new Error('Ongeldige publicatie.');}}
  return data;
}
export function publicPartners(data){return {schemaVersion:1,partners:data.partners.filter(item=>item.published&&!item.archived).map(item=>item.published)};}
export function updatePartner(data,item,action){
  validatePartners(data);validatePartner(item,action==='publish');
  if(!['draft','publish','archive'].includes(action))throw new Error('Ongeldige actie.');
  const fields={id:item.id,name:item.name.trim(),kind:item.kind,description:item.description.trim(),website:safeWebsite(item.website),logo:item.logo};
  const old=data.partners.find(record=>record.id===item.id);
  const record={...fields,published:action==='publish'?fields:old?.published||null,archived:action==='archive'?true:action==='publish'?false:old?.archived||false};
  const partners=data.partners.map(partner=>partner.id===record.id?record:partner);if(!old)partners.push(record);
  return validatePartners({schemaVersion:1,revision:data.revision+1,partners});
}
