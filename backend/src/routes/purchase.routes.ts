// src/routes/backup.routes.ts
import { Router } from 'express';
import { createBackup, listBackups, restoreBackup } from '../utils/backup.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';

const router = Router();

// ✅ إنشاء نسخة احتياطية (Admin فقط)
router.post('/backup', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const backupPath = await createBackup();
    res.json({ success: true, backup: backupPath });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Backup failed', message: errorMessage });
  }
});

// ✅ قائمة النسخ الاحتياطية (Admin فقط)
router.get('/backups', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const backups = listBackups();
    res.json({ backups });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Failed to list backups', message: errorMessage });
  }
});

// ✅ استعادة نسخة احتياطية (Admin فقط)
router.post('/backup/restore', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { backupFile } = req.body;
    if (!backupFile) {
      return res.status(400).json({ error: 'Backup file name required' });
    }
    await restoreBackup(backupFile);
    res.json({ success: true, message: 'Database restored successfully' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Restore failed', message: errorMessage });
  }
});

export default router;