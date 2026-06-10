const parts = new URL(import.meta.url).pathname.split('/');
const appIdx = parts.lastIndexOf('app');
export const BASE_PATH = appIdx > 0 ? parts.slice(0, appIdx).join('/') : '';
