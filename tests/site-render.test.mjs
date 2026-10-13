import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {defaultSiteContent,SECTION_IDS} from '../src/site-model.js';
import {renderSiteHTML,renderSiteText,formatSiteText,siteLinkURL,siteAssetURL,hiddenSiteAnchor,themeCSS} from '../src/site-render.js';

const content=changes=>({...structuredClone(defaultSiteContent),...changes});
const home=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const partners=readFileSync(new URL('../partners/index.html',import.meta.url),'utf8');
const options={base:'/Kaijuclub_kc/',origin:'https://alldaydigital.github.io',page:'home'};
const openingTag=(html,id)=>html.match(new RegExp('<[a-z][^>]*\\bid="'+id+'"[^>]*>'))?.[0];

test('published text and metadata are escaped before browser JavaScript runs',()=>{
 const changed=content({seo_home_title:'Club <night> & "crew"',seo_home_description:'Quality & "fun" <script>bad</script>',hero_text_7:'<img src=x onerror=alert(1)>\n90’s Japan & "friends"',events_placeholder_bericht:'Tell us "everything" <here>'});
 const html=renderSiteHTML(home,changed,options);
 assert.match(html,/<title data-cms-text="seo_home_title">Club &lt;night&gt; &amp; &quot;crew&quot;<\/title>/);
 assert.match(html,/content="Quality &amp; &quot;fun&quot; &lt;script&gt;bad&lt;\/script&gt;"[^>]*name="description"/);
 assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;<br>90’s Japan &amp; &quot;friends&quot;'));
 assert.ok(html.includes('placeholder="Tell us &quot;everything&quot; &lt;here&gt;"'));
 assert.ok(!html.includes('<img src=x onerror='));
 assert.ok(!html.includes('<script>bad</script>'));
});

test('editable labels retain buttons, nested SVGs, native fields and one semantic club story',()=>{
 const changed=content({hero_text_8:'Bekijk onze wagens',events_text_8:'Volledige naam',culture_text_10:'Ons verhaal in één doorlopende tekst.'});
 const html=renderSiteHTML(home,changed,options);
 assert.match(html,/data-cms-text="hero_text_8">Bekijk onze wagens <\/span><svg aria-hidden="true" class="arrow" viewBox="0 0 24 24"><path d="M5 19 19 5M5 5h14v14"><\/path><\/svg>/);
 assert.match(html,/<label><span data-cms-text="events_text_8">Volledige naam<\/span><input autocomplete="name" maxlength="120" name="naam" required="">/);
 assert.ok(html.includes('class="culture-story" data-cms-text="culture_text_10">Ons verhaal in één doorlopende tekst.</p>'));
 assert.ok(!html.includes('data-story=')&&!html.includes('role="tabpanel"'));
 assert.ok(openingTag(html,'culture').includes('aria-labelledby="culture-title"'));
 assert.ok(openingTag(html,'mobile-nav').includes('hidden=""'));
 assert.ok(openingTag(html,'car-dialog'));
 assert.ok(html.includes('<script src="/src/main.js" type="module"></script>'));
});

test('section visibility removes all menu and action routes into hidden content while keeping the skip link useful',()=>{
 const html=renderSiteHTML(home,content({visible_garage:false,visible_culture:false,visible_events:false}),options);
 for(const id of ['garage','culture','events'])assert.ok(openingTag(html,id).includes('data-cms-hidden'));
 assert.match(html,/<a class="skip-link" href="#top">Naar de garage<\/a>/);
 const internalLinks=[...html.matchAll(/<a\b[^>]*href="#(?:garage|culture|events)"[^>]*>/g)];
 assert.ok(internalLinks.length>3);
 assert.ok(internalLinks.every(match=>match[0].includes('data-cms-hidden')));
 assert.equal(hiddenSiteAnchor('https://alldaydigital.github.io/Kaijuclub_kc/#garage',content({visible_garage:false}),options),true);
 assert.equal(hiddenSiteAnchor('https://other.example/Kaijuclub_kc/#garage',content({visible_garage:false}),options),false);
});

test('the chosen homepage sequence renders on first paint with its header and discipline strip first',()=>{
 const order=[...SECTION_IDS].reverse();
 const html=renderSiteHTML(home,content({home_order:order}),options);
 const renderedOrder=[...html.matchAll(/data-cms-section="([^"]+)"/g)].map(match=>match[1]);
 assert.deepEqual(renderedOrder,order);
 assert.ok(html.indexOf('data-cms-group="hero"')<html.indexOf('data-cms-section="'+order[0]+'"'));
 assert.ok(html.indexOf('data-cms-group="disciplines"')<html.indexOf('data-cms-section="'+order[0]+'"'));
});

test('image alt text, horizontal/mobile crops and social images share the deployed base path',()=>{
 const image={...defaultSiteContent.hero_image_1,src:'/images/site/'+'a'.repeat(64)+'.webp',alt:'"Crew" <cars> & friends',width:1920,height:1080,positionDesktop:'25% 75%',positionMobile:'50% 60%'};
 const html=renderSiteHTML(home,content({hero_image_1:image}),options);
 assert.match(html,/data-cms-image="hero_image_1"[^>]*height="1080"[^>]*src="\/Kaijuclub_kc\/images\/site\/[a-f0-9]{64}\.webp"[^>]*width="1920"[^>]*style="--cms-image-desktop:25% 75%;--cms-image-mobile:50% 60%"/);
 assert.ok(html.includes('alt="&quot;Crew&quot; &lt;cars&gt; &amp; friends"'));
 assert.ok(html.includes('property="og:image" content="https://alldaydigital.github.io/Kaijuclub_kc/images/site/'+'a'.repeat(64)+'.webp"'));
 assert.equal(siteAssetURL('/images/culture.jpg','/Kaijuclub_kc/'),'/Kaijuclub_kc/images/culture.jpg');
});

test('home and partner navigation resolve local anchors correctly under GitHub Pages',()=>{
 assert.equal(siteLinkURL('/#garage',options),'#garage');
 assert.equal(siteLinkURL('/#garage',{...options,page:'partners'}),'/Kaijuclub_kc/#garage');
 assert.equal(siteLinkURL('#culture',{...options,page:'partners'}),'/Kaijuclub_kc/#culture');
 assert.equal(siteLinkURL('/partners/',options),'/Kaijuclub_kc/partners/');
 assert.equal(siteLinkURL('#samenwerken',{...options,page:'partners'}),'#samenwerken');
 const html=renderSiteHTML(partners,content(),{...options,page:'partners'});
 assert.match(html,/data-cms-link="nav_0_link"[^>]*href="\/Kaijuclub_kc\/#garage"/);
 assert.match(html,/data-cms-link="nav_3_link"[^>]*href="\/Kaijuclub_kc\/partners\/"/);
});

test('changing the recipient updates both request consent text and direct email links',()=>{
 const changed=content({contact_email:'club+events@example.com'});
 for(const [source,page] of [[home,'home'],[partners,'partners']]){
  const html=renderSiteHTML(source,changed,{...options,page});
  assert.ok(html.includes('href="mailto:club+events@example.com">club+events@example.com</a>'));
  assert.ok(html.includes('FormSubmit bezorgt het formulier aan club+events@example.com.')||html.includes('FormSubmit bezorgd aan club+events@example.com.'));
  assert.ok(!html.includes('{email}'));
 }
 assert.equal(formatSiteText(changed,'events_text_15').includes(changed.contact_email),true);
 assert.equal(formatSiteText({...changed,garage_results:'{number} builds / {unknown}'},'garage_results',{number:4}),'4 builds / {unknown}');
});

test('editable headings preserve accent treatment and theme colors choose readable button text',()=>{
 assert.equal(renderSiteText('<script>?','punctuation'),'&lt;script&gt;<span data-cms-bound="true">?</span>');
 assert.equal(renderSiteText('First & line\nLast <line>','line'),'First &amp; line<br><span data-cms-bound="true">Last &lt;line&gt;</span>');
 assert.match(themeCSS(content({theme_accent:'#ffffff'})),/--cms-accent-text:#0b0b0a/);
 assert.match(themeCSS(content({theme_accent:'#000000'})),/--cms-accent-text:#ffffff/);
 assert.throws(()=>renderSiteHTML(home,content({theme_accent:'red;display:none'}),options));
});

test('static renderer keeps unmarked admin pages and raw script expressions intact',()=>{
 const admin='<html><head><script>const condition = 1 < 2 && "<tag>";</script></head><body><main>Admin</main></body></html>';
 assert.equal(renderSiteHTML(admin,content(),options),admin);
 const marked=admin.replace('<main>','<main data-cms-group="layout">');
 const rendered=renderSiteHTML(marked,content(),options);
 assert.ok(rendered.includes('<script>const condition = 1 < 2 && "<tag>";</script>'));
});
