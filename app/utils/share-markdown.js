// Shares plain text (markdown export output) via the native share sheet where
// supported, falling back to clipboard copy — the caller decides whether to
// toast based on the returned outcome (a real share needs no toast, the OS
// share sheet already gives its own feedback; a user-cancelled share is a
// silent no-op, not a failure).
export async function shareMarkdown(text, title) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled';
      // Real failure (not a user cancel) — fall through to clipboard below.
    }
  }
  await navigator.clipboard.writeText(text);
  return 'copied';
}
