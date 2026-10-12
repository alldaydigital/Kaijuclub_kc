"""Verify browser-managed concepts, immutable live versions and actual media."""
from pathlib import Path
import hashlib, importlib.util, json, sys, tempfile, unittest
from copy import deepcopy
from test_vehicle_cms import png_bytes
SPEC=importlib.util.spec_from_file_location('validate_collection',Path(__file__).resolve().parents[1]/'scripts/validate_collection.py')
validator=importlib.util.module_from_spec(SPEC);sys.modules[SPEC.name]=validator;SPEC.loader.exec_module(validator)
PNG=png_bytes();DIGEST=hashlib.sha256(PNG).hexdigest()

def fixture(root,published=True):
    path=f'cms/media/123/{DIGEST}.png';photo={'path':path,'digest':DIGEST,'extension':'png','width':2,'height':3,'alt':'Eigen foto','blobSha':'a'*40}
    file=root/path;file.parent.mkdir(parents=True);file.write_bytes(PNG)
    fields={'id':'club-123','name':'Eigen clubwagen','category':'street','series':'R34','origin':'Japan','story':'Een eigen verhaal.\n\nTweede alinea.','specs':[{'label':'Motor','value':'RB26'}],'photos':[photo],'featured':False,'position':'50% 50%'}
    record={**fields,'published':deepcopy(fields) if published else None,'archived':False,'updatedAt':'2026-10-12T10:00:00Z'}
    manager={'schemaVersion':1,'revision':1,'updatedAt':record['updatedAt'],'vehicles':[record]}
    public={'schemaVersion':1,'source':'site-editor','mode':'managed' if published else 'reference','updatedAt':manager['updatedAt'],'vehicles':[validator.projection(fields)] if published else []}
    if published:
        output=root/('public'+public['vehicles'][0]['image']);output.parent.mkdir(parents=True);output.write_bytes(PNG)
    write(root,manager,public);return manager,public

def write(root,manager,public):
    for path,value in [('cms/catalog.json',manager),('public/data/vehicles.json',public)]:
        target=root/path;target.parent.mkdir(parents=True,exist_ok=True);target.write_text(json.dumps(value))

class SiteCatalogTests(unittest.TestCase):
    def test_published_vehicle_and_real_media_validate(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);fixture(root);self.assertEqual(validator.validate_collection(root),1)
    def test_concept_edits_do_not_replace_the_published_snapshot(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);manager,public=fixture(root);manager['vehicles'][0]['name']='Nieuwe conceptnaam';write(root,manager,public)
            self.assertEqual(validator.validate_collection(root),1)
    def test_incomplete_concept_without_photos_is_not_public(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);manager,public=fixture(root,False);manager['vehicles'][0]['name']='';manager['vehicles'][0]['photos']=[];write(root,manager,public)
            self.assertEqual(validator.validate_collection(root),0)
    def test_wrong_public_projection_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);manager,public=fixture(root);public['vehicles'][0]['name']='Wrong';write(root,manager,public)
            with self.assertRaises(validator.ValidationError):validator.validate_collection(root)
    def test_corrupt_or_replaced_photo_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);manager,_=fixture(root);(root/manager['vehicles'][0]['photos'][0]['path']).write_bytes(b'not the uploaded image')
            with self.assertRaises(validator.ValidationError):validator.validate_collection(root)
    def test_photo_path_traversal_and_foreign_vehicle_folder_are_rejected(self):
        for path in ['cms/media/../private',f'cms/media/456/{DIGEST}.png']:
            with self.subTest(path=path),tempfile.TemporaryDirectory() as folder:
                root=Path(folder);manager,public=fixture(root);manager['vehicles'][0]['photos'][0]['path']=path;write(root,manager,public)
                with self.assertRaises(validator.ValidationError):validator.validate_collection(root)
    def test_modified_dimensions_on_reused_photo_are_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);manager,public=fixture(root);manager['vehicles'][0]['published']['photos'][0]['width']=44;write(root,manager,public)
            with self.assertRaises(validator.ValidationError):validator.validate_collection(root)
    def test_archived_car_is_not_public_but_its_photos_are_retained(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);manager,public=fixture(root);manager['vehicles'][0]['archived']=True;public['vehicles']=[];write(root,manager,public)
            self.assertEqual(validator.validate_collection(root),0);self.assertTrue((root/manager['vehicles'][0]['photos'][0]['path']).exists())
    def test_duplicate_vehicle_and_missing_published_photos_are_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);manager,public=fixture(root);manager['vehicles'].append(deepcopy(manager['vehicles'][0]));write(root,manager,public)
            with self.assertRaises(validator.ValidationError):validator.validate_collection(root)
    def test_symlink_media_cannot_escape_the_checkout(self):
        with tempfile.TemporaryDirectory() as folder,tempfile.TemporaryDirectory() as outside:
            root=Path(folder);manager,public=fixture(root);photo=root/manager['vehicles'][0]['photos'][0]['path'];photo.unlink();target=Path(outside)/'image.png';target.write_bytes(PNG);photo.symlink_to(target)
            with self.assertRaises(validator.ValidationError):validator.validate_collection(root)
