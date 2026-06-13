const KEY = 'theme';
const _listeners = new Set();
let _mq = null;
let _initialized = false;

function _resolve() {
  const stored = localStorage.getItem(KEY) ?? 'system';
  if (stored === 'system') return _mq?.matches ? 'dark' : 'light';
  return stored;
}

function _apply() {
  document.documentElement.setAttribute('data-theme', _resolve());
  _listeners.forEach(cb => cb(getTheme()));
}

function initTheme() {
  if (_initialized) return;
  _initialized = true;
  _mq = window.matchMedia('(prefers-color-scheme: dark)');
  _mq.addEventListener('change', () => {
    if ((localStorage.getItem(KEY) ?? 'system') === 'system') _apply();
  });
  _apply();
}

function setTheme(theme) {
  if (theme !== 'light' && theme !== 'dark' && theme !== 'system') throw new Error(`Invalid theme: ${theme}`);
  localStorage.setItem(KEY, theme);
  _apply();
}

function getTheme() {
  return localStorage.getItem(KEY) ?? 'system';
}

function onThemeChange(cb) {
  _listeners.add(cb);
  return () => _listeners.delete(cb);
}

function reset() {
  _mq = null;
  _initialized = false;
  _listeners.clear();
}

export { initTheme, setTheme, getTheme, onThemeChange, reset };
