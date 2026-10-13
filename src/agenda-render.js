import {validateEvent,EVENT_TYPES,ATTENDANCE} from './agenda-model.js';
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const day=date=>new Date(date+'T12:00:00Z');
export const agendaMonth=date=>new Intl.DateTimeFormat('nl-BE',{month:'long',year:'numeric',timeZone:'UTC'}).format(day(date));
const formatDate=date=>new Intl.DateTimeFormat('nl-BE',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(day(date));
export function agendaCard(event,{text=()=>'',preview=false}={}){
 validateEvent(event,!preview);
 const label=(key,fallback)=>escape(text(key)||fallback);
 const date=event.date,month=date?new Intl.DateTimeFormat('nl-BE',{month:'short',timeZone:'UTC'}).format(day(date)): 'DATUM';
 const dates=date?formatDate(date)+(event.endDate&&event.endDate!==date?' — '+formatDate(event.endDate):''):'Datum volgt';
 const times=event.startTime+(event.endTime?' — '+event.endTime:'');
 const paragraphs=event.description.trim().split(/\n\s*\n/).filter(Boolean).map(value=>'<p>'+escape(value).replace(/\n/g,'<br>')+'</p>').join('');
 const query=event.address?[event.address,event.location].filter(Boolean).join(', '):event.location;
 const map=query?'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(query):null;
 return `<article class="agenda-card ${event.attendance==='cancelled'?'is-cancelled':''}" id="${escape(event.id)}"><div class="agenda-date" aria-hidden="true"><span>${escape(month)}</span><strong>${date?date.slice(8):'—'}</strong><small>${date?date.slice(0,4):'KC'}</small></div><div class="agenda-card-content"><div class="agenda-card-meta"><span class="agenda-kind">${escape(EVENT_TYPES[event.kind])}</span><span class="agenda-attendance ${escape(event.attendance)}">${label('agenda_status_'+event.attendance,ATTENDANCE[event.attendance])}</span></div><h3>${escape(event.title.trim()||'Jouw volgende event')}</h3><p class="agenda-date-copy">${escape(dates)}${times?`<span>${escape(times)} · ${label('agenda_time','Lokale tijd / België')}</span>`:''}</p><div class="agenda-place"><span>${label('agenda_location','Locatie')}</span><strong>${escape(event.location||'Locatie volgt')}</strong>${event.address?'<p>'+escape(event.address)+'</p>':''}</div>${paragraphs?`<details class="agenda-details"${preview?' open':''}><summary>${label('agenda_info','Praktische informatie')}<span aria-hidden="true">+</span></summary><div>${paragraphs}</div></details>`:''}<div class="agenda-card-links">${map?`<a href="${escape(map)}" target="_blank" rel="noopener noreferrer">${label('agenda_map','BEKIJK DE LOCATIE ↗')}</a>`:''}${event.website?`<a href="${escape(event.website)}" target="_blank" rel="noopener noreferrer">${label('agenda_website','EVENTWEBSITE ↗')}</a>`:''}</div></div></article>`;
}
