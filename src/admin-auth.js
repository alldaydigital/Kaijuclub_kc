export function normalizeConnectionToken(value) {
  const token=String(value??'').trim();
  if(!/^(github_pat_|ghp_)[A-Za-z0-9_]+$/.test(token))throw new Error('Deze tekst is geen herkenbare GitHub-beheersleutel. Klik op Beheersleutel aanmaken en kopieer de volledige sleutel die GitHub na Generate token toont (github_pat_ of ghp_). Je beheerwachtwoord hoort in het aparte wachtwoordveld.');
  return token;
}
export function connectionTokenKind(value){return normalizeConnectionToken(value).startsWith('ghp_')?'classic':'fine-grained';}
export async function checkGitHubConnection({fetcher=fetch}={}) {
  try {
    const response=await fetcher('https://api.github.com/repos/alldaydigital/Kaijuclub_kc',{headers:{Accept:'application/vnd.github+json'},credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(10000)});
    if(!response.ok)return {reachable:true,message:response.status===403||response.status===429?'GitHub is bereikbaar, maar beperkt deze verbinding momenteel. Probeer later opnieuw.':'GitHub is bereikbaar, maar de website-repository kon niet geladen worden.'};
    const repo=await response.json();if(repo.full_name?.toLowerCase()!=='alldaydigital/kaijuclub_kc')return {reachable:false,message:'Deze verbinding gaf geen herkenbaar antwoord van GitHub. Open het beheer rechtstreeks in je browser en probeer opnieuw.'};
    return {reachable:true,message:'GitHub en de website-repository zijn bereikbaar. Verbind nu met je beheersleutel om de schrijfrechten te controleren.'};
  }catch{return {reachable:false,message:'Deze browser kan GitHub niet bereiken. Open het beheer rechtstreeks in een apart browsertabblad. Controleer of privacy-extensies of je netwerk api.github.com blokkeren; probeer eventueel een ander netwerk.'};}
}
