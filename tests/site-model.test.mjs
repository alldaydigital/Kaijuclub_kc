import test from 'node:test';
import assert from 'node:assert/strict';
import {CONTENT_GROUPS,SECTION_IDS,SITE_FIELDS,defaultSiteContent,newSiteManager,validateContent,validateImage,validateSiteManager,updateSiteManager,publicSiteContent,safeSiteLink} from '../src/site-model.js';

test('the whole-site schema provides complete defaults and independent new editors',()=>{
 assert.ok(CONTENT_GROUPS.some(group=>group.id==='hero'));
 assert.ok(CONTENT_GROUPS.some(group=>group.page==='partners'));
 assert.equal(new Set(SITE_FIELDS.map(field=>field.key)).size,SITE_FIELDS.length);
 assert.deepEqual(Object.keys(defaultSiteContent).sort(),SITE_FIELDS.map(field=>field.key).sort());
 assert.doesNotThrow(()=>validateContent(defaultSiteContent));
 const first=newSiteManager(),second=newSiteManager();first.content.brand_name='Changed';
 assert.equal(second.content.brand_name,defaultSiteContent.brand_name);
 assert.equal(first.published.content.brand_name,defaultSiteContent.brand_name);
});

test('saving a website concept never changes live copy, visibility or page order',()=>{
 const manager=newSiteManager(),before=structuredClone(manager);
 const content=structuredClone(manager.content);content.brand_name='Concept club';content.visible_events=false;content.home_order=[...SECTION_IDS].reverse();
 const next=updateSiteManager(manager,content,'draft');
 assert.equal(next.revision,manager.revision+1);assert.equal(next.content.brand_name,'Concept club');
 assert.deepEqual(publicSiteContent(next),publicSiteContent(manager));assert.deepEqual(manager,before);
});

test('publishing creates immutable snapshots and bounded history that can be restored',()=>{
 let manager=newSiteManager();const first=structuredClone(manager.content);first.brand_name='First publication';
 manager=updateSiteManager(manager,first,'publish');first.brand_name='Mutation after publish';
 assert.equal(manager.published.content.brand_name,'First publication');
 for(let number=2;number<=8;number++){const content=structuredClone(manager.content);content.brand_name=`Publication ${number}`;manager=updateSiteManager(manager,content,'publish');}
 assert.equal(manager.history.length,5);assert.equal(manager.history[0].content.brand_name,'Publication 7');
 assert.equal(manager.history[4].content.brand_name,'Publication 3');
 const restored=updateSiteManager(manager,manager.history[2].content,'draft');
 assert.equal(restored.content.brand_name,'Publication 5');assert.equal(publicSiteContent(restored).content.brand_name,'Publication 8');
 const publicCopy=publicSiteContent(manager);publicCopy.content.brand_name='Mutation of public copy';
 assert.equal(manager.published.content.brand_name,'Publication 8');
});

test('website links allow managed anchors and HTTPS while rejecting executable, credentialed or ambiguous URLs',()=>{
 for(const link of ['/', '/#garage','#culture','/partners/','/partners/#samenwerken','https://example.com/path?q=1','mailto:club@example.com','tel:+3212345678'])assert.equal(safeSiteLink(link),true,link);
 for(const link of ['javascript:alert(1)','data:text/html,x','http://example.com','//example.com','https://user:password@example.com','https://example.com\\@evil.test','https://example.com\n','/beheer/','/../private','mailto:club@example.com?bcc=other@example.com','mailto:club@example.com#header','tel:+321?body=message'])assert.equal(safeSiteLink(link),false,link);
});

test('photos accept bounded browser uploads and exact preview paths without permitting SVG or remote tracking',()=>{
 const image=structuredClone(defaultSiteContent.hero_image_1);
 for(const src of ['/images/site/'+'a'.repeat(64)+'.webp','data:image/png;base64,AAAA'])assert.doesNotThrow(()=>validateImage({...image,src}));
 const raw='https://raw.githubusercontent.com/alldaydigital/Kaijuclub_kc/'+'a'.repeat(40)+'/cms/site-media/'+'b'.repeat(64)+'.png';
 assert.doesNotThrow(()=>validateImage({...image,src:raw},{preview:true}));assert.throws(()=>validateImage({...image,src:raw}));
 for(const src of ['data:image/svg+xml;base64,AAAA','https://tracker.example/image.png','/images/../secret.png','/images/photo.svg','/images/site/arbitrary.png','data:image/png;base64,'+'A'.repeat(2000001)])assert.throws(()=>validateImage({...image,src}));
 for(const positionDesktop of ['101% 50%','100.5% 0%','-1% 0%','50%;background:url(x)','50% 50% extra'])assert.throws(()=>validateImage({...image,positionDesktop}));
 assert.throws(()=>validateImage({...image,width:40000001,height:1}));assert.throws(()=>validateImage({...image,width:2.5}));
});

test('invalid fields, duplicate sections, hidden type mismatches and oversized text cannot be saved',()=>{
 const changes=[{unknown_field:'value'},{visible_events:'false'},{theme_accent:'red;display:none'},{theme_heading:'external-font'},{home_order:[...SECTION_IDS.slice(0,-1),SECTION_IDS[0]]},{contact_email:'not an email'},{social_instagram:'javascript:alert(1)'},{brand_name:'a'.repeat(501)},{brand_name:'bad\u0000text'}];
 for(const change of changes)assert.throws(()=>validateContent({...structuredClone(defaultSiteContent),...change}));
 const missing=structuredClone(defaultSiteContent);delete missing.brand_name;assert.throws(()=>validateContent(missing));
 assert.doesNotThrow(()=>validateContent({...structuredClone(defaultSiteContent),hero_text_7:'90’s Japan.\nTweede lijn — 怪獣 <letterlijke tekst>'}));
});

test('malformed manager states are rejected before publication changes',()=>{
 const manager=newSiteManager();
 for(const change of [{schemaVersion:2},{revision:-1},{revision:1.5},{updatedAt:'not a date'},{unexpected:'secret'},{history:[null]},{history:Array(6).fill(manager.published)},{published:{...manager.published,revision:99}},{published:{...manager.published,publishedAt:'invalid'}},{published:{...manager.published,unexpected:'secret'}}])assert.throws(()=>validateSiteManager({...structuredClone(manager),...change}));
 assert.throws(()=>updateSiteManager(manager,manager.content,'delete'));
 const unpublished={...structuredClone(manager),published:null};assert.deepEqual(publicSiteContent(unpublished).content,defaultSiteContent);
});

test('local upload sources remain editable but cannot leak into persisted concepts or immutable publications',()=>{
 const manager=newSiteManager(),content=structuredClone(manager.content);
 content.hero_image_1.src='data:image/png;base64,AAAA';
 assert.doesNotThrow(()=>validateContent(content));
 assert.throws(()=>validateSiteManager({...structuredClone(manager),content}));
 assert.throws(()=>validateSiteManager({...structuredClone(manager),published:{...manager.published,content}}));
 assert.throws(()=>updateSiteManager(manager,content,'draft'));
});

test('contact addresses reject HTML attributes, slashes and oversized values while allowing normal plus-addressing',()=>{
 for(const contact_email of ['\"club\"@example.com','<club>@example.com','club\\team@example.com','club@example\".com','a'.repeat(245)+'@example.com'])assert.throws(()=>validateContent({...structuredClone(defaultSiteContent),contact_email}));
 assert.doesNotThrow(()=>validateContent({...structuredClone(defaultSiteContent),contact_email:'club+events@kaijuclub.be'}));
});

test('calendar timestamps reject normalized impossible dates and preserve valid leap days',()=>{
 const manager=newSiteManager();
 for(const updatedAt of ['2026-02-31T10:00:00Z','2026-02-29T10:00:00.000Z','2026-04-31T10:00:00Z','2026-10-13T25:00:00Z'])assert.throws(()=>validateSiteManager({...structuredClone(manager),updatedAt}));
 assert.doesNotThrow(()=>validateSiteManager({...structuredClone(manager),updatedAt:'2024-02-29T10:00:00Z'}));
 assert.doesNotThrow(()=>validateSiteManager({...structuredClone(manager),updatedAt:'2024-02-29T10:00:00.123Z'}));
});
