/**
 * storage.js
 * ------------------------------------------------------------------
 * All persistence for Daymark lives here. We use localStorage (not
 * IndexedDB) because the data model is small and simple — a handful
 * of short-text goals per day. If this app ever needed to store large
 * attachments or run complex queries, IndexedDB would be the right
 * call, but for this shape of data, localStorage keeps things simple
 * and synchronous, which simplifies the rest of the app.
 *
 * Data shape (all under one key, "daymark:days"):
 * {
 *   "2026-07-04": {
 *     goals: [
 *       { id: "a1b2", text: "Ship the PR", done: false, carriedFrom: null },
 *       { id: "c3d4", text: "Call mom", done: true, carriedFrom: "2026-07-03" }
 *     ]
 *   },
 *   ...
 * }
 *
 * Settings live under a separate key, "daymark:settings".
 */

(function () {
const DAYS_KEY = "daymark:days";
const SETTINGS_KEY = "daymark:settings";

const DEFAULT_SETTINGS = {
  notificationsEnabled: false,
  reminderIntervalHours: 2,
  quietHourStart: 21, // 9pm
  quietHourEnd: 8, // 8am
  lastReminderAt: null, // ISO timestamp of the last reminder shown
  lastCheckInDate: null, // the last date the morning check-in was completed
};

/** Returns today's date as a local YYYY-MM-DD string (not UTC — this matters,
 *  since using toISOString() would roll the date over at UTC midnight,
 *  which is wrong for whatever timezone the user is actually in). */
function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateKeyFrom(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function readAllDays() {
  try {
    const raw = localStorage.getItem(DAYS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error("Daymark: failed to read stored days, resetting.", e);
    return {};
  }
}

function writeAllDays(days) {
  try {
    localStorage.setItem(DAYS_KEY, JSON.stringify(days));
    return true;
  } catch (e) {
    console.error("Daymark: failed to save days.", e);
    return false;
  }
}

function readSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch (e) {
    console.error("Daymark: failed to read settings, using defaults.", e);
    return { ...DEFAULT_SETTINGS };
  }
}

function writeSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch (e) {
    console.error("Daymark: failed to save settings.", e);
    return false;
  }
}

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

/** Returns the day's goal list, creating an empty entry if needed (without persisting it). */
function getDay(dateKey) {
  const days = readAllDays();
  return days[dateKey]?.goals ?? [];
}

/** Adds a new goal to a given day and persists it. Returns the new goal. */
function addGoal(dateKey, text, carriedFrom = null) {
  const days = readAllDays();
  if (!days[dateKey]) days[dateKey] = { goals: [] };
  const goal = { id: makeId(), text: text.trim(), done: false, carriedFrom };
  days[dateKey].goals.push(goal);
  writeAllDays(days);
  return goal;
}

function toggleGoal(dateKey, goalId) {
  const days = readAllDays();
  const goal = days[dateKey]?.goals.find((g) => g.id === goalId);
  if (!goal) return;
  goal.done = !goal.done;
  writeAllDays(days);
}

function deleteGoal(dateKey, goalId) {
  const days = readAllDays();
  if (!days[dateKey]) return;
  days[dateKey].goals = days[dateKey].goals.filter((g) => g.id !== goalId);
  writeAllDays(days);
}

/**
 * Finds every incomplete goal from days before `beforeDateKey`.
 * Used to build the "carried over" list during the morning check-in.
 * Returns an array of { dateKey, goal }.
 */
function getIncompleteGoalsBefore(beforeDateKey) {
  const days = readAllDays();
  const results = [];
  Object.keys(days)
    .filter((k) => k < beforeDateKey)
    .sort()
    .forEach((k) => {
      days[k].goals
        .filter((g) => !g.done)
        .forEach((g) => results.push({ dateKey: k, goal: g }));
    });
  return results;
}

/** Carries a list of {dateKey, goal} into today as new goals, tagged with where they came from. */
function carryGoalsInto(targetDateKey, incompleteEntries) {
  const days = readAllDays();
  if (!days[targetDateKey]) days[targetDateKey] = { goals: [] };
  incompleteEntries.forEach(({ dateKey, goal }) => {
    days[targetDateKey].goals.push({
      id: makeId(),
      text: goal.text,
      done: false,
      carriedFrom: dateKey,
    });
  });
  writeAllDays(days);
}

window.DaymarkStorage = {
  todayKey,
  dateKeyFrom,
  getDay,
  addGoal,
  toggleGoal,
  deleteGoal,
  getIncompleteGoalsBefore,
  carryGoalsInto,
  readSettings,
  writeSettings,
};
})();
