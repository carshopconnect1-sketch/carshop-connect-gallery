// The live gallery's Alphard film; playback is independent of gallery data loading.
const video = document.getElementById('heroVideo');
const hero = video.closest('.hero');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
let wantsPlayback = !motion.matches;
let inView = true;
let playPending = false;

// Show the opening frame when reduced motion or autoplay restrictions pause the film.
video.src = video.dataset.src;
async function syncPlayback() {
  if (!wantsPlayback || !inView || document.hidden) {
    video.pause();
    return;
  }
  if (playPending || !video.paused) return;
  playPending = true;
  video.muted = true;
  if (!video.getAttribute('src')) video.src = video.dataset.src;
  try {
    await video.play();
    if (!wantsPlayback || !inView || document.hidden) video.pause();
  } catch (error) {
    // If autoplay is blocked, keep the opening frame.
    if (error.name !== 'AbortError') wantsPlayback = false;
  } finally {
    playPending = false;
    // The hero may re-enter view while an earlier play request is being cancelled.
    if (wantsPlayback && inView && !document.hidden && video.paused) syncPlayback();
  }
}
video.addEventListener('playing', () => {
  hero.classList.add('is-video-ready');
});
video.addEventListener('loadeddata', () => hero.classList.add('is-video-ready'));
video.addEventListener('error', () => {
  hero.classList.remove('is-video-ready');
  wantsPlayback = false;
});
new IntersectionObserver(([entry]) => {
  inView = entry.isIntersecting;
  syncPlayback();
}, {threshold: 0}).observe(hero);
document.addEventListener('visibilitychange', syncPlayback);
motion.addEventListener('change', () => {
  wantsPlayback = !motion.matches;
  syncPlayback();
});
syncPlayback();
