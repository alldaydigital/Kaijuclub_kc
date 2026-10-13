import { CONTENT_GROUPS, validateContent } from './site-model.js';

export const escapeSiteHTML = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));

export function formatSiteText(content, key, values = {}) {
  const value = typeof content[key] === 'string' ? content[key] : '';
  const replacements = {email:content.contact_email, ...values};
  return value.replace(/\{([A-Za-z][\w]*)\}/g, (match, name) => Object.hasOwn(replacements, name) ? String(replacements[name]) : match);
}

export function siteAssetURL(source, base = '/') {
  if (globalThis.__KAIJU_OFFLINE_ASSETS__?.[source]) return globalThis.__KAIJU_OFFLINE_ASSETS__[source];
  if (!source.startsWith('/images/')) return source;
  return base.replace(/\/?$/, '/') + source.slice(1);
}

export function siteLinkURL(value, {base = '/', page = 'home'} = {}) {
  const prefix = base.replace(/\/?$/, '/');
  if (value === '/') return prefix;
  if (value.startsWith('/partners/') || value.startsWith('/events/') || value.startsWith('/agenda/')) return prefix + value.slice(1);
  if (value.startsWith('/#')) return page === 'home' ? value.slice(1) : prefix + value.slice(1);
  if (value.startsWith('#') && page !== 'home' && ['garage','culture','journal','events','connect','top'].includes(value.slice(1))) return prefix + value;
  return value;
}

export function renderSiteText(value, accent) {
  const lines = String(value).split('\n');
  if (accent === 'line' && lines.length > 1) {
    return lines.slice(0, -1).map(escapeSiteHTML).join('<br>') + '<br><span data-cms-bound="true">' + escapeSiteHTML(lines.at(-1)) + '</span>';
  }
  const escaped = lines.map(escapeSiteHTML).join('<br>');
  if (accent === 'punctuation' && /[.!?…]$/.test(value)) return escaped.slice(0, -1) + '<span data-cms-bound="true">' + escaped.at(-1) + '</span>';
  return escaped;
}

function contrastColor(color) {
  const channels = color.slice(1).match(/../g).map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  const luminance = channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  return (luminance + .05) / .05 >= 1.05 / (luminance + .05) ? '#0b0b0a' : '#ffffff';
}

export function themeCSS(content) {
  const headings = {condensed:"'Barlow Condensed',Arial,sans-serif", racing:"'Racing Sans One',Arial,sans-serif", clean:'Inter,Arial,sans-serif'};
  return `:root{--ink:${content.theme_ink};--paper:${content.theme_paper};--accent:${content.theme_accent};--heading:${headings[content.theme_heading] || headings.condensed};--cms-accent-text:${contrastColor(content.theme_accent)}}`;
}

export const sharedSiteCSS = `
[data-cms-image],[data-cms-dynamic-image]{object-position:var(--cms-image-desktop,50% 50%)!important}
@media(max-width:700px){[data-cms-image],[data-cms-dynamic-image]{object-position:var(--cms-image-mobile,50% 50%)!important}}
.primary-button{color:var(--cms-accent-text,#fff)}
.primary-button:hover{color:var(--ink)}
.cms-photo-credit{position:absolute;z-index:2;right:16px;bottom:14px;max-width:min(70%,360px);padding:6px 8px;background:#0b0b0abf;color:#fff;font:8px/1.5 var(--mono);text-align:right;overflow-wrap:anywhere;pointer-events:none}
.hero-photo-frame>.cms-photo-credit{right:4.6%}
.culture-visual>.cms-photo-credit{left:23px;right:auto;top:64px;bottom:auto;text-align:left}
.journal-photo>.cms-photo-credit{left:16px;right:72px;max-width:none;text-align:left}
.culture-interlude>.cms-photo-credit{top:22px;bottom:auto;right:4.6%}
@media(max-width:700px){.cms-photo-credit{font-size:7px;padding:5px 7px}.culture-visual>.cms-photo-credit{left:17px;top:50px}}
[data-cms-hidden]{display:none!important}
html[data-cms-preview] [data-cms-group]{position:relative}
html[data-cms-preview] [data-cms-selected]{outline:2px solid var(--accent);outline-offset:-2px}
html[data-cms-preview] [data-cms-group]:hover{box-shadow:inset 0 0 0 1px var(--accent)}
html[data-cms-preview] .request-form [type=submit]{cursor:default;opacity:.65}
html[data-cms-preview]{scroll-behavior:auto!important}
`;

export function hiddenSiteAnchor(link, content, {base = '/', page = 'home', origin} = {}) {
  if (!link) return false;
  let hash;
  if (link.startsWith('#')) hash = link.slice(1);
  else if (link.startsWith(base + '#')) hash = link.slice(base.length + 1);
  else if (link.startsWith(base + 'partners/#')) hash = link.split('#')[1];
  else if (origin) {
    try { const url = new URL(link, origin); if (url.origin === origin && [base,base+'partners/',base+'events/',base+'agenda/'].includes(url.pathname)) hash=url.hash.slice(1); } catch {}
  }
  const group = hash==='partner-grid'?CONTENT_GROUPS.find(item=>item.id==='partnerCollection'):CONTENT_GROUPS.find(item => item.selector === '#' + hash);
  return Boolean(group && content['visible_' + group.id] === false);
}

// A small markup tree keeps nested SVGs, form controls and ARIA structures intact.
// Editable values are inserted only as escaped text or validated attributes.
const voidTags = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
function parseMarkup(html) {
  const root = {children:[]}, stack = [root];
  const tokens = html.match(/<!--[\s\S]*?-->|<![^>]*>|<\/?[A-Za-z][^>]*>|[^<]+|</g) || [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index], parent = stack.at(-1);
    if (/^<\//.test(token)) {
      const tag = token.match(/^<\/([^\s>]+)/)?.[1].toLowerCase();
      for (let position = stack.length - 1; position > 0; position--) if (stack[position].tag === tag) { stack.length = position; break; }
    } else if (/^<[A-Za-z]/.test(token)) {
      const tag = token.match(/^<([^\s/>]+)/)[1].toLowerCase(), attributes = new Map();
      const raw = token.slice(token.indexOf(tag) + tag.length).replace(/\/?\s*>$/, '');
      for (const match of raw.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) attributes.set(match[1], match[2] ?? match[3] ?? match[4] ?? null);
      const node = {tag,attributes,children:[],parent};
      parent.children.push(node);
      if (!voidTags.has(tag) && !/\/\s*>$/.test(token)) {
        if (['script','style'].includes(tag)) {
          let rawText='';
          while (index+1<tokens.length && !new RegExp('^<\\/'+tag+'(?:\\s|>)','i').test(tokens[index+1])) rawText+=tokens[++index];
          if (index+1<tokens.length) index++;
          node.children.push({raw:rawText});
        } else stack.push(node);
      }
    } else parent.children.push({raw:token});
  }
  return root;
}
function serialize(node) {
  if (Object.hasOwn(node,'raw')) return node.raw;
  const children = node.children.map(serialize).join('');
  if (!node.tag) return children;
  const attrs = [...node.attributes].map(([name,value])=>value===null?' '+name:' '+name+'="'+value+'"').join('');
  return '<'+node.tag+attrs+'>'+ (voidTags.has(node.tag) ? '' : children+'</'+node.tag+'>');
}
function walk(node, callback) { if(node.tag)callback(node);for(const child of node.children || [])walk(child,callback); }
function setAttribute(node,name,value) { node.attributes.set(name,escapeSiteHTML(value)); }
function replaceContent(node,html) { node.children=[{raw:html}]; }
function textBoundary(node,value) {
  const original=node.children.map(serialize).join('').replace(/<[^>]*>/g,'');
  const leading=original.match(/^\s+/)?.[0]||'',trailing=original.match(/\s+$/)?.[0]||'';
  return (value.match(/^\s/) ? '' : leading) + value + (value.match(/\s$/) ? '' : trailing);
}

export function renderSiteHTML(html, content, options = {}) {
  if (!html.includes('data-cms-group=')) return html;
  validateContent(content);
  const tree=parseMarkup(html), page=options.page||'home', base=options.base||'/', sections=new Map(),credits=[];
  let head,main;
  walk(tree,node=>{
    if(node.tag==='head')head=node;
    if(node.tag==='main')main=node;
    const attrs=node.attributes;
    if(attrs.has('data-cms-text')) {
      const value=formatSiteText(content,attrs.get('data-cms-text'));
      replaceContent(node,node.tag==='title'?escapeSiteHTML(value.replace(/\n/g,' ')):textBoundary(node,renderSiteText(value,attrs.get('data-cms-accent'))));
    }
    if(attrs.has('data-cms-meta'))setAttribute(node,'content',formatSiteText(content,attrs.get('data-cms-meta')));
    if(attrs.has('data-cms-placeholder'))setAttribute(node,'placeholder',formatSiteText(content,attrs.get('data-cms-placeholder')));
    if(attrs.has('data-cms-link')) {
      const link=siteLinkURL(content[attrs.get('data-cms-link')],{base,page});
      setAttribute(node,'href',link);
      if(hiddenSiteAnchor(link,content,{base,page,origin:options.origin}))attrs.set('data-cms-hidden','');
      if(/^(https:|mailto:|tel:)/.test(link))setAttribute(node,'rel','noopener noreferrer');
    }
    if(attrs.has('data-cms-email')) {setAttribute(node,'href','mailto:'+content.contact_email);replaceContent(node,escapeSiteHTML(content.contact_email));}
    if(attrs.has('data-cms-image')) {
      const image=content[attrs.get('data-cms-image')];
      setAttribute(node,'src',siteAssetURL(image.src,base));setAttribute(node,'alt',image.alt);setAttribute(node,'width',image.width);setAttribute(node,'height',image.height);
      setAttribute(node,'style',`--cms-image-desktop:${image.positionDesktop};--cms-image-mobile:${image.positionMobile}`);
      if(image.credit)credits.push({node,key:attrs.get('data-cms-image'),credit:image.credit});
    }
    if(attrs.has('data-cms-section'))sections.set(attrs.get('data-cms-section'),node);
    const group=attrs.get('data-cms-group');
    if(group&&content['visible_'+group]===false)attrs.set('data-cms-hidden','');
    if(node.tag==='a'&&hiddenSiteAnchor(attrs.get('href'),content,{base,page,origin:options.origin})) {
      if(attrs.get('class')?.split(/\s+/).includes('skip-link'))setAttribute(node,'href','#top');
      else attrs.set('data-cms-hidden','');
    }
    if(node.tag==='meta'&&attrs.get('name')==='theme-color')setAttribute(node,'content',content.theme_ink);
    if(node.tag==='button'&&attrs.get('class')?.split(/\s+/).includes('menu-toggle'))setAttribute(node,'aria-label',content.menu_open);
    if(node.tag==='a'&&attrs.get('class')?.split(/\s+/).includes('wordmark'))setAttribute(node,'aria-label',content.brand_name+' home');
  });
  for(const {node,key,credit} of credits)node.parent.children.push({tag:'span',attributes:new Map([['class','cms-photo-credit'],['data-cms-credit-key',key]]),children:[{raw:escapeSiteHTML(credit)}]});
  if(main&&sections.size) {
    const untouched=main.children.filter(node=>!node.attributes?.has('data-cms-section'));
    main.children=[...untouched,...content.home_order.map(id=>sections.get(id)).filter(Boolean)];
  }
  if(head) {
    head.children.push({tag:'style',attributes:new Map([['id','kaiju-site-theme']]),children:[{raw:themeCSS(content)+sharedSiteCSS}]});
    const imageURL=siteAssetURL(content.hero_image_1.src,base);
    let socialImage;
    walk(head,node=>{if(node.tag==='meta'&&node.attributes.get('property')==='og:image')socialImage=node;});
    if(!socialImage){socialImage={tag:'meta',attributes:new Map([['property','og:image']]),children:[]};head.children.push(socialImage);}
    setAttribute(socialImage,'content',options.origin?new URL(imageURL,options.origin).href:imageURL);
  }
  return serialize(tree);
}
