const DATABASE='kaijuclub-editor-recovery';
async function database(){return new Promise((resolve,reject)=>{const request=indexedDB.open(DATABASE,1);request.onupgradeneeded=()=>request.result.createObjectStore('drafts',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function transaction(mode,work){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('drafts',mode);let result;work(tx.objectStore('drafts'),value=>{result=value});tx.oncomplete=()=>{db.close();resolve(result)};tx.onerror=()=>{db.close();reject(tx.error)};});}
export const keepRecovery=record=>transaction('readwrite',store=>store.put({...record,recoveredAt:Date.now()}));
export const clearRecovery=id=>transaction('readwrite',store=>store.delete(id));
export const recoverDrafts=()=>transaction('readonly',(store,done)=>{store.getAll().onsuccess=event=>done(event.target.result);});
