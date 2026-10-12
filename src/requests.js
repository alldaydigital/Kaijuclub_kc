export const REQUEST_ENDPOINT='https://formsubmit.co/ajax/kaijuclub.be@gmail.com';
export async function sendRequest(fields,subject,{fetcher=fetch}={}) {
  const response=await fetcher(REQUEST_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({...fields,_subject:subject,_template:'table',_captcha:'false'}),signal:AbortSignal.timeout(30000),credentials:'omit',referrerPolicy:'no-referrer'});
  if(!response.ok)throw new Error('De aanvraag kon niet bevestigd worden.');
  const data=await response.json();
  if(data.success!==true&&data.success!=='true')throw new Error('De e-maildienst kon je aanvraag niet bevestigen.');
  return data;
}
for(const form of (typeof document==='undefined'?[]:document.querySelectorAll('.request-form'))) {
  const date=form.querySelector('input[type="date"]');if(date){const now=new Date();date.min=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;}
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(!form.reportValidity())return;
    const fields=Object.fromEntries(new FormData(form));if(fields.website)return;
    delete fields.website;delete fields.toestemming;
    const button=form.querySelector('[type="submit"]');const status=form.querySelector('.form-status');
    button.disabled=true;form.setAttribute('aria-busy','true');status.textContent='Je aanvraag wordt verstuurd…';
    try {
      await sendRequest(fields,form.id==='event-form'?'Kaijuclub — eventaanvraag':'Kaijuclub — partneraanvraag');
      form.reset();status.textContent='De e-maildienst heeft je aanvraag aangenomen. Bedankt! We nemen persoonlijk contact op. Deelname is pas bevestigd na onze reactie.';status.dataset.state='success';
    }catch{status.textContent='We konden de verzending niet bevestigen. Je gegevens staan nog in het formulier. Probeer opnieuw of mail naar kaijuclub.be@gmail.com.';status.dataset.state='error';}
    finally{button.disabled=false;form.removeAttribute('aria-busy');}
  });
}
