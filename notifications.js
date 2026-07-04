/**
 * notifications.js
 * ------------------------------------------------------------------
 * IMPORTANT CONTEXT (worth understanding, not just running):
 *
 * iOS Safari only allows web notifications for PWAs that have been
 * added to the home screen (iOS 16.4+), and even then there is no way
 * for pure client-side JS to schedule a notification that fires later
 * while the app is closed or the phone is locked. That requires the
 * Push API + a server that sends the push at the right moment.
 *
 * This module implements the honest, static-hosting-friendly version:
 * reminders fire on an interval WHILE the app is open (foreground or
 * recently backgrounded — iOS gives a page a short grace period after
 * it's hidden before suspending it, but this is not guaranteed).
 *
 * This is a deliberate v1 scope decision, not an oversight — seeing
 * the "You have N pending goals" banner every time you open the app
 * is what does most of the mindfulness work anyway. Real push
 * notifications are a natural v2 (see README).
 */

(function () {
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // check every 5 minutes while open

let intervalHandle = null;

function isSupported() {
  return "Notification" in window;
}

function permissionState() {
  return isSupported() ? Notification.permission : "unsupported";
}

async function requestPermission() {
  if (!isSupported()) return "unsupported";
  const result = await Notification.requestPermission();
  return result;
}

function inQuietHours(settings) {
  const hour = new Date().getHours();
  const { quietHourStart, quietHourEnd } = settings;
  if (quietHourStart === quietHourEnd) return false;
  if (quietHourStart < quietHourEnd) {
    return hour >= quietHourStart && hour < quietHourEnd;
  }
  // wraps past midnight, e.g. 21 -> 8
  return hour >= quietHourStart || hour < quietHourEnd;
}

function hoursSince(isoString) {
  if (!isoString) return Infinity;
  return (Date.now() - new Date(isoString).getTime()) / (1000 * 60 * 60);
}

/** Shows a reminder notification (or falls back to nothing silently if not permitted). */
function fireReminder(pendingCount) {
  if (Notification.permission !== "granted") return;
  const body =
    pendingCount === 1
      ? "You have 1 goal left today. A quick check-in?"
      : `You have ${pendingCount} goals left today. A quick check-in?`;
  try {
    new Notification("Daymark", {
      body,
      icon: "icons/icon-192.png",
      tag: "daymark-reminder", // replaces any existing reminder notification rather than stacking
    });
  } catch (e) {
    console.error("Daymark: could not show notification.", e);
  }
}

/**
 * Starts the in-app reminder loop. Call this once on app load.
 * `getPendingCount` is a callback so this module doesn't need to know
 * about the storage layer directly.
 */
function startReminderLoop(getPendingCount) {
  if (intervalHandle) return; // already running
  const check = () => {
    const settings = window.DaymarkStorage.readSettings();
    if (!settings.notificationsEnabled) return;
    if (Notification.permission !== "granted") return;
    if (inQuietHours(settings)) return;

    const pending = getPendingCount();
    if (pending === 0) return;

    if (hoursSince(settings.lastReminderAt) >= settings.reminderIntervalHours) {
      fireReminder(pending);
      window.DaymarkStorage.writeSettings({
        ...settings,
        lastReminderAt: new Date().toISOString(),
      });
    }
  };

  check(); // run once immediately
  intervalHandle = setInterval(check, CHECK_INTERVAL_MS);

  // Also check right when the tab regains visibility — this is the moment
  // most likely to actually reach the user on iOS, since a fully
  // backgrounded Safari tab will have its timers suspended.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") check();
  });
}

window.DaymarkNotifications = {
  isSupported,
  permissionState,
  requestPermission,
  startReminderLoop,
};
})();
