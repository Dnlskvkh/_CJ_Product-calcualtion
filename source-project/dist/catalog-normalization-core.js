(function(root){
const dimensions=/(^|[^\p{L}\p{N}])([МMмmфФØø⌀]?\d+(?:[.,]\d+)?(?:\s*[xх×*XХ]\s*\d+(?:[.,]\d+)?)+)/gu;
function name(value){return String(value??'').normalize('NFC').replace(/\s+/g,' ').trim()
 .replace(dimensions,(_,prefix,size)=>prefix+size.replace(/\s*[xх×*XХ]\s*/g,' × ').replace(/\./g,','))
 .replace(/(^|[^\p{L}\p{N}])(\d+(?:[.,]\d+)?)\s*(мм|см|м²|м³|м2|м3|м|кг|мл|л)(?![\p{L}\p{N}])/gu,(_,prefix,n,unit)=>prefix+n.replace('.',',')+' '+unit.replace('м2','м²').replace('м3','м³'));}
function search(value){return String(value??'').normalize('NFKC').toLowerCase().replaceAll('ё','е')
 .replace(dimensions,(_,prefix,size)=>prefix+size.replace(/\s*[xх×*XХ]\s*/g,'×'))
 .replace(/(^|[^\p{L}\p{N}])[mм](?=\d)/gu,'$1м')
 .replace(/(\d),(?=\d)/g,'$1.')
 .replace(/(?<![\p{L}\p{N}])[mм]\s*\^?\s*([23])(?![\p{L}\p{N}])/gu,'м$1')
 .replace(/(\d)\s*(м\.\s*п\.?|мп\.?|пог\.?\s*м\.?|мм|см[23]?|м[23]?|кг|г|т|мл|л|шт\.?)(?![\p{L}\p{N}])/gu,'$1 $2')
 .replace(/(?<![\p{L}\p{N}])(?:м\.?\s*п\.?|пог\.?\s*м\.?)(?![\p{L}\p{N}])/gu,'м')
 .replace(/(?<![\p{L}\p{N}])(кг|л|мл|шт|компл|рул|уп)\.(?![\p{L}\p{N}])/gu,'$1')
 .replace(/(?<![\p{L}\p{N}])н\s*[/·]\s*ч(?![\p{L}\p{N}])/gu,'нч')
 .replace(/[,;:()[\]"«»]/g,' ').replace(/\s+/g,' ').trim();}
const en="`qwertyuiop[]asdfghjkl;'zxcvbnm,.",ru='ёйцукенгшщзхъфывапролджэячсмитьбю';
function layout(value,from,to){return value.toLowerCase().replace(/\S+/g,word=>/\d/.test(word)?word:Array.from(word,c=>from.includes(c)?to[from.indexOf(c)]:c).join(''));}
function matcher(value){const raw=String(value??''),variants=[raw,layout(raw,en,ru),layout(raw,ru,en)];
 const queries=[...new Set(variants.map(search))].map(q=>(q.match(/\S*\d (?:мм|см[23]?|м[23]?|кг|г|т|мл|л|шт\.?)(?= |$)|\S+/gu)||[]).map(term=>{
  const escaped=term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  if(!/\d/.test(term))return text=>text.includes(term);
  const edge=/[\p{L}]/u.test(term)?'[\\p{L}\\p{N}.]':'[\\p{N}.]';
  const pattern=new RegExp('(?<!'+edge+')'+escaped+'(?!'+edge+')','u');return text=>pattern.test(text);
 }));
 return text=>queries.some(terms=>terms.every(test=>test(text)));}
root.CatalogNormalization={name,search,matcher};if(typeof module!=='undefined')module.exports=root.CatalogNormalization;
})(typeof window!=='undefined'?window:globalThis);
