const raw = document.querySelector('sw-manager')?.getAttribute('base-path') ?? '/';
export const BASE_PATH = raw.endsWith('/') ? raw.slice(0, -1) : raw;
