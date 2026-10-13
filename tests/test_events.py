from copy import deepcopy
from pathlib import Path
import hashlib,importlib.util,json,sys,tempfile,unittest
from test_vehicle_cms import png_bytes
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
import validate_events as validator
PNG=png_bytes();DIGEST=hashlib.sha256(PNG).hexdigest()
def fixture(root):
    photo=dict(src=f'/images/events/{DIGEST}.png',width=2,height=3,alt='Een clubfoto',caption='Onze meet',credit='Kaijuclub',positionDesktop='50% 100%',positionMobile='50% 50%')
    event=dict(id='moment-17920000000001',title='Onze meet',kind='meet',date='2026-10-01',location='Testlocatie',description='Een clubmoment.',story='Ons verhaal.',photos=[photo])
    record={**deepcopy(event),'published':deepcopy(event),'archived':False}
    manager=dict(schemaVersion=1,revision=1,events=[record]);public=dict(schemaVersion=1,events=[deepcopy(event)])
    for name in [f'cms/event-media/{DIGEST}.png',f'public/images/events/{DIGEST}.png']:
        path=root/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(PNG)
    write(root,manager,public);return manager,public

def write(root,manager,public):
    for name,data in [('cms/events.json',manager),('public/data/events.json',public)]:
        path=root/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(data))
class EventsTests(unittest.TestCase):
    def test_current_archive_is_valid(self):self.assertEqual(validator.validate(ROOT),len(json.loads((ROOT/'public/data/events.json').read_text())['events']))
    def test_actual_published_bytes_and_snapshot_validate(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);fixture(root);self.assertEqual(validator.validate(root),1)
    def test_new_draft_photos_need_only_cms_media_and_preserve_publication(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);manager,public=fixture(root);manager['events'][0]['title']='Concept';manager['events'][0]['published']=None;public['events']=[];(root/f'public/images/events/{DIGEST}.png').unlink();write(root,manager,public);self.assertEqual(validator.validate(root),0)
    def test_changed_public_content_and_missing_photos_are_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);manager,public=fixture(root);public['events'][0]['title']='Changed';write(root,manager,public)
            with self.assertRaises(ValueError):validator.validate(root)
            manager,public=fixture(root);(root/f'cms/event-media/{DIGEST}.png').unlink()
            with self.assertRaises(Exception):validator.validate(root)
    def test_forged_dimensions_or_replaced_bytes_are_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);manager,public=fixture(root);manager['events'][0]['photos'][0]['width']=5;write(root,manager,public)
            with self.assertRaises(ValueError):validator.validate(root)
            fixture(root);(root/f'cms/event-media/{DIGEST}.png').write_bytes(b'not an image')
            with self.assertRaises(ValueError):validator.validate(root)
    def test_dates_types_duplicate_ids_and_oversized_metadata_are_rejected(self):
        for mutation in [lambda r:r.update(date='2026-02-31'),lambda r:r.update(kind='bogus'),lambda r:r.update(title='x'*161),lambda r:r['photos'][0].update(caption='x'*501),lambda r:r['photos'][0].update(positionMobile='101% 50%')]:
            with tempfile.TemporaryDirectory() as folder:
                root=Path(folder);manager,public=fixture(root);mutation(manager['events'][0]);write(root,manager,public)
                with self.assertRaises(Exception):validator.validate(root)
    def test_data_svg_external_and_path_traversal_photo_sources_are_rejected(self):
        for source in ['data:image/png;base64,YWJj','/images/events/../../secret.png','https://example.com/image.png',f'/images/events/{DIGEST}.svg']:
            with tempfile.TemporaryDirectory() as folder:
                root=Path(folder);manager,public=fixture(root);manager['events'][0]['photos'][0]['src']=source;write(root,manager,public)
                with self.assertRaises(ValueError):validator.validate(root)
    def test_archived_report_is_not_public_and_retains_immutable_photo(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);manager,public=fixture(root);manager['events'][0]['archived']=True;public['events']=[];write(root,manager,public);self.assertEqual(validator.validate(root),0)
