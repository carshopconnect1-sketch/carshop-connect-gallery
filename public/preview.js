const stages = [...document.querySelectorAll('.device-stage')];
const frames = stages.map(stage => stage.querySelector('iframe'));

// Keep the responsive viewport fixed while fitting each live page to its pane.
const resize = new ResizeObserver(entries => {
  for (const {target: stage, contentRect} of entries) {
    const width = Number(stage.dataset.width);
    const scale = contentRect.width / width;
    if (!scale) continue;
    const frame = stage.querySelector('iframe');
    frame.style.width = `${width}px`;
    frame.style.height = `${Math.ceil(contentRect.height / scale)}px`;
    frame.style.transform = `scale(${scale})`;
  }
});
stages.forEach(stage => resize.observe(stage));

document.querySelectorAll('[data-section]').forEach(button => {
  button.addEventListener('click', () => {
    for (const frame of frames) {
      const page = frame.contentWindow;
      if (button.dataset.section === 'top') {
        page.scrollTo({top: 0, behavior: 'instant'});
      } else {
        frame.contentDocument.getElementById(button.dataset.section)?.scrollIntoView({behavior: 'instant', block: 'start'});
      }
    }
  });
});
document.getElementById('reload').addEventListener('click', () => {
  frames.forEach(frame => frame.contentWindow.location.reload());
});
