import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../public/',import.meta.url));
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
http.createServer(async(req,res)=>{
 try {
  let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/watermar\//,'/');
  if(name.endsWith('/'))name+='index.html';
  const file=path.resolve(root,'.'+name);
  if(!file.startsWith(root))throw Error();
  res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
  res.end(await readFile(file));
 } catch {res.statusCode=404;res.end('Not found');}
}).listen(4173,'127.0.0.1',()=>console.log('Static Pages preview: http://127.0.0.1:4173/watermar/ (real Apps Script backend)'));
