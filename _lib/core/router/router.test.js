// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { navigate, matchRoute } from './router.js';

describe('matchRoute', () => {
  it('matches an exact path', () => {
    const routes = [{ path: '/', component: 'home-page' }];
    const result = matchRoute(routes, '/');
    expect(result).not.toBeNull();
    expect(result.route.component).toBe('home-page');
    expect(result.params).toEqual({});
  });

  it('extracts :param segments', () => {
    const routes = [{ path: '/goals/:id', component: 'goal-page' }];
    const result = matchRoute(routes, '/goals/42');
    expect(result).not.toBeNull();
    expect(result.params).toEqual({ id: '42' });
  });

  it('extracts multiple :param segments', () => {
    const routes = [{ path: '/goals/:id/items/:itemId', component: 'item-page' }];
    const result = matchRoute(routes, '/goals/1/items/99');
    expect(result).not.toBeNull();
    expect(result.params).toEqual({ id: '1', itemId: '99' });
  });

  it('returns null for non-matching path', () => {
    const routes = [{ path: '/', component: 'home-page' }];
    expect(matchRoute(routes, '/about')).toBeNull();
  });

  it('returns null for path with wrong segment count', () => {
    const routes = [{ path: '/goals/:id', component: 'goal-page' }];
    expect(matchRoute(routes, '/goals')).toBeNull();
  });

  it('matches first route when multiple could apply', () => {
    const routes = [
      { path: '/goals/:id', component: 'goal-page' },
      { path: '/goals/new', component: 'new-goal-page' },
    ];
    const result = matchRoute(routes, '/goals/new');
    expect(result.route.component).toBe('goal-page');
    expect(result.params).toEqual({ id: 'new' });
  });

  it('matches wildcard route after other routes fail', () => {
    const routes = [
      { path: '/', component: 'home-page' },
      { path: '*', component: 'not-found-page' },
    ];
    const result = matchRoute(routes, '/nonexistent');
    expect(result).not.toBeNull();
    expect(result.route.component).toBe('not-found-page');
    expect(result.params).toEqual({});
  });

  it('decodes URI-encoded param values', () => {
    const routes = [{ path: '/search/:query', component: 'search-page' }];
    const result = matchRoute(routes, '/search/hello%20world');
    expect(result.params).toEqual({ query: 'hello world' });
  });
});

describe('navigate', () => {
  beforeEach(() => {
    history.pushState(null, '', '/');
  });

  it('pushes the path to history', () => {
    navigate('/goals/1');
    expect(location.pathname).toBe('/goals/1');
  });

  it('dispatches a navigate event on window', () => {
    const spy = vi.fn();
    window.addEventListener('navigate', spy, { once: true });
    navigate('/goals/1');
    expect(spy).toHaveBeenCalledOnce();
  });

  it('includes the path in the event detail', () => {
    let detail;
    window.addEventListener('navigate', e => { detail = e.detail; }, { once: true });
    navigate('/goals/1');
    expect(detail).toEqual({ path: '/goals/1' });
  });
});
