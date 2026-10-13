import test from 'node:test';
import assert from 'node:assert/strict';
import {sendRequest,REQUEST_ENDPOINT} from '../src/requests.js';

test('The default contact mailbox retains the established FormSubmit endpoint',async()=>{
  let request;
  await sendRequest({naam:'Visitor',email:'visitor@example.com'},'Event',{fetcher:async(url,options)=>{request={url,options};return {ok:true,json:async()=>({success:true})};}});
  assert.equal(request.url,REQUEST_ENDPOINT);
  assert.equal(request.options.credentials,'omit');
  assert.equal(request.options.referrerPolicy,'no-referrer');
  assert.deepEqual(JSON.parse(request.options.body),{naam:'Visitor',email:'visitor@example.com',_subject:'Event',_template:'table',_captcha:'false'});
});

test('A custom mailbox stays inside the FormSubmit URL path',async()=>{
  let url;
  await sendRequest({naam:'Visitor'},'Custom subject',{recipient:'events+club@example.com',fetcher:async(value)=>{url=value;return {ok:true,json:async()=>({success:'true'})};}});
  assert.equal(url,'https://formsubmit.co/ajax/events%2Bclub@example.com');
  const parsed=new URL(url);
  assert.equal(parsed.origin,'https://formsubmit.co');
  assert.equal(parsed.search,'');
  assert.equal(parsed.hash,'');
});

test('Invalid recipients are rejected before starting a network request',async()=>{
  for(const recipient of ['', 'not-an-email', 'club@example.com\nBcc: another@example.com', 'club@@example.com', '"club"@example.com', 'club@localhost', 'club\\name@example.com']){
    let calls=0;
    await assert.rejects(sendRequest({},'Event',{recipient,fetcher:async()=>{calls++;return {ok:true,json:async()=>({success:true})};}}));
    assert.equal(calls,0);
  }
});

test('Offline previews never submit a visitor request',async()=>{
  globalThis.__KAIJU_OFFLINE__=true;
  try{
    const offline=await import('../src/requests.js?offline-test');
    let calls=0;
    await assert.rejects(offline.sendRequest({},'Event',{fetcher:async()=>{calls++;return {ok:true,json:async()=>({success:true})};}}));
    assert.equal(calls,0);
  }finally{delete globalThis.__KAIJU_OFFLINE__;}
});
