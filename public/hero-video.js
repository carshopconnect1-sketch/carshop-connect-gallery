// The live gallery's Alphard film; playback is independent of gallery data loading.
const video = document.getElementById('heroVideo');
const toggle = document.getElementById('heroVideoToggle');
const hero = video.closest('.hero');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
let wantsPlayback = !motion.matches;
let inView = true;
let playPending = false;

toggle.hidden = false;
// Show the opening frame when reduced motion or autoplay restrictions pause the film.
video.src = video.dataset.src;
function updateControl() {
  const playing = !video.paused && !video.ended;
  toggle.setAttribute('aria-label', playing ? '背景動画を一時停止' : '背景動画を再生');
  toggle.querySelector('span').textContent = playing ? '一時停止' : '再生';
  toggle.querySelector('path').setAttribute('d', playing ? 'M8 5v14M16 5v14' : 'm9 5 10 7-10 7Z');
}
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
    // If autoplay is blocked, keep the opening frame and the manual play button.
    if (error.name !== 'AbortError') wantsPlayback = false;
  } finally {
    playPending = false;
    updateControl();
    // The hero may re-enter view while an earlier play request is being cancelled.
    if (wantsPlayback && inView && !document.hidden && video.paused) syncPlayback();
  }
}
video.addEventListener('playing', () => {
  hero.classList.add('is-video-ready');
  updateControl();
});
video.addEventListener('pause', updateControl);
video.addEventListener('loadeddata', () => hero.classList.add('is-video-ready'));
video.addEventListener('error', () => {
  hero.classList.remove('is-video-ready');
  wantsPlayback = false;
  updateControl();
});
toggle.addEventListener('click', () => {
  wantsPlayback = video.paused;
  if (wantsPlayback && video.error) video.load();
  syncPlayback();
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
updateControl();
syncPlayback();
