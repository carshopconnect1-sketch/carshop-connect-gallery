import {lifestyleThemes,lifestyleGalleryUrl} from './lifestyle-data.js';

export function mountLifestyle(openGallery,startVehicleSearch){
  const root=document.getElementById('ownerStories'),choices=document.getElementById('lifestyleChoices'),panel=document.getElementById('lifestylePanel');
  const dialog=document.getElementById('lifestyleVideoDialog'),player=document.getElementById('lifestyleVideo'),videoTitle=document.getElementById('lifestyleVideoTitle');
  let active='',lastVideoButton;
  const element=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e;};
  const photo=(src,alt)=>{const img=element('img');img.src=src;img.alt=alt;img.loading='lazy';img.decoding='async';img.width=700;img.height=470;return img;};
  function openVideo(pick,button){lastVideoButton=button;videoTitle.textContent=`${pick.car} × ${pick.brand} ${pick.series}`;player.src=`/assets/lifestyle/${pick.video}.mp4`;player.poster=pick.image;player.muted=true;dialog.showModal();player.play().catch(()=>{});}
  document.getElementById('lifestyleVideoClose').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();}});
  dialog.addEventListener('close',()=>{player.pause();player.removeAttribute('src');player.load();lastVideoButton?.focus({preventScroll:true});});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)player.pause();});
  function closePanel(){active='';panel.hidden=true;panel.replaceChildren();choices.querySelectorAll('button').forEach(b=>b.setAttribute('aria-expanded','false'));}
  function choose(theme,button){
    if(active===theme.id){closePanel();return;}
    active=theme.id;choices.querySelectorAll('button').forEach(b=>b.setAttribute('aria-expanded',String(b===button)));
    const heading=element('div','lifestyle-panel-heading'),copy=element('div');
    copy.append(element('p','lifestyle-eyebrow',theme.english),element('h3','',theme.heading),element('p','lifestyle-description',theme.description));
    const close=element('button','lifestyle-close','×');close.type='button';close.setAttribute('aria-label','テーマの写真を閉じる');close.addEventListener('click',()=>{closePanel();button.focus({preventScroll:true});});heading.append(copy,close);
    const layout=element('div','lifestyle-panel-layout'),figure=element('figure','lifestyle-scene');figure.append(photo(theme.scene,theme.sceneAlt),element('figcaption','',theme.caption));
    const picks=element('div','lifestyle-picks');
    theme.picks.forEach(pick=>{
      const article=element('article','lifestyle-pick'),gallery=element('a','lifestyle-pick-link');gallery.href=lifestyleGalleryUrl(pick);gallery.setAttribute('aria-label',`${pick.car} ${pick.series}：${pick.label}`);
      gallery.addEventListener('click',event=>{if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();openGallery(pick.filters,gallery.getAttribute('href'));});
      const body=element('div','lifestyle-pick-body');body.append(element('p','lifestyle-brand',pick.brand),element('h4','',pick.car),element('p','lifestyle-series',pick.series),element('span','lifestyle-gallery-link',pick.label+' →'));
      gallery.append(photo(pick.image,`${pick.car}に装着した${pick.brand} ${pick.series}`),body);article.append(gallery);
      if(pick.video){const play=element('button','lifestyle-play',`▶ 動画で見る（${pick.seconds}秒）`);play.type='button';play.setAttribute('aria-label',`${pick.car} ${pick.series}の動画を見る`);play.addEventListener('click',()=>openVideo(pick,play));article.append(play);}
      picks.append(article);
    });
    layout.append(figure,picks);const foot=element('div','lifestyle-panel-foot');
    if(theme.article){const a=element('a','lifestyle-article',theme.article.label+' ↗');a.href=theme.article.url;foot.append(a);}
    const find=element('a','lifestyle-find','自分の車から絞り込む ↓');find.href='#finder';
    find.addEventListener('click',event=>{if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();startVehicleSearch();});foot.append(find);
    panel.replaceChildren(heading,layout,foot);panel.hidden=false;
    if(matchMedia('(max-width: 760px)').matches)panel.scrollIntoView({block:'start',behavior:'instant'});
  }
  lifestyleThemes.forEach(theme=>{
    const button=element('button','lifestyle-choice');button.type='button';button.dataset.theme=theme.id;button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','lifestylePanel');
    const caption=element('span','lifestyle-choice-caption'),label=element('strong');
    const split=theme.label.indexOf('、');label.append(element('span','',theme.label.slice(0,split+1)),element('span','',theme.label.slice(split+1)));
    caption.append(element('small','',theme.english),label,element('span','lifestyle-choice-open','＋'));
    button.append(photo(theme.cover,theme.coverAlt),caption);button.addEventListener('click',()=>choose(theme,button));choices.append(button);
  });
  root.hidden=false;
}
