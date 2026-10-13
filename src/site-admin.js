import '@fontsource/racing-sans-one/400.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import {normalizeConnectionToken, checkGitHubConnection} from './admin-auth.js';
import {GitHubStore} from './admin-api.js';
import {hasVault, unlockConnection, rememberConnection} from './admin-vault.js';
import {CONTENT_GROUPS, SECTION_IDS, defaultSiteContent, newSiteManager, validateContent, validateSiteManager, upgradeSiteContent} from './site-model.js';
import {saveSiteContent, previewSiteContent} from './site-store.js';

if (window.top !== window.self) throw new Error('Open websitebeheer rechtstreeks in je browser.');
const $ = selector => document.querySelector(selector);
const clone = value => structuredClone(value);
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const base = import.meta.env.BASE_URL;
const nonce = [...crypto.getRandomValues(new Uint8Array(24))].map(value => value.toString(16).padStart(2, '0')).join('');
const frames = [$('#site-preview-frame'), $('#site-expanded-frame')];
const readyFrames = new Set();
let manager = newSiteManager(), content = clone(defaultSiteContent), baseline = clone(content);
let store = null, selectedGroup = CONTENT_GROUPS.find(group => group.id === 'hero') || CONTENT_GROUPS[0], currentPage = 'home', device = 'desktop';
let dirty = false, busy = false, processing = false, pendingAction = null, watchVersion = 0, contentHeadSha = null;
let previewTimer, recoveryTimer, previewLoadTimer, inactivityTimer, recoveryWarning = false;
const pageNames = {agenda:'Agenda',home:'Homepage', partners:'Partners & sponsors', events:'Events & fotoreportages', global:'Instellingen'};

function notice(message = '', error = false) {
  const element = $('#site-notice');
  element.textContent = message;
  element.dataset.state = error ? 'error' : 'success';
  element.hidden = !message;
}
function loginError(message = '') { $('#site-login-error').textContent = message; $('#site-login-error').hidden = !message; }
function status(message) { $('#site-save-state').textContent = message; }
function updateDirty() {
  dirty = !equal(content, baseline);
  $('#site-dirty-indicator').classList.toggle('dirty', dirty);
  status(dirty ? 'Wijzigingen nog niet bewaard.' : manager.updatedAt ? (store ? 'Concept opgeslagen.' : 'Live website geladen.') : 'Je kunt meteen beginnen.');
  clearTimeout(recoveryTimer);
  if (dirty) recoveryTimer = setTimeout(() => recovery('write', {id:'website', content:clone(content), baseline:clone(baseline), headSha:contentHeadSha, recoveredAt:Date.now()}).catch(() => {
    if (!recoveryWarning) { recoveryWarning = true; notice('Automatisch herstel is niet beschikbaar in deze browser. Bewaar je concept voordat je afsluit.', true); }
  }), 550);
}
function setBusy(value) {
  busy = value;
  for (const element of document.querySelectorAll('#content-editor input,#content-editor textarea,#content-editor select,#content-editor button,.site-save-actions button,#site-connect,#site-lock,#site-refresh,#site-reset-group,#site-history')) element.disabled = value || processing || element.dataset.boundary === 'true';
}
function edit(key, value) {
  if (busy || processing) return;
  content[key] = value;
  updateDirty();
  schedulePreview();
  if (key.startsWith('visible_')) renderGroups();
}
function siteImageUrl(src) {
  if (!src) return '';
  return src.startsWith('/') ? base + src.slice(1) : src;
}
function visibleGroups() {
  const query = $('#site-section-search').value.trim().toLocaleLowerCase('nl');
  return CONTENT_GROUPS.filter(group => !query || [group.label, pageNames[group.page], ...group.fields.map(field => field.label), ...group.fields.map(field => typeof content[field.key] === 'string' ? content[field.key] : '')].join(' ').toLocaleLowerCase('nl').includes(query));
}
function renderGroups() {
  const list = $('#site-group-list'); list.replaceChildren();
  const groups = visibleGroups();
  for (const page of ['home', 'partners', 'events', 'agenda', 'global']) {
    const items = groups.filter(group => group.page === page);
    if (!items.length) continue;
    const heading = document.createElement('p'); heading.className = 'group-list-heading'; heading.textContent = pageNames[page]; list.append(heading);
    for (const group of items) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'site-group-button'; button.dataset.group = group.id; button.classList.toggle('active', group.id === selectedGroup.id); button.setAttribute('aria-current', group.id === selectedGroup.id ? 'true' : 'false');
      const visibility = group.fields.find(field => field.key.startsWith('visible_'));
      button.dataset.hidden = visibility && content[visibility.key] === false ? 'true' : 'false';
      const label = document.createElement('span'); label.textContent = group.label;
      const arrow = document.createElement('small'); arrow.textContent = '↗︎'; arrow.setAttribute('aria-hidden', 'true');
      button.append(label, arrow); button.addEventListener('click', () => selectGroup(group.id)); list.append(button);
    }
  }
  if (!groups.length) { const empty = document.createElement('p'); empty.className = 'site-group-empty'; empty.textContent = 'Geen onderdeel gevonden. Probeer een andere zoekterm.'; list.append(empty); }
}
function selectGroup(id, {fromPreview = false} = {}) {
  if (busy || processing) return;
  const group = CONTENT_GROUPS.find(item => item.id === id); if (!group) return;
  selectedGroup = group;
  renderGroups(); renderFields();
  if (group.page !== 'global' && group.page !== currentPage) changePage(group.page);
  else if (!fromPreview) sendPreview(true);
  if (fromPreview && matchMedia('(max-width:700px)').matches) setWorkspace('edit');
  requestAnimationFrame(() => $('.site-fields-heading').scrollIntoView({block:'start', behavior:'auto'}));
}
function fieldContainer(field) {
  const container = document.createElement('div'); container.className = 'field';
  const label = document.createElement('label'); label.htmlFor = `content-${field.key}`; label.textContent = field.label; container.append(label);
  return container;
}
function help(container, text) { const paragraph = document.createElement('p'); paragraph.className = 'field-help'; paragraph.textContent = text; container.append(paragraph); }
function countField(container, input, max) {
  if (!max) return;
  const output = document.createElement('p'); output.className = 'field-count';
  const update = () => { output.textContent = `${[...input.value].length} / ${max}`; };
  input.addEventListener('input', update); update(); container.append(output);
}
function renderFields() {
  $('#site-group-page').textContent = pageNames[selectedGroup.page];
  $('#site-group-title').textContent = selectedGroup.label;
  $('#site-group-description').textContent = selectedGroup.description || 'Je wijzigingen verschijnen meteen in het voorbeeld.';
  const form = $('#content-editor'); form.replaceChildren();
  for (const field of selectedGroup.fields) {
    if (field.type === 'image') { form.append(imageField(field)); continue; }
    if (field.type === 'sectionOrder') { form.append(orderField(field)); continue; }
    const container = fieldContainer(field); const id = `content-${field.key}`;
    if (field.type === 'boolean') {
      container.className = 'boolean-field'; const label = container.firstChild; label.remove();
      const input = document.createElement('input'); input.id = id; input.type = 'checkbox'; input.checked = !!content[field.key]; input.addEventListener('change', () => edit(field.key, input.checked));
      const sub = document.createElement('small'); sub.textContent = field.help || (field.key.startsWith('visible_') ? 'Zet uit om dit onderdeel op de website te verbergen.' : 'Deze instelling geldt voor de volledige website.'); label.append(sub); container.append(input, label);
    } else if (field.type === 'range') {
      const row = document.createElement('div'); row.className = 'range-field';
      const input = document.createElement('input'); input.id = id; input.type = 'range'; input.min = field.min ?? 0; input.max = field.max ?? 100; input.step = field.step ?? 1; input.value = content[field.key] ?? field.value ?? input.min;
      const output = document.createElement('output'); output.htmlFor = id; output.textContent = input.value;
      input.addEventListener('input', () => { output.textContent = input.value; edit(field.key, Number(input.value)); }); row.append(input, output); container.append(row);
    } else if (field.type === 'color') {
      const row = document.createElement('div'); row.className = 'color-field'; const picker = document.createElement('input'); picker.type = 'color'; picker.id = id; picker.value = content[field.key];
      const input = document.createElement('input'); input.type = 'text'; input.value = content[field.key]; input.maxLength = 7; input.setAttribute('aria-label', field.label + ' kleurcode'); input.pattern = '#[0-9A-Fa-f]{6}'; input.spellcheck = false;
      picker.addEventListener('input', () => { input.value = picker.value; edit(field.key, picker.value); });
      input.addEventListener('input', () => { if (/^#[0-9a-f]{6}$/i.test(input.value)) { picker.value = input.value; edit(field.key, input.value); input.setCustomValidity(''); } else input.setCustomValidity('Gebruik een kleurcode zoals #ff4d31.'); }); row.append(picker, input); container.append(row);
    } else if (field.type === 'select') {
      const input = document.createElement('select'); input.id = id;
      for (const entry of field.options || []) { const option = document.createElement('option'); option.value = typeof entry === 'string' ? entry : entry.value; option.textContent = typeof entry === 'string' ? entry : entry.label; input.append(option); }
      input.value = content[field.key]; input.addEventListener('change', () => edit(field.key, input.value)); container.append(input);
    } else {
      const input = document.createElement(field.type === 'textarea' ? 'textarea' : 'input'); input.id = id;
      if (field.type === 'textarea') input.rows = field.maxLength > 1500 ? 7 : 4;
      else { input.type = field.type === 'email' ? 'email' : 'text'; if (field.type === 'url') { input.inputMode = 'url'; input.spellcheck = false; } }
      input.value = content[field.key] ?? '';
      if (field.maxLength) input.maxLength = field.maxLength;
      input.addEventListener('input', () => edit(field.key, input.value)); container.append(input);
      if (field.type === 'url') help(container, field.help || 'Een websiteadres (https://…) of een link naar een onderdeel (#garage).');
      else if (field.help) help(container, field.help);
      countField(container, input, field.maxLength);
    }
    form.append(container);
  }
}
function imageField(field) {
  const container = fieldContainer(field);
  const editor = document.createElement('div'); editor.className = 'image-editor';
  const figure = document.createElement('figure'); figure.className = 'image-editor-figure';
  const image = document.createElement('img'); image.alt = content[field.key]?.alt || field.label;
  function refreshFigure() {
    const item = content[field.key];
    if (!item?.src) { figure.replaceChildren(); const empty = document.createElement('p'); empty.textContent = 'Voeg een foto toe om dit onderdeel persoonlijk te maken.'; figure.append(empty); return; }
    const mapped = previewSiteContent(content, store?.head?.sha || contentHeadSha)[field.key];
    image.src = siteImageUrl(mapped?.src || item.src); image.alt = item.alt || field.label; image.style.objectPosition = item.positionDesktop || '50% 50%'; figure.replaceChildren(image);
  }
  refreshFigure(); editor.append(figure);
  const actions = document.createElement('div'); actions.className = 'image-editor-actions';
  const uploadLabel = document.createElement('label'); uploadLabel.className = 'image-file-label'; uploadLabel.tabIndex = 0; uploadLabel.textContent = content[field.key]?.src ? 'Foto vervangen ↗︎' : 'Foto uploaden +';
  const file = document.createElement('input'); file.id = `content-${field.key}`; file.type = 'file'; file.accept = 'image/jpeg,image/png,image/webp'; uploadLabel.append(file); uploadLabel.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); file.click(); } });
  const original = document.createElement('button'); original.type = 'button'; original.className = 'text-button'; original.textContent = 'Originele foto';
  original.addEventListener('click', () => { if (busy || processing) return; edit(field.key, clone(field.value)); renderFields(); notice('De originele foto staat terug in je concept. Bewaar of publiceer om deze wijziging op te slaan.'); });
  file.addEventListener('change', async () => {
    const source = file.files[0]; if (!source || busy || processing) return;
    processing = true; setBusy(false); notice('Foto voorbereiden…');
    try {
      const prepared = await prepareImage(source);
      content[field.key] = {...clone(content[field.key]), ...prepared}; updateDirty(); refreshFigure(); schedulePreview();
      uploadLabel.firstChild.textContent = 'Foto vervangen ↗︎';
      notice('Foto klaar voor je website. Bewaar je concept of publiceer om ze in GitHub op te slaan.');
      sizeNote.textContent = `${prepared.width} × ${prepared.height} PX · automatisch geoptimaliseerd`;
    } catch (error) { notice(error.message, true); }
    finally { processing = false; setBusy(false); file.value = ''; }
  });
  actions.append(uploadLabel, original); editor.append(actions);
  const sizeNote = document.createElement('p'); sizeNote.className = 'image-size-note'; const item = content[field.key]; sizeNote.textContent = item?.width ? `${item.width} × ${item.height} PX` : 'PNG / JPEG / WEBP · MAX. 10 MB'; editor.append(sizeNote);
  const details = document.createElement('details'); const summary = document.createElement('summary'); summary.textContent = 'Beschrijving & uitsnede'; details.append(summary);
  const detailFields = document.createElement('div');
  for (const key of ['alt', 'credit']) {
    const row = document.createElement('div'); row.className = 'field'; const id = `image-${field.key}-${key}`; const label = document.createElement('label'); label.htmlFor = id; label.textContent = key === 'alt' ? 'Beschrijving van de foto' : 'Fotocredit (optioneel)';
    const input = document.createElement('input'); input.id = id; input.type = 'text'; input.maxLength = key === 'alt' ? 300 : 180; input.value = item?.[key] || ''; input.addEventListener('input', () => { edit(field.key, {...content[field.key], [key]:input.value}); if (key === 'alt') image.alt = input.value; }); row.append(label, input);
    if (key === 'alt') help(row, 'Beschrijf kort wat er op de foto staat, ook voor bezoekers die het beeld niet zien.'); detailFields.append(row);
  }
  for (const platform of ['Desktop', 'Mobile']) {
    const property = `position${platform}`; const position = (item?.[property] || '50% 50%').match(/([\d.]+)%\s+([\d.]+)%/); const initial = position ? [Number(position[1]), Number(position[2])] : [50, 50];
    for (let axis = 0; axis < 2; axis++) {
      const row = document.createElement('div'); row.className = 'field'; const label = document.createElement('label'); const id = `image-${field.key}-${platform}-${axis}`; label.htmlFor = id; label.textContent = `${platform === 'Mobile' ? 'Mobiel' : 'Desktop'} · ${axis ? 'hoogte' : 'links / rechts'}`;
      const range = document.createElement('div'); range.className = 'range-field'; const input = document.createElement('input'); input.id = id; input.type = 'range'; input.min = 0; input.max = 100; input.step = 1; input.value = initial[axis]; const output = document.createElement('output'); output.textContent = initial[axis] + '%';
      input.addEventListener('input', () => { const current = (content[field.key][property] || '50% 50%').match(/([\d.]+)%\s+([\d.]+)%/); const pair = current ? [Number(current[1]), Number(current[2])] : [50, 50]; pair[axis] = Number(input.value); output.textContent = input.value + '%'; edit(field.key, {...content[field.key], [property]:`${pair[0]}% ${pair[1]}%`}); if (platform === 'Desktop') image.style.objectPosition = content[field.key][property]; }); range.append(input, output); row.append(label, range); detailFields.append(row);
    }
  }
  details.append(detailFields); editor.append(details); help(editor, 'Een uitsnede verschuift het beeld binnen het kader. Je originele foto blijft behouden.'); container.append(editor); return container;
}
async function prepareImage(file) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Kies een PNG, JPEG of WebP-foto.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Deze foto is groter dan 10 MB. Kies een kleiner bestand.');
  let bitmap;
  try { bitmap = await createImageBitmap(file); } catch { throw new Error('Deze foto kon niet worden gelezen. Kies een andere PNG, JPEG of WebP.'); }
  if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 40000000) { bitmap.close(); throw new Error('Kies een foto van maximaal 40 megapixels.'); }
  const ratio = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(bitmap.width * ratio)); canvas.height = Math.max(1, Math.round(bitmap.height * ratio)); const context = canvas.getContext('2d');
  if (!context) { bitmap.close(); throw new Error('Deze browser kon de foto niet voorbereiden. Probeer een andere browser.'); }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
  let uri;
  for (const quality of [.9, .82, .74, .65]) { uri = canvas.toDataURL('image/webp', quality); if (uri.length <= 1400000) break; }
  if (!/^data:image\/(webp|png|jpeg);base64,/.test(uri) || uri.length > 2000000) throw new Error('De foto blijft te groot. Kies een kleinere of eenvoudigere foto.');
  return {src:uri, width:canvas.width, height:canvas.height};
}
function orderField(field) {
  const container = fieldContainer(field); const list = document.createElement('ol'); list.className = 'section-order-list';
  function draw() {
    list.replaceChildren(); const order = content[field.key] || SECTION_IDS;
    order.forEach((id, index) => {
      const row = document.createElement('li'); const label = document.createElement('span'); label.textContent = CONTENT_GROUPS.find(group => group.id === id)?.label || id;
      const up = document.createElement('button'); up.type = 'button'; up.textContent = '↑'; up.setAttribute('aria-label', `${label.textContent} hoger plaatsen`); up.disabled = index === 0; up.dataset.boundary = String(index === 0);
      const down = document.createElement('button'); down.type = 'button'; down.textContent = '↓'; down.setAttribute('aria-label', `${label.textContent} lager plaatsen`); down.disabled = index === order.length - 1; down.dataset.boundary = String(index === order.length - 1);
      function move(offset) { if (busy || processing) return; const next = [...order]; [next[index], next[index + offset]] = [next[index + offset], next[index]]; edit(field.key, next); draw(); }
      up.addEventListener('click', () => move(-1)); down.addEventListener('click', () => move(1)); row.append(label, up, down); list.append(row);
    });
  }
  draw(); container.append(list); help(container, 'De header blijft bovenaan. Verplaats de andere onderdelen met de pijlen; het voorbeeld volgt meteen.'); return container;
}
function schedulePreview() { clearTimeout(previewTimer); previewTimer = setTimeout(() => sendPreview(), 120); }
function sendPreview(select = false, only = null) {
  let preview;
  try { preview = previewSiteContent(content, store?.head?.sha || contentHeadSha); validateContent(preview, {preview:true}); }
  catch (error) { status('Controleer je invoer; het voorbeeld toont de vorige geldige versie.'); return; }
  for (const frame of only ? [only] : frames) if (readyFrames.has(frame)) frame.contentWindow.postMessage({type:'kaiju:site-preview', nonce, content:preview, ...(select ? {selectionGroup:selectedGroup.id, selection:selectedGroup.selector} : {})}, location.origin);
}
function previewUrl() { const url = new URL(base + (currentPage === 'home' ? '' : currentPage + '/'), location.origin); url.searchParams.set('preview', 'site'); url.searchParams.set('nonce', nonce); return url.href; }
function loadFrame(frame) { readyFrames.delete(frame); frame.src = previewUrl(); }
function changePage(page) {
  currentPage = page; $('#site-preview-page').value = page; $('#site-preview-loading').hidden = false;
  loadFrame(frames[0]); if ($('#site-expanded-preview').open) loadFrame(frames[1]);
  clearTimeout(previewLoadTimer); previewLoadTimer = setTimeout(() => { if (!readyFrames.has(frames[0])) { $('#site-preview-loading strong').textContent = 'Het voorbeeld laadt niet.'; $('#site-preview-loading p').textContent = 'Vernieuw deze pagina om het opnieuw te proberen. Je wijzigingen blijven in deze browser bewaard.'; } }, 15000);
}
function resizeFrames() {
  const logicalWidth = device === 'mobile' ? 390 : 1440;
  for (const frame of frames) {
    const wrap = frame.parentElement; if (!wrap.clientWidth || !wrap.clientHeight) continue;
    const scale = Math.min(1, wrap.clientWidth / logicalWidth); frame.style.width = logicalWidth + 'px'; frame.style.height = Math.ceil(wrap.clientHeight / scale) + 'px'; frame.style.transform = `scale(${scale})`;
  }
  $('#site-preview-dimensions').textContent = logicalWidth + ' PX';
}
function setDevice(value) {
  device = value;
  $('#site-preview-canvas').dataset.device = value;
  for (const button of document.querySelectorAll('[data-device]')) { button.classList.toggle('active', button.dataset.device === value); button.setAttribute('aria-pressed', button.dataset.device === value ? 'true' : 'false'); }
  resizeFrames();
}
function setWorkspace(value) {
  $('.site-workspace').dataset.workspace = value;
  for (const button of document.querySelectorAll('.mobile-workspace-tabs [data-workspace]')) { const active = button.dataset.workspace === value; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); }
  requestAnimationFrame(resizeFrames);
}
window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.data?.nonce !== nonce) return;
  const frame = frames.find(item => item.contentWindow === event.source); if (!frame) return;
  if (event.data.type === 'kaiju:site-preview-ready') { readyFrames.add(frame); if (frame === frames[0]) { $('#site-preview-loading').hidden = true; clearTimeout(previewLoadTimer); } resizeFrames(); sendPreview(true, frame); }
  if (event.data.type === 'kaiju:site-select' && typeof event.data.groupId === 'string') {
    if (busy || processing) return;
    selectGroup(event.data.groupId, {fromPreview:true});
    const key = event.data.fieldKey;
    if (typeof key === 'string' && selectedGroup.id === event.data.groupId && selectedGroup.fields.some(field => field.key === key)) requestAnimationFrame(() => {
      const input = document.getElementById('content-' + key); if (!input) return;
      const field = input.closest('.field,.boolean-field') || input;
      field.dataset.previewFocus = 'true';
      if (input.type === 'file') { field.tabIndex = -1; field.focus({preventScroll:true}); }
      else input.focus({preventScroll:true});
      field.scrollIntoView({block:'center', behavior:'auto'});
      setTimeout(() => { delete field.dataset.previewFocus; }, 3500);
    });
  }
  if (event.data.type === 'kaiju:site-preview-error') notice('Het voorbeeld kon deze wijziging niet tonen. Controleer je invoer en probeer opnieuw.', true);
});
for (const frame of frames) new ResizeObserver(resizeFrames).observe(frame.parentElement);
window.addEventListener('resize', resizeFrames);
$('#site-section-search').addEventListener('input', renderGroups);
$('#site-preview-page').addEventListener('change', event => { changePage(event.target.value); const first = CONTENT_GROUPS.find(group => group.page === currentPage); if (first) { selectedGroup = first; renderGroups(); renderFields(); } });
for (const button of document.querySelectorAll('[data-device]')) button.addEventListener('click', () => setDevice(button.dataset.device));
for (const button of document.querySelectorAll('.mobile-workspace-tabs [data-workspace]')) button.addEventListener('click', () => setWorkspace(button.dataset.workspace));
$('#site-expand-preview').addEventListener('click', () => { $('#site-expanded-preview').showModal(); loadFrame(frames[1]); requestAnimationFrame(resizeFrames); });
$('#site-close-expanded').addEventListener('click', () => $('#site-expanded-preview').close());
$('#content-editor').addEventListener('submit', event => event.preventDefault());
$('#site-reset-group').addEventListener('click', () => {
  if (busy || processing) return;
  const changed = selectedGroup.fields.some(field => !equal(content[field.key], baseline[field.key]));
  if (!changed) { notice('Dit onderdeel heeft geen wijzigingen om te herstellen.'); return; }
  if (!confirm('De niet-opgeslagen wijzigingen van dit onderdeel herstellen naar de laatst opgeslagen inhoud?')) return;
  for (const field of selectedGroup.fields) content[field.key] = clone(baseline[field.key]);
  updateDirty(); renderFields(); renderGroups(); sendPreview(true); notice('Dit onderdeel is hersteld. Je overige wijzigingen blijven behouden.');
});

function login() {
  if (busy || processing) return;
  loginError(); const remembered = hasVault(); $('#site-unlock-fields').hidden = !remembered; $('#site-token-fields').hidden = remembered;
  $('#site-login').showModal(); setTimeout(() => (remembered ? $('#site-password') : $('#site-token')).focus(), 0);
}
function lock() {
  watchVersion++; contentHeadSha = store?.head?.sha || contentHeadSha; store?.lock(); store = null; clearTimeout(inactivityTimer);
  $('#site-connection-status').classList.remove('connected'); $('#site-connection-status').innerHTML = '<i></i>Vergrendeld'; $('#site-lock').hidden = true; $('#site-connect').textContent = 'Verbind beheer';
  if (dirty) notice('Beheer vergrendeld. Je wijzigingen blijven in deze browser; verbind opnieuw om ze te bewaren.');
}
function touchSession() { if (!store) return; clearTimeout(inactivityTimer); inactivityTimer = setTimeout(lock, 30 * 60 * 1000); }
for (const event of ['pointerdown', 'keydown']) document.addEventListener(event, touchSession, {passive:true});
$('#site-connect').addEventListener('click', login); $('#site-lock').addEventListener('click', lock);
$('#site-use-token').addEventListener('click', () => { $('#site-unlock-fields').hidden = true; $('#site-token-fields').hidden = false; $('#site-token').focus(); });
$('#site-remember').addEventListener('change', event => { $('#site-remember-fields').hidden = !event.target.checked; });
$('#site-login').addEventListener('cancel', () => { pendingAction = null; });
$('#site-login').addEventListener('close', () => { $('#site-token').value = ''; $('#site-password').value = ''; $('#site-new-password').value = ''; if (!store) pendingAction = null; });
$('#site-check-connection').addEventListener('click', async event => { const button = event.currentTarget; button.disabled = true; $('#site-connection-result').textContent = 'GitHub controleren…'; try { const result = await checkGitHubConnection(); $('#site-connection-result').textContent = result.message; } finally { button.disabled = false; } });
$('#site-login-form').addEventListener('submit', async event => {
  event.preventDefault(); if (busy || processing) return;
  let candidate = null, connected = false; setBusy(true); const button = event.submitter; button.disabled = true; loginError();
  try {
    const unlocking = !$('#site-unlock-fields').hidden;
    const token = normalizeConnectionToken(unlocking ? await unlockConnection($('#site-password').value) : $('#site-token').value);
    if (!unlocking && $('#site-remember').checked && $('#site-new-password').value.length < 12) throw new Error('Kies een beheerwachtwoord van minimaal 12 tekens.');
    candidate = new GitHubStore(token); await candidate.connect(); const loaded = await candidate.readFile('cms/site.json'); validateSiteManager(loaded);
    const nextContent = clone(loaded.content); const localKeys = Object.keys(content).filter(key => !equal(content[key], baseline[key]));
    const conflicts = localKeys.filter(key => !equal(loaded.content[key], baseline[key]) && !equal(loaded.content[key], content[key]));
    if (conflicts.length && !confirm('De opgeslagen website is intussen gewijzigd. Wil je jouw wijzigingen voor de overlappende onderdelen behouden? De overige nieuwe inhoud wordt geladen.')) { candidate.lock(); return; }
    for (const key of localKeys) nextContent[key] = clone(content[key]);
    let rememberWarning = '';
    if (!unlocking && $('#site-remember').checked) {
      try { await rememberConnection(token, $('#site-new-password').value); }
      catch { rememberWarning = 'Je bent verbonden, maar deze browser kon je koppeling niet onthouden. Je kunt nu bewaren en publiceren; verbind bij je volgende bezoek opnieuw.'; }
    }
    store?.lock(); store = candidate; contentHeadSha = candidate.head.sha; manager = loaded; baseline = clone(loaded.content); content = nextContent; connected = true;
    $('#site-connection-status').classList.add('connected'); $('#site-connection-status').innerHTML = '<i></i>Verbonden met GitHub'; $('#site-lock').hidden = false; $('#site-connect').textContent = 'Koppeling'; $('#site-login').close();
    renderGroups(); renderFields(); updateDirty(); sendPreview(); touchSession(); notice(rememberWarning || (localKeys.length ? 'Verbonden. Je eigen wijzigingen zijn behouden; opgeslagen inhoud is geladen.' : 'Verbonden. Je opgeslagen website is geladen.'), !!rememberWarning);
  } catch (error) { if (!connected) candidate?.lock(); loginError(error.message); }
  finally { setBusy(false); button.disabled = false; $('#site-token').value = ''; $('#site-password').value = ''; $('#site-new-password').value = ''; }
  if (connected && pendingAction) { const action = pendingAction; pendingAction = null; await save(action); }
});
$('#site-refresh').addEventListener('click', async () => {
  if (busy || processing) return;
  if (!store) { login(); return; }
  if (dirty && !confirm('Je niet-opgeslagen wijzigingen vervangen door het opgeslagen concept in GitHub?')) return;
  setBusy(true);
  try { await store.load(); const loaded = await store.readFile('cms/site.json'); validateSiteManager(loaded); manager = loaded; contentHeadSha = store.head.sha; content = clone(loaded.content); baseline = clone(content); updateDirty(); await recovery('clear').catch(() => {}); renderGroups(); renderFields(); sendPreview(true); notice('Het actuele concept is geladen.'); }
  catch (error) { notice(error.message, true); }
  finally { setBusy(false); }
});
async function save(action) {
  if (busy || processing) { notice('Wacht tot de huidige actie klaar is.', true); return; }
  if (!$('#content-editor').reportValidity()) return;
  try { validateContent(content, {preview:true}); } catch (error) { notice(error.message, true); return; }
  if (!store) { pendingAction = action; login(); notice('Verbind je beheer. Daarna wordt deze wijziging opgeslagen.'); return; }
  setBusy(true); watchVersion++; const version = watchVersion;
  try {
    notice(action === 'publish' ? 'Je website veilig opslaan en publiceren…' : 'Je websiteconcept veilig opslaan…');
    const result = await saveSiteContent(store, manager, clone(content), action, {onProgress:status});
    manager = result.manager; contentHeadSha = store.head.sha; content = clone(result.content); baseline = clone(content); updateDirty(); clearTimeout(recoveryTimer); await recovery('clear').catch(() => {});
    renderGroups(); renderFields(); sendPreview();
    notice(action === 'draft' ? 'Concept opgeslagen in GitHub. Je kunt later verderwerken; je live website blijft zoals ze was.' : 'Opgeslagen in GitHub. De website wordt nu gepubliceerd…');
    if (action === 'publish') trackDeployment(result.commit, version);
  } catch (error) { notice(error.message, true); status('Bewaren niet bevestigd. Je invoer is behouden.'); }
  finally { setBusy(false); }
}
async function trackDeployment(commit, version) {
  for (let attempt = 0; attempt < 16; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 15000)); if (version !== watchVersion || !store) return;
    try {
      const result = await store.deployment(commit); if (version !== watchVersion) return;
      if (result.state === 'live') { notice('Je nieuwe website staat online.'); status('Gepubliceerd op de website.'); return; }
      if (result.state === 'failed') { notice('Je inhoud is opgeslagen, maar de publicatie is mislukt. Controleer de GitHub-publicatie voordat je opnieuw publiceert.', true); return; }
    } catch { /* The saved commit remains valid when public deployment status is unavailable. */ }
  }
  if (version === watchVersion) notice('Opgeslagen in GitHub. De live publicatie kon nog niet bevestigd worden.');
}
$('#site-save-draft').addEventListener('click', () => save('draft')); $('#site-publish').addEventListener('click', () => save('publish'));
$('#site-history').addEventListener('click', () => {
  if (busy || processing) return;
  const list = $('#site-history-list'); list.replaceChildren();
  const versions = [manager.published, ...(manager.history || [])].filter(Boolean);
  if (!versions.length) { const paragraph = document.createElement('p'); paragraph.className = 'field-help'; paragraph.textContent = 'Verbind het beheer om eerdere publicaties te laden. Na je eerste publicatie verschijnen je versies hier.'; list.append(paragraph); }
  for (const [index, version] of versions.entries()) {
    const button = document.createElement('button'); button.type = 'button'; const label = document.createElement('strong'); const date = new Date(version.publishedAt); label.textContent = !version.publishedAt || Number.isNaN(date.getTime()) ? (index ? 'Basisversie' : 'Huidige publicatie') : date.toLocaleString('nl-BE', {dateStyle:'medium', timeStyle:'short', timeZone:'Europe/Brussels'}); const sub = document.createElement('span'); sub.textContent = index === 0 ? 'Huidige publicatie · gebruik als concept ↗︎' : `Publicatie ${version.revision} · zet terug als concept ↗︎`; button.append(label, sub);
    button.addEventListener('click', () => { if (dirty && !confirm('Je huidige niet-opgeslagen wijzigingen vervangen door deze versie?')) return; content = clone(version.content); updateDirty(); renderGroups(); renderFields(); sendPreview(true); $('#site-history-dialog').close(); notice('Deze eerdere versie staat klaar als concept. Bewaar of publiceer wanneer je tevreden bent.'); }); list.append(button);
  }
  $('#site-history-dialog').showModal();
});

function recovery(action, value) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('kaijuclub-site-recovery', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('drafts', {keyPath:'id'});
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result; const tx = db.transaction('drafts', action === 'read' ? 'readonly' : 'readwrite'); const target = tx.objectStore('drafts'); let result;
      if (action === 'read') { const read = target.get('website'); read.onsuccess = () => { result = read.result; }; }
      else if (action === 'write') target.put(value);
      else target.delete('website');
      tx.oncomplete = () => { db.close(); resolve(result); }; tx.onerror = () => { db.close(); reject(tx.error); };
    };
  });
}
window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
document.addEventListener('visibilitychange', () => { if (document.hidden && dirty) recovery('write', {id:'website', content:clone(content), baseline:clone(baseline), headSha:contentHeadSha, recoveredAt:Date.now()}).catch(() => {}); });
async function initialize() {
  renderGroups(); renderFields(); changePage('home');
  let applied = false;
  try {
    const saved = await recovery('read');
    if (saved?.content && saved.recoveredAt > Date.now() - 30 * 24 * 60 * 60 * 1000) {
      saved.content=upgradeSiteContent(saved.content);saved.baseline=upgradeSiteContent(saved.baseline);validateContent(saved.content, {preview:true}); validateContent(saved.baseline, {preview:true});
      if (!dirty) { content = saved.content; baseline = saved.baseline; contentHeadSha = /^[a-f0-9]{40}$/.test(saved.headSha || '') ? saved.headSha : null; updateDirty(); applied = true; notice('Je niet-opgeslagen werk uit deze browser is hersteld. Bewaar een concept om het definitief op te slaan.'); }
    }
  } catch { /* Recovery is optional; authenticated GitHub saves are authoritative. */ }
  if (applied) { renderGroups(); renderFields(); sendPreview(); }
  applied = false;
  try {
    const response = await fetch(base + 'data/site.json', {credentials:'omit', cache:'no-store', signal:AbortSignal.timeout(10000)});
    if (response.ok) { const data = await response.json(); validateContent(data.content); if (!dirty && !store) { content = clone(data.content); baseline = clone(content); manager.content = clone(content); manager.revision = data.revision; manager.updatedAt = data.publishedAt; manager.published = {content:clone(content), publishedAt:data.publishedAt, revision:data.revision}; applied = true; } }
  } catch { /* The bundled defaults provide a usable editor even when the public fetch fails. */ }
  renderGroups(); if (applied && !dirty) renderFields(); updateDirty(); sendPreview();
}
initialize();
