import '@fontsource/racing-sans-one/400.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow-condensed/800.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/800.css';

// Resolve public assets under the deployed site path as well as the development root.
const imageUrl = path => path.startsWith('/') ? import.meta.env.BASE_URL + path.slice(1) : path;

// Reference collection. Replace these with confirmed club cars and owner-approved photos.
const builds = [
  {
    name: 'Nissan 370Z', model: 'Z34 / JAPANESE PERFORMANCE', category: 'drift', number: '01',
    image: '/images/hero.jpg', position: '50% 60%',
    alt: 'Donkere Nissan 370Z, van achteren gefotografeerd met brandende achterlichten',
    text: 'Achterwielaandrijving, een uitgesproken silhouet en pure Japanse sportwagenenergie. Deze referentie zet de toon voor de driftkant van de garage.',
    credit: 'Albin Berlin / Pexels',
  },
  {
    name: 'Porsche 911', model: '993 / THE PERFECT SILHOUETTE', category: 'stance', number: '02',
    image: '/images/porsche-993.jpg', position: '50% 58%',
    alt: 'Zilveren Porsche 993 in een garage met blauw en rood licht',
    text: 'Tijdloze lijnen en aandacht voor proportie. Een fotografische referentie voor de stancecollectie: karakter in elk detail.',
    credit: 'Yrka Pictured / Unsplash',
  },
  {
    name: 'Porsche 911', model: 'CLASSIC / CHASING THE APEX', category: 'track', number: '03',
    image: '/images/porsche-track.jpg', position: '50% 62%',
    alt: 'Blauwe klassieke Porsche racewagen in beweging op het circuit',
    text: 'Een moment op snelheid. De circuitcollectie draait om machines die gebouwd zijn om gereden te worden, en de mensen achter het stuur.',
    credit: 'Paul Jespers / Unsplash',
  },
  {
    name: 'Nissan Skyline', model: 'R34 / AFTER HOURS', category: 'street', number: '04',
    image: '/images/skyline.jpg', position: '50% 85%',
    alt: 'Twee blauwe Nissan Skyline R34 wagens met Mount Fuji op de achtergrond',
    text: 'De herkenbare lijnen van de R34. Een referentiebeeld voor streetcultuur, gedeelde ritten en de liefde voor Japanse wagens.',
    credit: 'Melih Karaahmet / Unsplash',
  },
];

const arrow = '<svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14"/></svg>';
const cars = document.querySelector('#cars');
const dialog = document.querySelector('#car-dialog');
const menuButton = document.querySelector('.menu-toggle');
const mobileNav = document.querySelector('#mobile-nav');
let previousFocus;

function render(filter = 'all') {
  const shown = builds.filter(car => filter === 'all' || car.category === filter);
  cars.classList.toggle('filtered', filter !== 'all');
  cars.innerHTML = shown.map(car => `
    <button class="car-card" data-car="${car.number}" aria-label="Bekijk ${car.name}, ${car.category}, voorbeeld ${car.number}">
      <div class="car-photo">
        <img src="${imageUrl(car.image)}" alt="${car.alt}" loading="lazy" style="object-position:${car.position}">
        <span class="car-category">${car.category.toUpperCase()}</span>
        <span class="car-open">${arrow}</span>
      </div>
      <div class="car-info"><div><small>${car.model}</small><h3>${car.name}</h3></div><span class="car-number">/${car.number}</span></div>
    </button>`).join('');
  document.querySelector('#result-count').textContent = `${shown.length} voorbeeldwagens weergegeven`;
}

for (const button of document.querySelectorAll('[data-filter]')) {
  button.addEventListener('click', () => {
    for (const filter of document.querySelectorAll('[data-filter]')) {
      filter.classList.toggle('active', filter === button);
      filter.setAttribute('aria-pressed', String(filter === button));
    }
    render(button.dataset.filter);
  });
}

cars.addEventListener('click', event => {
  const button = event.target.closest('[data-car]');
  if (!button) return;
  const car = builds.find(build => build.number === button.dataset.car);
  previousFocus = button;
  document.querySelector('#car-detail').innerHTML = `
    <img class="detail-image" src="${imageUrl(car.image)}" alt="${car.alt}" style="object-position:${car.position}">
    <div class="detail-copy"><span class="eyebrow">${car.category.toUpperCase()} / REFERENCE ${car.number}</span>
    <h2 id="detail-title">${car.name}</h2><p>${car.text}</p>
    <p class="disclaimer">Referentiewagen, geen bevestigde clubwagen. Foto: ${car.credit}. Jullie eigen wagen, verhaal en specificaties vervangen dit voorbeeld.</p></div>`;
  dialog.setAttribute('aria-labelledby', 'detail-title');
  dialog.showModal();
  document.body.style.overflow = 'hidden';
});
document.querySelector('.close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
});
dialog.addEventListener('close', () => {
  document.body.style.overflow = '';
  previousFocus?.focus({ preventScroll: true });
});

function closeMenu() {
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Menu openen');
  mobileNav.hidden = true;
}
menuButton.addEventListener('click', () => {
  const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!isOpen));
  menuButton.setAttribute('aria-label', isOpen ? 'Menu openen' : 'Menu sluiten');
  mobileNav.hidden = isOpen;
});
mobileNav.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !mobileNav.hidden) { closeMenu(); menuButton.focus(); }
});
window.matchMedia('(min-width:701px)').addEventListener('change', event => { if (event.matches) closeMenu(); });
document.querySelector('#year').textContent = new Date().getFullYear();
render();
