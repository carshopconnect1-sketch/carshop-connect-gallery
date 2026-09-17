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
    card.draggable = false;
    card.dataset.id = item.id;
    const vehicleFilters = {...emptyFilters(), maker: item.maker, car: item.car};
    card.href = `${location.pathname}?${filtersToParams(vehicleFilters)}#photoResults`;
    const actionLabel = `${item.car}の装着写真を見る`;
    card.setAttribute('aria-label', actionLabel);

    const photo = document.createElement('img');
    photo.src = item.previewImage || item.thumbnail || item.image;
    photo.alt = '';
    photo.draggable = false;
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
    action.textContent = `${actionLabel} →`;
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
    // Keep one photo in common between desktop pages for visual continuity.
    const stride = positions[1] || rail.clientWidth;
    const count = Math.max(1, Math.floor(rail.clientWidth / stride) - 1);
    const candidates = positions.filter(position => direction > 0 ? position > rail.scrollLeft + 2 : position < rail.scrollLeft - 2);
    const target = direction > 0
      ? candidates[Math.min(count, candidates.length) - 1] ?? rail.scrollWidth
      : candidates[Math.max(0, candidates.length - count)] ?? 0;
    rail.scrollTo({left: target, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
  };
  previous.addEventListener('click', () => step(-1));
  next.addEventListener('click', () => step(1));
  rail.addEventListener('scroll', updateControls, {passive: true});
  mountMouseDrag(rail);
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

function mountMouseDrag(rail) {
  let pointer = null;
  let suppressClick = false;
  rail.addEventListener('pointerdown', event => {
    suppressClick = false;
    if (event.pointerType !== 'mouse' || event.button !== 0 || !event.isPrimary
      || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey
      || !event.target.closest('.inspiration-card')) return;
    pointer = {id: event.pointerId, x: event.clientX, y: event.clientY, left: rail.scrollLeft, dragging: false};
  });
  // Touch scrolling and the page's vertical wheel scrolling remain native.
  window.addEventListener('pointermove', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    if (!pointer.dragging) {
      if (Math.abs(dx) < 8 || Math.abs(dx) <= Math.abs(dy)) return;
      pointer.dragging = true;
      rail.classList.add('is-dragging');
      rail.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
    rail.scrollTo({left: pointer.left - dx, behavior: 'instant'});
  }, {passive: false});
  const finish = event => {
    if (!pointer || (event.pointerId !== undefined && event.pointerId !== pointer.id)) return;
    const current = pointer;
    pointer = null;
    suppressClick = current.dragging;
    rail.classList.remove('is-dragging');
    if (rail.hasPointerCapture(current.id)) rail.releasePointerCapture(current.id);
  };
  window.addEventListener('pointerup', finish);
  window.addEventListener('pointercancel', finish);
  window.addEventListener('blur', finish);
  rail.addEventListener('lostpointercapture', finish);
  rail.addEventListener('dragstart', event => event.preventDefault());
  rail.addEventListener('click', event => {
    if (!suppressClick) return;
    suppressClick = false;
    if (event.detail === 0) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
}
