// Match the recorded source, never a guessed vehicle name or an unstable photo position.
export function photoSource(url) {
  try {const parsed=new URL(url);return ['localhost','127.0.0.1'].includes(parsed.hostname)?parsed.pathname:url;}
  catch {return url;}
}
export function photoReplacement(item, manifest={}) {
  const entries=manifest.cases?.[item.id]||[];
  const matched=entries.find(entry=>photoSource(item.image)===entry.source || item.image===entry.url);
  const images=Object.fromEntries(['image','thumbnail','previewImage'].filter(key=>item[key]).map(key=>[key,archivedPhoto(item[key],manifest)]));
  return {...item,...images,...(matched?{image:matched.url,thumbnail:matched.thumbnail,previewImage:matched.previewImage}:{}),
    ...(entries.some(entry=>entry.privacy)?{galleryUrl:''}:{})};
}
export function detailReplacement(id, detail, manifest={}) {
  const entries=manifest.cases?.[id]||[];
  return {...detail,images:(detail.images||[]).map(url=>entries.find(entry=>entry.source===photoSource(url))?.url||archivedPhoto(url,manifest))};
}
function archivedPhoto(url,manifest){return manifest.archivedUrls?.[photoSource(url)]||url;}
