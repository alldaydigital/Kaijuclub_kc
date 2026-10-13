import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {GitHubStore, ApiError} from '../src/admin-api.js';
import {newSiteManager, SITE_FIELDS, publicSiteContent} from '../src/site-model.js';
import {saveSiteContent, previewSiteContent} from '../src/site-store.js';
import {inspectRasterBytes,validateRasterUpload} from '../src/site-image-bytes.js';

// A complete, valid 1 × 1 PNG, rather than a signature-only upload fixture.
const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP476b7HwAGLAJyhC3+TAAAAABJRU5ErkJggg==';
const PNG_BYTES = Buffer.from(PNG_BASE64, 'base64');
// Pillow-generated 3 × 2 rasters cover progressive JPEG and both WebP codecs.
const PROGRESSIVE_JPEG = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wgARCAACAAMDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAL/xAAVAQEBAAAAAAAAAAAAAAAAAAAFBv/aAAwDAQACEAMQAAABoG0f/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABD3/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPxB//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPxB//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxB//9k=','base64');
const LOSSY_WEBP = Buffer.from('UklGRlwAAABXRUJQVlA4WAoAAAAQAAAAAgAAAQAAQUxQSAcAAAAAyMjIyMjIAFZQOCAuAAAA8AEAnQEqAwACAAFAJiWgAnS6AfgABfQAANpv/MEr8g3ah/9zge2T/bJ/6kAAAA==','base64');
const LOSSLESS_WEBP = Buffer.from('UklGRh4AAABXRUJQVlA4TBEAAAAvAkAAEAdQrdaXp8iBiOh/AAA=','base64');
const PNG_DIGEST = createHash('sha256').update(PNG_BYTES).digest('hex');
const CMS_MEDIA = `cms/site-media/${PNG_DIGEST}.png`;
const PUBLIC_MEDIA = `public/images/site/${PNG_DIGEST}.png`;
const IMAGE_KEYS = SITE_FIELDS.filter(field => field.type === 'image').map(field => field.key);
const TEXT_KEY = SITE_FIELDS.find(field => field.type === 'text').key;
const clone = value => structuredClone(value);
const sha = value => createHash('sha1').update(value).digest('hex');

function uploadImage(content, key = IMAGE_KEYS[0], source = `data:image/png;base64,${PNG_BASE64}`) {
  content[key] = {...content[key], src:source, width:1, height:1, alt:'Een testfoto'};
  return content;
}

/** Git's immutable trees are materialized only when a branch ref moves. */
class MemoryGitHubStore extends GitHubStore {
  constructor(manager = newSiteManager()) {
    super('ghp_synthetic_fixture_only');
    this.calls = [];
    this.blobs = new Map();
    this.trees = new Map();
    this.commits = new Map();
    this.refRace = false;
    this.truncated = false;
    this.sequence = 0;
    const tree = new Map([
      ['cms/site.json', this.addBlob(JSON.stringify(manager))],
      ['public/data/site.json', this.addBlob(JSON.stringify(publicSiteContent(manager)))],
    ]);
    const treeSha = this.addTree(tree);
    const commitSha = this.addCommit({tree:treeSha, parents:[], message:'Initial website'});
    this.remoteHead = commitSha;
    this.head = {sha:commitSha, tree:treeSha};
  }

  addBlob(value) {
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
    const blobSha = sha(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes]));
    this.blobs.set(blobSha, bytes);
    return blobSha;
  }

  addTree(entries) {
    const treeSha = sha(JSON.stringify([...entries].sort(([a],[b]) => a.localeCompare(b))));
    this.trees.set(treeSha, new Map(entries));
    return treeSha;
  }

  addCommit(commit) {
    const commitSha = sha(JSON.stringify({...commit, fixtureSequence:++this.sequence}));
    this.commits.set(commitSha, clone(commit));
    return commitSha;
  }

  branchTree() { return this.trees.get(this.commits.get(this.remoteHead).tree); }
  file(path) { const blobSha = this.branchTree().get(path); return blobSha ? this.blobs.get(blobSha) : null; }
  json(path) { return JSON.parse(this.file(path).toString('utf8')); }

  advanceRemote() {
    this.remoteHead = this.addCommit({tree:this.commits.get(this.remoteHead).tree, parents:[this.remoteHead], message:'Concurrent change'});
  }

  async request(path, options = {}) {
    const method = options.method || 'GET';
    this.calls.push({path, method, body:clone(options.body)});
    const endpoint = path.replace(`repos/${this.repository}/`, '');
    if (method === 'GET' && endpoint === `git/ref/heads/${this.branch}`) return {object:{sha:this.remoteHead}};
    if (method === 'GET' && /^git\/trees\/[^?]+\?recursive=1$/.test(endpoint)) {
      const treeSha = endpoint.slice('git/trees/'.length).split('?')[0];
      assert.ok(this.trees.has(treeSha), 'the editor reads its immutable base tree');
      return {truncated:this.truncated, tree:[...this.trees.get(treeSha)].map(([path,sha]) => ({path,sha,type:'blob',mode:'100644'}))};
    }
    if (method === 'POST' && endpoint === 'git/blobs') {
      assert.equal(options.body.encoding, 'base64');
      return {sha:this.addBlob(Buffer.from(options.body.content, 'base64'))};
    }
    if (method === 'POST' && endpoint === 'git/trees') {
      const entries = new Map(this.trees.get(options.body.base_tree));
      for (const entry of options.body.tree) {
        assert.equal(entry.type, 'blob');
        assert.equal(entry.mode, '100644');
        const blobSha = entry.sha || this.addBlob(entry.content);
        assert.ok(this.blobs.has(blobSha), 'tree entries reference an existing immutable blob');
        entries.set(entry.path, blobSha);
      }
      return {sha:this.addTree(entries)};
    }
    if (method === 'POST' && endpoint === 'git/commits') {
      const commitSha = this.addCommit(options.body);
      if (this.refRace) this.advanceRemote();
      return {sha:commitSha};
    }
    if (method === 'PATCH' && endpoint === `git/refs/heads/${this.branch}`) {
      assert.equal(options.body.force, false, 'publication must never overwrite a concurrent commit');
      const commit = this.commits.get(options.body.sha);
      if (commit.parents[0] !== this.remoteHead) throw new ApiError('The branch advanced during publication.',409);
      this.remoteHead = options.body.sha;
      return {object:{sha:this.remoteHead}};
    }
    assert.fail(`Unexpected GitHub operation: ${method} ${endpoint}`);
  }
}

const writes = store => store.calls.filter(call => call.method !== 'GET');
const blobUploads = store => store.calls.filter(call => call.method === 'POST' && call.path.endsWith('/git/blobs'));
const treeWrites = store => store.calls.filter(call => call.method === 'POST' && call.path.endsWith('/git/trees'));

test('Website saves reject a stale branch before uploading images or writing any files', async () => {
  const manager = newSiteManager(), before = clone(manager), store = new MemoryGitHubStore(manager);
  const originalHead = clone(store.head), content = uploadImage(clone(manager.content));
  store.advanceRemote();
  await assert.rejects(saveSiteContent(store,manager,content,'publish'), error => error instanceof ApiError && error.status === 409);
  assert.equal(store.calls.length,1);
  assert.deepEqual(writes(store),[]);
  assert.deepEqual(store.head,originalHead);
  assert.deepEqual(manager,before);
  assert.deepEqual(store.json('public/data/site.json'),publicSiteContent(before));
});

test('Website drafts preserve the live snapshot and keep new media outside the public directory', async () => {
  const manager = newSiteManager(), before = clone(manager), store = new MemoryGitHubStore(manager);
  const content = uploadImage(clone(manager.content));
  content[TEXT_KEY] = 'Tekst die nog niet gepubliceerd mag worden';
  const progress = [];
  const saved = await saveSiteContent(store,manager,content,'draft',{onProgress:value => progress.push(value)});
  assert.equal(saved.content[IMAGE_KEYS[0]].src,`/images/site/${PNG_DIGEST}.png`);
  assert.equal(saved.manager.revision,1);
  assert.equal(saved.manager.content[TEXT_KEY],content[TEXT_KEY]);
  assert.deepEqual(saved.manager.published,before.published);
  assert.deepEqual(store.json('public/data/site.json'),publicSiteContent(before));
  assert.deepEqual(store.json('cms/site.json'),saved.manager);
  assert.deepEqual(store.file(CMS_MEDIA),PNG_BYTES);
  assert.equal(store.file(PUBLIC_MEDIA),null);
  assert.deepEqual(manager,before,'an unsuccessful caller can retain its original state');
  assert.equal(content[IMAGE_KEYS[0]].src,`data:image/png;base64,${PNG_BASE64}`,'normalization does not mutate the local draft');
  assert.equal(blobUploads(store).length,1);
  assert.equal(treeWrites(store).length,1);
  assert.equal(store.calls.filter(call => call.path.endsWith('/git/commits')).length,1);
  assert.equal(store.calls.at(-1).method,'PATCH');
  assert.equal(store.head.sha,saved.commit);
  assert.ok(progress.some(message => message.includes('Foto')));
});

test('Publishing a saved draft reuses its existing media blob and atomically updates the public snapshot', async () => {
  const manager = newSiteManager(), store = new MemoryGitHubStore(manager);
  const draft = await saveSiteContent(store,manager,uploadImage(clone(manager.content)),'draft');
  const originalPublished = clone(draft.manager.published);
  store.calls = [];
  const published = await saveSiteContent(store,draft.manager,draft.content,'publish');
  assert.equal(blobUploads(store).length,0,'saved draft media should not be uploaded again');
  assert.deepEqual(store.file(PUBLIC_MEDIA),PNG_BYTES);
  assert.equal(store.branchTree().get(PUBLIC_MEDIA),store.branchTree().get(CMS_MEDIA));
  assert.deepEqual(store.json('public/data/site.json'),publicSiteContent(published.manager));
  assert.deepEqual(published.manager.history,[originalPublished]);
  assert.equal(published.manager.published.revision,2);
  const entries = treeWrites(store)[0].body.tree;
  assert.ok(entries.some(entry => entry.path === PUBLIC_MEDIA));
  assert.ok(entries.some(entry => entry.path === 'cms/site.json'));
  assert.ok(entries.some(entry => entry.path === 'public/data/site.json'));
  assert.equal(store.calls.filter(call => call.method === 'PATCH').length,1);
});

test('A new draft after publication retains the published image, copy, and publication history', async () => {
  const manager = newSiteManager(), store = new MemoryGitHubStore(manager);
  const published = await saveSiteContent(store,manager,uploadImage(clone(manager.content)),'publish');
  const live = store.json('public/data/site.json'), history = clone(published.manager.history);
  const concept = clone(published.content);
  concept[TEXT_KEY] = 'Nieuwe concepttekst';
  concept[IMAGE_KEYS[0]] = clone(manager.content[IMAGE_KEYS[0]]);
  const draft = await saveSiteContent(store,published.manager,concept,'draft');
  assert.deepEqual(store.json('public/data/site.json'),live);
  assert.deepEqual(draft.manager.history,history);
  assert.deepEqual(draft.manager.published,published.manager.published);
  assert.deepEqual(store.file(PUBLIC_MEDIA),PNG_BYTES);
});

test('Using the same upload in several website sections creates one media blob', async () => {
  const manager = newSiteManager(), store = new MemoryGitHubStore(manager);
  const content = uploadImage(uploadImage(clone(manager.content),IMAGE_KEYS[0]),IMAGE_KEYS[1]);
  const saved = await saveSiteContent(store,manager,content,'publish');
  assert.equal(blobUploads(store).length,1);
  assert.equal(saved.content[IMAGE_KEYS[0]].src,saved.content[IMAGE_KEYS[1]].src);
  const entries = treeWrites(store)[0].body.tree;
  assert.equal(entries.filter(entry => entry.path === CMS_MEDIA).length,1);
  assert.equal(entries.filter(entry => entry.path === PUBLIC_MEDIA).length,1);
});

test('A concurrent change during final publication never advances the editor head or exposes the candidate files', async () => {
  const manager = newSiteManager(), before = clone(manager), store = new MemoryGitHubStore(manager);
  const originalHead = clone(store.head), live = store.json('public/data/site.json');
  store.refRace = true;
  await assert.rejects(saveSiteContent(store,manager,uploadImage(clone(manager.content)),'publish'),error => error instanceof ApiError && error.status === 409);
  assert.deepEqual(store.head,originalHead);
  assert.deepEqual(manager,before);
  assert.notEqual(store.remoteHead,originalHead.sha,'a concurrent commit stays on the branch');
  assert.deepEqual(store.json('public/data/site.json'),live);
  assert.equal(store.file(PUBLIC_MEDIA),null);
  assert.equal(store.calls.at(-1).body.force,false);
});

test('Missing saved media in the current draft, live snapshot, or history refuses a tree write', async () => {
  for (const location of ['draft','published','history']) {
    const manager = newSiteManager(), store = new MemoryGitHubStore(manager);
    const missing = {...manager.content[IMAGE_KEYS[0]],src:`/images/site/${'a'.repeat(64)}.png`,width:1,height:1};
    const content = clone(manager.content);
    if (location === 'draft') content[IMAGE_KEYS[0]] = missing;
    if (location === 'published') manager.published.content[IMAGE_KEYS[0]] = missing;
    if (location === 'history') {
      manager.history = [clone(manager.published)];
      manager.history[0].content[IMAGE_KEYS[0]] = missing;
    }
    const before = clone(manager), originalHead = clone(store.head);
    await assert.rejects(saveSiteContent(store,manager,content,'draft'),/foto ontbreekt/);
    assert.deepEqual(writes(store),[],`${location} media must exist before saving the projection`);
    assert.deepEqual(manager,before);
    assert.deepEqual(store.head,originalHead);
  }
});

test('An upload with a mismatched raster MIME type is rejected before creating a blob', async () => {
  const manager = newSiteManager(), store = new MemoryGitHubStore(manager);
  const content = uploadImage(clone(manager.content),IMAGE_KEYS[0],`data:image/webp;base64,${PNG_BASE64}`);
  await assert.rejects(saveSiteContent(store,manager,content,'publish'),/fotobestand.*formaat/);
  assert.deepEqual(writes(store),[]);
});

test('A truncated Git tree cannot be used to save website content', async () => {
  const manager = newSiteManager(), store = new MemoryGitHubStore(manager);
  store.truncated = true;
  await assert.rejects(saveSiteContent(store,manager,clone(manager.content),'draft'),/niet veilig geladen/);
  assert.deepEqual(writes(store),[]);
});

test('Draft preview image URLs pin the immutable commit and never include connection credentials', () => {
  const content = clone(newSiteManager().content);
  content[IMAGE_KEYS[0]] = {...content[IMAGE_KEYS[0]],src:`/images/site/${PNG_DIGEST}.png`,width:1,height:1};
  const before = clone(content), headSha = 'b'.repeat(40);
  const preview = previewSiteContent(content,headSha);
  assert.equal(preview[IMAGE_KEYS[0]].src,`https://raw.githubusercontent.com/alldaydigital/Kaijuclub_kc/${headSha}/${CMS_MEDIA}`);
  assert.deepEqual(preview[IMAGE_KEYS[1]],content[IMAGE_KEYS[1]],'bundled photos remain local');
  assert.deepEqual(content,before);
  assert.ok(!JSON.stringify(preview).includes('ghp_'));
  assert.ok(!preview[IMAGE_KEYS[0]].src.includes('?'));
  for (const invalid of ['',undefined,'main','ghp_not_a_commit','c'.repeat(39),'C'.repeat(40)]) {
    assert.deepEqual(previewSiteContent(content,invalid),content);
  }
});

test('Raster inspection reads real PNG, progressive JPEG, alpha WebP and lossless WebP dimensions', async () => {
  for (const [bytes,mime,size] of [[PNG_BYTES,'png',{width:1,height:1}],[PROGRESSIVE_JPEG,'image/jpeg',{width:3,height:2}],[LOSSY_WEBP,'webp',{width:3,height:2}],[LOSSLESS_WEBP,'webp',{width:3,height:2}]]) {
    assert.deepEqual(inspectRasterBytes(bytes,mime),size);
    assert.deepEqual(await validateRasterUpload(bytes,mime,size,{decoder:undefined}),size);
  }
});

test('Raster inspection rejects corrupt PNG chunks, truncated JPEG scans, incomplete WebP and MIME mismatches', () => {
  const corruptPng=Buffer.from(PNG_BYTES);corruptPng[40]^=1;
  for (const [bytes,mime] of [[corruptPng,'png'],[PNG_BYTES.subarray(0,33),'png'],[PROGRESSIVE_JPEG.subarray(0,-2),'jpeg'],[LOSSY_WEBP.subarray(0,-1),'webp'],[LOSSLESS_WEBP.subarray(0,-1),'webp'],[PNG_BYTES,'jpeg'],[PNG_BYTES,'webp']]) {
    assert.throws(()=>inspectRasterBytes(bytes,mime),/beschadigd of onvolledig/);
  }
});

test('Raster verification checks the declared dimensions before decoding and closes decoded bitmaps', async () => {
  let decodes=0,closes=0;
  const decoder=async(blob,options)=>{
    decodes++;
    assert.equal(blob.type,'image/png');
    assert.deepEqual(Buffer.from(await blob.arrayBuffer()),PNG_BYTES);
    assert.equal(options.imageOrientation,'none');
    return {width:1,height:1,close:()=>closes++};
  };
  await assert.rejects(validateRasterUpload(PNG_BYTES,'png',{width:2,height:1},{decoder}),/afmetingen.*foto/);
  assert.equal(decodes,0);
  assert.deepEqual(await validateRasterUpload(PNG_BYTES,'png',{width:1,height:1},{decoder}),{width:1,height:1});
  assert.equal(decodes,1);
  assert.equal(closes,1);
  await assert.rejects(validateRasterUpload(PNG_BYTES,'png',{width:1,height:1},{decoder:async()=>({width:2,height:1,close:()=>closes++})}),/beschadigd of onvolledig/);
  assert.equal(closes,2,'a failed browser decode must also release the bitmap');
  await assert.rejects(validateRasterUpload(PNG_BYTES,'png',{width:1,height:1},{decoder:async()=>{throw new Error('Private decoder detail');}}),error=>!error.message.includes('Private decoder detail'));
});

test('Incorrect uploaded image dimensions refuse every GitHub write', async () => {
  const manager = newSiteManager(), store = new MemoryGitHubStore(manager);
  const content=uploadImage(clone(manager.content));content[IMAGE_KEYS[0]].width=2;
  await assert.rejects(saveSiteContent(store,manager,content,'publish'),/afmetingen.*foto/);
  assert.deepEqual(writes(store),[]);
});

test('A corrupt PNG with its original signature refuses every GitHub write', async () => {
  const manager = newSiteManager(), store = new MemoryGitHubStore(manager);
  const corrupt=Buffer.from(PNG_BYTES);corrupt[40]^=1;
  const content=uploadImage(clone(manager.content),IMAGE_KEYS[0],`data:image/png;base64,${corrupt.toString('base64')}`);
  await assert.rejects(saveSiteContent(store,manager,content,'publish'),/beschadigd of onvolledig/);
  assert.deepEqual(writes(store),[]);
});
