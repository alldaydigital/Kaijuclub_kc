"""Build one offline portfolio artifact from the actual published content."""
from pathlib import Path
import base64
import json
import mimetypes
import re
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]

def script_json(value):
    return json.dumps(value, ensure_ascii=False).replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')

with tempfile.TemporaryDirectory(prefix='kaiju-offline-') as directory:
    temporary = Path(directory)
    entry = temporary / 'entry.js'
    entry.write_text('\n'.join('import ' + json.dumps(str(root / path)) + ';' for path in ['src/main.js', 'src/requests.js', 'src/style.css']))
    build_script = r'''
import {build} from 'vite';
import {readFileSync,writeFileSync} from 'node:fs';
import {renderSiteHTML} from './src/site-render.js';
const [entry,out]=process.argv.slice(2);
const published=JSON.parse(readFileSync('public/data/site.json','utf8'));
const vehicles=JSON.parse(readFileSync('public/data/vehicles.json','utf8'));
await build({configFile:false,base:'/',logLevel:'error',define:{__SITE_CONTENT__:JSON.stringify(published),__INITIAL_COLLECTION__:JSON.stringify(vehicles)},build:{outDir:out,emptyOutDir:false,cssCodeSplit:false,lib:{entry,name:'KaijuOffline',formats:['iife'],fileName:()=> 'portfolio.js'}}});
writeFileSync(out+'/hydrated.html',renderSiteHTML(readFileSync('index.html','utf8'),published.content,{base:'/',page:'home'}));
'''
    subprocess.run(['node', '--input-type=module', '-', str(entry), str(temporary)], input=build_script, text=True, cwd=root, check=True)
    html = (temporary / 'hydrated.html').read_text()
    js = (temporary / 'portfolio.js').read_text()
    css = '\n'.join(path.read_text() for path in temporary.glob('*.css'))
    html = re.sub(r'<link\b[^>]*href=["\']/src/style\.css["\'][^>]*>', '', html)
    html = re.sub(r'<script\b[^>]*src=["\']/src/(?:main|requests)\.js["\'][^>]*>\s*</script>', '', html)
    vehicles = json.loads((root / 'public/data/vehicles.json').read_text())
    site = json.loads((root / 'public/data/site.json').read_text())
    assets = {}
    for path in set(re.findall(r'/images/[A-Za-z0-9_./-]+', html + js + json.dumps(vehicles) + json.dumps(site))):
        file = root / 'public' / path.lstrip('/')
        if not file.is_file():
            continue
        mime = mimetypes.guess_type(file.name)[0] or 'application/octet-stream'
        assets[path] = 'data:' + mime + ';base64,' + base64.b64encode(file.read_bytes()).decode()
    for path, data in assets.items():
        html = html.replace('src="' + path + '"', 'src="' + data + '"')
    bootstrap = 'globalThis.__KAIJU_OFFLINE__=true;globalThis.__KAIJU_OFFLINE_ASSETS__=' + script_json(assets) + ';'
    bootstrap += 'const offlineData=' + script_json({'vehicles': vehicles, 'site': site}) + ';'
    bootstrap += r'''window.fetch=async input=>{const path=new URL(String(input),location.href).pathname;const key=path.endsWith('/data/vehicles.json')?'vehicles':path.endsWith('/data/site.json')?'site':null;if(!key)throw new TypeError('Dit offline voorbeeld verstuurt geen netwerkverzoeken.');return new Response(JSON.stringify(offlineData[key]),{headers:{'Content-Type':'application/json'}})};document.addEventListener('submit',event=>{event.preventDefault();event.stopImmediatePropagation();},true);document.addEventListener('click',event=>{const link=event.target.closest('a');if(link&&!link.getAttribute('href')?.startsWith('#'))event.preventDefault();},true);'''
    js = re.sub(r'</script', r'<\/script', js, flags=re.I)
    html = html.replace('</head>', '<style>' + css + '</style></head>')
    html = html.replace('</body>', '<script>' + bootstrap + js + '</script></body>')
    output = root / 'dist/kaijuclub-preview.html'
    output.parent.mkdir(exist_ok=True)
    output.write_text(html)
    print(output)
