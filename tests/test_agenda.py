import sys,json,tempfile,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from validate_agenda import validate_event,validate_agenda
class AgendaTests(unittest.TestCase):
    def record(self,**changes):
        return dict(id='agenda-12345678-1234-4234-8234-123456789abc',title='Test event',kind='meet',date='2026-10-17',endDate='',startTime='',endTime='',location='Test location',address='',description='',website='',attendance='confirmed',**changes)
    def test_current_calendar(self):validate_agenda(Path(__file__).resolve().parents[1])
    def test_date_and_time(self):
        base=self.record()
        for changes in [{'date':'2026-02-29'},{'endDate':'2026-10-16'},{'startTime':'24:00'},{'endTime':'12:00'},{'startTime':'23:00','endTime':'01:00'}]:
            with self.subTest(changes=changes),self.assertRaises(ValueError):validate_event(base|changes,True)
        validate_event(base|{'startTime':'23:00','endTime':'01:00','endDate':'2026-10-18'},True)
    def test_missing_copy_unsafe_urls_utf16(self):
        for changes in [{'title':''},{'date':''},{'location':''},{'website':'https://user:pass@example.org'},{'website':'http://example.org'},{'title':'😀'*81},{'kind':[]}]:
            with self.subTest(changes=changes),self.assertRaises(ValueError):validate_event(self.record()|changes,True)
    def test_snapshot_mismatch(self):
        with tempfile.TemporaryDirectory() as path:
            root=Path(path);(root/'cms').mkdir();(root/'public/data').mkdir(parents=True);snapshot=self.record();record=snapshot|{'title':'Draft name','published':snapshot,'archived':False}
            (root/'cms/agenda.json').write_text(json.dumps({'schemaVersion':1,'revision':1,'events':[record]}));public={'schemaVersion':1,'events':[snapshot]};(root/'public/data/agenda.json').write_text(json.dumps(public));self.assertEqual(validate_agenda(root),1)
            public['events'][0]['title']='Leaked draft';(root/'public/data/agenda.json').write_text(json.dumps(public))
            with self.assertRaises(ValueError):validate_agenda(root)
if __name__=='__main__':unittest.main()
