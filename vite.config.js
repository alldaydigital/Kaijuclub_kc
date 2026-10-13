import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { validateContent } from './src/site-model.js';
import { renderSiteHTML } from './src/site-render.js';

const catalog = JSON.parse(readFileSync(new URL('./public/data/vehicles.json', import.meta.url), 'utf8'));
const initialEvents=JSON.parse(readFileSync(new URL('./public/data/events.json',import.meta.url),'utf8'));
const publishedSite = JSON.parse(readFileSync(new URL('./public/data/site.json', import.meta.url), 'utf8'));
validateContent(publishedSite.content);
export default defineConfig(({command})=>({
  plugins:[{
    name:'kaiju-published-site-content',
    transformIndexHtml:{order:'post',handler(html,context){
      return renderSiteHTML(html,publishedSite.content,{
        base:context.server?.config.base||buildBase,
        page:!context.path.includes('/beheer/')&&context.path.includes('/events/')?'events':context.path.includes('/partners/')&&!context.path.includes('/beheer/')?'partners':'home',
        origin:command==='build'?'https://alldaydigital.github.io':undefined,
      });
    }},
    configResolved(config){buildBase=config.base;},
  }],
  build: { rolldownOptions: { input: {
    site: new URL('./index.html',import.meta.url).pathname,
    beheer: new URL('./beheer/index.html',import.meta.url).pathname,
    partners: new URL('./partners/index.html',import.meta.url).pathname,
    partnerbeheer: new URL('./beheer/partners/index.html',import.meta.url).pathname,
    events: new URL('./events/index.html',import.meta.url).pathname,
    eventbeheer: new URL('./beheer/events/index.html',import.meta.url).pathname,
    websitebeheer: new URL('./beheer/website/index.html',import.meta.url).pathname,
  } } },
  define: { __INITIAL_COLLECTION__: JSON.stringify(catalog), __SITE_CONTENT__: JSON.stringify(publishedSite), __INITIAL_EVENTS__: JSON.stringify(initialEvents) },
}));
let buildBase='/';
