"""Export a standalone, offline browser preview using installed local assets."""
from pathlib import Path
import base64
import re

root = Path(__file__).resolve().parents[1]
html = (root / 'index.html').read_text()
css = (root / 'src/style.css').read_text()
js = re.sub(r'^import .*;\n', '', (root / 'src/main.js').read_text(), flags=re.M)
# Inline scripts cannot use Vite's build-time import.meta.env replacement.
js = js.replace('import.meta.env.BASE_URL', "'/'")
fonts = []
for family, stem, weights in [('Barlow Condensed', 'barlow-condensed', [700, 800]), ('Inter', 'inter', [400, 600, 800])]:
    for weight in weights:
        file = root / f'node_modules/@fontsource/{stem}/files/{stem}-latin-{weight}-normal.woff2'
        data = base64.b64encode(file.read_bytes()).decode()
        fonts.append(f"@font-face{{font-family:'{family}';font-style:normal;font-weight:{weight};font-display:swap;src:url(data:font/woff2;base64,{data}) format('woff2');}}")
html = html.replace('<link rel="stylesheet" href="/src/style.css">', '<style>' + ''.join(fonts) + css + '</style>')
html = html.replace('<script type="module" src="/src/main.js"></script>', '<script>' + js + '</script>')
for path in set(re.findall(r'/images/[A-Za-z0-9_.-]+', html)):
    file = root / 'public' / path.lstrip('/')
    mime = 'image/jpeg' if file.suffix.lower() in ('.jpg', '.jpeg') else 'image/svg+xml'
    data = 'data:' + mime + ';base64,' + base64.b64encode(file.read_bytes()).decode()
    html = html.replace(path, data)
output = root / 'dist/kaijuclub-preview.html'
output.parent.mkdir(exist_ok=True)
output.write_text(html)
print(output)
