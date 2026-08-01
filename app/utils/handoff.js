// Payload shapes sent to another person's independent Telos install.
// __telosHandoff/kind are markers the sender/receiver use for routing; they are
// never read by mergeStrategy, which only looks at `lists`/`goals`.
//
// - 'list' and 'year' payloads already sit under a `lists`/`goals` key, so they
//   round-trip straight through the existing mergeStrategy/applyMerge machinery
//   unchanged — mergeStrategy already merges goals per year+section by id.
// - 'item' and 'goal' payloads carry a bare entity — there is no source list/year
//   context worth preserving across two independent stores, so the receiver picks
//   a fresh destination (list, or year+section) instead of it being implied by the payload.

export function buildListHandoff(list) {
  return {
    __telosHandoff: true,
    kind: 'list',
    lists: [{ ...list, items: (list.items ?? []).map(item => ({ ...item, inGoals: [] })) }],
  };
}

export function buildItemHandoff(item) {
  return { __telosHandoff: true, kind: 'item', item: { ...item, inGoals: [] } };
}

// A bulk-selected group of items from one list — kept as a distinct kind from
// 'item' (rather than always wrapping in an array) so the single-item payload
// shape stays unchanged for the already-shipped S1/S2 receivers. bottom-nav.js's
// routing treats 'item' and 'items' identically otherwise (same list-picker
// landing), it just always has an array of items to place.
export function buildItemsHandoff(items) {
  return { __telosHandoff: true, kind: 'items', items: items.map(item => ({ ...item, inGoals: [] })) };
}

export function buildGoalHandoff(goal) {
  return { __telosHandoff: true, kind: 'goal', goal };
}

export function buildYearHandoff(year, yearGoals) {
  return { __telosHandoff: true, kind: 'year', goals: { [String(year)]: yearGoals } };
}

// SOCLE_VERSION must match _lib/modules/sync/sync.js's own constant — the envelope
// below is read by that module's _readLegacyJSON() path (pre-ZIP era code, still
// present and exercised by readImportFile()/previewImport() for any non-ZIP file).
// Reusing it here means the entire existing inbound routing in bottom-nav.js
// (list/year → merge with Replace hidden, item/goal → picker) works unchanged —
// no new import-side code needed for this format at all.
const SOCLE_VERSION = 1;

function _filenameFor(kind, name) {
  const ts   = new Date().toISOString().replace(/\D/g, '').slice(0, 12);
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) || kind;
  return `${ts}_telos-${kind}-${slug}.txt`;
}

function _envelope(payload) {
  return JSON.stringify({
    socleVersion: SOCLE_VERSION,
    exportedAt: new Date().toISOString(),
    events: [{ type: 'simple:state', payload }],
  });
}

// Share a slice payload as a plain-text .txt file — share as a real (non-ZIP)
// file via the native share sheet, falling back to a plain-text download.
//
// Why plain text, not the ZIP format exportData uses for full backups:
// Chromium validates every shared file's extension AND MIME type against a
// hardcoded allowlist before share() will proceed (chrome/browser/webshare/
// share_service_impl.cc — IsDangerousFilename()/IsDangerousMimeType()), covering
// only images, audio, video, PDF, and plain text/csv/html/css — no archive
// format, under any MIME type or extension (confirmed on-device: canShare()
// returned true for a .telos/zip file, but share() itself always rejected with
// NotAllowedError). .txt/text/plain is on that list, so this is a real,
// achievable native share, not a workaround.
export async function shareHandoff(payload, shareTitle) {
  const json     = _envelope(payload);
  const filename = _filenameFor(payload.kind, shareTitle);
  const file     = new File([json], filename, { type: 'text/plain' });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: shareTitle });
      return;
    } catch (err) {
      if (err?.name === 'AbortError') return;
      console.error('Share failed:', err);
      // Real failure (not a user cancel) — fall through to the download fallback below.
    }
  }

  const blob = new Blob([json], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
