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
  goalLog: null,                 // [{ from: 'YYYY-MM-DD', goal, bonus }] — see goalFor()
  runGoal: 15,                   // km per week (Monday–Sunday)
  runBonus: 5,                   // km on the bonus lap
  runGoalLog: null,              // [{ from: 'YYYY-MM-DD' (a Monday), goal, bonus }]
  noteColor: 'yellow'            // colour the next quick note starts with
};

export const state = {
  settings: { ...DEFAULTS },
  drinks: [],                    // { id, ts, ml }
  runs: [],                      // { id, ts, km, sec, where, incline }
  notes: []                      // { id, ts, edited, text, color }
};

const listeners = new Set();
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach((fn) => fn());

export async function load() {
  await db.open();
  await db.purgeTrash();
  state.settings = { ...DEFAULTS, ...(await db.getSettings()) };
  state.drinks = (await db.allDrinks()).sort((a, b) => a.ts - b.ts);
  state.runs = (await db.allRuns()).sort((a, b) => a.ts - b.ts);
  state.notes = (await db.allNotes()).sort((a, b) => b.ts - a.ts);   // newest first
  if (!Array.isArray(state.settings.runGoalLog) || !state.settings.runGoalLog.length) {
    state.settings.runGoalLog = [{ from: '0000-00-00', goal: state.settings.runGoal, bonus: state.settings.runBonus }];
    await db.setSetting('runGoalLog', state.settings.runGoalLog);
  }
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
  emit();
  await db.setSettings({ goal, bonus, goalLog: log });
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
  const d = await db.trashItem('drink', id);
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

export async function restoreDrink(id) { return restoreItem(id); }

export async function reloadAll() { await load(); emit(); }

// ---------- questions pages ask ----------
export function drinksOn(key = dayKey(Date.now())) {
  return state.drinks.filter((d) => dayKey(d.ts) === key);
}
export const totalOn = (key) => drinksOn(key).reduce((s, d) => s + d.ml, 0);

// =========================================================
// Running (Update 5). Goals are per week, Monday to Sunday.
// Like water, a new weekly goal counts from this week on.
// =========================================================
export const mondayKey = (ts = Date.now()) => {
  const d = new Date(ts); d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dayKey(d.getTime());
};

export function runGoalFor(weekKey = mondayKey()) {
  const log = state.settings.runGoalLog || [];
  let g = { goal: state.settings.runGoal, bonus: state.settings.runBonus };
  for (const e of log) { if (e.from <= weekKey) g = { goal: e.goal, bonus: e.bonus }; else break; }
  if (log.length && weekKey < log[0].from) g = { goal: log[0].goal, bonus: log[0].bonus };
  return g;
}

export async function setRunGoal({ goal = state.settings.runGoal, bonus = state.settings.runBonus }) {
  const week = mondayKey();
  const log = (state.settings.runGoalLog || []).filter((e) => e.from < week);
  log.push({ from: week, goal, bonus });
  Object.assign(state.settings, { runGoal: goal, runBonus: bonus, runGoalLog: log });
  emit();
  await db.setSettings({ runGoal: goal, runBonus: bonus, runGoalLog: log });
}

export function runsInWeek(weekKey = mondayKey()) {
  return state.runs.filter((r) => mondayKey(r.ts) === weekKey);
}
export function runsOn(key) {
  return state.runs.filter((r) => dayKey(r.ts) === key);
}

const cleanRun = (r) => ({
  id: r.id, ts: r.ts, km: Math.round(r.km * 100) / 100, sec: Math.round(r.sec),
  where: r.where === 'treadmill' ? 'treadmill' : 'outdoor',
  incline: r.where === 'treadmill' ? Math.round((Number(r.incline) || 0) * 10) / 10 : 0
});

export async function addRun(r) {
  const run = cleanRun({ ...r, id: uid() });
  state.runs.push(run);
  state.runs.sort((a, b) => a.ts - b.ts);
  await db.putRun(run);
  emit();
  return run;
}
export async function updateRun(id, changes) {
  const i = state.runs.findIndex((x) => x.id === id);
  if (i < 0) return null;
  const before = { ...state.runs[i] };
  state.runs[i] = cleanRun({ ...state.runs[i], ...changes });
  state.runs.sort((a, b) => a.ts - b.ts);
  await db.putRun(state.runs.find((x) => x.id === id));
  emit();
  return before;
}
export async function deleteRun(id) {
  const r = await db.trashItem('run', id);
  state.runs = state.runs.filter((x) => x.id !== id);
  emit();
  return r;
}
export async function undoAddRun(id) {
  await db.removeRun(id);
  state.runs = state.runs.filter((x) => x.id !== id);
  emit();
}
// Restore anything from the Trash (drink or run)
export async function restoreItem(id) {
  const t = await db.restoreItem(id);
  if (t) {
    const { kind, deletedAt, ...item } = t;
    if (kind === 'run') state.runs.push(item);
    else if (kind === 'note') { state.notes.push(item); state.notes.sort((a, b) => b.ts - a.ts); }
    else state.drinks.push(item);
    state.runs.sort((a, b) => a.ts - b.ts);
    state.drinks.sort((a, b) => a.ts - b.ts);
  }
  emit();
  return t;
}

// ---------- run maths ----------
export const paceSec = (r) => (r.km > 0 ? r.sec / r.km : 0);              // seconds per km
export const speedKmh = (r) => (r.sec > 0 ? r.km / (r.sec / 3600) : 0);
export const climbedM = (r) => (r.where === 'treadmill' ? Math.round(r.km * 1000 * (r.incline || 0) / 100) : 0);

// =========================================================
// Notes (Update 6). Kept newest first. `ts` is when the note
// was written and never changes; `edited` is the last change.
// =========================================================
export const NOTE_COLORS = ['plain', 'yellow', 'green', 'blue', 'pink', 'purple'];
const cleanColor = (c) => (NOTE_COLORS.includes(c) ? c : 'plain');

export async function addNote(text, color = state.settings.noteColor) {
  const n = { id: uid(), ts: Date.now(), edited: null, text: String(text).trim(), color: cleanColor(color) };
  state.notes.unshift(n);
  await db.putNote(n);
  emit();
  return n;
}
export async function updateNote(id, changes) {
  const n = state.notes.find((x) => x.id === id);
  if (!n) return null;
  const before = { ...n };
  if (changes.text != null) n.text = String(changes.text).trim();
  if (changes.color != null) n.color = cleanColor(changes.color);
  n.edited = changes.edited !== undefined ? changes.edited : Date.now();
  await db.putNote({ ...n });
  emit();
  return before;
}
export async function deleteNote(id) {
  const n = await db.trashItem('note', id);
  state.notes = state.notes.filter((x) => x.id !== id);
  emit();
  return n;
}
export async function undoAddNote(id) {
  await db.removeNote(id);
  state.notes = state.notes.filter((x) => x.id !== id);
  emit();
}
export const notesOn = (key) => state.notes.filter((n) => dayKey(n.ts) === key);
