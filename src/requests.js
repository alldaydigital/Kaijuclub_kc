import {siteText,onSiteContentChange,isSitePreview} from './site-content.js';

const isRequestPreview=isSitePreview||globalThis.__KAIJU_OFFLINE__===true;
export const REQUEST_ENDPOINT='https://formsubmit.co/ajax/kaijuclub.be@gmail.com';
function requestEndpoint(recipient){
  const email=String(recipient).trim();
  if(!/^[^\s<>"\\@]+@[^\s<>"\\@]+\.[^\s<>"\\@]+$/.test(email)||email.length>254)throw new Error('Het e-mailadres voor aanvragen is niet geldig.');
  return 'https://formsubmit.co/ajax/'+encodeURIComponent(email).replace(/%40/gi,'@');
}
export async function sendRequest(fields,subject,{fetcher=fetch,recipient=siteText('contact_email')||'kaijuclub.be@gmail.com'}={}) {
  if(isRequestPreview)throw new Error(siteText('request_preview'));
  const response=await fetcher(requestEndpoint(recipient),{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({...fields,_subject:subject,_template:'table',_captcha:'false'}),signal:AbortSignal.timeout(30000),credentials:'omit',referrerPolicy:'no-referrer'});
  if(!response.ok)throw new Error('De aanvraag kon niet bevestigd worden.');
  const data=await response.json();
  if(data.success!==true&&data.success!=='true')throw new Error('De e-maildienst kon je aanvraag niet bevestigen.');
  return data;
}
for(const form of (typeof document==='undefined'?[]:document.querySelectorAll('.request-form'))) {
  const date=form.querySelector('input[type="date"]');if(date){const now=new Date();date.min=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;}
  const status=form.querySelector('.form-status');
  const updateCopy=()=>{
    const consent=form.querySelector('.consent [data-cms-text]');
    if(consent)consent.textContent=siteText(consent.dataset.cmsText,{email:siteText('contact_email')});
    if(isRequestPreview){status.textContent=siteText('request_preview');status.dataset.state='preview';}
    else if(status.dataset.state==='pending')status.textContent=siteText('request_sending');
    else if(status.dataset.state==='success')status.textContent=siteText('request_success');
    else if(status.dataset.state==='error')status.textContent=siteText('request_error',{email:siteText('contact_email')});
  };
  onSiteContentChange(updateCopy);
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(isRequestPreview){updateCopy();return;}
    if(!form.reportValidity())return;
    const fields=Object.fromEntries(new FormData(form));if(fields.website)return;
    delete fields.website;delete fields.toestemming;
    const button=form.querySelector('[type="submit"]');
    if(button.disabled)return;
    button.disabled=true;form.setAttribute('aria-busy','true');status.dataset.state='pending';updateCopy();
    try {
      await sendRequest(fields,siteText(form.id==='event-form'?'request_event_subject':'request_partner_subject'));
      form.reset();status.dataset.state='success';updateCopy();
    }catch{status.dataset.state='error';updateCopy();}
    finally{button.disabled=false;form.removeAttribute('aria-busy');}
  });
}
