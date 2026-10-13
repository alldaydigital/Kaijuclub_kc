import { CONTENT_GROUPS, defaultSiteContent, validateContent } from './site-model.js';
import { formatSiteText, renderSiteText, siteAssetURL, siteLinkURL, hiddenSiteAnchor, themeCSS, sharedSiteCSS } from './site-render.js';

const base = import.meta.env?.BASE_URL || '/';
const hasDOM = typeof document !== 'undefined' && typeof window !== 'undefined';
const publicPage = hasDOM && Boolean(document.querySelector('main .hero[data-cms-group],main .partner-intro[data-cms-group],main.events-archive[data-cms-group],main.agenda-page[data-cms-group]'));
const page = publicPage && document.querySelector('main.agenda-page')?'agenda':publicPage && document.querySelector('main.events-archive')?'events':publicPage && document.querySelector('main .partner-intro') ? 'partners' : 'home';
const query = hasDOM ? new URLSearchParams(location.search) : new URLSearchParams();
const nonce = query.get('nonce') || '';
export const isSitePreview = Boolean(publicPage && window.parent !== window && query.get('preview') === 'site' && /^[a-f0-9]{16,128}$/i.test(nonce));
const initial = typeof __SITE_CONTENT__ !== 'undefined' ? (__SITE_CONTENT__.content || __SITE_CONTENT__) : defaultSiteContent;
let current = structuredClone(validateContent(initial)), fingerprint = JSON.stringify(current);
const listeners = new Set();
let selectedGroup = null;

export function siteText(key, values = {}) { return formatSiteText(current,key,values); }
export function siteImage(key) {
  const image = current[key];
  if (!image || typeof image !== 'object' || typeof image.src !== 'string') return null;
  return {...image,src:siteAssetURL(image.src,base)};
}
export function applySiteImage(element, key) {
  const image=siteImage(key);
  if(!element||!image)return;
  element.src=image.src;element.alt=image.alt;element.width=image.width;element.height=image.height;
  element.style.setProperty('--cms-image-desktop',image.positionDesktop);
  element.style.setProperty('--cms-image-mobile',image.positionMobile);
  element.setAttribute('data-cms-dynamic-image','');
  element.dataset.cmsImage=key;
  const parent=element.parentElement;
  if(!parent)return;
  let credit=[...parent.children].find(child=>child.classList?.contains('cms-photo-credit'));
  if(!image.credit){credit?.remove();return;}
  if(!credit){credit=document.createElement('span');credit.className='cms-photo-credit';parent.append(credit);}
  credit.dataset.cmsCreditKey=key;credit.textContent=image.credit;
}
export function onSiteContentChange(callback) {
  if(typeof callback!=='function')throw new TypeError('Een websitecallback moet een functie zijn.');
  listeners.add(callback);callback(current);
  return ()=>listeners.delete(callback);
}

function boundaryText(element, rendered) {
  const original=element.textContent||'';
  return (rendered.match(/^\s/)?'':original.match(/^\s+/)?.[0]||'')+rendered+(rendered.match(/\s$/)?'':original.match(/\s+$/)?.[0]||'');
}
function previewStatus() {
  if(!isSitePreview)return;
  for(const form of document.querySelectorAll('.request-form')) {
    for(const button of form.querySelectorAll('[type=submit]')) {button.disabled=true;button.setAttribute('aria-disabled','true');}
    const status=form.querySelector('.form-status');
    if(status)status.textContent=siteText('request_preview');
  }
}
function refreshAnchorVisibility() {
  for(const anchor of document.querySelectorAll('a[href]')) {
    const hidden=hiddenSiteAnchor(anchor.getAttribute('href'),current,{base,page,origin:location.origin});
    if(anchor.classList.contains('skip-link')) {
      if(!anchor.dataset.cmsSkipTarget)anchor.dataset.cmsSkipTarget=anchor.getAttribute('href');
      const target=anchor.dataset.cmsSkipTarget;
      anchor.setAttribute('href',hiddenSiteAnchor(target,current,{base,page,origin:location.origin})?'#top':target);
    } else anchor.toggleAttribute('data-cms-hidden',hidden);
  }
}
function applyDOM() {
  if(!publicPage)return;
  for(const element of document.querySelectorAll('[data-cms-text]')) {
    const value=siteText(element.dataset.cmsText);
    if(element.tagName==='TITLE')element.textContent=value.replace(/\n/g,' ');
    else element.innerHTML=boundaryText(element,renderSiteText(value,element.dataset.cmsAccent));
  }
  for(const element of document.querySelectorAll('[data-cms-meta]'))element.setAttribute('content',siteText(element.dataset.cmsMeta));
  for(const element of document.querySelectorAll('[data-cms-placeholder]'))element.setAttribute('placeholder',siteText(element.dataset.cmsPlaceholder));
  for(const element of document.querySelectorAll('[data-cms-link]')) {
    const link=siteLinkURL(current[element.dataset.cmsLink],{base,page});element.setAttribute('href',link);
    element.toggleAttribute('data-cms-hidden',hiddenSiteAnchor(link,current,{base,page,origin:location.origin}));
    if(/^(https:|mailto:|tel:)/.test(link))element.setAttribute('rel','noopener noreferrer');
  }
  for(const element of document.querySelectorAll('[data-cms-email]')) {element.setAttribute('href','mailto:'+current.contact_email);element.textContent=current.contact_email;}
  for(const element of document.querySelectorAll('[data-cms-image]'))applySiteImage(element,element.dataset.cmsImage);
  for(const element of document.querySelectorAll('[data-cms-group]'))element.toggleAttribute('data-cms-hidden',current['visible_'+element.dataset.cmsGroup]===false);
  const main=document.querySelector('main'),sections=new Map([...document.querySelectorAll('[data-cms-section]')].map(element=>[element.dataset.cmsSection,element]));
  if(main&&sections.size)for(const id of current.home_order){const element=sections.get(id);if(element&&element.parentElement===main)main.append(element);}
  let style=document.querySelector('#kaiju-site-theme');
  if(!style){style=document.createElement('style');style.id='kaiju-site-theme';document.head.append(style);}
  style.textContent=themeCSS(current)+sharedSiteCSS;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',current.theme_ink);
  for(const brand of document.querySelectorAll('a.wordmark'))brand.setAttribute('aria-label',current.brand_name+' home');
  const menu=document.querySelector('.menu-toggle');
  if(menu)menu.setAttribute('aria-label',siteText(menu.getAttribute('aria-expanded')==='true'?'menu_close':'menu_open'));
  let socialImage=document.querySelector('meta[property="og:image"]');
  if(!socialImage){socialImage=document.createElement('meta');socialImage.setAttribute('property','og:image');document.head.append(socialImage);}
  const hero=siteImage('hero_image_1');
  if(hero&&!hero.src.startsWith('data:'))socialImage.setAttribute('content',new URL(hero.src,location.origin).href);
  previewStatus();
  refreshAnchorVisibility();
  markSelectedGroup(false);
}
function acceptContent(content,{preview=false}={}) {
  validateContent(content,{preview});
  const nextFingerprint=JSON.stringify(content);
  if(nextFingerprint===fingerprint)return false;
  current=structuredClone(content);fingerprint=nextFingerprint;
  applyDOM();
  for(const callback of listeners)callback(current);
  previewStatus();
  refreshAnchorVisibility();
  return true;
}
function groupElement(id) {
  const exact=[...document.querySelectorAll('[data-cms-group]')].find(element=>element.dataset.cmsGroup===id);
  if(exact)return exact;
  const group=CONTENT_GROUPS.find(item=>item.id===id);
  if(!group)return null;
  if(group.selector==='head')return document.querySelector('.header');
  if(group.selector==='body')return document.querySelector('main');
  return document.querySelector(group.selector);
}
function markSelectedGroup(scroll) {
  if(!isSitePreview)return;
  for(const element of document.querySelectorAll('[data-cms-selected]'))element.removeAttribute('data-cms-selected');
  const element=selectedGroup&&groupElement(selectedGroup);
  if(!element)return;
  element.setAttribute('data-cms-selected','');
  if(scroll&&!element.hasAttribute('data-cms-hidden')&&element.getClientRects().length)element.scrollIntoView({block:'start',behavior:'instant'});
}

if(publicPage) {
  applyDOM();
  if(isSitePreview) {
    document.documentElement.setAttribute('data-cms-preview','');
    // Event origin, source and the per-editor nonce must all match.
    window.addEventListener('message',event=>{
      if(event.origin!==location.origin||event.source!==window.parent||event.data?.nonce!==nonce||event.data?.type!=='kaiju:site-preview')return;
      const previousScroll={x:window.scrollX,y:window.scrollY};
      try {
        acceptContent(event.data.content,{preview:true});
        if(typeof event.data.selectionGroup==='string'&&CONTENT_GROUPS.some(group=>group.id===event.data.selectionGroup)) {selectedGroup=event.data.selectionGroup;markSelectedGroup(true);}
        else window.scrollTo(previousScroll.x,previousScroll.y);
      } catch {window.parent.postMessage({type:'kaiju:site-preview-error',nonce},location.origin);}
    });
    document.addEventListener('submit',event=>{event.preventDefault();event.stopImmediatePropagation();previewStatus();},true);
    document.addEventListener('click',event=>{
      const anchor=event.target.closest?.('a');
      if(anchor)event.preventDefault();
      const fieldElement=event.target.closest?.('[data-cms-text],[data-cms-image],[data-cms-placeholder],[data-cms-link],[data-cms-email],[data-cms-credit-key]');
      const fieldKey=fieldElement&&(fieldElement.dataset.cmsText||fieldElement.dataset.cmsImage||fieldElement.dataset.cmsPlaceholder||fieldElement.dataset.cmsLink||fieldElement.dataset.cmsCreditKey||(fieldElement.hasAttribute('data-cms-email')?'contact_email':undefined));
      const owner=fieldKey&&CONTENT_GROUPS.find(group=>group.fields.some(field=>field.key===fieldKey));
      const element=event.target.closest?.('[data-cms-group]');
      if(!element)return;
      const groupId=owner?.id||element.dataset.cmsGroup;
      if(!CONTENT_GROUPS.some(group=>group.id===groupId))return;
      selectedGroup=groupId;markSelectedGroup(false);
      window.parent.postMessage({type:'kaiju:site-select',nonce,groupId,...(fieldKey?{fieldKey}:{})},location.origin);
    },true);
    window.parent.postMessage({type:'kaiju:site-preview-ready',nonce},location.origin);
  } else if(!globalThis.__KAIJU_OFFLINE__) {
    void fetch(base+'data/site.json',{cache:'no-cache',credentials:'omit',signal:AbortSignal.timeout(10000)})
      .then(response=>{if(!response.ok)throw new Error();return response.json();})
      .then(snapshot=>{if(snapshot?.schemaVersion!==1||!Number.isInteger(snapshot.revision)||snapshot.revision<0)throw new Error();acceptContent(snapshot.content);})
      .catch(()=>{}); // The compiled published snapshot keeps the website available.
  }
}
