import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { generateKeyPairSync } from 'node:crypto';
import { database } from '../scripts/sqlite-adapter.mjs';
import { syncSheets } from '../src/sheets.js';
test('Sheets retry recovers a lost response without duplicating rows; user text stays RAW',async()=>{
 const DB=database();DB.exec(await readFile(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8'));
 await DB.prepare('INSERT INTO products(id,name,description,category,price,images,active,created_at,updated_at) VALUES(?,?,?,?,?,?,1,?,?)').bind('test-id','=IMPORTXML("bad")','Desc','Оборудование',120000,'[]','2026-01-01','2026-01-01').run();
 await DB.prepare("INSERT INTO outbox(entity,entity_id) VALUES('product','test-id')").run();
 const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 const env={DB,SHEET_ID:'test',GOOGLE_SERVICE_ACCOUNT:JSON.stringify({client_email:'test@example.com',private_key:privateKey.export({format:'pem',type:'pkcs8'})})};
 const original=globalThis.fetch;let rows=[['ID']];let loseResponse=true;let payload;
 globalThis.fetch=async(url,options)=>{
   if(String(url).includes('oauth2'))return Response.json({access_token:'test-access-token'});
   if(String(url).includes('values:batchUpdate')){payload=JSON.parse(options.body);const row=Number(payload.data[0].range.match(/A(\d+)$/)[1]);rows[row-1]=payload.data[0].values[0];if(loseResponse){loseResponse=false;throw new Error('response lost');}return Response.json({});}
   return Response.json({values:rows.map(r=>[r[0]])});
 };
 try {
   const first=await syncSheets(env);assert.ok(first.error);assert.equal(rows.length,2);
   assert.equal((await DB.prepare('SELECT synced_version FROM outbox').first()).synced_version,0);
   await DB.prepare('UPDATE outbox SET next_attempt=0').run();
   assert.equal((await syncSheets(env)).synced,1);assert.equal(rows.length,2);assert.equal(payload.valueInputOption,'RAW');assert.equal(rows[1][1],'=IMPORTXML("bad")');
   assert.equal((await DB.prepare('SELECT synced_version FROM outbox').first()).synced_version,1);
 }finally{globalThis.fetch=original;DB.close();}
});
