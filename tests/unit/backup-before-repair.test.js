// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../../app/strings.js';
import { _resetToast } from '../../_lib/modules/toast/toast.js';

vi.mock('../../_lib/modules/sync/sync.js', () => ({
  exportData: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
  downloadExport: vi.fn(),
}));

import { exportData, downloadExport } from '../../_lib/modules/sync/sync.js';
import { backupBeforeRepair, LAST_EXPORT_KEY } from '../../app/utils/backup-before-repair.js';

beforeEach(() => { localStorage.clear(); });
afterEach(() => { _resetToast(); vi.clearAllMocks(); });

describe('backupBeforeRepair', () => {
  it('exports data and downloads it as a before-update backup file', async () => {
    await backupBeforeRepair();
    expect(exportData).toHaveBeenCalledOnce();
    expect(downloadExport).toHaveBeenCalledOnce();
    const [data, filename] = downloadExport.mock.calls[0];
    expect(data).toBeInstanceOf(Uint8Array);
    expect(filename).toMatch(/^telos-backup-before-update-\d+\.telos$/);
  });

  it('records the export timestamp under LAST_EXPORT_KEY', async () => {
    expect(localStorage.getItem(LAST_EXPORT_KEY)).toBeNull();
    await backupBeforeRepair();
    expect(Number(localStorage.getItem(LAST_EXPORT_KEY))).toBeGreaterThan(0);
  });

  it('propagates a failure from exportData (caller/repairInstallation treats onBackup failure as non-fatal)', async () => {
    exportData.mockRejectedValueOnce(new Error('export failed'));
    await expect(backupBeforeRepair()).rejects.toThrow('export failed');
  });
});
