// A literal prefix of the published comment, never a generated summary.
export function publishedReviewText(detail){
  const review=typeof detail?.review==='string'?detail.review:'';
  // The archived gallery flattened its separate purchase link into this suffix.
  // Its JSON-LD reviewBody omits the label. Shared staff comments have no sourceFile.
  return detail?.sourceFile?review.replace(/\s{3,}ご購入はこちら\s*$/u,''):review;
}

export function reviewExcerpt(review,limit=120){
  const original=typeof review==='string'?review.trim():'';
  const characters=Array.from(original);
  const truncated=characters.length>limit;
  return {text:truncated?characters.slice(0,limit).join('')+'…':original,truncated};
}

// Cards and dialogs read the same public endpoint. Failed responses stay retryable.
export function createDetailLoader(request){
  const cache=new Map();
  return id=>{
    if(!cache.has(id)){
      const pending=Promise.resolve().then(()=>request(id)).then(detail=>{
        if(!Array.isArray(detail?.images)||!detail.images.length)throw new Error('Detail images unavailable');
        return detail;
      }).catch(error=>{cache.delete(id);throw error;});
      cache.set(id,pending);
    }
    return cache.get(id);
  };
}
