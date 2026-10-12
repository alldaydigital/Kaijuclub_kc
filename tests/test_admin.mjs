import test from 'node:test';
import assert from 'node:assert/strict';
import {newVehicle,validateFields,cleanFields,fingerprint,publicCatalog,vehicleForSite} from '../src/admin-model.js';
import {GitHubStore} from '../src/admin-api.js';
const digest='a'.repeat(64),blobSha='b'.repeat(40),head='c'.repeat(40),tree='d'.repeat(40),next='e'.repeat(40);
function record(){const value=newVehicle();value.name='Nissan Skyline';value.photos=[{path:`cms/media/${value.id.slice(5)}/${digest}.png`,digest,extension:'png',width:2,height:3,alt:'Skyline',blobSha}];return value;}
const catalog=value=>({schemaVersion:1,revision:0,updatedAt:null,vehicles:value?[value]:[]});
function fakeStore({stale=false,failRef=false}={}){
 const calls=[];
 const fetcher=async(url,options={})=>{const body=options.body?JSON.parse(options.body):null;calls.push({url,options,body});let data={};let status=200;
 if(url.endsWith('/git/ref/heads/main'))data={object:{sha:stale?next:head}};
 else if(url.endsWith('/git/blobs'))data={sha:blobSha};
 else if(url.endsWith('/git/trees'))data={sha:tree};
 else if(url.endsWith('/git/commits'))data={sha:next};
 else if(url.endsWith('/git/refs/heads/main')){data={object:{sha:next}};status=failRef?422:200;}
 else throw new Error('Unexpected test request '+url);
 return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
 };
 const store=new GitHubStore('fixture-key',{fetcher});store.head={sha:head,tree};store.catalog=catalog();return {store,calls};
}

test('concepts are saved separately and never replace a published snapshot',async()=>{
 const vehicle=record();vehicle.published=cleanFields(vehicle);vehicle.name='Nieuwe conceptnaam';
 const {store,calls}=fakeStore();store.catalog=catalog(vehicle);store.publicMode='managed';
 const result=await store.save(vehicle,'draft');assert.equal(result.record.name,'Nieuwe conceptnaam');assert.equal(result.publicCatalog.vehicles[0].name,'Nissan Skyline');
 const committed=calls.find(call=>call.url.endsWith('/git/trees')).body.tree;
 assert.ok(committed.some(entry=>entry.path==='cms/catalog.json'));assert.ok(committed.some(entry=>entry.path==='public/data/vehicles.json'));
 assert.ok(calls.find(call=>call.url.endsWith('/git/refs/heads/main')).body.force===false);
});
test('publishing uploads every new photo before a single tree/commit/ref update',async()=>{
 const vehicle=record();delete vehicle.photos[0].blobSha;vehicle.photos[0].file=new File([new Uint8Array([1,2,3])],'fixture.png');
 const {store,calls}=fakeStore();const result=await store.save(vehicle,'publish');
 assert.equal(result.record.published.name,vehicle.name);assert.equal(result.publicCatalog.mode,'managed');
 const methods=calls.filter(call=>call.options.method&&call.options.method!=='GET').map(call=>call.url.split('/').slice(-2).join('/'));
 assert.deepEqual(methods,['git/blobs','git/trees','git/commits','heads/main']);
 const entries=calls.find(call=>call.url.endsWith('/git/trees')).body.tree;
 assert.ok(entries.some(entry=>entry.path.startsWith('cms/media/')));assert.ok(entries.some(entry=>entry.path.startsWith('public/images/vehicles/')));
 assert.ok(!JSON.stringify(entries).includes('fixture-key'));
});
test('first draft preserves reference mode; hiding the final actual car keeps managed mode',()=>{
 const vehicle=record();assert.equal(publicCatalog(catalog(vehicle)).mode,'reference');
 vehicle.published=cleanFields(vehicle);vehicle.archived=true;const result=publicCatalog(catalog(vehicle),'managed');assert.equal(result.mode,'managed');assert.deepEqual(result.vehicles,[]);
});
test('stale state is rejected before uploads and retains in-memory work',async()=>{
 const vehicle=record();const {store,calls}=fakeStore({stale:true});const previous=store.catalog;
 await assert.rejects(store.save(vehicle,'publish'),error=>error.status===409);assert.equal(calls.length,1);assert.equal(store.catalog,previous);assert.equal(store.head.sha,head);
});
test('a ref race never advances local success state or forces another writer out',async()=>{
 const vehicle=record();const {store,calls}=fakeStore({failRef:true});const previous=store.catalog;
 await assert.rejects(store.save(vehicle,'publish'),error=>error.status===422);assert.equal(store.catalog,previous);assert.equal(store.head.sha,head);assert.equal(calls.at(-1).body.force,false);
});
test('publishing rejects incomplete fields before any API request',async()=>{
 const {store,calls}=fakeStore();await assert.rejects(store.save(newVehicle(),'publish'),/naam/);assert.equal(calls.length,0);
});
test('incomplete drafts can be stored, but photo paths and crop cannot escape their constraints',()=>{
 assert.doesNotThrow(()=>validateFields(newVehicle()));const vehicle=record();vehicle.photos[0].path='cms/media/../secret';assert.throws(()=>validateFields(vehicle));
 vehicle.photos[0].path=`cms/media/${vehicle.id.slice(5)}/${digest}.png`;vehicle.position='50%;background:url(x)';assert.throws(()=>validateFields(vehicle));
});
test('site projection preserves paragraphs/specs/photo order and uses safe public paths',()=>{
 const vehicle=record();vehicle.story='Eigen verhaal.\n\nTweede alinea.';vehicle.specs=[{label:'Motor',value:'RB26'}];const projected=vehicleForSite(vehicle);
 assert.equal(projected.intro,'Eigen verhaal.');assert.deepEqual(projected.paragraphs,['Tweede alinea.']);assert.deepEqual(projected.specs,vehicle.specs);assert.ok(projected.image.startsWith('/images/vehicles/'));assert.equal(projected.reference,false);
});
test('photo file objects and local blob URLs cannot be serialized into cloud records',()=>{
 const vehicle=record();vehicle.photos[0].file=new File(['bytes'],'photo.png');vehicle.photos[0].previewUrl='blob:secret-local-preview';
 const clean=cleanFields(vehicle);assert.ok(!JSON.stringify(clean).includes('blob:'));assert.equal(clean.photos[0].file,undefined);
 const before=fingerprint(vehicle);vehicle.photos[0].blobSha='f'.repeat(40);assert.equal(fingerprint(vehicle),before);
});
test('public deployment polling sends no authentication or credential to the public endpoint',async()=>{
 let captured;const store=new GitHubStore('fixture-secret',{fetcher:async(url,options)=>{captured={url,options};return new Response(JSON.stringify({workflow_runs:[{head_sha:next,status:'completed',conclusion:'success'}]}));}});
 assert.equal((await store.deployment(next)).state,'live');assert.equal(captured.options.headers.Authorization,undefined);assert.equal(captured.options.credentials,'omit');
});
test('saving a concept preserves the order of existing live cars and omits transient URLs',async()=>{
 const a=record(),b=record();a.published=cleanFields(a);b.published=cleanFields(b);b.photos[0].remoteUrl='https://temporary-preview';
 const {store}=fakeStore();store.catalog=catalog();store.catalog.vehicles=[a,b];store.publicMode='managed';a.name='Draft title';
 const result=await store.save(a,'draft');assert.deepEqual(result.publicCatalog.vehicles.map(item=>item.id),[a.id,b.id]);assert.ok(!JSON.stringify(result.catalog).includes('temporary-preview'));
});
test('long introductions with emoji use whole characters rather than broken UTF-16',()=>{
 const vehicle=record();vehicle.story='🚘'.repeat(250);assert.equal(Array.from(vehicleForSite(vehicle).teaser).length,240);
});
