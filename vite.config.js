import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const catalog = JSON.parse(readFileSync(new URL('./public/data/vehicles.json', import.meta.url), 'utf8'));
export default defineConfig({
  build: { rolldownOptions: { input: {
    site: new URL('./index.html',import.meta.url).pathname,
    beheer: new URL('./beheer/index.html',import.meta.url).pathname,
    partners: new URL('./partners/index.html',import.meta.url).pathname,
    partnerbeheer: new URL('./beheer/partners/index.html',import.meta.url).pathname,
  } } },
  define: { __INITIAL_COLLECTION__: JSON.stringify(catalog) },
});
