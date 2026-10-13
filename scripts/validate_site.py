"""Validate website text, immutable publications and content-addressed photos.

This runs before Pages builds. Browser previews may use local data URLs, but no
such temporary URL is allowed in a persisted concept or published website.
"""
from __future__ import annotations

from datetime import datetime
import hashlib
import json
import math
from pathlib import Path
import re
from urllib.parse import urlsplit

from PIL import Image


class ValidationError(ValueError):
    """The CMS files cannot safely be deployed."""


def require(condition, message):
    if not condition:
        raise ValidationError(message)


def exact_keys(value, keys, message):
    require(isinstance(value, dict) and set(value) == set(keys), message)


def timestamp(value):
    if value is None:
        return True
    if not isinstance(value, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z', value):
        return False
    try:
        parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
        return parsed.tzinfo is not None
    except (ValueError, OverflowError):
        return False


def safe_site_link(value):
    if not isinstance(value, str) or len(value) > 500 or re.search(r'[\x00-\x20\\]', value):
        return False
    if re.fullmatch(r'/(?:#[A-Za-z][\w-]*|(?:partners|events|agenda)/(?:#[A-Za-z][\w-]*)?)?', value) or re.fullmatch(r'#[A-Za-z][\w-]*', value):
        return True
    try:
        url = urlsplit(value)
        if url.scheme == 'https':
            # Accessing .port also rejects invalid numeric ports.
            url.port
            return bool(url.hostname) and not url.username and not url.password
        if url.scheme == 'mailto':
            return not url.query and not url.fragment and bool(re.fullmatch(r'[^\s<>"\\@]+@[^\s<>"\\@]+\.[^\s<>"\\@]+', url.path))
        if url.scheme == 'tel':
            return not url.query and not url.fragment and bool(re.fullmatch(r'\+?[0-9()-]+', url.path))
    except (ValueError, UnicodeError):
        return False
    return False


def checked_file(root, relative):
    path = root / relative
    try:
        require(path.resolve().is_relative_to(root.resolve()), f'Media escapes checkout: {relative}')
        require(path.is_file(), f'Missing website photo: {relative}')
        return path
    except OSError as error:
        raise ValidationError(f'Cannot read website photo: {relative}') from error


def check_image(root, value, *, published, media_cache):
    exact_keys(value, ['src', 'alt', 'width', 'height', 'positionDesktop', 'positionMobile', 'credit'], 'Invalid website photo metadata')
    src = value['src']
    require(isinstance(src, str) and re.fullmatch(r'/images/[A-Za-z0-9/_-]+\.(?:png|jpg|jpeg|webp)', src), 'Website photos must have a local raster path')
    require('..' not in src and '//' not in src, 'Invalid website photo path')
    width, height = value['width'], value['height']
    require(type(width) is int and type(height) is int and 0 < width <= 12000 and 0 < height <= 12000 and width * height <= 40000000, 'Invalid website photo dimensions')
    for key in ('alt', 'credit'):
        require(isinstance(value[key], str) and len(value[key]) <= 500, f'Invalid photo {key}')
    for key in ('positionDesktop', 'positionMobile'):
        position = value[key]
        require(isinstance(position, str) and re.fullmatch(r'((?:100|\d{1,2})(?:\.\d+)?)% ((?:100|\d{1,2})(?:\.\d+)?)%', position), 'Invalid website crop')
        require(all(0 <= float(part[:-1]) <= 100 for part in position.split()), 'Website crop exceeds 100 percent')

    upload = re.fullmatch(r'/images/site/([a-f0-9]{64})\.(png|jpg|webp)', src)
    require(not src.startswith('/images/site/') or upload, 'Uploaded photos must use a SHA-256 filename')
    expected_digest = upload[1] if upload else None
    relative = 'cms/site-media/' + src.rsplit('/', 1)[1] if upload else 'public' + src
    paths = [relative]
    if upload and published:
        paths.append('public' + src)
    for relative in paths:
        path = checked_file(root, relative)
        cache_key = (str(path), width, height, expected_digest)
        if cache_key in media_cache:
            continue
        try:
            data = path.read_bytes()
            if expected_digest:
                require(hashlib.sha256(data).hexdigest() == expected_digest, f'Website photo checksum mismatch: {relative}')
                require(len(data) <= 1500000, f'Oversized uploaded website photo: {relative}')
            with Image.open(path) as image:
                require(image.size == (width, height), f'Website photo dimensions mismatch: {relative}')
                extension = path.suffix.lower()
                expected_format = {'.png': 'PNG', '.jpg': 'JPEG', '.jpeg': 'JPEG', '.webp': 'WEBP'}[extension]
                require(image.format == expected_format, f'Website photo format mismatch: {relative}')
                image.verify()
            with Image.open(path) as image:
                image.load()
        except (OSError, ValueError, SyntaxError, Image.DecompressionBombError) as error:
            if isinstance(error, ValidationError):
                raise
            raise ValidationError(f'Corrupt website photo: {relative}') from error
        media_cache.add(cache_key)


def validate_content(root, content, fields, sections, *, published, media_cache):
    exact_keys(content, [field['key'] for field in fields], 'Website content has missing or unknown fields')
    for field in fields:
        key, kind = field['key'], field['type']
        value = content[key]
        if kind == 'image':
            check_image(root, value, published=published, media_cache=media_cache)
        elif kind == 'boolean':
            require(type(value) is bool, f'Invalid visibility: {key}')
        elif kind == 'sectionOrder':
            require(isinstance(value, list) and len(value) == len(sections) and all(isinstance(item, str) for item in value) and set(value) == set(sections), 'Each website section must appear once')
        elif kind == 'color':
            require(isinstance(value, str) and re.fullmatch(r'#[a-fA-F0-9]{6}', value), f'Invalid website color: {key}')
        elif kind == 'select':
            require(value in [option['value'] for option in field['options']], f'Invalid website option: {key}')
        elif kind == 'range':
            require(type(value) in (int, float) and math.isfinite(value) and field['min'] <= value <= field['max'], f'Invalid website range: {key}')
        else:
            require(isinstance(value, str) and len(value.encode('utf-16-le', errors='surrogatepass')) // 2 <= field.get('maxLength', 500) and not re.search(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', value), f'Invalid website text: {key}')
            if kind == 'url':
                require(safe_site_link(value), f'Unsafe website link: {key}')
            elif kind == 'email':
                require(re.fullmatch(r'[^\s<>"\\@]+@[^\s<>"\\@]+\.[^\s<>"\\@]+', value), f'Invalid contact email: {key}')


def validate(root):
    root = Path(root)
    try:
        schema = json.loads((root / 'src/site-schema.json').read_text())
        manager = json.loads((root / 'cms/site.json').read_text())
        public = json.loads((root / 'public/data/site.json').read_text())
    except (OSError, ValueError) as error:
        raise ValidationError('Website CMS files are missing or invalid JSON') from error
    fields = [field for group in schema['groups'] for field in group['fields']]
    sections = schema['sections']
    exact_keys(manager, ['schemaVersion', 'revision', 'updatedAt', 'content', 'published', 'history'], 'Invalid website manager schema')
    require(type(manager['schemaVersion']) is int and manager['schemaVersion'] == 1 and type(manager['revision']) is int and manager['revision'] >= 0 and timestamp(manager['updatedAt']), 'Invalid website manager revision or timestamp')
    require(isinstance(manager['history'], list) and len(manager['history']) <= 5, 'Website history exceeds five publications')
    media_cache = set()
    validate_content(root, manager['content'], fields, sections, published=False, media_cache=media_cache)
    snapshots = ([manager['published']] if manager['published'] is not None else []) + manager['history']
    for index, snapshot in enumerate(snapshots):
        exact_keys(snapshot, ['content', 'publishedAt', 'revision'], 'Invalid website publication snapshot')
        require(type(snapshot['revision']) is int and 0 <= snapshot['revision'] <= manager['revision'] and timestamp(snapshot['publishedAt']) and (snapshot['publishedAt'] is not None or snapshot['revision'] == 0), 'Invalid website publication revision or timestamp')
        validate_content(root, snapshot['content'], fields, sections, published=index == 0 and manager['published'] is not None, media_cache=media_cache)
    publication = manager['published'] or {'content': {field['key']: field['value'] for field in fields}, 'revision': 0, 'publishedAt': None}
    expected = {'schemaVersion': 1, 'revision': publication['revision'], 'publishedAt': publication['publishedAt'], 'content': publication['content']}
    require(public == expected, 'Published website differs from immutable snapshot')
    if manager['published'] is None:
        validate_content(root, public['content'], fields, sections, published=True, media_cache=media_cache)
    return len(fields)


if __name__ == '__main__':
    count = validate(Path(__file__).resolve().parents[1])
    print(f'Website content, {count} fields, publication history and photos validated.')
