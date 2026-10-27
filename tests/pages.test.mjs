import test from 'node:test';
import assert from 'node:assert/strict';
import {storeApi,imageUrl} from '../public/transport.js';
test('Pages transport sends signed session in a simple POST and surfaces server errors',async()=>{
 const original=globalThis.fetch;let request;
 try {
  globalThis.fetch=async(url,options)=>{request={url,options,body:JSON.parse(options.body)};return Response.json({ok:true,data:{orders:[]}});};
  await storeApi('/orders?offset=20',{},'signed-session');
  assert.equal(request.options.method,'POST');assert.equal(request.options.credentials,'omit');
  assert.equal(request.options.headers['Content-Type'],'text/plain;charset=UTF-8');
  assert.equal(request.body.initData,'signed-session');assert.equal(request.body.offset,'20');assert.equal(request.body.path,'/api/orders');
  assert.equal('secret' in request.body,false);
  globalThis.fetch=async()=>Response.json({ok:false,status:401,error:'Сессия истекла'});
  await assert.rejects(storeApi('/orders'),/Сессия истекла/);
  assert.ok(imageUrl('/img/1.webp').endsWith('/public/img/1.webp'));
  assert.ok(imageUrl('https://evil.test/x').endsWith('/public/favicon.svg'));
 } finally {globalThis.fetch=original;}
});
