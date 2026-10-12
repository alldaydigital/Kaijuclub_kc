import '@fontsource/racing-sans-one/latin-400.css';
import '@fontsource/barlow-condensed/latin-800.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/inter/latin-400.css';
import {safeWebsite,validatePartner} from './partners-model.js';
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function partnerCard(item){
  validatePartner(item,true);const website=safeWebsite(item.website);
  return `<article class="partner-card"><div class="partner-logo">${item.logo?`<img src="${item.logo}" alt="Logo ${escape(item.name)}">`:`<span>${escape(item.name)}</span>`}</div><div class="partner-card-copy"><span class="eyebrow">${item.kind==='sponsor'?'SPONSOR':'PARTNER'}</span><h3>${escape(item.name)}</h3><p>${escape(item.description)}</p>${website?`<a class="text-link" href="${escape(website)}" target="_blank" rel="noopener noreferrer">WEBSITE VAN ${escape(item.name)} ↗</a>`:''}</div></article>`;
}
const grid=document.querySelector('#partner-grid');
if(grid){try{const response=await fetch(import.meta.env.BASE_URL+'data/partners.json',{cache:'no-cache',signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error();const data=await response.json();if(data.schemaVersion!==1||!Array.isArray(data.partners))throw new Error();if(data.partners.length){grid.innerHTML=data.partners.map(partnerCard).join('');document.querySelector('#partner-empty').hidden=true;}}catch{document.querySelector('#partner-empty').textContent='De partnercollectie is tijdelijk niet beschikbaar. Voor samenwerkingen: kaijuclub.be@gmail.com.';}}
const menu=document.querySelector('.menu-toggle');const mobileNav=document.querySelector('#mobile-nav');
if(menu&&mobileNav){
  const setMenu=open=>{menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Menu sluiten':'Menu openen');mobileNav.hidden=!open;};
  menu.addEventListener('click',()=>setMenu(menu.getAttribute('aria-expanded')!=='true'));
  mobileNav.addEventListener('click',event=>{if(event.target.closest('a'))setMenu(false);});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!mobileNav.hidden){setMenu(false);menu.focus();}});
  window.matchMedia('(min-width:1001px)').addEventListener('change',event=>{if(event.matches)setMenu(false);});
}
const year=document.querySelector('#year');if(year)year.textContent=new Date().getFullYear();
