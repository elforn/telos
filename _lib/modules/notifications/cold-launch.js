// Routes a tapped OS notification back into the app, whether a tab is
// already open (focused, then messaged) or the tap had to open a brand-new
// one (cold start via a one-time URL param). Both paths matter — a
// notificationclick handler running in the Service Worker can't always find
// an existing window to focus, and a fresh window has no in-memory state to
// message into yet. paramName/messageType are app-chosen so multiple apps
// (or multiple digest types in one app) don't collide.
export function consumeColdLaunchParam(paramName) {
  const url = new URL(location.href);
  if (!url.searchParams.has(paramName)) return false;
  url.searchParams.delete(paramName);
  history.replaceState(null, '', url);
  return true;
}

export function onColdLaunchMessage(messageType, callback) {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data?.type === messageType) callback();
  });
}
