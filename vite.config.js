import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const catalog = JSON.parse(readFileSync(new URL('./public/data/vehicles.json', import.meta.url), 'utf8'));
const escapeAttribute = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export default defineConfig({
  build: { rolldownOptions: { input: { site: new URL('./index.html',import.meta.url).pathname, beheer: new URL('./beheer/index.html',import.meta.url).pathname } } },
  define: { __INITIAL_COLLECTION__: JSON.stringify(catalog) },
  plugins: [{
    name: 'kaiju-published-collection',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        if(!html.includes('class="hero-photo"'))return html;
        const first = catalog.mode === 'managed' ? catalog.vehicles[0] : null;
        if (!first) return html;
        return html.replace(/(<img class="hero-photo"[^>]*?src=")[^"]+("[^>]*?alt=")[^"]+("[^>]*?width=")[^"]+("[^>]*?height=")[^"]+("[^>]*>)/,
          (_,a,b,c,d,e) => `${a}${escapeAttribute(first.image)}${b}${escapeAttribute(first.alt)}${c}${first.width}${d}${first.height}${e}`)
          .replace(/(<span class="photo-index">)[\s\S]*?(<\/span>)/,`$1[ ${escapeAttribute(first.series||first.name)} / CLUB BUILD ]$2`);
      },
    },
  }],
});
