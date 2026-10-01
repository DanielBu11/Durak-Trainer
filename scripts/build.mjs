import {cp, mkdir, readdir, readFile, writeFile, rm, lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
export const outputRoot = path.resolve(projectRoot, '_site');
export async function filesIn(root, prefix = '') {
  const result = [];
  for (const entry of await readdir(path.join(root, prefix), {withFileTypes:true})) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symlinks are not supported: ${relative}`);
    if (entry.isDirectory()) result.push(...await filesIn(root, relative));
    else result.push(relative);
  }
  return result.sort();
}
export async function build() {
  // Only the fixed generated directory may be replaced; never source dist/.
  if (path.dirname(outputRoot) !== path.resolve(projectRoot) || path.basename(outputRoot) !== '_site') throw Error('Unsafe output path');
  const existing = await lstat(outputRoot).catch(error => {if(error.code !== 'ENOENT')throw error;});
  if (existing?.isSymbolicLink()) throw Error('Output must not be a symlink');
  await rm(outputRoot, {recursive:true, force:true});
  await mkdir(outputRoot, {recursive:true});
  await cp(path.join(projectRoot, 'dist'), outputRoot, {recursive:true});
  await cp(path.join(projectRoot, 'src'), path.join(outputRoot, 'src'), {recursive:true});
  await writeFile(path.join(outputRoot,'.nojekyll'),'');
  const assets=(await filesIn(outputRoot)).filter(f=>f!=='.nojekyll' && f!=='sw.js');
  const worker=await readFile(path.join(projectRoot,'dist/sw.js'),'utf8');
  const hash=createHash('sha256').update(worker);
  for(const asset of assets) hash.update(asset).update(await readFile(path.join(outputRoot,asset)));
  const version=hash.digest('hex').slice(0,16);
  const generated=worker.replace(/const VERSION = '[^']+';/,`const VERSION = '${version}';`)
    .replace(/\/\* ASSETS_START \*\/[\s\S]*?\/\* ASSETS_END \*\//,`/* ASSETS_START */\nconst ASSETS = ${JSON.stringify(assets.map(f=>'./'+f))};\n/* ASSETS_END */`);
  await writeFile(path.join(outputRoot,'sw.js'),generated);
  console.log(`Production: _site (${assets.length} cached assets, version ${version})`);
  return {assets,version};
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) await build();
