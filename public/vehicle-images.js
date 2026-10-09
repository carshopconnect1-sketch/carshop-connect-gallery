import {vehicleArtwork} from './vehicle-artwork-data.js';
import {canonicalVehicle} from './vehicle-identity.js';
const imageRoot='https://m-connect.co.jp/images/carlist/';
const artworkKey=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/[\s・･:：.．/／‐‑–—−-]/g,'');
const artworkByVehicle=new Map(vehicleArtwork.map(row=>[`${row.maker}|${artworkKey(canonicalVehicle(row.maker,row.name))}`,row.image]));
// Image aliases do not merge gallery cases or infer vehicle compatibility.
const imageNameAliases={'スーパーキャリィ':'スーパーキャリー','スーパーキャリイ':'スーパーキャリー','エブリイ':'エブリィ','エブリィ(バン)':'エブリィ'};

function officialVehicleImage(item){
  const maker=item.maker==='ミツビシ'?'三菱':item.maker;
  const car=canonicalVehicle(maker,item.car);
  return artworkByVehicle.get(`${maker}|${artworkKey(imageNameAliases[car]||car)}`)||'';
}

const slugAliases={
  avensis:'avensiswagon',
  crownmajesta:'majesta',
  ekcross:'ekx',
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
  const official=items.map(officialVehicleImage).filter(Boolean);
  const slugs=[];
  for(const item of items){
    const galleryPage=item.galleryUrl?.split('#')[0]||'';
    const product=productSlug(vehicleProductUrls[galleryPage]);
    if(product)slugs.push(product);
    slugs.push(...gallerySlugs(item.galleryUrl));
  }
  return [...new Set([...official,...slugs.map(slug=>`${imageRoot}${slug}.jpg`)])];
}
