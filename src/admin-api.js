import {REPOSITORY,BRANCH,validateManagerCatalog,cleanFields,publicCatalog,validateFields,photoPublicPath} from './admin-model.js';
const MANAGER_PATH='cms/catalog.json';
const PUBLIC_PATH='public/data/vehicles.json';
export class ApiError extends Error { constructor(message,status=0){super(message);this.status=status;} }
const encodeText=value=>bytesBase64(new TextEncoder().encode(value));
export function bytesBase64(bytes) {
  let binary='';for(let offset=0;offset<bytes.length;offset+=32768)binary+=String.fromCharCode(...bytes.subarray(offset,offset+32768));return btoa(binary);
}
const decodeContent=blob=>new TextDecoder().decode(Uint8Array.from(atob(blob.content.replace(/\s/g,'')),char=>char.charCodeAt(0)));
export class GitHubStore {
  constructor(token,{repository=REPOSITORY,branch=BRANCH,fetcher=fetch}={}){this.token=token;this.repository=repository;this.branch=branch;this.fetcher=fetcher;this.head=null;this.catalog=null;this.publicMode='reference';}
  lock(){this.token='';this.head=null;this.catalog=null;}
  async request(path,{method='GET',body,signal}={}) {
    if(!this.token)throw new ApiError('Log opnieuw in om je wijzigingen op te slaan.',401);
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),45000);
    const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
    try {
      const response=await this.fetcher('https://api.github.com/'+path,{method,headers:{Authorization:'Bearer '+this.token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:controller.signal,credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer'});
      if(!response.ok) {
        const messages={401:'Je beheerkoppeling is verlopen. Koppel GitHub opnieuw.',403:'Deze koppeling heeft onvoldoende rechten of GitHub beperkt tijdelijk de aanvragen. Controleer Contents: Read and write.',404:'De collectie of repository is niet bereikbaar met deze beheerkoppeling.',409:'Iemand heeft de collectie intussen gewijzigd. Je wijzigingen blijven hier bewaard. Laad de actuele collectie en probeer opnieuw.',422:'De collectie is intussen gewijzigd of GitHub kon deze update niet bewaren. Je wijzigingen blijven hier bewaard.'};
        throw new ApiError(messages[response.status]||'GitHub kon de wijziging niet verwerken. Je werk blijft hier bewaard.',response.status);
      }
      return response.status===204?null:await response.json();
    }catch(error){if(error instanceof ApiError)throw error;throw new ApiError('De verbinding is onderbroken. Je werk blijft hier bewaard. Controleer je verbinding en probeer opnieuw.');}
    finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
  }
  endpoint(path){return `repos/${this.repository}${path?'/'+path:''}`;}
  async connect() {
    const user=await this.request('user');
    const repo=await this.request(this.endpoint(''));
    if(!repo.permissions?.push)throw new ApiError('Je account heeft geen schrijfrechten voor de Kaijuclub-website.',403);
    // Verify actual token write scope without changing a branch or published file.
    await this.request(this.endpoint('git/blobs'),{method:'POST',body:{content:'Kaijuclub CMS connection check',encoding:'utf-8'}});
    await this.load();return {login:user.login,avatar:user.avatar_url};
  }
  async load() {
    const ref=await this.request(this.endpoint(`git/ref/heads/${this.branch}`));
    const commit=await this.request(this.endpoint(`git/commits/${ref.object.sha}`));
    const tree=await this.request(this.endpoint(`git/trees/${commit.tree.sha}?recursive=1`));
    if(tree.truncated)throw new ApiError('De repository is te groot om veilig als één collectie te laden.');
    const managerEntry=tree.tree.find(entry=>entry.path===MANAGER_PATH);
    const publicEntry=tree.tree.find(entry=>entry.path===PUBLIC_PATH);
    const manager=managerEntry?JSON.parse(decodeContent(await this.request(this.endpoint(`git/blobs/${managerEntry.sha}`)))):{schemaVersion:1,revision:0,updatedAt:null,vehicles:[]};
    if(publicEntry){const data=JSON.parse(decodeContent(await this.request(this.endpoint(`git/blobs/${publicEntry.sha}`))));this.publicMode=data.mode;}
    validateManagerCatalog(manager);
    for(const record of manager.vehicles)for(const source of [record,record.published].filter(Boolean))for(const photo of source.photos){const entry=tree.tree.find(entry=>entry.path===photo.path);if(!entry||entry.type!=='blob')throw new ApiError('Een opgeslagen foto ontbreekt. De collectie is niet aangepast.');photo.blobSha=entry.sha;}
    this.catalog=manager;this.head={sha:ref.object.sha,tree:commit.tree.sha};return manager;
  }
  async save(record,action,{onProgress=()=>{}}={}) {
    if(!this.catalog||!this.head)throw new ApiError('Open de actuele collectie voordat je opslaat.');
    if(!['draft','publish','archive','restore'].includes(action))throw new ApiError('Ongeldige beheeractie.');
    validateFields(record,action==='publish');
    // Refuse a stale snapshot before uploading any photos; final ref update also remains atomic.
    const current=await this.request(this.endpoint(`git/ref/heads/${this.branch}`));
    if(current.object.sha!==this.head.sha)throw new ApiError('De collectie is intussen gewijzigd. Je werk blijft hier bewaard. Kies Vernieuwen om de actuele collectie te laden.',409);
    const uploaded=new Map();const photos=[];
    for(let index=0;index<record.photos.length;index++) {
      const photo={...record.photos[index]};
      if(!photo.blobSha){
        if(!photo.file)throw new ApiError('Deze foto is nog niet opgeslagen. Voeg de foto opnieuw toe.');
        onProgress(`Foto ${index+1} van ${record.photos.length} uploaden…`);
        if(!uploaded.has(photo.digest)){const bytes=new Uint8Array(await photo.file.arrayBuffer());const blob=await this.request(this.endpoint('git/blobs'),{method:'POST',body:{content:bytesBase64(bytes),encoding:'base64'}});uploaded.set(photo.digest,blob.sha);}
        photo.blobSha=uploaded.get(photo.digest);
      }
      photos.push(photo);
    }
    const now=new Date().toISOString();
    const saved={...cleanFields({...record,photos}),published:record.published?cleanFields(record.published):null,archived:!!record.archived,updatedAt:now};
    if(action==='publish'){saved.published=cleanFields(saved);saved.archived=false;}
    if(action==='archive')saved.archived=true;
    if(action==='restore')saved.archived=false;
    let exists=false;
    const vehicles=this.catalog.vehicles.map(item=>{
      if(item.id===record.id){exists=true;return saved;}
      return {...cleanFields(item),published:item.published?cleanFields(item.published):null,archived:!!item.archived,updatedAt:item.updatedAt};
    });
    if(!exists)vehicles.push(saved);
    const catalog={schemaVersion:1,revision:this.catalog.revision+1,updatedAt:now,vehicles};
    validateManagerCatalog(catalog);
    const published=publicCatalog(catalog,this.publicMode);
    const entries=new Map();
    for(const vehicle of vehicles)for(const source of [vehicle,vehicle.published].filter(Boolean))for(const photo of source.photos){entries.set(photo.path,{path:photo.path,mode:'100644',type:'blob',sha:photo.blobSha});}
    for(const vehicle of vehicles.filter(item=>item.published&&!item.archived))for(const photo of vehicle.published.photos){const path='public'+photoPublicPath(photo);entries.set(path,{path,mode:'100644',type:'blob',sha:photo.blobSha});}
    entries.set(MANAGER_PATH,{path:MANAGER_PATH,mode:'100644',type:'blob',content:JSON.stringify(catalog,null,2)+'\n'});
    entries.set(PUBLIC_PATH,{path:PUBLIC_PATH,mode:'100644',type:'blob',content:JSON.stringify(published,null,2)+'\n'});
    onProgress('Collectie veilig bewaren…');
    const tree=await this.request(this.endpoint('git/trees'),{method:'POST',body:{base_tree:this.head.tree,tree:[...entries.values()]}});
    const commit=await this.request(this.endpoint('git/commits'),{method:'POST',body:{message:`${action==='publish'?'Publish':action==='archive'?'Archive':'Save'} vehicle ${record.id} from site editor`,tree:tree.sha,parents:[this.head.sha]}});
    await this.request(this.endpoint(`git/refs/heads/${this.branch}`),{method:'PATCH',body:{sha:commit.sha,force:false}});
    this.catalog=catalog;this.head={sha:commit.sha,tree:tree.sha};this.publicMode=published.mode;
    return {record:saved,catalog,commit:commit.sha,publicCatalog:published};
  }
  async deployment(commit) {
    // Published repository: deployment metadata is public; no extra Actions scope is needed.
    const response=await this.fetcher(`https://api.github.com/repos/${this.repository}/actions/workflows/deploy-pages.yml/runs?head_sha=${commit}&per_page=5`,{credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',headers:{Accept:'application/vnd.github+json'}});
    if(!response.ok)return {state:'unknown'};
    const data=await response.json();const run=data.workflow_runs?.find(item=>item.head_sha===commit);
    if(!run)return {state:'queued'};
    return {state:run.status==='completed'?(run.conclusion==='success'?'live':'failed'):run.status,url:run.html_url};
  }
  async readFile(path) {
    if(!this.head)throw new ApiError('Verbind het beheer eerst.');
    const tree=await this.request(this.endpoint(`git/trees/${this.head.tree}?recursive=1`));
    if(tree.truncated)throw new ApiError('Het bestand kon niet veilig geladen worden.');
    const entry=tree.tree.find(item=>item.type==='blob'&&item.path===path);
    if(!entry)throw new ApiError('Het beheerbestand ontbreekt.');
    return JSON.parse(decodeContent(await this.request(this.endpoint(`git/blobs/${entry.sha}`))));
  }
  async saveFiles(files,message) {
    if(!this.head)throw new ApiError('Verbind het beheer eerst.');
    const ref=await this.request(this.endpoint(`git/ref/heads/${this.branch}`));
    if(ref.object.sha!==this.head.sha)throw new ApiError('De site is intussen gewijzigd. Je werk blijft in het formulier. Verbind opnieuw om de actuele versie te laden.',409);
    const entries=Object.entries(files).map(([path,data])=>({path,mode:'100644',type:'blob',content:JSON.stringify(data,null,2)+'\n'}));
    const tree=await this.request(this.endpoint('git/trees'),{method:'POST',body:{base_tree:this.head.tree,tree:entries}});
    const commit=await this.request(this.endpoint('git/commits'),{method:'POST',body:{message,tree:tree.sha,parents:[this.head.sha]}});
    await this.request(this.endpoint(`git/refs/heads/${this.branch}`),{method:'PATCH',body:{sha:commit.sha,force:false}});
    this.head={sha:commit.sha,tree:tree.sha};return commit.sha;
  }
}
