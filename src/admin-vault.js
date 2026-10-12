const VAULT_KEY='kaijuclub.encrypted-connection.v1';
const encoder=new TextEncoder();
const toBase64=bytes=>btoa(String.fromCharCode(...bytes));
const fromBase64=value=>Uint8Array.from(atob(value),char=>char.charCodeAt(0));
async function passwordKey(password,salt,usage) {
  const material=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:310000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,[usage]);
}
export function hasVault() { try{return !!localStorage.getItem(VAULT_KEY)}catch{return false} }
export function forgetVault(){localStorage.removeItem(VAULT_KEY);}
export async function rememberConnection(token,password) {
  if(password.length<12)throw new Error('Gebruik een beheerwachtwoord van minimaal 12 tekens.');
  const salt=crypto.getRandomValues(new Uint8Array(16));const iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await passwordKey(password,salt,'encrypt');
  const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,encoder.encode(token)));
  localStorage.setItem(VAULT_KEY,JSON.stringify({version:1,salt:toBase64(salt),iv:toBase64(iv),data:toBase64(encrypted)}));
}
export async function unlockConnection(password) {
  try {
    const vault=JSON.parse(localStorage.getItem(VAULT_KEY));
    if(vault?.version!==1)throw new Error();
    const key=await passwordKey(password,fromBase64(vault.salt),'decrypt');
    const decoded=await crypto.subtle.decrypt({name:'AES-GCM',iv:fromBase64(vault.iv)},key,fromBase64(vault.data));
    return new TextDecoder().decode(decoded);
  }catch{throw new Error('Het beheerwachtwoord klopt niet of deze browser heeft geen geldige koppeling.');}
}
