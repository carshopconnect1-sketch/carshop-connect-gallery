const normalized=value=>String(value||'').normalize('NFKC').trim().replace(/[‐‑–—−]/g,'-');
const upper=value=>normalized(value).toUpperCase().replace(/([A-Z0-9]{3})-\s+(?=[A-Z])/g,'$1-');
const tokens=value=>upper(value).match(/(?<![A-Z0-9-])(?:[A-Z0-9]{3}-)?[A-Z]{1,4}\d[A-Z0-9]{0,7}(?:-[A-Z0-9]{2,})?(?![A-Z0-9-])/g)||[];
const core=value=>value.replace(/^[A-Z0-9]{3}-/,'').split('-')[0];

// The master only verifies that a literal posted token is a model token. It
// never supplies a missing token or expands a partial chassis designation.
export function postedVehicleInfo(info, rows=[]) {
  const raw=normalized(info['型式']);
  const code=upper(info['品番']);
  const known=new Set(rows.flatMap(row=>tokens(row.model).map(core)));
  const models=[...new Set(tokens(raw).filter(token=>token!==code && !/^[RF]\d{2}$/.test(token) && known.has(core(token))))];
  const result={...info};delete result['型式'];delete result['車両情報'];
  if(models.length)result['型式']=models.join(' / ');
  let vehicle=normalized(info['車両情報'])||raw;
  // A pasted table is not a vehicle model: retain its explicitly posted type
  // section, with the original text still kept in the private intake archive.
  if(/品\s*番/.test(vehicle)&&/型\s*式/.test(vehicle))vehicle=vehicle.split(/型\s*式/).at(-1).trim();
  if(code){const escaped=code.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');vehicle=vehicle.replace(new RegExp(`(?<![A-Z0-9-])${escaped}(?![A-Z0-9-])`,'gi'),'').trim();}
  if(vehicle && upper(vehicle)!==models.join(' / '))result['車両情報']=vehicle;
  return result;
}
