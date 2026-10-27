function validateTelegram(raw, token) {
  if(!token)fail(503,'Бот ещё не настроен.');
  if(typeof raw!=='string'||!raw||raw.length>12000)fail(401,'Откройте приложение через Telegram.');
  const params={};
  try {raw.split('&').forEach(part=>{const n=part.indexOf('=');if(n<0)throw Error();const k=decodeURIComponent(part.slice(0,n).replace(/\+/g,' ')),v=decodeURIComponent(part.slice(n+1).replace(/\+/g,' '));if(Object.prototype.hasOwnProperty.call(params,k)||['__proto__','constructor','prototype'].includes(k))throw Error();params[k]=v;});}catch{fail(401,'Некорректная сессия Telegram.');}
  const hash=params.hash;if(!/^[a-f0-9]{64}$/.test(hash||''))fail(401,'Некорректная подпись.');delete params.hash;
  const check=Object.keys(params).sort().map(k=>k+'='+params[k]).join('\n');
  const bytes=s=>Utilities.newBlob(s).getBytes();
  const secret=Utilities.computeHmacSha256Signature(bytes(token),bytes('WebAppData'));
  const actual=Utilities.computeHmacSha256Signature(bytes(check),secret);
  let mismatch=0;for(let i=0;i<32;i++)mismatch|=(actual[i]&255)^parseInt(hash.slice(i*2,i*2+2),16);
  const now=Date.now()/1000,date=Number(params.auth_date);
  if(mismatch||!Number.isFinite(date)||date<=0||date>now+60||now-date>86400)fail(401,'Сессия истекла или недействительна. Откройте приложение заново.');
  let u;try{u=JSON.parse(params.user);}catch{fail(401,'Некорректный профиль.');}
  if(!u||!Number.isSafeInteger(u.id)||u.id<=0)fail(401,'Некорректный профиль.');
  return {id:String(u.id),first_name:String(u.first_name||''),last_name:String(u.last_name||''),username:String(u.username||'')};
}
