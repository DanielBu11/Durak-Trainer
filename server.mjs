import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const base=fileURLToPath(new URL('./',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.mp3':'audio/mpeg','.webmanifest':'application/manifest+json'};
const port=Number(process.env.PORT||5173);
createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    const pathname=decodeURIComponent(url.pathname);
    const root=path.join(base,pathname.startsWith('/src/')?'src':'dist');
    const relative=pathname.startsWith('/src/')?pathname.slice(5):pathname.slice(1)||'index.html';
    const file=path.resolve(root,relative);
    if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
    const body=await readFile(file);
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(body);
  }catch {res.writeHead(404);res.end('Nicht gefunden');}
}).listen(port,'0.0.0.0',()=>console.log(`Durak: http://localhost:${port} — Beenden mit Strg+C`));
