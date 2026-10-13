import './brand.css';
import {validateImage} from './site-model.js';
import {siteAssetURL} from './site-render.js';
import {onSiteContentChange,isSitePreview} from './site-content.js';
const base=import.meta.env.BASE_URL;
function applyLogo(image){
 try{validateImage(image,{preview:isSitePreview});}catch{return;}
 for(const element of document.querySelectorAll('[data-brand-logo]')){element.src=siteAssetURL(image.src,base);element.alt=image.alt;element.width=image.width;element.height=image.height;element.classList.toggle('is-prepared-logo',image.src==='/images/kaiju-club-logo.png');}
}
onSiteContentChange(content=>applyLogo(content.brand_logo_image));
// Editors use the published logo, including when an owner changes it later.
if(!document.querySelector('main [data-cms-group],main[data-cms-group]'))void fetch(base+'data/site.json',{cache:'no-cache',credentials:'omit',signal:AbortSignal.timeout(10000)}).then(response=>{if(!response.ok)throw Error();return response.json();}).then(data=>applyLogo(data.content?.brand_logo_image)).catch(()=>{});
