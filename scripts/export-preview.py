"""Export a standalone, offline browser preview using installed local assets."""
from pathlib import Path
import base64
import re
import json
import mimetypes

root = Path(__file__).resolve().parents[1]
html = (root / 'index.html').read_text()
css = (root / 'src/style.css').read_text().replace("@import './partner-styles.css';", (root / 'src/partner-styles.css').read_text())
js = re.sub(r'^import .*;\n', '', (root / 'src/main.js').read_text(), flags=re.M)
# Inline scripts cannot use Vite's build-time import.meta.env replacement.
js = js.replace('import.meta.env.BASE_URL', "'/'")
catalog_path = root / 'public/data/vehicles.json'
catalog = json.loads(catalog_path.read_text()) if catalog_path.exists() else {'schemaVersion': 1, 'mode': 'reference', 'vehicles': []}
serialized = json.dumps(catalog, ensure_ascii=False).replace('<', chr(92)+'u003c').replace('>', chr(92)+'u003e').replace('&', chr(92)+'u0026')
js = js.replace("const response=await fetch(imageUrl('/data/vehicles.json'),{signal:controller.signal,cache:'no-cache',credentials:'omit'});", 'const response={ok:true,json:async()=>(' + serialized + ')};')
fonts = []
for family, stem, weights in [('Barlow Condensed', 'barlow-condensed', [700, 800]), ('Inter', 'inter', [400, 600, 800]), ('Racing Sans One', 'racing-sans-one', [400]), ('IBM Plex Mono', 'ibm-plex-mono', [400])]:
    for weight in weights:
        file = root / f'node_modules/@fontsource/{stem}/files/{stem}-latin-{weight}-normal.woff2'
        data = base64.b64encode(file.read_bytes()).decode()
        fonts.append(f"@font-face{{font-family:'{family}';font-style:normal;font-weight:{weight};font-display:swap;src:url(data:font/woff2;base64,{data}) format('woff2');}}")
html = html.replace('<link rel="stylesheet" href="/src/style.css">', '<style>' + ''.join(fonts) + css + '</style>')
html = html.replace('<script type="module" src="/src/main.js"></script>', '<script>' + js + '</script>')
requests = (root / 'src/requests.js').read_text().replace('export ', '')
html = html.replace('<script type="module" src="/src/requests.js"></script>', '<script>' + requests + '</script>')
for path in set(re.findall(r'/images/[A-Za-z0-9_./-]+', html)):
    file = root / 'public' / path.lstrip('/')
    mime = mimetypes.guess_type(file.name)[0] or 'application/octet-stream'
    data = 'data:' + mime + ';base64,' + base64.b64encode(file.read_bytes()).decode()
    html = html.replace(path, data)
output = root / 'dist/kaijuclub-preview.html'
output.parent.mkdir(exist_ok=True)
output.write_text(html)
print(output)
