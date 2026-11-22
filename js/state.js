// =========================================================
// The app's data while it runs, kept in step with the database.
// Pages read from `state` and call these functions to change it;
// every change tells the open page to redraw.
// =========================================================
import * as db from './db.js';
import { dayKey, uid } from './ui.js';

export const DEFAULTS = {
  goal: 2500,                    // ml per day
  bonus: 1000,                   // ml, size of the bonus bottle
  cups: [200, 330, 500, 1000],   // cup buttons
  recent: [],                    // last custom amounts
  ask: true,                     // "Add 330 ml?" before a cup counts
  theme: 'midnight',             // midnight | daylight | ocean | berry
  goalLog: null                  // [{ from: 'YYYY-MM-DD', goal, bonus }] — see goalFor()
};

export const state = {
  settings: { ...DEFAULTS },
  drinks: []                     // { id, ts, ml }
};

const listeners = new Set();
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach((fn) => fn());

export async function load() {
  await db.open();
  await db.purgeTrash();
  state.settings = { ...DEFAULTS, ...(await db.getSettings()) };
  state.drinks = (await db.allDrinks()).sort((a, b) => a.ts - b.ts);
  // Phones coming from v1/v2 have no goal history yet: every past day keeps today's goal.
  if (!Array.isArray(state.settings.goalLog) || !state.settings.goalLog.length) {
    state.settings.goalLog = [{ from: '0000-00-00', goal: state.settings.goal, bonus: state.settings.bonus }];
    await db.setSetting('goalLog', state.settings.goalLog);
  }
}

// =========================================================
// Goals over time. Changing the goal applies from today on;
// earlier days keep the goal they had, so their progress
// (full bottles, extra) never changes after the fact.
// =========================================================
export function goalFor(key = dayKey(Date.now())) {
  const log = state.settings.goalLog || [];
  let g = { goal: state.settings.goal, bonus: state.settings.bonus };
  for (const e of log) { if (e.from <= key) g = { goal: e.goal, bonus: e.bonus }; else break; }
  if (log.length && key < log[0].from) g = { goal: log[0].goal, bonus: log[0].bonus };
  return g;
}

export async function setGoal({ goal = state.settings.goal, bonus = state.settings.bonus }) {
  const today = dayKey(Date.now());
  const log = (state.settings.goalLog || []).filter((e) => e.from < today);
  log.push({ from: today, goal, bonus });
  state.settings.goal = goal;
  state.settings.bonus = bonus;
  state.settings.goalLog = log;
  await db.setSetting('goal', goal);
  await db.setSetting('bonus', bonus);
  await db.setSetting('goalLog', log);
  emit();
}

export async function setSetting(key, value) {
  state.settings[key] = value;
  await db.setSetting(key, value);
  emit();
}

export async function addDrink(ml, ts = Date.now()) {
  const d = { id: uid(), ts, ml: Math.round(ml) };
  state.drinks.push(d);
  state.drinks.sort((a, b) => a.ts - b.ts);
  await db.putDrink(d);
  emit();
  return d;
}

export async function deleteDrink(id) {
  const d = await db.trashDrink(id);
  state.drinks = state.drinks.filter((x) => x.id !== id);
  emit();
  return d;
}

// Undo of an add: the drink was a mistake, so it skips the Trash
export async function undoAdd(id) {
  await db.removeDrink(id);
  state.drinks = state.drinks.filter((x) => x.id !== id);
  emit();
}

// Change a drink's amount or time (any day, not in the future)
export async function updateDrink(id, changes) {
  const d = state.drinks.find((x) => x.id === id);
  if (!d) return null;
  const before = { ...d };
  Object.assign(d, changes);
  state.drinks.sort((a, b) => a.ts - b.ts);
  await db.putDrink({ id: d.id, ts: d.ts, ml: d.ml });
  emit();
  return before;
}

export async function restoreDrink(id) {
  const t = await db.restoreDrink(id);
  if (t) {
    const { kind, deletedAt, ...d } = t;
    state.drinks.push(d);
    state.drinks.sort((a, b) => a.ts - b.ts);
  }
  emit();
  return t;
}

export async function reloadAll() { await load(); emit(); }

// ---------- questions pages ask ----------
export function drinksOn(key = dayKey(Date.now())) {
  return state.drinks.filter((d) => dayKey(d.ts) === key);
}
export const totalOn = (key) => drinksOn(key).reduce((s, d) => s + d.ml, 0);
