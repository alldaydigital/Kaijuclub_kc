import test from 'node:test';
import assert from 'node:assert/strict';
import {gitHubRequest} from '../src/admin-transport.js';

const endpoint='https://api.github.com/repos/alldaydigital/Kaijuclub_kc';
const syntheticKey='github_pat_transport_fixture_123';

async function withXHR(scenario,run) {
  const originalXHR=Object.getOwnPropertyDescriptor(globalThis,'XMLHttpRequest');
  const originalFetch=Object.getOwnPropertyDescriptor(globalThis,'fetch');
  const instances=[];
  let fetchCalls=0;
  class FakeXHR {
    constructor(){
      this.withCredentials=true;
      this.headers=new Headers();
      this.listeners=new Map();
      this.sent=[];
      this.abortCount=0;
      this.status=200;
      this.statusText='OK';
      this.responseText='{"full_name":"alldaydigital/Kaijuclub_kc"}';
      this.response=this.responseText;
      this.responseURL=endpoint;
      this.responseHeaders='Content-Type: application/json\r\nX-RateLimit-Remaining: 59\r\n';
      instances.push(this);
    }
    open(method,url,async){this.method=method;this.url=url;this.responseURL=url;this.async=async;this.readyState=1;}
    setRequestHeader(name,value){this.headers.append(name,value);}
    getAllResponseHeaders(){return this.responseHeaders;}
    addEventListener(type,handler,options={}){
      const listeners=this.listeners.get(type)||[];
      listeners.push({handler,once:!!options.once});this.listeners.set(type,listeners);
    }
    removeEventListener(type,handler){this.listeners.set(type,(this.listeners.get(type)||[]).filter(item=>item.handler!==handler));}
    send(body){this.sent.push(body);queueMicrotask(()=>scenario(this));}
    abort(){this.abortCount++;this.emit('abort');}
    emit(type){
      if(type==='load')this.readyState=4;
      const event=new Event(type);
      this['on'+type]?.call(this,event);
      for(const {handler,once} of [...(this.listeners.get(type)||[])]){
        if(once)this.removeEventListener(type,handler);
        if(typeof handler==='function')handler.call(this,event);else handler.handleEvent(event);
      }
    }
  }
  Object.defineProperty(globalThis,'XMLHttpRequest',{configurable:true,writable:true,value:FakeXHR});
  Object.defineProperty(globalThis,'fetch',{configurable:true,writable:true,value:async()=>{
    fetchCalls++;throw new Error('Fetch must not run when XMLHttpRequest is available');
  }});
  try{return await run({instances,get fetchCalls(){return fetchCalls;}});}
  finally{
    if(originalXHR)Object.defineProperty(globalThis,'XMLHttpRequest',originalXHR);else delete globalThis.XMLHttpRequest;
    if(originalFetch)Object.defineProperty(globalThis,'fetch',originalFetch);else delete globalThis.fetch;
  }
}

test('browser GET uses XMLHttpRequest, omits browser credentials, and returns standard response headers',async()=>{
  await withXHR(xhr=>xhr.emit('load'),async fixture=>{
    const result=await gitHubRequest(endpoint,{headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+syntheticKey}});
    assert.ok(result instanceof Response);
    assert.equal(result.status,200);
    assert.equal(result.headers.get('X-RateLimit-Remaining'),'59');
    assert.equal((await result.json()).full_name,'alldaydigital/Kaijuclub_kc');
    assert.equal(fixture.instances.length,1);
    const xhr=fixture.instances[0];
    assert.equal(xhr.method,'GET');
    const requested=new URL(xhr.url);
    const expected=new URL(endpoint);
    assert.equal(requested.origin,expected.origin);
    assert.equal(requested.pathname,expected.pathname);
    assert.ok(requested.searchParams.get('_kc'));
    assert.equal(xhr.async,true);
    assert.equal(xhr.withCredentials,false);
    assert.equal(xhr.headers.get('Authorization'),'Bearer '+syntheticKey);
    assert.equal(xhr.headers.get('Accept'),'application/vnd.github+json');
    assert.equal(xhr.headers.get('Cookie'),null);
    assert.equal(xhr.sent.length,1);
    assert.ok(xhr.sent[0]==null);
    assert.equal(fixture.fetchCalls,0);
  });
});

test('repeated browser GETs stay fresh even within one clock tick and preserve existing query parameters',async()=>{
  const originalNow=Date.now;
  Date.now=()=>1700000000000;
  try{
    await withXHR(xhr=>xhr.emit('load'),async fixture=>{
      const url=endpoint+'/git/trees/fixture?recursive=1&per_page=25&filter=a%20b&filter=c';
      await gitHubRequest(url);
      await gitHubRequest(url,{method:'GET'});
      assert.equal(fixture.instances.length,2);
      const requests=fixture.instances.map(xhr=>new URL(xhr.url));
      for(const requested of requests){
        assert.equal(requested.origin,'https://api.github.com');
        assert.equal(requested.pathname,new URL(url).pathname);
        assert.equal(requested.searchParams.get('recursive'),'1');
        assert.equal(requested.searchParams.get('per_page'),'25');
        assert.deepEqual(requested.searchParams.getAll('filter'),['a b','c']);
        assert.ok(requested.searchParams.get('_kc'));
      }
      assert.notEqual(requests[0].href,requests[1].href);
      assert.equal(fixture.fetchCalls,0);
    });
  }finally{Date.now=originalNow;}
});

test('cache prevention never alters POST or PATCH write destinations or repeats their bodies',async()=>{
  await withXHR(xhr=>xhr.emit('load'),async fixture=>{
    const writes=[
      {method:'POST',url:endpoint+'/git/blobs?fixture=one',body:'{"content":"fixture"}'},
      {method:'PATCH',url:endpoint+'/git/refs/heads/main?fixture=two',body:'{"sha":"fixture","force":false}'},
    ];
    for(const {url,...options} of writes)await gitHubRequest(url,options);
    assert.equal(fixture.instances.length,writes.length);
    for(let index=0;index<writes.length;index++){
      const xhr=fixture.instances[index],expected=writes[index];
      assert.equal(xhr.method,expected.method);
      assert.equal(xhr.url,expected.url);
      assert.equal(new URL(xhr.url).searchParams.has('_kc'),false);
      assert.deepEqual(xhr.sent,[expected.body]);
    }
    assert.equal(fixture.fetchCalls,0);
  });
});

test('a browser write sends the exact method, headers, and UTF-8 JSON body once',async()=>{
  const body=JSON.stringify({content:'Kaijuclub 🚘 verbinding',encoding:'utf-8'});
  await withXHR(xhr=>{xhr.status=201;xhr.statusText='Created';xhr.responseText='{"sha":"fixture-sha"}';xhr.response=xhr.responseText;xhr.emit('load');},async fixture=>{
    const result=await gitHubRequest(endpoint+'/git/blobs',{
      method:'POST',headers:{Authorization:'Bearer '+syntheticKey,'Content-Type':'application/json'},body,
    });
    assert.equal(result.status,201);
    assert.equal((await result.json()).sha,'fixture-sha');
    assert.equal(fixture.instances.length,1);
    const xhr=fixture.instances[0];
    assert.equal(xhr.method,'POST');
    assert.equal(xhr.url,endpoint+'/git/blobs');
    assert.equal(xhr.withCredentials,false);
    assert.equal(xhr.headers.get('Content-Type'),'application/json');
    assert.deepEqual(xhr.sent,[body]);
    assert.equal(fixture.fetchCalls,0);
  });
});

test('HTTP error statuses and GitHub diagnostic headers reach the caller unchanged',async()=>{
  for(const status of [401,403,404,429]) {
    await withXHR(xhr=>{
      xhr.status=status;xhr.statusText='GitHub error';xhr.responseText='{"message":"fixture error"}';xhr.response=xhr.responseText;
      xhr.responseHeaders='Content-Type: application/json\r\nX-RateLimit-Remaining: 0\r\nRetry-After: 60\r\nX-GitHub-SSO: required\r\n';
      xhr.emit('load');
    },async fixture=>{
      const result=await gitHubRequest(endpoint);
      assert.equal(result.status,status);
      assert.equal(result.ok,false);
      assert.equal(result.headers.get('X-RateLimit-Remaining'),'0');
      assert.equal(result.headers.get('Retry-After'),'60');
      assert.equal(result.headers.get('X-GitHub-SSO'),'required');
      assert.equal((await result.json()).message,'fixture error');
      assert.equal(fixture.instances.length,1);
    });
  }
});

test('a no-content HTTP response remains a valid standard Response',async()=>{
  await withXHR(xhr=>{xhr.status=204;xhr.statusText='No Content';xhr.responseText='';xhr.response='';xhr.emit('load');},async()=>{
    const result=await gitHubRequest(endpoint,{method:'DELETE'});
    assert.equal(result.status,204);
    assert.equal(await result.text(),'');
  });
});

test('non-GitHub URLs are rejected before sending credentials or starting any transport',async()=>{
  const rejected=[
    'http://api.github.com/user',
    'https://github.com/user',
    'https://api.github.com.example.invalid/user',
    'https://api.github.com@example.invalid/user',
    'https://fixture@api.github.com/user',
    'https://api.github.com:444/user',
    'https://example.invalid/?next=https://api.github.com/user',
    '/repos/alldaydigital/Kaijuclub_kc',
  ];
  await withXHR(xhr=>xhr.emit('load'),async fixture=>{
    for(const url of rejected)await assert.rejects(async()=>gitHubRequest(url,{headers:{Authorization:'Bearer '+syntheticKey}}));
    assert.ok(fixture.instances.every(xhr=>xhr.sent.length===0));
    assert.equal(fixture.fetchCalls,0);
  });
});

test('a browser network error never retries an uncertain write through XMLHttpRequest or fetch',async()=>{
  await withXHR(xhr=>xhr.emit('error'),async fixture=>{
    await assert.rejects(gitHubRequest(endpoint+'/git/blobs',{method:'POST',body:'{"content":"fixture"}'}));
    assert.equal(fixture.instances.length,1);
    assert.equal(fixture.instances[0].sent.length,1);
    assert.equal(fixture.fetchCalls,0);
  });
});

test('a browser timeout rejects without repeating an uncertain write',async()=>{
  await withXHR(xhr=>xhr.emit('timeout'),async fixture=>{
    await assert.rejects(gitHubRequest(endpoint+'/git/blobs',{method:'POST',body:'fixture'}));
    assert.equal(fixture.instances.length,1);
    assert.deepEqual(fixture.instances[0].sent,['fixture']);
    assert.equal(fixture.fetchCalls,0);
  });
});

test('an already aborted signal prevents a write from being sent',async()=>{
  const controller=new AbortController();controller.abort();
  await withXHR(xhr=>xhr.emit('load'),async fixture=>{
    await assert.rejects(gitHubRequest(endpoint+'/git/blobs',{method:'POST',body:'fixture',signal:controller.signal}));
    assert.ok(fixture.instances.every(xhr=>xhr.sent.length===0));
    assert.equal(fixture.fetchCalls,0);
  });
});

test('aborting an in-flight browser write cancels its transport and never retries',async()=>{
  const controller=new AbortController();
  await withXHR(()=>controller.abort(),async fixture=>{
    await assert.rejects(gitHubRequest(endpoint+'/git/blobs',{method:'POST',body:'fixture',signal:controller.signal}));
    assert.equal(fixture.instances.length,1);
    assert.deepEqual(fixture.instances[0].sent,['fixture']);
    assert.equal(fixture.instances[0].abortCount,1);
    assert.equal(fixture.fetchCalls,0);
  });
});

test('a response redirected outside the GitHub API is rejected rather than exposed as trusted data',async()=>{
  await withXHR(xhr=>{
    xhr.responseURL='https://example.invalid/intercepted';
    xhr.responseText='{"full_name":"untrusted/repository"}';xhr.response=xhr.responseText;xhr.emit('load');
  },async fixture=>{
    await assert.rejects(gitHubRequest(endpoint));
    assert.equal(fixture.instances.length,1);
    assert.equal(fixture.instances[0].sent.length,1);
    assert.equal(fixture.fetchCalls,0);
  });
});

test('fetch is used only when XMLHttpRequest is unavailable and preserves the single request',async()=>{
  const originalXHR=Object.getOwnPropertyDescriptor(globalThis,'XMLHttpRequest');
  const originalFetch=Object.getOwnPropertyDescriptor(globalThis,'fetch');
  const calls=[];
  const body='{"content":"fixture"}';
  Object.defineProperty(globalThis,'XMLHttpRequest',{configurable:true,writable:true,value:undefined});
  Object.defineProperty(globalThis,'fetch',{configurable:true,writable:true,value:async(url,options)=>{
    calls.push({url,options});return responseForFetch();
  }});
  try{
    const result=await gitHubRequest(endpoint+'/git/blobs',{method:'POST',headers:{Authorization:'Bearer '+syntheticKey},body});
    assert.equal(result.status,201);
    assert.equal(calls.length,1);
    assert.equal(calls[0].url,endpoint+'/git/blobs');
    assert.equal(calls[0].options.method,'POST');
    assert.equal(calls[0].options.body,body);
    assert.equal(calls[0].options.credentials,'omit');
    assert.equal(calls[0].options.redirect,'error');
    await assert.rejects(async()=>gitHubRequest('https://example.invalid/',{method:'POST',body}));
    assert.equal(calls.length,1);
  }finally{
    if(originalXHR)Object.defineProperty(globalThis,'XMLHttpRequest',originalXHR);else delete globalThis.XMLHttpRequest;
    if(originalFetch)Object.defineProperty(globalThis,'fetch',originalFetch);else delete globalThis.fetch;
  }
});

function responseForFetch(){return new Response('{"sha":"fixture-sha"}',{status:201,headers:{'Content-Type':'application/json'}});}
