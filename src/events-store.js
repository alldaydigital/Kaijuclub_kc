import {validateEvent,validateEvents,publicEvents,updateEvent,eventMediaName} from './events-model.js';
import {validateRasterUpload} from './site-image-bytes.js';
import {ApiError,bytesBase64} from './admin-api.js';
export function previewEvent(event,sha){const result=structuredClone(event);if(/^[a-f0-9]{40}$/.test(sha||''))for(const photo of result.photos){const name=eventMediaName(photo.src);if(name)photo.src=`https://raw.githubusercontent.com/alldaydigital/Kaijuclub_kc/${sha}/cms/event-media/${name}`;}return validateEvent(result,false,{preview:true});}
export async function saveEvent(store,manager,event,action,{onProgress=()=>{}}={}){
 validateEvents(manager);validateEvent(event,action==='publish');if(!['draft','publish','archive'].includes(action))throw new ApiError('Ongeldige beheeractie.');if(!store.head)throw new ApiError('Verbind het beheer eerst.');
 const head={...store.head};const ref=await store.request(store.endpoint(`git/ref/heads/${store.branch}`));if(ref.object.sha!==head.sha)throw new ApiError('De website is intussen gewijzigd. Je invoer blijft bewaard. Verbind opnieuw om de actuele versie te laden.',409);
 const tree=await store.request(store.endpoint(`git/trees/${head.tree}?recursive=1`));if(tree.truncated)throw new ApiError('De eventbestanden konden niet veilig geladen worden.');
 const blobs=new Map(tree.tree.filter(item=>item.type==='blob').map(item=>[item.path,item.sha]));const entries=new Map();const normalized=structuredClone(event);
 for(let index=0;index<normalized.photos.length;index++){
  const photo=normalized.photos[index];if(!photo.src.startsWith('data:'))continue;const match=/^data:image\/(png|webp|jpeg);base64,([A-Za-z0-9+/]+=*)$/.exec(photo.src);if(!match)throw new ApiError('Voeg de foto opnieuw toe.');
  const bytes=Uint8Array.from(atob(match[2]),char=>char.charCodeAt(0));await validateRasterUpload(bytes,match[1],photo);
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');const name=hash+'.'+(match[1]==='jpeg'?'jpg':match[1]);const path='cms/event-media/'+name;
  if(!blobs.has(path)){onProgress(`Foto ${index+1} van ${normalized.photos.length} uploaden…`);const blob=await store.request(store.endpoint('git/blobs'),{method:'POST',body:{content:bytesBase64(bytes),encoding:'base64'}});blobs.set(path,blob.sha);}entries.set(path,{path,mode:'100644',type:'blob',sha:blobs.get(path)});photo.src='/images/events/'+name;
 }
 const next=updateEvent(manager,normalized,action);const published=publicEvents(next);
 for(const item of next.events)for(const source of [item,item.published].filter(Boolean))for(const photo of source.photos){const path='cms/event-media/'+eventMediaName(photo.src);if(!blobs.has(path))throw new ApiError('Een opgeslagen foto ontbreekt. Voeg deze foto opnieuw toe.');}
 for(const item of published.events)for(const photo of item.photos){const path='public'+photo.src;entries.set(path,{path,mode:'100644',type:'blob',sha:blobs.get('cms/event-media/'+eventMediaName(photo.src))});}
 for(const [path,value] of [['cms/events.json',next],['public/data/events.json',published]])entries.set(path,{path,mode:'100644',type:'blob',content:JSON.stringify(value,null,2)+'\n'});
 onProgress('Reportage veilig bewaren…');const nextTree=await store.request(store.endpoint('git/trees'),{method:'POST',body:{base_tree:head.tree,tree:[...entries.values()]}});const commit=await store.request(store.endpoint('git/commits'),{method:'POST',body:{message:`${action==='publish'?'Publish':action==='archive'?'Hide':'Save'} event ${event.id} from site editor`,tree:nextTree.sha,parents:[head.sha]}});
 await store.request(store.endpoint(`git/refs/heads/${store.branch}`),{method:'PATCH',body:{sha:commit.sha,force:false}});store.head={sha:commit.sha,tree:nextTree.sha};return {manager:next,event:structuredClone(next.events.find(item=>item.id===event.id)),commit:commit.sha};
}
