// =========================================================
// Data safety (Update 7)
// - Ask Chrome to keep this app's data ("persistent storage"), so it
//   isn't cleared on its own when the phone runs low on space.
// - Weekly backup reminder (a dot on the Today page's backup button).
// - If the app opens with no data at all, offer to restore a backup.
// =========================================================
import { state } from './state.js';

export const safety = { persisted: null, supported: 'storage' in navigator && !!navigator.storage.persist };

export async function checkPersisted() {
  if (!safety.supported) return null;
  try { safety.persisted = await navigator.storage.persisted(); } catch (e) { safety.persisted = null; }
  return safety.persisted;
}
// Chrome decides on its own (installed apps and sites you use a lot are approved).
export async function askPersist() {
  if (!safety.supported) return null;
  try { safety.persisted = await navigator.storage.persist(); } catch (e) { safety.persisted = false; }
  return safety.persisted;
}

const WEEK = 7 * 864e5;
export const hasAnyData = () => state.drinks.length + state.runs.length + state.notes.length > 0;
export function backupDue(now = Date.now()) {
  if (!hasAnyData()) return false;
  const last = state.settings.lastBackup || 0;
  const snooze = state.settings.backupSnooze || 0;
  return now - last > WEEK && now > snooze;
}
export function lastBackupText(now = Date.now()) {
  const last = state.settings.lastBackup;
  if (!last) return 'Never';
  const days = Math.floor((now - last) / 864e5);
  return days === 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`;
}
