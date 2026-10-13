// Use the browser's standard HTTP client for GitHub's authenticated API.
// A failed write is never resent: its outcome may already have reached GitHub.
let requestSequence=0;
export function gitHubRequest(url,options={}) {
  let target;try{target=new URL(url);}catch{return Promise.reject(new TypeError('Unsupported API destination'));}
  if(target.origin!=='https://api.github.com'||target.username||target.password)return Promise.reject(new TypeError('Unsupported API destination'));
  if(typeof XMLHttpRequest==='undefined')return fetch(url,{...options,credentials:'omit',redirect:'error',referrerPolicy:'no-referrer'});
  // Fresh ref checks are essential for optimistic saves. Avoid extra request
  // headers, which would require additional CORS permissions from GitHub.
  if((options.method||'GET').toUpperCase()==='GET')target.searchParams.set('_kc',`${Date.now()}-${++requestSequence}`);
  return new Promise((resolve,reject)=>{
    const xhr=new XMLHttpRequest();let done=false;
    const cleanup=()=>{options.signal?.removeEventListener('abort',abort);xhr.onload=xhr.onerror=xhr.onabort=xhr.ontimeout=null;};
    const finish=(error,response)=>{if(done)return;done=true;cleanup();error?reject(error):resolve(response);};
    const abort=()=>{xhr.abort();finish(new DOMException('Request aborted','AbortError'));};
    if(options.signal?.aborted){finish(new DOMException('Request aborted','AbortError'));return;}
    try {
      xhr.open(options.method||'GET',target.href,true);xhr.withCredentials=false;xhr.timeout=45000;
      for(const [name,value] of new Headers(options.headers||{}))xhr.setRequestHeader(name,value);
      xhr.onload=()=>{
        try {
          if(new URL(xhr.responseURL).origin!=='https://api.github.com')throw new TypeError('Unexpected API redirect');
          const headers=new Headers();
          for(const line of xhr.getAllResponseHeaders().split(/\r?\n/)){const colon=line.indexOf(':');if(colon>0)headers.append(line.slice(0,colon),line.slice(colon+1).trim());}
          finish(null,new Response([204,205,304].includes(xhr.status)?null:xhr.responseText,{status:xhr.status,headers}));
        }catch(error){finish(error);}
      };
      xhr.onerror=()=>finish(new TypeError('API network request failed'));
      xhr.ontimeout=()=>finish(new DOMException('Request timed out','TimeoutError'));
      xhr.onabort=()=>finish(new DOMException('Request aborted','AbortError'));
      options.signal?.addEventListener('abort',abort,{once:true});
      xhr.send(options.body??null);
    }catch(error){finish(error);}
  });
}
