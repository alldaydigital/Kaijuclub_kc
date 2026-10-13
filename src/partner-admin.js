import {normalizeConnectionToken,checkGitHubConnection} from './admin-auth.js';
import {GitHubStore} from './admin-api.js';
import {hasVault,unlockConnection} from './admin-vault.js';
import {emptyPartners,validatePartners,updatePartner,publicPartners} from './partners-model.js';
import {partnerCard} from './partners.js';
if(window.top!==window.self)throw new Error('Open clubbeheer rechtstreeks.');
const $=selector=>document.querySelector(selector);
let store=null,catalog=emptyPartners(),current=null,busy=false,dirty=false,processing=false,watch=0,pendingAction=null;
const ids=['name','kind','description','website'];
function notice(message,error=false){$('#partner-notice').textContent=message;$('#partner-notice').dataset.state=error?'error':'success';}
function fields(){if(!current)return;for(const key of ids)current[key]=$('#partner-'+key).value;dirty=true;renderPreview();}
function renderPreview(){try{$('#partner-preview').innerHTML=partnerCard({...current,name:current.name.trim()||'Jouw partner'});}catch(error){$('#partner-preview').textContent=error.message;}}
function renderList(){const list=$('#partner-list');list.replaceChildren();if(!catalog.partners.length){const p=document.createElement('p');p.textContent='Voeg je eerste partner of sponsor toe.';list.append(p);}for(const item of catalog.partners){const button=document.createElement('button');button.type='button';button.classList.toggle('active',item.id===current?.id);const name=document.createElement('strong');name.textContent=item.name||'Naamloos concept';const status=document.createElement('small');status.textContent=item.archived?'Verborgen':item.published?'Gepubliceerd':'Concept';button.append(name,status);button.addEventListener('click',()=>select(item));list.append(button);}}
function select(item){if(busy||processing)return;if(dirty&&!confirm('Je wijzigingen zijn nog niet opgeslagen. Deze partner toch openen?'))return;current=structuredClone(item);for(const key of ids)$('#partner-'+key).value=current[key];$('#partner-logo').value='';dirty=false;notice('');renderPreview();renderList();}
function newPartner(){select({id:'partner-'+Date.now()+String(crypto.getRandomValues(new Uint32Array(1))[0]%100000),name:'',kind:'partner',description:'',website:'',logo:''});}
function lock(){watch++;store?.lock();store=null;$('#partner-connection-status').textContent='Vergrendeld';$('#partner-lock').hidden=true;$('#partner-connect').hidden=false;$('#partner-connect').textContent='Verbind beheer';}
function login(){if(busy||processing)return;$('#partner-login-error').textContent='';const remembered=hasVault();$('#partner-unlock-field').hidden=!remembered;$('#partner-token-field').hidden=remembered;$('#partner-use-token').hidden=!remembered;$('#partner-login').showModal();}
$('#partner-login-form').addEventListener('submit',async event=>{
 event.preventDefault();if(busy)return;busy=true;const button=event.submitter;button.disabled=true;let connected=false,candidate=null;
 try{
  const token=normalizeConnectionToken($('#partner-unlock-field').hidden?$('#partner-token').value:await unlockConnection($('#partner-password').value));
  candidate=new GitHubStore(token);const user=await candidate.connect();const data=validatePartners(await candidate.readFile('cms/partners.json'));
  if(dirty&&catalog.revision!==data.revision&&!confirm('De opgeslagen partners zijn gewijzigd. Je huidige formulier behouden en de nieuwe collectie laden?')){candidate.lock();return;}
  store?.lock();store=candidate;catalog=data;connected=true;
  $('#partner-connection-status').textContent='Verbonden als '+user.login;$('#partner-lock').hidden=false;$('#partner-connect').hidden=false;$('#partner-connect').textContent='Koppeling';$('#partner-login').close();
  renderList();if(!dirty&&catalog.partners.length){busy=false;select(catalog.partners.find(item=>item.id===current?.id)||catalog.partners[0]);}
 }catch(error){if(!connected)candidate?.lock();$('#partner-login-error').textContent=error.message;}
 finally{busy=false;button.disabled=false;$('#partner-token').value='';$('#partner-password').value='';}
 if(connected&&pendingAction){const action=pendingAction;pendingAction=null;await save(action);}
});
$('#partner-use-token').addEventListener('click',()=>{$('#partner-unlock-field').hidden=true;$('#partner-token-field').hidden=false;$('#partner-use-token').hidden=true;});
$('#partner-login').addEventListener('cancel',()=>{pendingAction=null;});
$('#partner-login').addEventListener('close',()=>{if(!store)pendingAction=null;$('#partner-token').value='';$('#partner-password').value='';});
$('#partner-connect').addEventListener('click',login);$('#partner-lock').addEventListener('click',lock);$('#add-partner').addEventListener('click',newPartner);
for(const key of ids)$('#partner-'+key).addEventListener('input',fields);
$('#remove-logo').addEventListener('click',()=>{if(busy||processing)return;current.logo='';dirty=true;$('#partner-logo').value='';renderPreview();});
$('#partner-logo').addEventListener('change',async event=>{
  const file=event.target.files[0];if(!file)return;if(busy||processing)return;processing=true;
  try{if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10*1024*1024)throw new Error('Kies PNG, JPEG of WebP van maximaal 10 MB.');const bitmap=await createImageBitmap(file);if(bitmap.width*bitmap.height>40000000){bitmap.close();throw new Error('Dit logo is te groot. Kies een versie onder 40 megapixels.');}const ratio=Math.min(1,900/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();const logo=canvas.toDataURL('image/webp',.9);if(logo.length>700000)throw new Error('Dit logo blijft te groot. Kies een eenvoudiger of kleiner bestand.');current.logo=logo;dirty=true;renderPreview();notice('Logo klaar. Bewaar of publiceer om het op te slaan.');}catch(error){notice(error.message,true);}finally{processing=false;event.target.value='';}
});
async function save(action){
  if(busy||processing){notice('Wacht tot de huidige actie klaar is.',true);return;}fields();if(action==='publish'&&!$('#partner-editor').reportValidity())return;if(!store){pendingAction=action;login();notice('Verbind het beheer; daarna wordt deze wijziging opgeslagen.',true);return;}if(action==='archive'&&!current.published){notice('Deze partner staat nog niet op de site.',true);return;}if(action==='archive'&&!confirm('Deze partner verbergen op de website?'))return;
  busy=true;watch++;const buttons=$('#partner-editor').querySelectorAll('button,input,select,textarea');for(const element of buttons)element.disabled=true;
  try{const next=updatePartner(catalog,current,action);notice('Partner veilig bewaren…');const commit=await store.saveFiles({'cms/partners.json':next,'public/data/partners.json':publicPartners(next)},`${action==='publish'?'Publish':action==='archive'?'Archive':'Save'} partner ${current.id} from site editor`);catalog=next;current=structuredClone(next.partners.find(item=>item.id===current.id));dirty=false;renderList();notice(action==='draft'?'Concept opgeslagen in GitHub. De gepubliceerde kaart blijft zoals ze was.':'Opgeslagen in GitHub. De website wordt bijgewerkt…');if(action!=='draft')trackDeployment(commit,watch);}catch(error){notice(error.message,true);}finally{busy=false;for(const element of buttons)element.disabled=false;}
}
async function trackDeployment(commit,version){for(let attempt=0;attempt<16;attempt++){await new Promise(resolve=>setTimeout(resolve,15000));if(version!==watch||!store)return;try{const result=await store.deployment(commit);if(version!==watch)return;if(result.state==='live'){notice('De wijziging is gepubliceerd op de website.');return;}if(result.state==='failed'){notice('Opgeslagen, maar de publicatie is mislukt. Controleer de GitHub-publicatie voordat je opnieuw publiceert.',true);return;}}catch{}}if(version===watch)notice('Opgeslagen in GitHub. De live publicatie kon nog niet bevestigd worden.');}
$('#partner-editor').addEventListener('submit',event=>{event.preventDefault();save('publish');});$('#partner-draft').addEventListener('click',()=>save('draft'));$('#partner-archive').addEventListener('click',()=>save('archive'));
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
let idle=setTimeout(lock,1800000);for(const event of ['pointerdown','keydown'])document.addEventListener(event,()=>{clearTimeout(idle);idle=setTimeout(lock,1800000);});
newPartner();

$('#check-github-connection').addEventListener('click',async event=>{const button=event.currentTarget;button.disabled=true;$('#github-connection-result').textContent='Verbinding controleren…';const result=await checkGitHubConnection();$('#github-connection-result').textContent=result.message;button.disabled=false;});
