import { createHash } from 'crypto';
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as esbuild from 'esbuild';

const root      = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist      = join(root, 'dist');
const BASE_PATH = process.env.BASE_PATH ?? '/';

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

function contentHash(content) {
  return createHash('sha256').update(content).digest('hex').slice(0, 8);
}

// 1. Bundle + minify app/main.js — all _lib/ imports resolved, tree-shaken
const { outputFiles } = await esbuild.build({
  entryPoints: [join(root, 'app', 'main.js')],
  bundle:      true,
  minify:      true,
  sourcemap:   true,
  format:      'esm',
  define:      { __APP_VERSION__: `"${version}"` },
  outdir:      dist,
  write:       false,
});

const jsFile  = outputFiles.find(f => !f.path.endsWith('.map'));
const mapFile = outputFiles.find(f =>  f.path.endsWith('.map'));

const mainHash     = contentHash(jsFile.text);
const mainFilename = `main.${mainHash}.js`;
const jsContent    = jsFile.text.replace(
  /\/\/# sourceMappingURL=.*$/m,
  `//# sourceMappingURL=${mainFilename}.map`
);

writeFileSync(join(dist, mainFilename), jsContent);
if (mapFile) writeFileSync(join(dist, `${mainFilename}.map`), mapFile.text);

// 2. version.json
writeFileSync(
  join(dist, 'version.json'),
  JSON.stringify({ version, buildTime: new Date().toISOString() }, null, 2)
);

// 3. SW — compute CACHE_VERSION from all significant content
const swSrc         = readFileSync(join(root, '_lib', 'core', 'sw.js'), 'utf8');
const tokensContent = readFileSync(join(root, '_lib', 'core', 'styles', 'tokens.css'), 'utf8');
const manifestSrc   = readFileSync(join(root, 'manifest.json'), 'utf8');
const indexSrc      = readFileSync(join(root, 'index.html'), 'utf8');
const cacheHash     = contentHash(jsContent + tokensContent + manifestSrc + indexSrc);

// Asset list — bundle + manifest + icons (no _lib/ or app/ module files)
const iconDir = join(root, 'app', 'icons');
const assets  = [BASE_PATH, `${BASE_PATH}${mainFilename}`, `${BASE_PATH}manifest.json`];
if (existsSync(iconDir)) {
  for (const f of readdirSync(iconDir)) assets.push(`${BASE_PATH}app/icons/${f}`);
}

writeFileSync(join(dist, 'sw.js'), swSrc
  .replace('%%CACHE_VERSION%%', `${version}-${cacheHash}`)
  .replace('%%ASSETS%%',        JSON.stringify(assets))
  .replace('%%BASE_PATH%%',     BASE_PATH));

// 4. index.html — inline tokens.css, inject hashed main.js, BASE_PATH
writeFileSync(join(dist, 'index.html'), indexSrc
  .replace('<link rel="stylesheet" href="_lib/core/styles/tokens.css" />', `<style>\n${tokensContent}\n</style>`)
  .replace('%%MAIN_JS%%',    `${BASE_PATH}${mainFilename}`)
  .replace('__APP_VERSION__', version)
  .replace('base-path="/"', `base-path="${BASE_PATH}"`));

// 5. manifest.json (BASE_PATH substitution for scaffolded apps)
writeFileSync(join(dist, 'manifest.json'), manifestSrc.replaceAll('%%BASE_PATH%%', BASE_PATH));

// 6. Copy app/icons/ — referenced by manifest
if (existsSync(iconDir)) cpSync(iconDir, join(dist, 'app', 'icons'), { recursive: true });

console.log(`Built ${version} (base: ${BASE_PATH}) → dist/`);
console.log(`  ${mainFilename} (${(jsContent.length / 1024).toFixed(1)} KB)`);
if (mapFile) console.log(`  ${mainFilename}.map`);
console.log(`  sw.js (cache: ${version}-${cacheHash})`);
console.log(`  version.json`);
console.log(`  index.html`);
