// Extra static asset directories (beyond app/icons/, which build.js handles natively)
// to copy into dist/ and add to the service worker's precache list. Project-root-relative
// paths. This file is never part of the Socle scaffold template, so `npx socle update`
// never touches it — app-specific build extensions live here, not inline in build.js.
export const extraAssetDirs = ['app/fonts'];
