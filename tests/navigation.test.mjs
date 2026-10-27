import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
test('Navigation paints profile before slow Google response and ignores stale responses',async()=>{
 const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
 const fn=source.slice(source.indexOf('async function route() {'),source.indexOf('async function load()'));
 const app={innerHTML:'catalog',removeAttribute(){}};let resolve;
 const response=new Promise(r=>resolve=r);
 const context=vm.createContext({Date,Promise,routeVersion:0,ordersLoaded:false,ordersUpdated:0,adminUpdated:0,state:{user:{id:'1'},admin:true},location:{hash:'#profile'},stopSmoothScroll(){},updateNav(){},$:(s)=>s==='#sheet'?{open:false}:app,loading:()=>'<loading>',profile:()=>'<profile>',history:()=>'<history>',cart:()=>'<cart>',catalog:()=>'<catalog>',smoothSwap:async(_el,commit)=>commit(),api:()=>response,window:{scrollTo(){}},renderProducts(){},empty:()=>'<error>',toast(){}});
 vm.runInContext(fn,context);
 await context.route();assert.match(app.innerHTML,/Мой профиль/);assert.match(app.innerHTML,/loading/);
 context.location.hash='#cart';await context.route();assert.equal(app.innerHTML,'<cart>');
 resolve({orders:[],hasMore:false});await new Promise(r=>setTimeout(r,0));assert.equal(app.innerHTML,'<cart>');
});
