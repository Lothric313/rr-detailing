const $=(s,p=document)=>p.querySelector(s), $$=(s,p=document)=>[...p.querySelectorAll(s)];
const cfg=window.RR;
const groups = $$('.service-group');
groups.forEach(group => {
 const heading = group.querySelector('.service-heading');
 heading.addEventListener('click', () => {
  const opening = heading.getAttribute('aria-expanded') !== 'true';
  groups.forEach(item => {
   const active = item === group && opening;
   item.querySelector('.service-heading').setAttribute('aria-expanded', String(active));
   item.querySelector('.service-drawer').inert = !active;
   item.classList.toggle('is-open', active);
  });
 });
});
const selections = $$('.service-option input');
const totalDisplay = $('.service-total');
const sendButton = $('#services-send');
function estimate(selected) {
 const total = selected.reduce((sum, input) => sum + Number(input.dataset.price), 0);
 return 'Ориентировочно от ' + formatPrice(total);
}
const formatPrice = price => Number(price).toLocaleString('ru-RU') + ' ₽';
function updateTotal() {
 const selected = selections.filter(input => input.checked);
 totalDisplay.textContent = selected.length ? estimate(selected) : 'Выберите услуги';
 sendButton.disabled = selected.length === 0;
}
// Resolve the choice before the estimate and the 3D preview read it.
$('#services').addEventListener('change', ({target}) => {
 const group = target.dataset.exclusive;
 if (!group || !target.checked) return;
 for (const input of selections) {
  if (input !== target && input.dataset.exclusive === group) input.checked = false;
 }
}, true);
selections.forEach(input => input.addEventListener('change', updateTotal));
window.addEventListener('pageshow', updateTotal);
sendButton.addEventListener('click', () => {
 const selected = selections.filter(input => input.checked);
 const lines = selected.map(input => '• ' + input.dataset.name + ' — от ' + formatPrice(input.dataset.price));
 const message = ['Здравствуйте! Хочу записаться на услуги:', ...lines, '', estimate(selected) + '.'].join('\n');
 window.open(cfg.telegram + '?text=' + encodeURIComponent(message), '_blank', 'noopener');
});
const addressEl = $('#address'), routeEl = $('#route'), mapEl = $('#map');
const contact = $('.work-contact');
if (contact) {
 const wallObserver = new IntersectionObserver(([entry]) => {
  contact.classList.toggle('is-in-view', entry.isIntersecting);
 });
 wallObserver.observe(contact);
}
if(addressEl) addressEl.textContent=cfg.address;
if(routeEl) routeEl.href=`https://www.google.com/maps/dir/?api=1&destination=${cfg.map.lat}%2C${cfg.map.lng}&travelmode=driving`;
if(mapEl) mapEl.src=`https://maps.google.com/maps?q=${cfg.map.lat}%2C${cfg.map.lng}&z=16&output=embed`;
const contactLinks = $('#contact-links');
if(contactLinks) contactLinks.innerHTML=`<a href="${cfg.telegram}" target="_blank" rel="noopener">Telegram / @rrd_098 ↗</a>`+cfg.phones.map(p=>`<a href="tel:${p[1]}">${p[0]} ↗</a>`).join('');

const toggle=$('.menu-toggle'),nav=$('#nav');toggle.onclick=()=>{let open=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',open)};$$('#nav a').forEach(a=>a.onclick=()=>{nav.classList.remove('open');toggle.setAttribute('aria-expanded','false')});
const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){$$('#nav a').forEach(a=>a.classList.toggle('active',a.getAttribute('href')==='#'+e.target.id))}}),{rootMargin:'-25% 0px -65%'});$$('main section[id]').forEach(s=>observer.observe(s));
const header=document.querySelector('.header');
const hero=document.querySelector('#top');
function updateHeader(){
  header.classList.toggle('over-hero',hero.getBoundingClientRect().bottom>header.offsetHeight);
}
window.addEventListener('scroll',updateHeader,{passive:true});
window.addEventListener('resize',updateHeader);
updateHeader();

// Ease discrete mouse-wheel steps while leaving touchpads and nested scrollers native.
(() => {
 const reduced = matchMedia('(prefers-reduced-motion: reduce)');
 let target = window.scrollY, frame = 0, lastTime = 0;
 const stop = () => { if (frame) cancelAnimationFrame(frame); frame = 0; lastTime = 0; target = window.scrollY; };
 function tick(time) {
  const elapsed = lastTime ? Math.min(time - lastTime, 40) : 16;
  lastTime = time;
  const next = window.scrollY + (target - window.scrollY) * (1 - Math.exp(-elapsed / 115));
  window.scrollTo({top: next, behavior: 'instant'});
  if (Math.abs(target - window.scrollY) > 0.5) frame = requestAnimationFrame(tick);
  else { window.scrollTo({top: target, behavior: 'instant'}); frame = 0; lastTime = 0; }
 }
 window.addEventListener('wheel', event => {
  if (event.defaultPrevented || event.ctrlKey || event.shiftKey || window.rrMobile.matches || reduced.matches || Math.abs(event.deltaX) > Math.abs(event.deltaY)) { stop(); return; }
  // Pixel-precise trackpads already provide their own momentum.
  if (event.deltaMode === 0 && Math.abs(event.deltaY) < 50) { stop(); return; }
  for (let node = event.target instanceof Element ? event.target : null; node && node !== document.body; node = node.parentElement) {
   const style = getComputedStyle(node);
   if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) { stop(); return; }
  }
  const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
  const max = Math.max(0, document.documentElement.scrollHeight - innerHeight);
  if (!frame) target = window.scrollY;
  target = Math.max(0, Math.min(max, target + delta));
  event.preventDefault();
  if (!frame) frame = requestAnimationFrame(tick);
 }, {passive:false});
 window.addEventListener('keydown', stop);
 window.addEventListener('pointerdown', stop, {passive:true});
 reduced.addEventListener('change', stop);
})();
