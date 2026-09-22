"""Build a standalone, data-free HTML deliverable with pinned dependencies."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
html = (ROOT / 'index.html').read_text()
css = (ROOT / 'vendor/leaflet.css').read_text()
# No raster marker icons are used; keep the distribution entirely self-contained.
css = re.sub(r'url\(images/[^)]+\)', 'none', css)
html = html.replace('<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">', '<style>' + css + '</style>')
for src, local, element_id in [
    ('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', 'vendor/leaflet.js', 'leaflet-lib'),
    ('https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js', 'vendor/xlsx.full.min.js', 'xlsx-lib'),
    ('engine.js', 'engine.js', 'engine-lib'),
    ('app.js', 'app.js', 'app-lib'),
]:
    source = (ROOT / local).read_text()
    source = source.replace('</script', '<\\/script')
    html = html.replace(f'<script src="{src}"></script>', f'<script id="{element_id}">\n{source}\n</script>')
assert '<script src=' not in html
(ROOT / 'dist').mkdir(exist_ok=True)
(ROOT / 'dist/index.html').write_text(html)
(ROOT / 'dist/MFC_Delivery_Zones_3.2.html').write_text(html)
print(f'Built standalone HTML: {len(html.encode()):,} bytes; no uploaded customer data included.')
