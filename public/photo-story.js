import {emptyFilters, filtersToParams} from './filter.js';

// Each representative photo leads to all brands for the pictured vehicle.
export function mountPhotoStory(cases, featuredIds, openVehicleGallery) {
  const section = document.getElementById('inspiration');
  const rail = document.getElementById('inspirationRail');
  const previous = document.getElementById('inspirationPrevious');
  const next = document.getElementById('inspirationNext');
  const byId = new Map(cases.map(item => [item.id, item]));
  const items = [...new Set(featuredIds || [])].map(id => byId.get(id)).filter(Boolean);
  if (!items.length) return;

  for (const item of items) {
    const slide = document.createElement('li');
    const card = document.createElement('a');
    card.className = 'inspiration-card';
    card.dataset.id = item.id;
    const vehicleFilters = {...emptyFilters(), maker: item.maker, car: item.car};
    card.href = `${location.pathname}?${filtersToParams(vehicleFilters)}#photoResults`;
    card.setAttribute('aria-label', `${item.car}の装着ギャラリーを見る`);

    const photo = document.createElement('img');
    photo.src = item.previewImage || item.thumbnail || item.image;
    photo.alt = '';
    photo.loading = 'lazy';
    photo.decoding = 'async';
    const caption = document.createElement('span');
    caption.className = 'inspiration-caption';
    for (const [className, value] of [['brand', item.brand], ['car', item.car], ['series', item.series]]) {
      const text = document.createElement('span');
      text.className = `inspiration-${className}`;
      text.textContent = value;
      caption.append(text);
    }
    const action = document.createElement('span');
    action.className = 'inspiration-link';
    action.textContent = 'この車種の写真を見る →';
    caption.append(action);
    card.append(photo, caption);
    card.addEventListener('click', event => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      openVehicleGallery(vehicleFilters, card.getAttribute('href'));
    });
    slide.append(card);
    rail.append(slide);
  }
  section.hidden = false;

  const updateControls = () => {
    previous.disabled = rail.scrollLeft < 2;
    next.disabled = rail.scrollLeft >= rail.scrollWidth - rail.clientWidth - 2;
  };
  const step = direction => {
    const slides = [...rail.children];
    const start = slides[0].offsetLeft;
    const positions = slides.map(slide => slide.offsetLeft - start);
    const target = direction > 0
      ? positions.find(position => position > rail.scrollLeft + 2) ?? rail.scrollWidth
      : positions.findLast(position => position < rail.scrollLeft - 2) ?? 0;
    rail.scrollTo({left: target, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
  };
  previous.addEventListener('click', () => step(-1));
  next.addEventListener('click', () => step(1));
  rail.addEventListener('scroll', updateControls, {passive: true});
  // Arrow keys move focus among the vehicle links; Tab stays native.
  rail.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const cards = [...rail.querySelectorAll('.inspiration-card')];
    const current = cards.indexOf(event.target);
    if (current < 0) return;
    event.preventDefault();
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? cards.length - 1
      : Math.max(0, Math.min(cards.length - 1, current + (event.key === 'ArrowRight' ? 1 : -1)));
    cards[index].focus({preventScroll: true});
    cards[index].scrollIntoView({behavior: 'instant', block: 'nearest', inline: 'nearest'});
  });
  new ResizeObserver(updateControls).observe(rail);
  updateControls();
  if (location.hash === '#inspiration') requestAnimationFrame(() => section.scrollIntoView({behavior: 'instant'}));
}
