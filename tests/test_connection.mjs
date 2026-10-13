import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeConnectionToken,connectionTokenKind,checkGitHubConnection} from '../src/admin-auth.js';
import {GitHubStore,ApiError} from '../src/admin-api.js';

// Synthetic fixtures: these strings are not credentials and no test uses the network.
const fineGrained='github_pat_connection_fixture_123';
const classic='ghp_connection_fixture_123';
const repository='alldaydigital/Kaijuclub_kc';
const api='https://api.github.com/';
const repoPath=`repos/${repository}`;

const response=(status,data={},headers={})=>new Response(JSON.stringify(data),{
  status,headers:{'Content-Type':'application/json',...headers},
});

function connectionFixture({metadata={},writeStatus=201,writeHeaders={}}={}) {
  const calls=[];
  const store=new GitHubStore(fineGrained,{fetcher:async(url,options={})=>{
    calls.push({url,options});
    if(url===api+'user')return response(200,{login:'fixture-owner',avatar_url:'https://example.invalid/avatar'});
    if(url===api+repoPath)return response(200,metadata);
    if(url===api+repoPath+'/git/blobs')return response(writeStatus,{sha:'a'.repeat(40)},writeHeaders);
    throw new Error('Unexpected connection request');
  }});
  let loadCount=0;
  store.load=async()=>{loadCount++;return {schemaVersion:1,revision:0,vehicles:[]};};
  return {store,calls,get loadCount(){return loadCount;}};
}

test('both GitHub personal-access key formats accept surrounding whitespace',()=>{
  assert.equal(normalizeConnectionToken(` \n${fineGrained}\t `),fineGrained);
  assert.equal(normalizeConnectionToken(` \r\n${classic} `),classic);
  assert.equal(connectionTokenKind(fineGrained),'fine-grained');
  assert.equal(connectionTokenKind(classic),'classic');
});

test('connection keys reject SSH keys, OAuth keys, embedded whitespace, and other text',()=>{
  const rejected=[
    '', '   ', 'github_pat_', 'ghp_',
    'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAfixture example@example.invalid',
    '-----BEGIN OPENSSH PRIVATE KEY-----\nfixture\n-----END OPENSSH PRIVATE KEY-----',
    'gho_oauth_fixture', 'ghu_oauth_fixture', 'ghs_installation_fixture',
    'github_pat_connection fixture', 'ghp_connection\nfixture',
    'github_pat_connection-fixture', 'ghp_connection.fixture',
    `Bearer ${fineGrained}`, `https://example.invalid/${classic}`,
    'random-password', null, undefined,
  ];
  for(const value of rejected)assert.throws(()=>normalizeConnectionToken(value));
});

test('a successful write-scope probe connects even when repository permission metadata is absent',async()=>{
  const fixture=connectionFixture();
  const result=await fixture.store.connect();
  assert.equal(result.login,'Clubbeheer');
  assert.equal(fixture.loadCount,1);
  assert.deepEqual(fixture.calls.map(({url,options})=>[url,options.method]),[
    [api+repoPath,'GET'],[api+repoPath+'/git/blobs','POST'],
  ]);
  const probe=fixture.calls.at(-1);
  assert.equal(probe.options.headers.Authorization,'Bearer '+fineGrained);
  assert.equal(probe.options.credentials,'omit');
  assert.equal(probe.options.redirect,'error');
  assert.equal(probe.options.referrerPolicy,'no-referrer');
  assert.equal(JSON.parse(probe.options.body).encoding,'utf-8');
  assert.ok(!probe.options.body.includes(fineGrained));
  assert.ok(fixture.calls.every(({url})=>!url.includes('/git/refs/')));
});

test('a denied write probe never loads the collection or changes a branch',async()=>{
  const fixture=connectionFixture({metadata:{permissions:{push:true}},writeStatus:403});
  await assert.rejects(fixture.store.connect(),error=>{
    assert.equal(error.status,403);
    assert.match(error.message,/Contents/i);
    assert.match(error.message,/Read and write/i);
    return true;
  });
  assert.equal(fixture.loadCount,0);
  assert.equal(fixture.store.head,null);
  assert.equal(fixture.store.catalog,null);
  assert.ok(fixture.calls.every(({options})=>options.method!=='PATCH'));
  assert.equal(fixture.calls.filter(({options})=>options.method==='POST').length,1);
});

test('an invalid or expired key has a specific safe error and stops before any write',async()=>{
  const calls=[];
  const providerMarker='PROVIDER_BODY_SHOULD_NEVER_APPEAR';
  const store=new GitHubStore(classic,{fetcher:async(url)=>{
    calls.push(url);
    return response(401,{message:providerMarker+' '+classic});
  }});
  await assert.rejects(store.connect(),error=>{
    assert.equal(error.status,401);
    assert.match(error.message,/ongeldig|verlopen/i);
    assert.ok(!error.message.includes(providerMarker));
    assert.ok(!error.message.includes(classic));
    return true;
  });
  assert.deepEqual(calls,[api+repoPath]);
});

test('GitHub request-limit headers yield a temporary-limit error rather than a write-permission error',async()=>{
  for(const headers of [
    {'X-RateLimit-Remaining':'0','X-RateLimit-Reset':'2000000000'},
    {'Retry-After':'60'},
  ]) {
    const store=new GitHubStore(fineGrained,{fetcher:async()=>response(403,
      {message:'untrusted provider body '+fineGrained},headers)});
    await assert.rejects(store.request(repoPath+'/git/blobs',{method:'POST',body:{content:'fixture'}}),error=>{
      assert.equal(error.status,403);
      assert.match(error.message,/limiet|tijdelijk|te veel|beperkt/i);
      assert.doesNotMatch(error.message,/Contents|Read and write/i);
      assert.ok(!error.message.includes(fineGrained));
      assert.ok(!error.message.includes('untrusted provider body'));
      return true;
    });
  }
});

test('an organization SSO requirement is distinguished from Contents permissions without reflecting its URL',async()=>{
  const providerMarker='PROVIDER_SSO_MARKER';
  const store=new GitHubStore(classic,{fetcher:async()=>response(403,
    {message:providerMarker+' '+classic},
    {'X-GitHub-SSO':`required; url=https://example.invalid/${providerMarker}/${classic}`})});
  await assert.rejects(store.request(repoPath),error=>{
    assert.equal(error.status,403);
    assert.match(error.message,/SSO|organisatie/i);
    assert.ok(!error.message.includes(providerMarker));
    assert.ok(!error.message.includes(classic));
    assert.ok(!error.message.includes('https://example.invalid'));
    return true;
  });
});

test('an inaccessible repository explains key repository selection and does not run the write probe',async()=>{
  const calls=[];
  const fixture=connectionFixture();
  fixture.store.fetcher=async(url,options)=>{
    calls.push({url,options});
    if(url===api+'user')return response(200,{login:'fixture-owner'});
    return response(404,{message:'arbitrary provider text '+fineGrained});
  };
  await assert.rejects(fixture.store.connect(),error=>{
    assert.equal(error.status,404);
    assert.match(error.message,/repository/i);
    assert.match(error.message,/select|toegang|account|organisatie|resource owner/i);
    assert.ok(!error.message.includes('arbitrary provider text'));
    assert.ok(!error.message.includes(fineGrained));
    return true;
  });
  assert.equal(fixture.loadCount,0);
  assert.deepEqual(calls.map(({url})=>url),[api+repoPath]);
});

test('the public reachability probe verifies the intended repository without sending credentials or cookies',async()=>{
  const calls=[];
  const result=await checkGitHubConnection({fetcher:async(url,options)=>{
    calls.push({url,options});
    return response(200,{full_name:'AllDayDigital/Kaijuclub_kc'});
  }});
  assert.equal(result.reachable,true);
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,api+repoPath);
  assert.equal(calls[0].options.credentials,'omit');
  assert.equal(calls[0].options.referrerPolicy,'no-referrer');
  const headers=new Headers(calls[0].options.headers);
  assert.equal(headers.get('Authorization'),null);
  assert.equal(headers.get('Cookie'),null);
  assert.ok(calls[0].options.signal instanceof AbortSignal);
});

test('a response for another repository cannot pass the public reachability probe',async()=>{
  const providerMarker='UNTRUSTED_REPOSITORY_'+fineGrained;
  for(const data of [{full_name:providerMarker},{},null]) {
    const result=await checkGitHubConnection({fetcher:async()=>response(200,data)});
    assert.equal(result.reachable,false);
    assert.ok(!result.message.includes(providerMarker));
    assert.ok(!result.message.includes(fineGrained));
  }
});

test('a blocked public request reports unreachable without reflecting browser or provider errors',async()=>{
  const providerMarker='UNTRUSTED_BROWSER_ERROR_'+classic;
  const result=await checkGitHubConnection({fetcher:async()=>{throw new TypeError(providerMarker);}});
  assert.equal(result.reachable,false);
  assert.match(result.message,/browser|verbinding|netwerk/i);
  assert.ok(!result.message.includes(providerMarker));
  assert.ok(!result.message.includes(classic));
});

test('a non-JSON public proxy response is unreachable and never appears in the user message',async()=>{
  const providerMarker='PROXY_HTML_'+fineGrained;
  const result=await checkGitHubConnection({fetcher:async()=>new Response(`<html>${providerMarker}</html>`,{
    status:200,headers:{'Content-Type':'text/html'},
  })});
  assert.equal(result.reachable,false);
  assert.ok(!result.message.includes(providerMarker));
  assert.ok(!result.message.includes(fineGrained));
});

test('a public GitHub rate-limit response remains distinguishable from a blocked connection',async()=>{
  const result=await checkGitHubConnection({fetcher:async()=>response(429,{
    message:'UNTRUSTED_LIMIT_BODY '+fineGrained,
  },{'Retry-After':'60'})});
  assert.equal(result.reachable,true);
  assert.match(result.message,/beperkt|limiet|tijdelijk/i);
  assert.ok(!result.message.includes('UNTRUSTED_LIMIT_BODY'));
  assert.ok(!result.message.includes(fineGrained));
});

test('a failed authenticated write uses a tokenless probe and never retries the uncertain write',async()=>{
  const calls=[];
  const store=new GitHubStore(fineGrained,{fetcher:async(url,options)=>{
    calls.push({url,options});
    if(new Headers(options.headers).has('Authorization'))throw new TypeError('PRIVATE_NETWORK_ERROR '+fineGrained);
    return response(200,{full_name:repository});
  }});
  await assert.rejects(store.request(repoPath+'/git/blobs',{method:'POST',body:{content:'fixture'}}),error=>{
    assert.ok(error instanceof ApiError);
    assert.match(error.message,/GitHub is bereikbaar/i);
    assert.match(error.message,/beheersleutel/i);
    assert.ok(!error.message.includes(fineGrained));
    assert.ok(!error.message.includes('PRIVATE_NETWORK_ERROR'));
    return true;
  });
  assert.equal(calls.length,2);
  assert.equal(calls[0].options.method,'POST');
  assert.equal(calls[0].url,api+repoPath+'/git/blobs');
  assert.equal(calls[1].url,api+repoPath);
  assert.equal(calls[1].options.method??'GET','GET');
  assert.equal(new Headers(calls[1].options.headers).get('Authorization'),null);
  assert.equal(calls[1].options.credentials,'omit');
  assert.equal(store.token,fineGrained);
});

test('when authenticated and public requests are blocked, the error explains reachability instead of blaming the key',async()=>{
  const calls=[];
  const store=new GitHubStore(classic,{fetcher:async(url,options)=>{
    calls.push({url,options});
    throw new TypeError('UNTRUSTED_FETCH_ERROR '+classic);
  }});
  await assert.rejects(store.request('user'),error=>{
    assert.ok(error instanceof ApiError);
    assert.match(error.message,/niet bereiken|verbinding|netwerk/i);
    assert.doesNotMatch(error.message,/ongeldig|verlopen/i);
    assert.ok(!error.message.includes('UNTRUSTED_FETCH_ERROR'));
    assert.ok(!error.message.includes(classic));
    return true;
  });
  assert.equal(calls.length,2);
  assert.equal(calls[1].url,api+repoPath);
  assert.equal(new Headers(calls[1].options.headers).get('Authorization'),null);
  assert.equal(calls[1].options.credentials,'omit');
});

test('invalid JSON from an HTTP 200 authenticated request yields an explicit response error without a network probe',async()=>{
  const calls=[];
  const providerMarker='UNTRUSTED_HTML '+classic;
  const store=new GitHubStore(classic,{fetcher:async(url,options)=>{
    calls.push({url,options});
    return new Response(`<html>${providerMarker}</html>`,{status:200,headers:{'Content-Type':'text/html'}});
  }});
  await assert.rejects(store.request('user'),error=>{
    assert.ok(error instanceof ApiError);
    assert.equal(error.status,200);
    assert.match(error.message,/antwoord.*gelezen/i);
    assert.ok(!error.message.includes(providerMarker));
    assert.ok(!error.message.includes(classic));
    return true;
  });
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,api+'user');
});
