"""Verify persisted website concepts, live snapshots, media and unsafe inputs."""
from copy import deepcopy
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

from test_vehicle_cms import png_bytes

REPO_ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('validate_site', REPO_ROOT / 'scripts/validate_site.py')
validator = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(validator)
SCHEMA = json.loads((REPO_ROOT / 'src/site-schema.json').read_text())
FIELDS = [field for group in SCHEMA['groups'] for field in group['fields']]
PNG = png_bytes()
DIGEST = hashlib.sha256(PNG).hexdigest()
IMAGE_PATH = f'/images/site/{DIGEST}.png'


def write(root, manager, public=None):
    if public is None:
        snapshot = manager['published']
        public = {'schemaVersion': 1, 'revision': snapshot['revision'], 'publishedAt': snapshot['publishedAt'], 'content': deepcopy(snapshot['content'])}
    for name, value in [('src/site-schema.json', SCHEMA), ('cms/site.json', manager), ('public/data/site.json', public)]:
        path = root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value, ensure_ascii=False))
    return public


def fixture(root):
    content = {field['key']: deepcopy(field['value']) for field in FIELDS}
    for field in FIELDS:
        if field['type'] == 'image':
            content[field['key']].update(src=IMAGE_PATH, width=2, height=3)
    manager = {'schemaVersion': 1, 'revision': 1, 'updatedAt': '2026-10-13T10:00:00Z', 'content': content, 'published': {'content': deepcopy(content), 'publishedAt': '2026-10-13T10:00:00Z', 'revision': 1}, 'history': []}
    for name in [f'cms/site-media/{DIGEST}.png', 'public' + IMAGE_PATH]:
        path = root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(PNG)
    public = write(root, manager)
    return manager, public


class SiteContentTests(unittest.TestCase):
    def test_checked_in_site_defaults_and_actual_photos_validate(self):
        self.assertEqual(validator.validate(REPO_ROOT), len(FIELDS))

    def test_valid_published_copy_and_real_uploaded_photos_validate(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            fixture(root)
            self.assertEqual(validator.validate(root), len(FIELDS))

    def test_concepts_can_edit_every_page_without_replacing_the_live_snapshot(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            manager, public = fixture(root)
            manager['revision'] = 2
            manager['content']['brand_name'] = 'Nieuwe conceptnaam'
            manager['content']['visible_events'] = False
            manager['content']['home_order'].reverse()
            write(root, manager, public)
            self.assertEqual(validator.validate(root), len(FIELDS))

    def test_new_concept_photos_need_cms_media_but_do_not_need_a_live_public_copy(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            manager, public = fixture(root)
            photo = png_bytes(4, 5)
            digest = hashlib.sha256(photo).hexdigest()
            path = root / f'cms/site-media/{digest}.png'
            path.write_bytes(photo)
            manager['content']['hero_image_1'].update(src=f'/images/site/{digest}.png', width=4, height=5)
            write(root, manager, public)
            self.assertEqual(validator.validate(root), len(FIELDS))
            path.unlink()
            with self.assertRaisesRegex(validator.ValidationError, 'Missing website photo'):
                validator.validate(root)

    def test_public_copy_must_exactly_match_the_immutable_snapshot(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            manager, public = fixture(root)
            public['content']['brand_name'] = 'Silently replaced live text'
            write(root, manager, public)
            with self.assertRaisesRegex(validator.ValidationError, 'immutable snapshot'):
                validator.validate(root)

    def test_unsafe_links_controls_and_unknown_fields_are_rejected(self):
        changes = [{'social_instagram': 'javascript:alert(1)'}, {'social_instagram': 'https://user:password@example.com'}, {'social_instagram': '//example.com'}, {'social_instagram': 'mailto:club@example.com?bcc=other@example.com'}, {'brand_name': '\u0000'}, {'unknown_setting': 'secret'}, {'visible_events': 'false'}, {'theme_accent': '#fff;bad'}, {'home_order': ['garage'] * len(SCHEMA['sections'])}]
        for change in changes:
            with self.subTest(change=change), tempfile.TemporaryDirectory() as folder:
                root = Path(folder)
                manager, public = fixture(root)
                manager['content'].update(change)
                write(root, manager, public)
                with self.assertRaises(validator.ValidationError):
                    validator.validate(root)

    def test_text_limits_use_browser_utf16_length_and_allow_plain_literal_markup(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            manager, public = fixture(root)
            manager['content']['brand_name'] = '🚘' * 251
            write(root, manager, public)
            with self.assertRaises(validator.ValidationError):
                validator.validate(root)
            manager['content']['brand_name'] = '怪獣 <letterlijke tekst>'
            write(root, manager, public)
            self.assertEqual(validator.validate(root), len(FIELDS))

    def test_temporary_browser_data_urls_and_untrusted_remote_photos_are_not_persistable(self):
        for src in ['data:image/png;base64,AAAA', 'https://tracker.example/photo.png', 'https://raw.githubusercontent.com/alldaydigital/Kaijuclub_kc/' + 'a' * 40 + '/cms/site-media/' + 'b' * 64 + '.png', '/images/../secret.png', '/images/site/arbitrary.png']:
            with self.subTest(src=src), tempfile.TemporaryDirectory() as folder:
                root = Path(folder)
                manager, public = fixture(root)
                manager['content']['hero_image_1']['src'] = src
                write(root, manager, public)
                with self.assertRaises(validator.ValidationError):
                    validator.validate(root)

    def test_real_dimensions_and_checksum_are_enforced_for_drafts_and_publications(self):
        for location in ['cms/site-media/' + DIGEST + '.png', 'public' + IMAGE_PATH]:
            with self.subTest(location=location), tempfile.TemporaryDirectory() as folder:
                root = Path(folder)
                fixture(root)
                (root / location).write_bytes(b'corrupt or replaced image')
                with self.assertRaisesRegex(validator.ValidationError, 'checksum mismatch'):
                    validator.validate(root)
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            manager, public = fixture(root)
            manager['content']['hero_image_1']['width'] = 99
            write(root, manager, public)
            with self.assertRaisesRegex(validator.ValidationError, 'dimensions mismatch'):
                validator.validate(root)

    def test_publication_photos_must_have_a_public_copy_and_format_matching_bytes(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            fixture(root)
            (root / ('public' + IMAGE_PATH)).unlink()
            with self.assertRaisesRegex(validator.ValidationError, 'Missing website photo'):
                validator.validate(root)
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            manager, public = fixture(root)
            for content in [manager['content'], manager['published']['content']]:
                content['hero_image_1']['src'] = IMAGE_PATH.replace('.png', '.jpg')
            for name in [f'cms/site-media/{DIGEST}.jpg', 'public' + IMAGE_PATH.replace('.png', '.jpg')]:
                (root / name).write_bytes(PNG)
            write(root, manager)
            with self.assertRaisesRegex(validator.ValidationError, 'format mismatch'):
                validator.validate(root)

    def test_missing_fields_invalid_crops_and_unknown_photo_metadata_are_rejected(self):
        for change in [{'positionDesktop': '100.5% 50%'}, {'positionMobile': '-1% 50%'}, {'width': True}, {'width': 0}, {'metadata': 'unexpected'}]:
            with self.subTest(change=change), tempfile.TemporaryDirectory() as folder:
                root = Path(folder)
                manager, public = fixture(root)
                manager['content']['hero_image_1'].update(change)
                write(root, manager, public)
                with self.assertRaises(validator.ValidationError):
                    validator.validate(root)
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            manager, public = fixture(root)
            del manager['content']['brand_name']
            write(root, manager, public)
            with self.assertRaises(validator.ValidationError):
                validator.validate(root)

    def test_invalid_history_and_manager_schemas_are_rejected(self):
        changes = [{'history': [None]}, {'history': [None] * 6}, {'revision': True}, {'revision': -1}, {'schemaVersion': 2}, {'updatedAt': 'not-a-date'}, {'unexpected': 'secret'}]
        for change in changes:
            with self.subTest(change=change), tempfile.TemporaryDirectory() as folder:
                root = Path(folder)
                manager, public = fixture(root)
                manager.update(change)
                write(root, manager, public)
                with self.assertRaises(validator.ValidationError):
                    validator.validate(root)

    def test_contact_emails_reject_attributes_slashes_and_oversized_values(self):
        for address in ['"club"@example.com', '<club>@example.com', 'club\\team@example.com', 'club@example".com', 'a' * 245 + '@example.com']:
            with self.subTest(address=address), tempfile.TemporaryDirectory() as folder:
                root = Path(folder)
                manager, public = fixture(root)
                manager['content']['contact_email'] = address
                write(root, manager, public)
                with self.assertRaises(validator.ValidationError):
                    validator.validate(root)
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            manager, public = fixture(root)
            manager['content']['contact_email'] = 'club+events@kaijuclub.be'
            write(root, manager, public)
            self.assertEqual(validator.validate(root), len(FIELDS))

    def test_calendar_timestamps_reject_impossible_dates_and_allow_actual_leap_days(self):
        for date in ['2026-02-31T10:00:00Z', '2026-02-29T10:00:00.000Z', '2026-04-31T10:00:00Z', '2026-10-13T25:00:00Z']:
            self.assertFalse(validator.timestamp(date), date)
        for date in ['2024-02-29T10:00:00Z', '2024-02-29T10:00:00.123Z']:
            self.assertTrue(validator.timestamp(date), date)

    def test_symlink_media_cannot_escape_the_checkout(self):
        with tempfile.TemporaryDirectory() as folder, tempfile.TemporaryDirectory() as outside:
            root = Path(folder)
            fixture(root)
            photo = root / f'cms/site-media/{DIGEST}.png'
            photo.unlink()
            target = Path(outside) / 'photo.png'
            target.write_bytes(PNG)
            photo.symlink_to(target)
            with self.assertRaisesRegex(validator.ValidationError, 'escapes checkout'):
                validator.validate(root)


if __name__ == '__main__':
    unittest.main()
