const imageRoot='https://m-connect.co.jp/images/carlist/';

const slugAliases={
  avensis:'avensiswagon',
  crownmajesta:'majesta',
  spadedbansp141:'spade',
  vits:'vitz'
};

function cleanSlug(value=''){
  const clean=decodeURIComponent(value).normalize('NFKC').toLowerCase().replace(/\.html$/,'').replace(/[^a-z0-9]/g,'');
  return slugAliases[clean]||clean;
}

function gallerySlugs(url=''){
  const match=url.match(/\/gallery\/([^/?#]+)\.html/i);
  if(!match)return [];
  const basename=decodeURIComponent(match[1]);
  const withoutMaker=basename.replace(/^[^_]+_/,'');
  const withoutSeries=withoutMaker.replace(/-(?:dep|euro|dia|luxur|cox|crossline|fn|urban|spyder).*$/i,'');
  return [withoutSeries,withoutMaker].map(cleanSlug).filter(Boolean);
}

function productSlug(url=''){
  try{
    const parts=new URL(url).pathname.split('/').filter(Boolean);
    const category=parts.indexOf('c');
    if(category<0||parts[category+1]==='seatcovermaker'||parts.length!==category+3)return '';
    return cleanSlug(parts.at(-1));
  }catch{return '';}
}

export function vehicleImageCandidates(items=[],vehicleProductUrls={}){
  const slugs=[];
  for(const item of items){
    const galleryPage=item.galleryUrl?.split('#')[0]||'';
    const product=productSlug(vehicleProductUrls[galleryPage]);
    if(product)slugs.push(product);
    slugs.push(...gallerySlugs(item.galleryUrl));
  }
  return [...new Set(slugs)].map(slug=>`${imageRoot}${slug}.jpg`);
}
