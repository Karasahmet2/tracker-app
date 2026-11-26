// =========================================================
// Backup: save everything to a file on the phone, and load it back.
// =========================================================
import * as db from './db.js';

export const BACKUP_KIND = 'tracker-backup';

export async function saveBackup({ useShare = false } = {}) {
  const data = await db.exportAll();
  const file = { kind: BACKUP_KIND, version: 1, savedAt: new Date().toISOString(), ...data };
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
  const d = new Date();
  const name = `tracker-backup-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`;
  // Update 7: on the phone, offer the share sheet so it can go straight to Google Drive or Files.
  if (useShare) {
    const f = new File([blob], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [f] })) {
      try { await navigator.share({ files: [f], title: 'Tracker backup' }); await db.setSetting('lastBackup', Date.now()); return name; }
      catch (e) { if (e && e.name === 'AbortError') return null; }          // closed the share sheet: not saved
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  await db.setSetting('lastBackup', Date.now());
  return name;
}

// Checks the file, then replaces all data with it. Throws a plain message if it isn't a backup.
export async function loadBackup(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch (e) { throw new Error("That file isn't a tracker backup."); }
  if (!data || data.kind !== BACKUP_KIND || !Array.isArray(data.drinks)) throw new Error("That file isn't a tracker backup.");
  const clean = {
    drinks: data.drinks.filter((d) => d && typeof d.id === 'string' && Number.isFinite(d.ts) && Number.isFinite(d.ml))
      .map((d) => ({ id: d.id, ts: d.ts, ml: d.ml })),
    runs: (data.runs || []).filter((r) => r && typeof r.id === 'string' && Number.isFinite(r.ts) && Number.isFinite(r.km))
      .map((r) => ({ id: r.id, ts: r.ts, km: r.km, sec: Number(r.sec) || 0, where: r.where === 'treadmill' ? 'treadmill' : 'outdoor', incline: Number(r.incline) || 0 })),
    notes: (data.notes || []).filter((n) => n && typeof n.id === 'string' && Number.isFinite(n.ts) && typeof n.text === 'string')
      .map((n) => ({ id: n.id, ts: n.ts, edited: Number.isFinite(n.edited) ? n.edited : null, text: n.text, color: String(n.color || 'plain') })),
    trash: (data.trash || []).filter((t) => t && typeof t.id === 'string' && Number.isFinite(t.ts)),
    settings: data.settings && typeof data.settings === 'object' ? data.settings : {}
  };
  await db.importAll(clean);
  return clean.drinks.length;
}
