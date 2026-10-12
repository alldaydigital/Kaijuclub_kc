"""Validate partner media and the published projection before deployment."""
import base64
import io
import json
import re
from pathlib import Path
from urllib.parse import urlsplit
from PIL import Image


def validate_fields(item, required=False):
    assert isinstance(item, dict) and re.fullmatch(r'partner-\d+', item.get('id', '')), 'Invalid partner ID'
    assert isinstance(item.get('name'), str) and len(item['name']) <= 120 and (not required or item['name'].strip()), 'Invalid partner name'
    assert item.get('kind') in ('partner', 'sponsor'), 'Invalid partner type'
    assert isinstance(item.get('description'), str) and len(item['description']) <= 1200, 'Invalid description'
    website = item.get('website')
    assert isinstance(website, str) and len(website) <= 500, 'Invalid website'
    if website:
        parsed = urlsplit(website)
        assert parsed.scheme == 'https' and parsed.hostname and not parsed.username and not parsed.password, 'Unsafe website'
    logo = item.get('logo')
    assert isinstance(logo, str) and len(logo) <= 700000, 'Oversized logo'
    if logo:
        match = re.fullmatch(r'data:image/(png|webp|jpeg);base64,([A-Za-z0-9+/]+=*)', logo)
        assert match, 'Unsupported logo'
        content = base64.b64decode(match[2], validate=True)
        with Image.open(io.BytesIO(content)) as image:
            assert image.format.lower().replace('jpg', 'jpeg') == match[1], 'Logo format mismatch'
            assert 0 < image.width * image.height <= 40000000, 'Oversized logo dimensions'
            image.verify()
        with Image.open(io.BytesIO(content)) as image:
            image.load()


def validate(root):
    manager = json.loads((root / 'cms/partners.json').read_text())
    public = json.loads((root / 'public/data/partners.json').read_text())
    assert manager.get('schemaVersion') == 1 and type(manager.get('revision')) is int and manager['revision'] >= 0, 'Invalid partner schema'
    assert isinstance(manager.get('partners'), list) and len(manager['partners']) <= 60, 'Invalid partner collection'
    ids = set()
    expected = []
    for item in manager['partners']:
        validate_fields(item)
        assert item['id'] not in ids, 'Duplicate partner ID'
        ids.add(item['id'])
        if item.get('published'):
            validate_fields(item['published'], required=True)
            assert item['published']['id'] == item['id'], 'Snapshot ID mismatch'
            if not item.get('archived'):
                expected.append(item['published'])
    assert public == {'schemaVersion': 1, 'partners': expected}, 'Published partners differ from immutable snapshots'


if __name__ == '__main__':
    validate(Path(__file__).resolve().parents[1])
    print('Partner catalog and published projection validated.')
