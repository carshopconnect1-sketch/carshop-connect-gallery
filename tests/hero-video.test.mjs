import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../public/hero-video.js',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function setup({reduced=false,blocked=false}={}){
  const classes=new Set();
  const hero={classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)}};
  const video=new EventTarget();
  Object.assign(video,{paused:true,muted:false,dataset:{src:'https://example.test/film.mp4'},closest:()=>hero,getAttribute:()=>video.src,calls:0});
  video.pause=()=>{video.paused=true;video.dispatchEvent(new Event('pause'));};
  video.play=async()=>{video.calls++;if(blocked){blocked=false;throw Object.assign(new Error('Blocked'),{name:'NotAllowedError'});}video.paused=false;video.dispatchEvent(new Event('playing'));};
  const button=new EventTarget();Object.assign(button,{hidden:true,setAttribute(){}});
  const document=new EventTarget();Object.assign(document,{hidden:false,getElementById:id=>id==='heroVideo'?video:button});
  const motion=new EventTarget();motion.matches=reduced;
  let observer;
  vm.runInNewContext(source,{document,matchMedia:()=>motion,IntersectionObserver:class{constructor(fn){observer=fn;}observe(){}},setTimeout,clearTimeout});
  return {video,button,document,motion,hero,observe:visible=>observer([{isIntersecting:visible}])};
}
test('a rejected Chrome autoplay can be restarted with the visible play control',async()=>{
  const {video,button}=setup({blocked:true});await tick();
  assert.equal(video.paused,true);assert.equal(button.hidden,false);
  button.dispatchEvent(new Event('click'));await tick();
  assert.equal(video.paused,false);assert.equal(video.calls,2);
  button.dispatchEvent(new Event('click'));await tick();assert.equal(video.paused,true);
});
test('offscreen and hidden tabs pause and resume without losing a manual pause',async()=>{
  const s=setup();await tick();assert.equal(s.video.paused,false);
  s.observe(false);await tick();assert.equal(s.video.paused,true);
  s.observe(true);await tick();assert.equal(s.video.paused,false);
  s.document.hidden=true;s.document.dispatchEvent(new Event('visibilitychange'));await tick();assert.equal(s.video.paused,true);
  s.document.hidden=false;s.document.dispatchEvent(new Event('visibilitychange'));await tick();assert.equal(s.video.paused,false);
  s.button.dispatchEvent(new Event('click'));s.observe(false);s.observe(true);await tick();assert.equal(s.video.paused,true);
});
test('reduced motion prevents autoplay while allowing an explicit play click',async()=>{
  const {video,button}=setup({reduced:true});await tick();assert.equal(video.calls,0);
  button.dispatchEvent(new Event('click'));await tick();assert.equal(video.paused,false);
});
