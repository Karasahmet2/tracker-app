// =========================================================
// Saved data — the phone's built-in database (IndexedDB).
// Nothing here leaves the phone.
//
// Stores
//   drinks   { id, ts, ml }                 one row per drink
//   runs     { id, ts, km, sec, where, incline }   one row per run (v2)
//              where: 'outdoor' | 'treadmill'; incline in % (treadmill only)
//   trash    { ...item, kind, deletedAt }    deleted drinks/runs, kept 30 days
//              kind: 'drink' | 'run'
//   settings { key, value }
//
// Changing the layout? Bump DB_VERSION and add a step in migrate()
// so existing data carries over.
// =========================================================

const DB_NAME = 'tracker';
const DB_VERSION = 2;
export const TRASH_DAYS = 30;

let dbPromise = null;

function migrate(db, oldVersion) {
  // Each case runs once, in order, for phones coming from an older version.
  switch (oldVersion) {
    case 0: {
      const drinks = db.createObjectStore('drinks', { keyPath: 'id' });
      drinks.createIndex('ts', 'ts');
      db.createObjectStore('trash', { keyPath: 'id' });
      db.createObjectStore('settings', { keyPath: 'key' });
    }
    // falls through
    case 1: {                                   // Update 5: running
      const runs = db.createObjectStore('runs', { keyPath: 'id' });
      runs.createIndex('ts', 'ts');
    }
    // case 2: future migrations go here
  }
}

export function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (ev) => migrate(req.result, ev.oldVersion);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

const done = (req) => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});
const finished = (tx) => new Promise((resolve, reject) => {
  tx.oncomplete = () => resolve();
  tx.onerror = () => reject(tx.error);
  tx.onabort = () => reject(tx.error);
});

async function store(name, mode = 'readonly') {
  const db = await open();
  return db.transaction(name, mode).objectStore(name);
}

// ---------- drinks ----------
export async function allDrinks() {
  return done((await store('drinks')).getAll());
}
export async function putDrink(d) {
  return done((await store('drinks', 'readwrite')).put(d));
}

// ---------- runs (Update 5) ----------
export async function allRuns() {
  return done((await store('runs')).getAll());
}
export async function putRun(r) {
  return done((await store('runs', 'readwrite')).put(r));
}
export async function removeRun(id) {
  return done((await store('runs', 'readwrite')).delete(id));
}

// Move any item to the Trash / back. kind 'drink' → drinks store, 'run' → runs store.
const STORE_OF = { drink: 'drinks', run: 'runs' };
export async function trashItem(kind, id) {
  const db = await open();
  const name = STORE_OF[kind];
  const tx = db.transaction([name, 'trash'], 'readwrite');
  const s = tx.objectStore(name);
  const item = await done(s.get(id));
  if (item) {
    s.delete(id);
    tx.objectStore('trash').put({ ...item, kind, deletedAt: Date.now() });
  }
  await finished(tx);
  return item || null;
}
export async function restoreItem(id) {
  const db = await open();
  const tx = db.transaction(['drinks', 'runs', 'trash'], 'readwrite');
  const trash = tx.objectStore('trash');
  const t = await done(trash.get(id));
  if (t) {
    trash.delete(id);
    const { kind, deletedAt, ...item } = t;
    tx.objectStore(STORE_OF[kind] || 'drinks').put(item);
  }
  await finished(tx);
  return t || null;
}

// ---------- trash ----------
export async function trashList() {
  return done((await store('trash')).getAll());
}
export async function purgeTrash(now = Date.now()) {
  const limit = now - TRASH_DAYS * 864e5;
  const db = await open();
  const tx = db.transaction('trash', 'readwrite');
  const s = tx.objectStore('trash');
  const items = await done(s.getAll());
  items.filter((t) => t.deletedAt < limit).forEach((t) => s.delete(t.id));
  await finished(tx);
}
export async function emptyTrash() {
  return done((await store('trash', 'readwrite')).clear());
}

// ---------- settings ----------
export async function getSettings() {
  const rows = await done((await store('settings')).getAll());
  const out = {};
  rows.forEach((r) => { out[r.key] = r.value; });
  return out;
}
export async function setSetting(key, value) {
  return done((await store('settings', 'readwrite')).put({ key, value }));
}

// Several settings in one go, so they can't half-save
export async function setSettings(obj) {
  const db = await open();
  const tx = db.transaction('settings', 'readwrite');
  Object.entries(obj).forEach(([key, value]) => tx.objectStore('settings').put({ key, value }));
  await finished(tx);
}

// ---------- backup ----------
export async function exportAll() {
  return { drinks: await allDrinks(), runs: await allRuns(), trash: await trashList(), settings: await getSettings() };
}

// Replaces everything with the backup's contents
export async function importAll(data) {
  const db = await open();
  const tx = db.transaction(['drinks', 'runs', 'trash', 'settings'], 'readwrite');
  const drinks = tx.objectStore('drinks'), runs = tx.objectStore('runs'), trash = tx.objectStore('trash'), settings = tx.objectStore('settings');
  drinks.clear(); runs.clear(); trash.clear(); settings.clear();
  (data.drinks || []).forEach((d) => drinks.put(d));
  (data.runs || []).forEach((r) => runs.put(r));
  (data.trash || []).forEach((t) => trash.put(t));
  Object.entries(data.settings || {}).forEach(([key, value]) => settings.put({ key, value }));
  await finished(tx);
}

// Remove a drink for good (used by Undo right after adding it)
export async function removeDrink(id) {
  return done((await store('drinks', 'readwrite')).delete(id));
}
