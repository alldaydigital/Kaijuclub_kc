import {SITE_FIELDS,validateContent,validateSiteManager,updateSiteManager,publicSiteContent} from './site-model.js';
import {ApiError,bytesBase64} from './admin-api.js';
import {validateRasterUpload} from './site-image-bytes.js';
const MANAGER='cms/site.json',PUBLIC='public/data/site.json';
const mediaPattern=/^\/images\/site\/([a-f0-9]{64}\.(?:webp|png|jpg))$/;
const imageFields=()=>SITE_FIELDS.filter(field=>field.type==='image');
const mediaPath=src=>{const match=src.match(mediaPattern);return match?'cms/site-media/'+match[1]:null;};
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
function decodeUpload(src){
 const match=src.match(/^data:image\/(webp|png|jpeg);base64,([A-Za-z0-9+/]+=*)$/);if(!match)throw new ApiError('Deze foto kon niet worden gelezen. Voeg hem opnieuw toe.');
 const bytes=Uint8Array.from(atob(match[2]),char=>char.charCodeAt(0));
 const valid=match[1]==='png'?bytes.length>24&&bytes[0]===137&&new TextDecoder().decode(bytes.subarray(1,4))==='PNG':match[1]==='jpeg'?bytes.length>4&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255:bytes.length>12&&new TextDecoder().decode(bytes.subarray(0,4))==='RIFF'&&new TextDecoder().decode(bytes.subarray(8,12))==='WEBP';
 if(!valid)throw new ApiError('Het fotobestand komt niet overeen met het opgegeven formaat.');return {bytes,mime:match[1],extension:match[1]==='jpeg'?'jpg':match[1]};
}
export function previewSiteContent(content,headSha){
 const preview=structuredClone(content);if(!/^[a-f0-9]{40}$/.test(headSha||''))return preview;
 for(const field of imageFields()){const image=preview[field.key],path=mediaPath(image.src);if(path)image.src=`https://raw.githubusercontent.com/alldaydigital/Kaijuclub_kc/${headSha}/${path}`;}
 return validateContent(preview,{preview:true});
}
export async function saveSiteContent(store,manager,content,action,{onProgress=()=>{}}={}){
 validateSiteManager(manager);validateContent(content);if(!['draft','publish'].includes(action))throw new ApiError('Ongeldige websiteactie.');
 if(!store.head)throw new ApiError('Verbind het beheer eerst.');
 const head={...store.head};const ref=await store.request(store.endpoint(`git/ref/heads/${store.branch}`));
 if(ref.object.sha!==head.sha)throw new ApiError('De website is intussen gewijzigd. Je werk blijft hier bewaard. Verbind opnieuw om de nieuwste versie te laden.',409);
 const sourceTree=await store.request(store.endpoint(`git/trees/${head.tree}?recursive=1`));if(sourceTree.truncated)throw new ApiError('De websitebestanden konden niet veilig geladen worden.');
 const blobs=new Map(sourceTree.tree.filter(item=>item.type==='blob').map(item=>[item.path,item.sha]));
 const entries=new Map();const normalized=structuredClone(content);let uploadNumber=0;
 for(const field of imageFields()){
  const image=normalized[field.key];if(!image.src.startsWith('data:'))continue;
  const {bytes,mime,extension}=decodeUpload(image.src);await validateRasterUpload(bytes,mime,image);const hash=await digest(bytes);const path=`cms/site-media/${hash}.${extension}`;
  if(!blobs.has(path)){onProgress(`Foto ${++uploadNumber} uploaden…`);const blob=await store.request(store.endpoint('git/blobs'),{method:'POST',body:{content:bytesBase64(bytes),encoding:'base64'}});blobs.set(path,blob.sha);}
  entries.set(path,{path,mode:'100644',type:'blob',sha:blobs.get(path)});image.src=`/images/site/${hash}.${extension}`;
 }
 const next=updateSiteManager(manager,normalized,action);const published=publicSiteContent(next);
 // Draft assets live in the repository, outside the published web directory.
 // Keep immutable current/live/history images reachable before creating the commit.
 for(const source of [next.content,next.published?.content,...next.history.map(item=>item.content)].filter(Boolean)){
  for(const field of imageFields()){const path=mediaPath(source[field.key].src);if(path&&!blobs.has(path))throw new ApiError('Een opgeslagen websitefoto ontbreekt. Upload deze foto opnieuw.');}
 }
 for(const field of imageFields()){
  const src=published.content[field.key].src,path=mediaPath(src);if(path){const publicPath='public'+src;entries.set(publicPath,{path:publicPath,mode:'100644',type:'blob',sha:blobs.get(path)});}
 }
 for(const [path,value] of [[MANAGER,next],[PUBLIC,published]])entries.set(path,{path,mode:'100644',type:'blob',content:JSON.stringify(value,null,2)+'\n'});
 onProgress(action==='publish'?'Website publiceren…':'Concept veilig bewaren…');
 const tree=await store.request(store.endpoint('git/trees'),{method:'POST',body:{base_tree:head.tree,tree:[...entries.values()]}});
 const commit=await store.request(store.endpoint('git/commits'),{method:'POST',body:{message:action==='publish'?'Publish website content from visual editor':'Save website draft from visual editor',tree:tree.sha,parents:[head.sha]}});
 await store.request(store.endpoint(`git/refs/heads/${store.branch}`),{method:'PATCH',body:{sha:commit.sha,force:false}});
 store.head={sha:commit.sha,tree:tree.sha};return {manager:next,content:normalized,commit:commit.sha};
}
