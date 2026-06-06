export function navigate(path) {
  history.pushState(null, '', path);
  window.dispatchEvent(new CustomEvent('navigate', { detail: { path } }));
}

export function matchRoute(routes, path) {
  for (const route of routes) {
    const params = match(route.path, path);
    if (params !== null) return { route, params };
  }
  return null;
}

function match(pattern, path) {
  if (pattern === '*') return {};
  const pp = pattern.split('/');
  const rp = path.split('/');
  if (pp.length !== rp.length) return null;
  const params = {};
  for (let i = 0; i < pp.length; i++) {
    if (pp[i].startsWith(':')) {
      params[pp[i].slice(1)] = decodeURIComponent(rp[i]);
    } else if (pp[i] !== rp[i]) {
      return null;
    }
  }
  return params;
}
