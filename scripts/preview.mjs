import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../_site/',import.meta.url));
export const BASE='/Durak-Trainer/';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
export function previewServer() {
  return createServer(async(req,res)=>{
    try {
      const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      if(pathname===BASE.slice(0,-1)){res.writeHead(301,{Location:BASE});res.end();return;}
      if(!pathname.startsWith(BASE)){res.writeHead(404);res.end();return;}
      const file=path.resolve(root,pathname.slice(BASE.length)||'index.html');
      if(!file.startsWith(root)){res.writeHead(403);res.end();return;}
      const body=await readFile(file);
      res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(body);
    }catch{res.writeHead(404);res.end();}
  });
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const port=Number(process.env.PORT||4173);
  previewServer().listen(port,'127.0.0.1',()=>console.log(`Production preview: http://localhost:${port}${BASE}`));
}
