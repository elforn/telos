const _locales = { en: {} };
let _active = 'en';

export function defineStrings(obj, locale = 'en') {
  if (!_locales[locale]) _locales[locale] = {};
  Object.assign(_locales[locale], obj);
}

export function setLocale(locale) {
  _active = _locales[locale] ? locale : 'en';
  if (typeof localStorage !== 'undefined') localStorage.setItem('locale', _active);
}

export function getLocale() {
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem('locale');
    if (stored) return stored;
  }
  return 'en';
}

export function t(key, params) {
  const str = _locales[_active]?.[key] ?? _locales.en?.[key] ?? key;
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? `{${k}}`);
}

export function reset() {
  for (const k of Object.keys(_locales)) delete _locales[k];
  _locales.en = {};
  _active = 'en';
  if (typeof localStorage !== 'undefined') localStorage.removeItem('locale');
}
