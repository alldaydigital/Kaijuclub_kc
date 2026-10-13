import '@fontsource/racing-sans-one/400.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow-condensed/800.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/800.css';
import {validateEvent,validatePublicAgenda,splitAgenda,brusselsToday} from './agenda-model.js';
import {agendaCard,agendaMonth} from './agenda-render.js';
import {siteText,onSiteContentChange} from './site-content.js';
const $=selector=>document.querySelector(selector),base=import.meta.env.BASE_URL,params=new URLSearchParams(location.search),nonce=params.get('nonce');
const preview=params.get('preview')==='agenda'&&window.parent!==window&&/^[a-f0-9]{48}$/.test(nonce||'');
let events=[],period='upcoming',loadFailed=false,previewEvent=null,lastDay=brusselsToday();
function render(){
 if(preview){$('#agenda-list').innerHTML=previewEvent?agendaCard(previewEvent,{text:siteText,preview:true}):'';return;}
 const groups=splitAgenda(events),shown=groups[period],list=$('#agenda-list');list.replaceChildren();let month=null;
 for(const event of shown){const key=event.date.slice(0,7);if(month!==key){month=key;const heading=document.createElement('h3');heading.className='agenda-month';heading.textContent=agendaMonth(event.date);list.append(heading);}const holder=document.createElement('div');holder.innerHTML=agendaCard(event,{text:siteText});list.append(holder.firstElementChild);}
 $('#agenda-empty').hidden=shown.length>0;$('#agenda-empty-copy').textContent=siteText(period==='past'?'agenda_past_empty':'agenda_empty_copy');$('#agenda-count').textContent=String(shown.length).padStart(2,'0')+' / '+(period==='past'?'PAST STOPS':'NEXT STOPS');$('#agenda-results').textContent=shown.length+' events weergegeven';
 for(const button of document.querySelectorAll('[data-agenda-period]')){const active=button.dataset.agendaPeriod===period;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}
 $('#agenda-error').hidden=!loadFailed;if(loadFailed)$('#agenda-error').textContent=siteText('agenda_error');
}
function accept(data){events=structuredClone(validatePublicAgenda(data).events);loadFailed=false;render();}
$('.agenda-tabs').addEventListener('click',event=>{const button=event.target.closest('[data-agenda-period]');if(button){period=button.dataset.agendaPeriod;render();}});
const menu=$('.menu-toggle'),nav=$('#mobile-nav');const setMenu=open=>{menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',siteText(open?'menu_close':'menu_open'));nav.hidden=!open;};menu.addEventListener('click',()=>setMenu(menu.getAttribute('aria-expanded')!=='true'));nav.addEventListener('click',event=>{if(event.target.closest('a'))setMenu(false);});document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!nav.hidden){setMenu(false);menu.focus();}});matchMedia('(min-width:1001px)').addEventListener('change',event=>{if(event.matches)setMenu(false);});$('#year').textContent=new Date().getFullYear();
onSiteContentChange(render);
if(preview){document.body.classList.add('agenda-preview');window.addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==window.parent||event.data?.nonce!==nonce||event.data?.type!=='kaiju:agenda-preview')return;try{previewEvent=structuredClone(validateEvent(event.data.event));render();window.parent.postMessage({type:'kaiju:agenda-rendered',nonce},location.origin);}catch{window.parent.postMessage({type:'kaiju:agenda-preview-error',nonce},location.origin);}});window.parent.postMessage({type:'kaiju:agenda-preview-ready',nonce},location.origin);}
else{
 if(typeof __INITIAL_AGENDA__!=='undefined')accept(__INITIAL_AGENDA__);
 void fetch(base+'data/agenda.json',{cache:'no-cache',credentials:'omit',signal:AbortSignal.timeout(10000)}).then(response=>{if(!response.ok)throw new Error();return response.json();}).then(accept).catch(()=>{loadFailed=true;render();});
 const checkDay=()=>{const today=brusselsToday();if(today!==lastDay){lastDay=today;render();}};setInterval(checkDay,30000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkDay();});
}
