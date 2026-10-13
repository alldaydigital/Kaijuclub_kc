import '@fontsource/racing-sans-one/latin-400.css';
import '@fontsource/barlow-condensed/latin-800.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/inter/latin-400.css';
import {safeWebsite,validatePartner} from './partners-model.js';
import {siteText,onSiteContentChange} from './site-content.js';
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function partnerCard(item){
  validatePartner(item,true);const website=safeWebsite(item.website);
  return `<article class="partner-card"><div class="partner-logo">${item.logo?`<img src="${item.logo}" alt="Logo ${escape(item.name)}">`:`<span>${escape(item.name)}</span>`}</div><div class="partner-card-copy"><span class="eyebrow">${escape(siteText(item.kind==='sponsor'?'sponsor_badge':'partner_badge'))}</span><h3>${escape(item.name)}</h3><p>${escape(item.description)}</p>${website?`<a class="text-link" href="${escape(website)}" target="_blank" rel="noopener noreferrer">${escape(siteText('partner_website_cta',{name:item.name}))}</a>`:''}</div></article>`;
}
const grid=document.querySelector('#partner-grid');
let partners=[];
let collectionFailed=false;
function renderPartners(){
  if(!grid)return;
  const empty=document.querySelector('#partner-empty');
  grid.innerHTML=partners.map(partnerCard).join('');
  if(empty){
    empty.hidden=partners.length>0;
    let error=empty.querySelector('[data-partner-error]');
    if(collectionFailed&&!error){error=document.createElement('p');error.dataset.partnerError='';error.setAttribute('role','status');empty.append(error);}
    if(error){error.hidden=!collectionFailed;error.textContent=collectionFailed?siteText('partner_load_error',{email:siteText('contact_email')}):'';}
  }
}
if(grid){
  try{
    const response=await fetch(import.meta.env.BASE_URL+'data/partners.json',{cache:'no-cache',credentials:'omit',signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw new Error();
    const data=await response.json();
    if(data.schemaVersion!==1||!Array.isArray(data.partners))throw new Error();
    data.partners.forEach(item=>validatePartner(item,true));
    partners=data.partners;
  }catch{collectionFailed=true;}
  renderPartners();
  onSiteContentChange(renderPartners);
}
const menu=document.querySelector('.menu-toggle');const mobileNav=document.querySelector('#mobile-nav');
if(menu&&mobileNav){
  const setMenu=open=>{menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',siteText(open?'menu_close':'menu_open'));mobileNav.hidden=!open;};
  menu.addEventListener('click',()=>setMenu(menu.getAttribute('aria-expanded')!=='true'));
  mobileNav.addEventListener('click',event=>{if(event.target.closest('a'))setMenu(false);});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!mobileNav.hidden){setMenu(false);menu.focus();}});
  window.matchMedia('(min-width:1001px)').addEventListener('change',event=>{if(event.matches)setMenu(false);});
  onSiteContentChange(()=>menu.setAttribute('aria-label',siteText(mobileNav.hidden?'menu_open':'menu_close')));
}
const year=document.querySelector('#year');if(year)year.textContent=new Date().getFullYear();
