import '@fontsource/racing-sans-one/400.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow-condensed/800.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/800.css';
import {siteText,siteImage,applySiteImage,onSiteContentChange,isSitePreview} from './site-content.js';

const imageUrl = path => globalThis.__KAIJU_OFFLINE_ASSETS__?.[path] || (path.startsWith('/') && !path.startsWith(import.meta.env.BASE_URL) ? import.meta.env.BASE_URL + path.slice(1) : path);
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const arrow = '<svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14"/></svg>';

// Editorial references. Replace with confirmed club vehicles and owner-approved material.
const referenceBuilds = [
  {id:'skyline-r34',number:'01',name:'Nissan Skyline',series:'R34',origin:'Japan',category:'street',model:'R34 / JAPANESE PERFORMANCE',image:'/images/skyline.jpg',position:'50% 85%',width:5098,height:2872,alt:'Twee blauwe Nissan Skyline R34 wagens met Mount Fuji op de achtergrond',credit:'Melih Karaahmet / Unsplash',title:'Een silhouet dat je bijblijft.',intro:'Er zijn wagens waar je blik vanzelf op terugkomt. De herkenbare lijnen van de R34 vertellen precies waarom.',paragraphs:['De verhoudingen, het profiel en de aanwezigheid. De Skyline is hier een visuele referentie voor het gevoel dat een zorgvuldig gekozen wagen kan oproepen.','Binnen de streetcultuur draait een wagen niet alleen om een bestemming. Het gaat ook om de rit, het uitzicht en het moment dat je deelt.'],focus:['Herkenbare Japanse lijnen','Een uitgesproken eigen karakter','Het gevoel van de rit'],teaser:'Japanse lijnen. Een blijvende indruk. Ontdek deze referentie van dichtbij.'},
  {id:'porsche-993',number:'02',name:'Porsche 911',series:'993',origin:'Duitsland',category:'stance',model:'993 / THE PERFECT SILHOUETTE',image:'/images/porsche-993.jpg',position:'50% 58%',width:5000,height:5000,alt:'Zilveren Porsche 993 in een garage met blauw en rood licht',credit:'Yrka Pictured / Unsplash',title:'Alles begint bij verhouding.',intro:'Sommige lijnen hebben niets extra nodig om indruk te maken. Toch maakt de manier waarop je kijkt telkens het verschil.',paragraphs:['De 993 staat hier als referentie voor balans en proportie. Van de lijn van het koetswerk tot de manier waarop de wagen in zijn omgeving staat.','Stance is een perspectief dat aandacht vraagt. Details die je soms pas ziet als je even blijft staan, en een geheel dat alleen klopt als die details samenkomen.'],focus:['Balans en proportie','Aandacht voor het silhouet','Details die samen één geheel vormen'],teaser:'Tijdloze lijnen, aandacht voor proportie en een eigen perspectief.'},
  {id:'porsche-track',number:'03',name:'Porsche 911',series:'Classic',origin:'Duitsland',category:'track',model:'CLASSIC / CHASING THE APEX',image:'/images/porsche-track.jpg',position:'50% 62%',width:3263,height:3263,alt:'Blauwe klassieke Porsche racewagen in beweging op het circuit',credit:'Paul Jespers / Unsplash',title:'De aandacht wordt focus.',intro:'Op snelheid verandert je perspectief. Wat je stilstaand bewondert, krijgt betekenis in beweging.',paragraphs:['Deze klassieke Porsche is een fotografische referentie voor de trackkant van automotive cultuur. Voor de lijn door een bocht en het moment waarop alles samenkomt.','Een circuitwagen laat zien hoe vorm en functie elkaar kunnen versterken. Een ander soort aandacht, met dezelfde passie voor de machine.'],focus:['Een machine in beweging','Vorm en functie','Focus op de lijn'],teaser:'Vorm, functie en het moment waarop de lijn samenkomt.'},
  {id:'nissan-370z',number:'04',name:'Nissan 370Z',series:'Z34',origin:'Japan',category:'drift',model:'Z34 / THE SIDEWAYS PERSPECTIVE',image:'/images/hero.jpg',position:'50% 60%',width:5472,height:3648,alt:'Donkere Nissan 370Z met brandende achterlichten, gefotografeerd van achteren',credit:'Albin Berlin / Pexels',title:'Een ander perspectief op beweging.',intro:'Een uitgesproken silhouet. Een aanwezigheid die je ook in het donker herkent. Deze referentie vangt de energie van Japanse performance.',paragraphs:['De 370Z staat in deze voorbeeldcollectie voor de driftkant van onze visuele wereld. Niet als bevestigde driftbuild, maar als referentie voor karakter, beweging en expressie.','Drift is een discipline waarin een wagen vanuit een heel andere hoek tot leven komt. Het is die eigen kijk op automotive cultuur die deze collectie samenbrengt.'],focus:['Japanse sportwagenenergie','Karakter en expressie','Een eigen lijn in beweging'],teaser:'Japanse performance, karakter en een eigen kijk op beweging.'},
].map(car=>({...car,reference:true,gallery:[{src:car.image,alt:car.alt,width:car.width,height:car.height}],specs:[]}));
let builds = referenceBuilds;
let collectionMode = 'reference';
let selectedPhoto = 0;
let appliedCollection = '';
const previewParameters=new URLSearchParams(location.search);
const previewNonce=previewParameters.get('nonce');
const isAdminPreview=previewParameters.get('preview')==='beheer'&&window.parent!==window&&!!previewNonce;
if(isAdminPreview)document.body.classList.add('admin-preview','preview-waiting');
const disciplines = {drift:true,stance:true,track:true,street:true};
const stories = {
  attention:{image:'/images/culture.jpg',alt:'Regendruppels op het koetswerk van een klassieke Porsche',frame:'KC / THE DETAILS',caption:'HET VERSCHIL ZIT IN WAT JE ZIET.',counter:'01 / 03'},
  character:{image:'/images/porsche-993.jpg',alt:'Zilveren Porsche 993 in rood en blauw licht',frame:'KC / THE CHARACTER',caption:'JE HERKENT KARAKTER VANZELF.',counter:'02 / 03'},
  passion:{image:'/images/porsche-duo.jpg',alt:'Twee klassieke Porsche wagens op het circuit',frame:'KC / SHARED PASSION',caption:'DE WAGENS BRENGEN ONS SAMEN.',counter:'03 / 03'},
};
const notes = {
  details:{number:'01',title:'Het zit in de details.',kicker:'THE DETAILS',image:'/images/culture.jpg',alt:'Regendruppels op het koetswerk van een klassieke Porsche',credit:'Alexander / Unsplash',category:'stance',lead:'Je ziet een wagen. En dan zie je iets dat je laat blijven kijken.',paragraphs:['Een lijn die het licht anders vangt. De overgang tussen twee vormen. De manier waarop een geheel tot rust komt. Kwaliteit hoeft niet luid te zijn om je aandacht vast te houden.','Voor ons hoort die aandacht bij automotive cultuur. Juist in de kleine keuzes krijgt een wagen zijn eigen karakter. Het is geen lijstje met onderdelen, maar het gevoel dat ontstaat wanneer het geheel klopt.','Misschien merk je dat bij je eigen wagen. Of bij een build waar je onverwacht voor stil blijft staan. Dat is het perspectief dat we hier willen delen.']},
  perspective:{number:'02',title:'Nog één keer kijken.',kicker:'THE PERSPECTIVE',image:'/images/porsche-993.jpg',alt:'Klassieke Porsche 993 met blauwe en rode garageverlichting',credit:'Yrka Pictured / Unsplash',category:'street',lead:'Dezelfde wagen. Een ander licht. Een detail dat je eerder niet zag.',paragraphs:['De manier waarop je naar een wagen kijkt, verandert wat je ziet. Een silhouet kan vertrouwd zijn en toch iets nieuws laten zien zodra het licht of je positie verandert.','Dat maakt automotive fotografie meer dan een beeld van een object. Ze kan je even laten kijken zoals iemand anders kijkt: met aandacht, met nieuwsgierigheid, met een eigen obsessie.','Neem die tijd. Bekijk de lijnen. Kijk nog eens. Het is vaak precies dat kleine moment dat een wagen je bijblijft.']},
  together:{number:'03',title:'Dezelfde taal.',kicker:'THE CONNECTION',image:'/images/porsche-duo.jpg',alt:'Twee klassieke Porsche wagens samen op het circuit',credit:'Nika Qufarashvili / Unsplash',category:'track',lead:'Niet dezelfde wagen. Wel hetzelfde gevoel.',paragraphs:['Automotive cultuur brengt verschillende perspectieven samen. De één ziet een perfecte fitment. Een ander denkt aan de volgende bocht. Weer iemand anders kiest gewoon de lange weg naar huis.','Bij Kaijuclub komen drift, stance, track en street samen. Vier disciplines met een eigen karakter, verbonden door aandacht voor kwalitatieve wagens.','Je hoeft geen identieke smaak te hebben om die passie te herkennen. Misschien herken je jezelf in één discipline. Misschien in allemaal. Dat gesprek begint bij de manier waarop je kijkt.']},
};

const cars = document.querySelector('#cars');
const dialog = document.querySelector('#car-dialog');
const noteDialog = document.querySelector('#note-dialog');
const menuButton = document.querySelector('.menu-toggle');
const mobileNav = document.querySelector('#mobile-nav');
let activeCar;
let activeNote;
let activeFilter='all';
let activeStory='attention';
let carFocus;
let noteFocus;
let carReturnHash = '#garage';
let noteReturnHash = '#journal';

function render(filter = 'all') {
  const shown = builds.filter(car => filter === 'all' || car.category === filter);
  cars.classList.toggle('filtered', filter !== 'all');
  cars.innerHTML = shown.map((car,index) => `
    <button class="car-card ${filter==='all'&&index===0?'car-card-featured':''}" data-car="${car.id}" aria-label="${escapeHtml(siteText('ui_carAria',{name:car.name,series:car.series,category:car.category,kind:siteText(car.reference?'ui_referenceKind':'ui_clubKind')}))}">
      <div class="car-photo"><img src="${imageUrl(car.image)}" alt="${escapeHtml(car.alt)}" width="${car.width}" height="${car.height}" loading="lazy" style="object-position:${car.position}"><span class="car-category">${car.category.toUpperCase()}</span><span class="car-open">${arrow}</span></div>
      <div class="car-info"><div class="car-meta"><small>${escapeHtml(car.model)}</small><span class="car-number">/${car.number}</span></div><h3>${escapeHtml(car.name)}</h3><p class="car-teaser">${escapeHtml(car.teaser)}</p><div class="car-bottom"><span>${escapeHtml(car.series||car.category)}${car.origin?' / '+escapeHtml(car.origin):''}</span><span>${escapeHtml(siteText('garage_card_cta'))} ${arrow}</span></div></div>
    </button>`).join('');
  if(!shown.length)cars.innerHTML='<div class="empty-collection">'+escapeHtml(siteText(builds.length?'garage_empty_filter':'garage_empty_all'))+'</div>';
  document.querySelector('[data-filter="all"] [data-garage-count], [data-filter="all"] > span:last-child').textContent=String(builds.length).padStart(2,'0');
  document.querySelector('#result-count').textContent = siteText('garage_results',{number:shown.length});
  document.querySelector('#collection-status').textContent = `${String(shown.length).padStart(2,'0')} / ${siteText(collectionMode==='managed'?'garage_status_live':'garage_status_reference')}`;
}
function setFilter(filter) {
  activeFilter=filter;
  for (const button of document.querySelectorAll('[data-filter]')) {
    button.classList.toggle('active', button.dataset.filter === filter);
    button.setAttribute('aria-pressed', String(button.dataset.filter === filter));
  }
  render(filter);
}
for (const button of document.querySelectorAll('[data-filter]')) button.addEventListener('click',()=>setFilter(button.dataset.filter));

function updateScrollLock() { document.body.classList.toggle('dialog-open',dialog.open||noteDialog.open); }
function renderCar(car,focusControl) {
  const index = builds.indexOf(car);
  selectedPhoto=0;
  document.querySelector('#car-detail').innerHTML = `
    <div class="dossier-top"><span>${escapeHtml(siteText('garage_dossier_label'))}</span><span>${car.number} / ${String(builds.length).padStart(2,'0')}</span></div>
    <div class="dossier-layout"><figure class="dossier-visual"><img class="detail-image" src="${imageUrl(car.image)}" alt="${escapeHtml(car.alt)}" width="${car.width}" height="${car.height}" style="object-position:${car.position}"><figcaption>${escapeHtml(car.credit||siteText('ui_photoCreditFallback'))} <span>${escapeHtml(siteText(car.reference?'garage_reference_label':'garage_live_label'))}</span></figcaption>${car.gallery?.length>1?`<div class="dossier-gallery" role="group" aria-label="${escapeHtml(siteText('ui_galleryAria'))}">${car.gallery.map((photo,i)=>`<button data-gallery-index="${i}" aria-label="${escapeHtml(siteText('ui_photoAria',{number:i+1,total:car.gallery.length}))}" aria-pressed="${i===0}"><img src="${imageUrl(photo.src)}" alt="" width="${photo.width}" height="${photo.height}"></button>`).join('')}</div>`:''}</figure><div class="detail-copy"><span class="eyebrow">${car.category.toUpperCase()} / ${escapeHtml(siteText(car.reference?'garage_status_reference':'garage_live_label'))}</span><h2 id="detail-title">${escapeHtml(car.name)}</h2><dl class="build-facts">${car.series?`<div><dt>${escapeHtml(siteText('garage_series_label'))}</dt><dd>${escapeHtml(car.series)}</dd></div>`:''}${car.origin?`<div><dt>${escapeHtml(siteText('garage_origin_label'))}</dt><dd>${escapeHtml(car.origin)}</dd></div>`:''}<div><dt>${escapeHtml(siteText('garage_category_label'))}</dt><dd>${car.category}</dd></div></dl>${car.title!==car.name?`<h3>${escapeHtml(car.title)}</h3>`:''}${car.intro?`<p class="dossier-lead">${escapeHtml(car.intro)}</p>`:''}${car.paragraphs.map(text=>`<p>${escapeHtml(text)}</p>`).join('')}${car.specs?.length?`<dl class="vehicle-specs">${car.specs.map(spec=>`<div><dt>${escapeHtml(spec.label)}</dt><dd>${escapeHtml(spec.value)}</dd></div>`).join('')}</dl>`:''}${car.focus.length?`<div class="build-focus"><span class="eyebrow">${escapeHtml(siteText('garage_focus_label'))}</span><ul>${car.focus.map(text=>`<li>${escapeHtml(text)}</li>`).join('')}</ul></div>`:''}${car.reference?`<p class="disclaimer">${escapeHtml(siteText('garage_reference_disclaimer'))}</p>`:''}<div class="share-area"><button class="text-link" data-share-build="${car.id}">${escapeHtml(siteText('garage_share_label'))} ${arrow}</button><span class="share-status" aria-live="polite"></span><input class="share-fallback" aria-label="${escapeHtml(siteText('ui_shareAria'))}" readonly hidden></div></div></div>
    <div class="dossier-navigation"><button data-build-step="-1" class="dossier-previous" aria-label="${escapeHtml(siteText('ui_previousAria'))}"><span>←</span><span><small>${escapeHtml(siteText('garage_prev_label'))}</small>${escapeHtml(builds[(index-1+builds.length)%builds.length].name)}</span></button><span class="dossier-counter">${car.number} / ${String(builds.length).padStart(2,'0')}</span><button data-build-step="1" class="dossier-next" aria-label="${escapeHtml(siteText('ui_nextAria'))}"><span><small>${escapeHtml(siteText('garage_next_label'))}</small>${escapeHtml(builds[(index+1)%builds.length].name)}</span><span>→</span></button></div>`;
  dialog.setAttribute('aria-labelledby','detail-title');
  dialog.scrollTop=0;
  if (focusControl) {const heading=dialog.querySelector('#detail-title');heading.tabIndex=-1;heading.focus({preventScroll:true});}
}
function selectPhoto(index,focus=false){
  const photo=activeCar?.gallery?.[index];if(!photo)return;selectedPhoto=index;
  const image=dialog.querySelector('.detail-image');image.src=imageUrl(photo.src);image.alt=photo.alt||activeCar.alt;image.width=photo.width;image.height=photo.height;image.style.objectPosition=index===0?(activeCar.position||'center'):'center';
  for(const button of dialog.querySelectorAll('[data-gallery-index]'))button.setAttribute('aria-pressed',String(Number(button.dataset.galleryIndex)===index));
  if(focus)dialog.querySelector(`[data-gallery-index="${index}"]`).focus();
}
function openCar(id,{fromHash=false,focusControl}={}) {
  const car = builds.find(build=>build.id===id);
  if (!car) return;
  if (!dialog.open) {
    carFocus = fromHash ? document.querySelector(`[data-car="${id}"]`) : document.activeElement;
    carReturnHash = location.hash.startsWith('#build-') ? '#garage' : (location.hash||'#garage');
  }
  activeCar = car;
  if (!fromHash) {
    const nextHash = `#build-${car.id}`;
    if (dialog.open) history.replaceState(null,'',nextHash);
    else history.pushState(null,'',nextHash);
  }
  renderCar(car,focusControl);
  if (!dialog.open) dialog.showModal();
  updateScrollLock();
}
cars.addEventListener('click',event=>{const button=event.target.closest('[data-car]');if(button)openCar(button.dataset.car);});
for (const button of document.querySelectorAll('[data-open-build]')) button.addEventListener('click',()=>{if(builds.some(car=>car.id===button.dataset.openBuild))openCar(button.dataset.openBuild);else if(collectionMode==='managed'&&!builds.length)location.hash='garage';});
dialog.addEventListener('click',async event=>{
  const photoButton=event.target.closest('[data-gallery-index]');
  if(photoButton)selectPhoto(Number(photoButton.dataset.galleryIndex));
  const step = event.target.closest('[data-build-step]');
  if (step) {
    const change = Number(step.dataset.buildStep);
    const next = builds[(builds.indexOf(activeCar)+change+builds.length)%builds.length];
    openCar(next.id,{focusControl:change===1?'.dossier-next':'.dossier-previous'});
  }
  const share = event.target.closest('[data-share-build]');
  if (share) {
    const publicUrl = new URL('https://alldaydigital.github.io/Kaijuclub_kc/');
    publicUrl.hash=`build-${share.dataset.shareBuild}`;
    const status = dialog.querySelector('.share-status');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(publicUrl.href);
      if(status?.isConnected)status.textContent=siteText('garage_share_success');
    } catch {
      const input=dialog.querySelector('.share-fallback');
      if (input) {input.hidden=false;input.value=publicUrl.href;input.focus();input.select();status.textContent=siteText('garage_share_fallback');}
    }
  }
});
dialog.addEventListener('keydown',event=>{
  if (['INPUT','TEXTAREA'].includes(event.target.tagName)) return;
  if(event.target.closest('[data-gallery-index]')&&(event.key==='ArrowLeft'||event.key==='ArrowRight')){event.preventDefault();selectPhoto((selectedPhoto+(event.key==='ArrowRight'?1:-1)+activeCar.gallery.length)%activeCar.gallery.length,true);return;}
  if (event.key==='ArrowLeft'||event.key==='ArrowRight') {
    event.preventDefault();
    const change=event.key==='ArrowRight'?1:-1;
    openCar(builds[(builds.indexOf(activeCar)+change+builds.length)%builds.length].id,{focusControl:change===1?'.dossier-next':'.dossier-previous'});
  }
});
dialog.addEventListener('close',()=>{
  if(location.hash.startsWith('#build-'))history.replaceState(null,'',carReturnHash);
  updateScrollLock();
  const fallback=document.querySelector(`[data-car="${activeCar?.id}"]`)||document.querySelector('[data-filter].active');
  (carFocus?.isConnected&&carFocus.getClientRects().length?carFocus:fallback)?.focus({preventScroll:true});
});

function openNote(id,{fromHash=false}={}) {
  const note=notes[id];if(!note)return;activeNote=id;
  if(!noteDialog.open){noteFocus=fromHash?document.querySelector(`[data-note="${id}"]`):document.activeElement;noteReturnHash=location.hash.startsWith('#note-')?'#journal':(location.hash||'#journal');}
  if(!fromHash)history.pushState(null,'',`#note-${id}`);
  document.querySelector('#note-detail').innerHTML=`<div class="dossier-top"><span>${escapeHtml(siteText('ui_essayEyebrow'))}</span><span>${note.number} / 03</span></div><img class="note-image" src="${imageUrl(note.image)}" alt="${escapeHtml(note.alt)}"><div class="note-copy"><span class="eyebrow">${escapeHtml(note.kicker)}</span><h2 id="note-title">${escapeHtml(note.title)}</h2><p class="note-lead">${escapeHtml(note.lead)}</p>${note.paragraphs.map(text=>`<p>${escapeHtml(text)}</p>`).join('')}<p class="disclaimer">${escapeHtml(siteText('journal_disclaimer',{credit:note.credit}))}</p><button class="text-link" data-related-builds="${note.category}">${escapeHtml(siteText('journal_related_cta',{category:note.category.toUpperCase()}))} ${arrow}</button></div>`;
  applySiteImage(noteDialog.querySelector('.note-image'),`note_${id}_image`);
  noteDialog.setAttribute('aria-labelledby','note-title');
  if(!noteDialog.open)noteDialog.showModal();updateScrollLock();
}
for(const button of document.querySelectorAll('[data-note],[data-open-note]'))button.addEventListener('click',()=>openNote(button.dataset.note||button.dataset.openNote));
noteDialog.addEventListener('click',event=>{const button=event.target.closest('[data-related-builds]');if(button){noteDialog.close();setFilter(button.dataset.relatedBuilds);location.hash='garage';}});
noteDialog.addEventListener('close',()=>{if(location.hash.startsWith('#note-'))history.replaceState(null,'',noteReturnHash);updateScrollLock();if(noteFocus?.isConnected)noteFocus.focus({preventScroll:true});});
for(const modal of [dialog,noteDialog]){
  modal.querySelector('.close').addEventListener('click',()=>modal.close());
  modal.addEventListener('click',event=>{if(event.target!==modal)return;const r=modal.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)modal.close();});
}
function syncRoute(){
  const carId=location.hash.startsWith('#build-')?location.hash.slice(7):null;
  const noteId=location.hash.startsWith('#note-')?location.hash.slice(6):null;
  if(carId&&builds.some(car=>car.id===carId)){if(noteDialog.open)noteDialog.close();if(!dialog.open||activeCar?.id!==carId)openCar(carId,{fromHash:true});return;}
  if(noteId&&notes[noteId]){if(dialog.open)dialog.close();if(!noteDialog.open)openNote(noteId,{fromHash:true});return;}
  if(dialog.open)dialog.close();if(noteDialog.open)noteDialog.close();
}
window.addEventListener('popstate',syncRoute);window.addEventListener('hashchange',syncRoute);

function selectStory(id,{focus=false}={}){
  const story=stories[id];if(!story)return;activeStory=id;
  for(const button of document.querySelectorAll('[data-story]')){const active=button.dataset.story===id;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;document.querySelector(`#panel-${button.dataset.story}`).hidden=!active;}
  const image=document.querySelector('#story-image');image.dataset.cmsImage=`story_${id}_image`;applySiteImage(image,`story_${id}_image`);
  document.querySelector('#story-frame').textContent=story.frame;document.querySelector('#story-caption').textContent=story.caption;document.querySelector('#story-counter').textContent=story.counter;
  if(focus)document.querySelector(`[data-story="${id}"]`).focus();
}
for(const button of document.querySelectorAll('[data-story]')){
  button.addEventListener('click',()=>selectStory(button.dataset.story));
  button.addEventListener('keydown',event=>{
    const ids=Object.keys(stories);let index=ids.indexOf(button.dataset.story);
    if(event.key==='ArrowRight')index=(index+1)%ids.length;
    else if(event.key==='ArrowLeft')index=(index-1+ids.length)%ids.length;
    else if(event.key==='Home')index=0;else if(event.key==='End')index=ids.length-1;else return;
    event.preventDefault();selectStory(ids[index],{focus:true});
  });
}
function closeMenu(){menuButton.setAttribute('aria-expanded','false');menuButton.setAttribute('aria-label',siteText('menu_open'));mobileNav.hidden=true;}
menuButton.addEventListener('click',()=>{const open=menuButton.getAttribute('aria-expanded')==='true';menuButton.setAttribute('aria-expanded',String(!open));menuButton.setAttribute('aria-label',siteText(open?'menu_open':'menu_close'));mobileNav.hidden=open;});
mobileNav.addEventListener('click',event=>{if(event.target.closest('a'))closeMenu();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!mobileNav.hidden){closeMenu();menuButton.focus();}});
window.matchMedia('(min-width:1001px)').addEventListener('change',event=>{if(event.matches)closeMenu();});

const navSections=['garage','culture','journal','events'].map(id=>document.getElementById(id)).filter(Boolean);
let scrollQueued=false;
function updateScrollUI(){
  const height=document.documentElement.scrollHeight-innerHeight;
  document.documentElement.style.setProperty('--scroll-progress',`${height>0?Math.min(100,scrollY/height*100):0}%`);
  if(!isAdminPreview&&!isSitePreview&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.style.setProperty('--hero-offset',`${Math.min(25,scrollY*.035)}px`);
  let current='',nearest=-Infinity;for(const section of navSections){if(section.hidden||section.hasAttribute('data-cms-hidden'))continue;const top=section.getBoundingClientRect().top;if(top<innerHeight*.35&&top>nearest){current=section.id;nearest=top;}}
  for(const link of document.querySelectorAll('.desktop-nav a,.mobile-nav a')){const active=link.getAttribute('href')===`#${current}`;link.classList.toggle('active',active);if(active)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');}
  scrollQueued=false;
}
window.addEventListener('scroll',()=>{if(!scrollQueued){scrollQueued=true;requestAnimationFrame(updateScrollUI);}},{passive:true});
window.addEventListener('resize',updateScrollUI);
document.querySelector('#year').textContent=new Date().getFullYear();
const initialCollection=typeof __INITIAL_COLLECTION__!=='undefined'?__INITIAL_COLLECTION__:null;
if(initialCollection?.mode==='managed')applyCollection(initialCollection);else render();
syncRoute();updateScrollUI();


function normalizeVehicle(record,index){
  if(!/^club-\d+$/.test(record.id)||!disciplines[record.category]||typeof record.name!=='string')throw new Error('Invalid vehicle');
  const validImage=path=>typeof path==='string'&&((location.protocol==='file:'&&path.startsWith('data:image/'))||(isAdminPreview&&(path.startsWith('blob:'+location.origin+'/')||/^data:image\/(jpeg|png|webp|svg\+xml)[;,]/.test(path)||/^https:\/\/raw\.githubusercontent\.com\/alldaydigital\/Kaijuclub_kc\/(main|[a-f0-9]{40})\/cms\/media\/\d+\/[a-f0-9]{64}\.(jpg|png|webp)$/.test(path)))||/^\/images\/vehicles\/\d+\/[a-f0-9]{64}\.(jpg|png|webp)$/.test(path));
  if(!validImage(record.image)||!Array.isArray(record.gallery)||!record.gallery.length||record.gallery.some(photo=>!validImage(photo.src)))throw new Error('Invalid image');
  return {...record,number:String(index+1).padStart(2,'0'),reference:false,series:String(record.series||''),origin:String(record.origin||''),model:String(record.model||record.category.toUpperCase()),credit:String(record.credit||''),title:String(record.title||siteText('ui_defaultVehicleTitle')),intro:String(record.intro||record.teaser||''),paragraphs:Array.isArray(record.paragraphs)?record.paragraphs:[],focus:Array.isArray(record.focus)?record.focus:[],specs:Array.isArray(record.specs)?record.specs:[],teaser:String(record.teaser||record.intro||siteText('ui_defaultVehicleTeaser'))};
}
function applyCollection(data){
    if(data.mode==='managed'){
      const fingerprint=JSON.stringify(data);if(fingerprint===appliedCollection)return;
      const nextBuilds=data.vehicles.map(normalizeVehicle);
      appliedCollection=fingerprint;
      if(dialog.open)dialog.close();builds=nextBuilds;collectionMode='managed';setFilter('all');
      updateCollectionCopy();
      syncRoute();
    }
}
function updateCollectionCopy(){
  const note=document.querySelector('.collection-note p');
  const noteKey=collectionMode==='managed'?(builds.length?'garage_live_note':'garage_empty_note'):'garage_reference_note';
  if(note){note.dataset.cmsText=noteKey;note.textContent=siteText(noteKey);}
  const first=builds[0];
  for(const button of document.querySelectorAll('[data-open-build]')){
    button.disabled=!first&&button.classList.contains('connect-arrow');
    button.dataset.openBuild=first?.id||'';
    if(first)button.setAttribute('aria-label',siteText('ui_openBuildAria',{name:first.name}));
    else button.removeAttribute('aria-label');
  }
  const detailButton=document.querySelector('.connect-bottom [data-open-build]');
  if(detailButton){
    const key=collectionMode==='reference'?'connect_reference_cta':first?'connect_live_cta':'connect_empty_cta';
    let label=detailButton.querySelector('[data-cms-text]');
    if(!label){label=document.createElement('span');detailButton.replaceChildren(label);detailButton.insertAdjacentHTML('beforeend',arrow);}
    label.dataset.cmsText=key;label.textContent=siteText(key)+' ';
  }
}
function updateDynamicContent(){
  for(const [id,story] of Object.entries(stories)){
    const photo=siteImage(`story_${id}_image`);
    Object.assign(story,{image:photo.src,alt:photo.alt,frame:siteText(`story_${id}_frame`),caption:siteText(`story_${id}_caption`)});
  }
  for(const [id,note] of Object.entries(notes)){
    const photo=siteImage(`note_${id}_image`);
    Object.assign(note,{image:photo.src,alt:photo.alt,title:siteText(`note_${id}_title`),kicker:siteText(`note_${id}_kicker`),credit:photo.credit||siteText(`note_${id}_credit`),category:siteText(`note_${id}_category`),lead:siteText(`note_${id}_lead`),paragraphs:siteText(`note_${id}_body`).split(/\n\s*\n/).filter(text=>text.trim())});
  }
  selectStory(activeStory);
  updateCollectionCopy();
  render(activeFilter);
  if(dialog.open&&activeCar){
    const photo=selectedPhoto,scroll=dialog.scrollTop;
    const focusedGallery=dialog.querySelector('[data-gallery-index]:focus')?.dataset.galleryIndex;
    renderCar(activeCar);selectPhoto(photo);dialog.scrollTop=scroll;
    if(focusedGallery!==undefined)dialog.querySelector(`[data-gallery-index="${focusedGallery}"]`)?.focus({preventScroll:true});
  }
  if(noteDialog.open&&activeNote){const scroll=noteDialog.scrollTop;openNote(activeNote,{fromHash:true});noteDialog.scrollTop=scroll;}
  menuButton.setAttribute('aria-label',siteText(mobileNav.hidden?'menu_open':'menu_close'));
  updateScrollUI();
}
onSiteContentChange(updateDynamicContent);
async function loadCollection(){
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),10000);
  try{
    const response=await fetch(imageUrl('/data/vehicles.json'),{signal:controller.signal,cache:'no-cache',credentials:'omit'});
    if(!response.ok)throw new Error('Collection unavailable');
    const data=await response.json();if(data.schemaVersion!==1||!Array.isArray(data.vehicles))throw new Error('Invalid collection');
    applyCollection(data);
  }catch{
    if(collectionMode!=='managed')document.querySelector('.collection-status').textContent=siteText('ui_referenceUnavailable');
  }finally{clearTimeout(timeout);}
}
if(!isAdminPreview)loadCollection();
if(isAdminPreview){
  window.addEventListener('message',event=>{
    if(event.source!==window.parent||event.origin!==location.origin||event.data?.type!=='kaiju:preview'||event.data.nonce!==previewNonce)return;
    try{
      const {catalog,view,id}=event.data;
      if(catalog?.schemaVersion!==1||catalog.mode!=='managed'||!Array.isArray(catalog.vehicles))return;
      if(dialog.open)dialog.close();if(noteDialog.open)noteDialog.close();
      appliedCollection='';applyCollection(catalog);
      document.body.classList.remove('preview-waiting','preview-card','preview-dossier');
      if(view==='card'){document.body.classList.add('preview-card');document.querySelector('.car-card')?.classList.toggle('car-card-featured',!!event.data.cardFeatured);}
      if(view==='dossier'){document.body.classList.add('preview-dossier');openCar(id,{fromHash:true});}
      if(view==='card')window.scrollTo({top:document.querySelector('#garage').offsetTop,behavior:'instant'});
      else if(view==='site')window.scrollTo({top:0,behavior:'instant'});
      window.parent.postMessage({type:'kaiju:preview-rendered',nonce:previewNonce},location.origin);
    }catch{window.parent.postMessage({type:'kaiju:preview-error',nonce:previewNonce},location.origin);}
  });
  window.parent.postMessage({type:'kaiju:preview-ready',nonce:previewNonce},location.origin);
}
