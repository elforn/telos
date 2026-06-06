import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'child_process';
import { readFileSync, existsSync, readdirSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(__dirname, '../..');
const DIST = join(APP_ROOT, 'dist');

function runBuild(env = {}) {
  execFileSync('node', [join(APP_ROOT, 'utils/build.js')], {
    env: { ...process.env, ...env },
    stdio: 'pipe',
  });
}

function readDist(filename) {
  return readFileSync(join(DIST, filename), 'utf8');
}

function mainFilename() {
  return readdirSync(DIST).find(f => /^main\.[a-f0-9]{8}\.js$/.test(f));
}

const { version } = JSON.parse(readFileSync(join(APP_ROOT, 'package.json'), 'utf8'));

describe('build — default (BASE_PATH=/)', () => {
  beforeAll(() => {
    rmSync(DIST, { recursive: true, force: true });
    runBuild();
  });

  it('produces a hashed main.js in dist/', () => {
    expect(mainFilename()).toMatch(/^main\.[a-f0-9]{8}\.js$/);
  });

  it('produces sw.js, version.json, index.html, manifest.json', () => {
    for (const f of ['sw.js', 'version.json', 'index.html', 'manifest.json']) {
      expect(existsSync(join(DIST, f)), f).toBe(true);
    }
  });

  it('version.json contains version string and ISO buildTime', () => {
    const v = JSON.parse(readDist('version.json'));
    expect(v.version).toBe(version);
    expect(() => new Date(v.buildTime).toISOString()).not.toThrow();
  });

  it('replaces __APP_VERSION__ token in main.js output', () => {
    const content = readDist(mainFilename());
    expect(content).not.toContain('__APP_VERSION__');
    expect(content).toContain(`'${version}'`);
  });

  it('rewrites import paths in main.js for dist/ layout', () => {
    const content = readDist(mainFilename());
    expect(content).not.toContain("'../_lib/");
    expect(content).toContain("'./_lib/");
    expect(content).toContain("'./app/store/");
    expect(content).toContain("'./app/pages/");
    // General invariant: no bare app-relative imports remain after rewriting
    const unrewritten = content.match(/'\.\/(?!app\/|_lib\/)/g);
    expect(unrewritten, 'unrewritten app-relative imports found').toBeNull();
  });

  it('injects CACHE_VERSION into sw.js', () => {
    const sw = readDist('sw.js');
    expect(sw).not.toContain('%%CACHE_VERSION%%');
    expect(sw).toMatch(new RegExp(`'${version}-[a-f0-9]{8}'`));
  });

  it('injects BASE_PATH into sw.js', () => {
    const sw = readDist('sw.js');
    expect(sw).not.toContain('%%BASE_PATH%%');
    expect(sw).toContain("const BASE_PATH = '/'");
  });

  it('injects ASSETS array into sw.js', () => {
    const sw = readDist('sw.js');
    expect(sw).not.toContain('%%ASSETS%%');
    const parsed = sw.match(/const ASSETS = (\[.*?\]);/s);
    expect(parsed).not.toBeNull();
    const assets = JSON.parse(parsed[1]);
    expect(assets).toContain('/');
    expect(assets).toContain('/manifest.json');
    expect(assets.some(a => /^\/main\.[a-f0-9]{8}\.js$/.test(a))).toBe(true);
  });

  it('replaces %%MAIN_JS%% token in index.html', () => {
    const html = readDist('index.html');
    expect(html).not.toContain('%%MAIN_JS%%');
    expect(html).toMatch(/src="\/main\.[a-f0-9]{8}\.js"/);
  });

  it('copies manifest.json byte-for-byte', () => {
    const src = readFileSync(join(APP_ROOT, 'manifest.json'), 'utf8');
    expect(readDist('manifest.json')).toBe(src);
  });

  it('copies _lib/ to dist/_lib/', () => {
    expect(existsSync(join(DIST, '_lib', 'core', 'app-element.js'))).toBe(true);
    expect(existsSync(join(DIST, '_lib', 'core', 'router', 'router.js'))).toBe(true);
  });

  it('copies app/ to dist/app/', () => {
    expect(existsSync(join(DIST, 'app', 'pages', 'home-page.js'))).toBe(true);
    expect(existsSync(join(DIST, 'app', 'pages', 'not-found-page.js'))).toBe(true);
  });

  it('produces a deterministic hash — same content yields same filename', () => {
    const first = mainFilename();
    rmSync(DIST, { recursive: true, force: true });
    runBuild();
    expect(mainFilename()).toBe(first);
  });
});

describe('build — custom BASE_PATH', () => {
  beforeAll(() => {
    rmSync(DIST, { recursive: true, force: true });
    runBuild({ BASE_PATH: '/my-app/' });
  });

  it('prefixes all asset paths in sw.js ASSETS with BASE_PATH', () => {
    const sw = readDist('sw.js');
    const parsed = sw.match(/const ASSETS = (\[.*?\]);/s);
    const assets = JSON.parse(parsed[1]);
    expect(assets.every(a => a.startsWith('/my-app/'))).toBe(true);
  });

  it('prefixes main.js src in index.html with BASE_PATH', () => {
    const html = readDist('index.html');
    expect(html).toContain('src="/my-app/main.');
  });

  it('injects custom BASE_PATH into sw.js', () => {
    const sw = readDist('sw.js');
    expect(sw).not.toContain('%%BASE_PATH%%');
    expect(sw).toContain("const BASE_PATH = '/my-app/'");
  });
});
