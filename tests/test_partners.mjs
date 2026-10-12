import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyPartners,updatePartner,publicPartners,safeWebsite,validatePartners} from '../src/partners-model.js';
import {GitHubStore,ApiError} from '../src/admin-api.js';
import {sendRequest} from '../src/requests.js';
const partner={id:'partner-123456789',name:'Test partner',kind:'sponsor',description:'Een test, geen echte sponsor.',website:'https://example.com/',logo:''};
test('Partner concepts preserve the live snapshot; publish and archive update the projection',()=>{
  let data=updatePartner(emptyPartners(),partner,'draft');assert.deepEqual(publicPartners(data).partners,[]);
  data=updatePartner(data,partner,'publish');assert.equal(publicPartners(data).partners[0].name,'Test partner');
  data=updatePartner(data,{...partner,name:'New concept'},'draft');assert.equal(publicPartners(data).partners[0].name,'Test partner');
  data=updatePartner(data,{...partner,name:'New concept'},'publish');assert.equal(publicPartners(data).partners[0].name,'New concept');
  data=updatePartner(data,partner,'archive');assert.deepEqual(publicPartners(data).partners,[]);
  data=updatePartner(data,partner,'publish');assert.equal(publicPartners(data).partners.length,1);
});
test('Partner links and logos reject executable URLs, credentials and duplicate identities',()=>{
  for(const value of ['javascript:alert(1)','http://example.com','https://user:password@example.com'])assert.throws(()=>safeWebsite(value));
  assert.throws(()=>updatePartner(emptyPartners(),{...partner,logo:'data:image/svg+xml;base64,AAAA'},'publish'));
  const data=updatePartner(emptyPartners(),partner,'publish');assert.throws(()=>validatePartners({...data,partners:[...data.partners,...data.partners]}));
});
test('Partner saves commit both files together and reject a stale GitHub snapshot',async()=>{
  const store=new GitHubStore('test-token');store.head={sha:'old',tree:'base'};const calls=[];
  store.request=async(path,options={})=>{calls.push({path,options});if(path.includes('git/ref/'))return {object:{sha:'old'}};if(path.endsWith('git/trees'))return {sha:'tree'};if(path.endsWith('git/commits'))return {sha:'new'};return {};};
  const data=updatePartner(emptyPartners(),partner,'publish');assert.equal(await store.saveFiles({'cms/partners.json':data,'public/data/partners.json':publicPartners(data)},'Publish partner'),'new');
  const tree=calls.find(call=>call.path.endsWith('git/trees'));assert.deepEqual(tree.options.body.tree.map(item=>item.path),['cms/partners.json','public/data/partners.json']);assert.equal(calls.at(-1).options.body.force,false);
  store.request=async()=>({object:{sha:'changed'}});await assert.rejects(store.saveFiles({},'stale'),error=>error instanceof ApiError&&error.status===409);assert.equal(store.head.sha,'new');
});
test('Forms require a confirmed provider response and never accept HTTP errors as sent',async()=>{
  let request;const fetcher=async(url,options)=>{request={url,options};return {ok:true,json:async()=>({success:'true'})};};
  await sendRequest({email:'visitor@example.com',naam:'Visitor'},'Event',{fetcher});assert.equal(request.options.credentials,'omit');assert.equal(JSON.parse(request.options.body).email,'visitor@example.com');
  for(const response of [{ok:false},{ok:true,json:async()=>({success:false})},{ok:true,json:async()=>({})}])await assert.rejects(sendRequest({},'Event',{fetcher:async()=>response}));
});
