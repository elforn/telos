import { toast } from './toast.js';

// Capture snapshot, run apply, then show a toast with an undo action.
// If apply() throws, the error propagates and no toast is shown.
// Returns the toast handle so callers can dismiss it programmatically if needed.
export function withUndo({ getSnapshot, apply, restore, message, undoLabel = 'Undo' }) {
  const snapshot = getSnapshot();
  apply();
  return toast(message, 'info', {
    action: { label: undoLabel, onClick: () => restore(snapshot) },
  });
}
