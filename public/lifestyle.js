import {lifestyleThemes,lifestyleGalleryUrl} from './lifestyle-data.js';
import {lifestyleAlbums} from './lifestyle-albums.js';

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
  const albumDialog=document.getElementById('lifestylePhotoDialog'),albumImage=document.getElementById('lifestylePhotoImage'),albumThumbs=document.getElementById('lifestylePhotoThumbs');
  let selectedAlbum,lastPhotoButton,photoIndex=0;
  const nameOf=pick=>pick.displayCar||pick.car;
  function showPhoto(index){
    photoIndex=(index+selectedAlbum.photos.length)%selectedAlbum.photos.length;
    const shot=selectedAlbum.photos[photoIndex];
    albumImage.src=shot.src;albumImage.alt=`${selectedAlbum.car} ${selectedAlbum.brand} ${selectedAlbum.series}：${shot.caption}`;
    document.getElementById('lifestylePhotoCaption').textContent=shot.caption;
    document.getElementById('lifestylePhotoCount').textContent=`${photoIndex+1} / ${selectedAlbum.photos.length}`;
    [...albumThumbs.children].forEach((b,i)=>b.setAttribute('aria-pressed',String(i===photoIndex)));
  }
  function openAlbum(pick,button,index=0){
    selectedAlbum=lifestyleAlbums[pick.album];lastPhotoButton=button;
    document.getElementById('lifestylePhotoBrand').textContent=pick.brand;
    document.getElementById('lifestylePhotoTitle').textContent=nameOf(pick);
    document.getElementById('lifestylePhotoSeries').textContent=pick.series+(pick.variant?` / ${pick.variant}`:'');
    const note=document.getElementById('lifestylePhotoNote');note.textContent=selectedAlbum.note||'';note.hidden=!selectedAlbum.note;
    const gallery=document.getElementById('lifestylePhotoGallery');gallery.href=lifestyleGalleryUrl(pick,location.pathname);gallery.textContent=pick.label+' →';
    gallery.onclick=event=>{if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();albumDialog.close();openGallery(pick.filters,gallery.getAttribute('href'));};
    albumThumbs.replaceChildren(...selectedAlbum.photos.map((shot,i)=>{const b=element('button');b.type='button';b.setAttribute('aria-label',`${i+1}枚目：${shot.caption}`);b.append(photo(shot.thumbnail,''));b.addEventListener('click',()=>showPhoto(i));return b;}));
    showPhoto(index);albumDialog.showModal();
  }
  document.getElementById('lifestylePhotoClose').addEventListener('click',()=>albumDialog.close());
  document.getElementById('lifestylePhotoPrev').addEventListener('click',()=>showPhoto(photoIndex-1));
  document.getElementById('lifestylePhotoNext').addEventListener('click',()=>showPhoto(photoIndex+1));
  albumDialog.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();showPhoto(photoIndex+(event.key==='ArrowRight'?1:-1));}});
  albumDialog.addEventListener('click',event=>{if(event.target===albumDialog){const box=albumDialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)albumDialog.close();}});
  albumDialog.addEventListener('close',()=>lastPhotoButton?.focus({preventScroll:true}));
  function closePanel(){active='';panel.hidden=true;panel.replaceChildren();choices.querySelectorAll('button').forEach(b=>b.setAttribute('aria-expanded','false'));}
  function choose(theme,button){
    if(active===theme.id){closePanel();return;}
    active=theme.id;choices.querySelectorAll('button').forEach(b=>b.setAttribute('aria-expanded',String(b===button)));
    const heading=element('div','lifestyle-panel-heading'),copy=element('div');
    copy.append(element('p','lifestyle-eyebrow',theme.english),element('h3','',theme.heading),element('p','lifestyle-description',theme.description));
    const scene=element('figure','lifestyle-scene');scene.append(photo(theme.scene,theme.sceneAlt),element('figcaption','',theme.caption));
    const close=element('button','lifestyle-close','×');close.type='button';close.setAttribute('aria-label','テーマの写真を閉じる');close.addEventListener('click',()=>{closePanel();button.focus({preventScroll:true});});heading.append(copy,scene,close);
    const layout=element('div','lifestyle-panel-layout');
    const picks=element('div','lifestyle-picks');
    picks.dataset.columns=String(theme.picks.length);
    theme.picks.forEach(pick=>{
      const shots=lifestyleAlbums[pick.album].photos;
      const article=element('article','lifestyle-pick'),gallery=element('a','lifestyle-gallery-link',pick.label+' →');gallery.href=lifestyleGalleryUrl(pick,location.pathname);
      gallery.addEventListener('click',event=>{if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();openGallery(pick.filters,gallery.getAttribute('href'));});
      const cover=element('button','lifestyle-pick-link');cover.type='button';cover.setAttribute('aria-label',`${nameOf(pick)} ${pick.series}${pick.variant?' '+pick.variant:''}の写真${shots.length}枚を見る`);
      const pickPhoto=photo(pick.image,`${nameOf(pick)}に装着した${pick.brand} ${pick.series}`);if(pick.imagePosition)pickPhoto.style.objectPosition=pick.imagePosition;
      cover.append(pickPhoto,element('span','lifestyle-photo-badge',`${shots.length}枚を見る ＋`));cover.addEventListener('click',()=>openAlbum(pick,cover));
      const previews=element('div','lifestyle-pick-thumbs');
      shots.slice(1,4).forEach((shot,i)=>{const thumb=element('button');thumb.type='button';thumb.setAttribute('aria-label',`${nameOf(pick)}：${shot.caption}`);thumb.append(photo(shot.thumbnail,''));thumb.addEventListener('click',()=>openAlbum(pick,thumb,i+1));previews.append(thumb);});
      const body=element('div','lifestyle-pick-body');body.append(element('p','lifestyle-brand',pick.brand),element('h4','',nameOf(pick)),element('p','lifestyle-series',pick.series+(pick.variant?` / ${pick.variant}`:'')),gallery);
      article.append(cover,previews,body);
      if(pick.video){const play=element('button','lifestyle-play',`▶ 動画で見る（${pick.seconds}秒）`);play.type='button';play.setAttribute('aria-label',`${pick.car} ${pick.series}の動画を見る`);play.addEventListener('click',()=>openVideo(pick,play));article.append(play);}
      picks.append(article);
    });
    layout.append(picks);const foot=element('div','lifestyle-panel-foot');
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
