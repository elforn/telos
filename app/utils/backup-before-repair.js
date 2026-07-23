import { exportData, downloadExport } from '../../_lib/modules/sync/sync.js';
import { toast } from '../../_lib/modules/toast/toast.js';
import { t } from '../../_lib/core/strings.js';

export const LAST_EXPORT_KEY = 'telos:lastExportedAt';

// Shared onBackup callback for repairInstallation() — used both by <sw-manager>'s
// automatic loop-detected repair (wired in main.js) and bottom-nav's manual repair
// button, so a full page reload right after always has fresh backed-up data either way.
export async function backupBeforeRepair() {
  const data = await exportData();
  const ts = new Date().toISOString().replace(/\D/g, '').slice(0, 12);
  downloadExport(data, `telos-backup-before-update-${ts}.telos`);
  toast(t('sync.backup-downloaded'), 'info');
  localStorage.setItem(LAST_EXPORT_KEY, String(Date.now()));
}
