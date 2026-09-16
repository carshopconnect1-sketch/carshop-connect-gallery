// The photo rail shares the catalog and detail dialog with the filtered results.
export function mountPhotoStory(cases, featuredIds, openDetail) {
  const section = document.getElementById('inspiration');
  const rail = document.getElementById('inspirationRail');
  const previous = document.getElementById('inspirationPrevious');
  const next = document.getElementById('inspirationNext');
  const byId = new Map(cases.map(item => [item.id, item]));
  const items = [...new Set(featuredIds || [])].map(id => byId.get(id)).filter(Boolean);
  if (!items.length) return;

  for (const item of items) {
    const slide = document.createElement('li');
    const button = document.createElement('button');
    button.className = 'inspiration-card';
    button.type = 'button';
    button.dataset.id = item.id;
    button.setAttribute('aria-label', `${item.car} / ${item.brand} ${item.series}の装着写真を見る`);

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
    const arrow = document.createElement('span');
    arrow.className = 'inspiration-open';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '↗';
    button.append(photo, caption, arrow);
    button.addEventListener('click', () => openDetail(item));
    slide.append(button);
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
  // Arrow keys move focus among the actual photo buttons; Tab stays native.
  rail.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const buttons = [...rail.querySelectorAll('button')];
    const current = buttons.indexOf(event.target);
    if (current < 0) return;
    event.preventDefault();
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
      : Math.max(0, Math.min(buttons.length - 1, current + (event.key === 'ArrowRight' ? 1 : -1)));
    buttons[index].focus({preventScroll: true});
    buttons[index].scrollIntoView({behavior: 'instant', block: 'nearest', inline: 'nearest'});
  });
  new ResizeObserver(updateControls).observe(rail);
  updateControls();
  if (location.hash === '#inspiration') requestAnimationFrame(() => section.scrollIntoView({behavior: 'instant'}));
}
