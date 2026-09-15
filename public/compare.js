const versions={
  new:{url:'/',title:'新しい装着ギャラリーのプレビュー',caption:'新TOPの書体・色・余白に合わせ、車種やブランドから直接探せる構成です。'},
  old:{url:'/reference/old/gallery-top.html',title:'2026年5月12日の旧検索版',caption:'5項目の検索欄が表示されていた版（766bfaf）。保存HTMLの比較用表示です。車種別リンク先は6月の保存資料です。'},
  current:{url:'/reference/current/gallery-top.html',title:'2026年6月4日の現在構成の保存版',caption:'メーカー → 車種の2ステップ構成（47481fcと同一のTOP）。公開サイトを直接表示しているものではありません。'}
};
document.querySelectorAll('[data-version]').forEach(b=>b.addEventListener('click',()=>{const v=versions[b.dataset.version];document.querySelectorAll('[data-version]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));const f=document.getElementById('previewFrame');f.src=v.url;f.title=v.title;document.getElementById('compareCaption').textContent=v.caption;}));
document.querySelectorAll('[data-device]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-device]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));document.getElementById('previewStage').classList.toggle('sp',b.dataset.device==='sp');}));
fetch('/data/catalog.json').then(r=>r.json()).then(data=>{const brands=new Set(data.cases.map(x=>x.brand));document.getElementById('dataSummary').textContent=`2026年6月4日の引き継ぎ資料と提供されたold.zipから、${data.cases.length.toLocaleString('ja-JP')}件を収録。ブランドは${[...brands].join(' / ')}です。件数はこのデータから集計しています。`;}).catch(()=>{});
