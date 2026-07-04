/**
 * app.js
 * ------------------------------------------------------------------
 * Main application logic. Deliberately framework-free: at this scale
 * (one screen, a handful of interactions) a full re-render on every
 * state change is simpler to reason about than introducing a
 * virtual-DOM library, and it keeps the whole app readable in one
 * sitting — which matters for a portfolio piece.
 */

const { todayKey, getDay, addGoal, toggleGoal, deleteGoal,
        getIncompleteGoalsBefore, carryGoalsInto,
        readSettings, writeSettings } = window.DaymarkStorage;

const els = {
  dayArc: document.getElementById("day-arc"),
  dateHeading: document.getElementById("date-heading"),
  checkInModal: document.getElementById("checkin-modal"),
  checkInCarried: document.getElementById("checkin-carried-list"),
  checkInNewGoals: document.getElementById("checkin-new-goals"),
  checkInInput: document.getElementById("checkin-input"),
  checkInAddBtn: document.getElementById("checkin-add-btn"),
  checkInDoneBtn: document.getElementById("checkin-done-btn"),
  carriedSection: document.getElementById("carried-section"),
  carriedList: document.getElementById("carried-list"),
  todayList: document.getElementById("today-list"),
  emptyState: document.getElementById("empty-state"),
  quickAddInput: document.getElementById("quick-add-input"),
  quickAddBtn: document.getElementById("quick-add-btn"),
  settingsBtn: document.getElementById("settings-btn"),
  settingsModal: document.getElementById("settings-modal"),
  settingsClose: document.getElementById("settings-close"),
  notifToggle: document.getElementById("notif-toggle"),
  notifStatus: document.getElementById("notif-status"),
  intervalSelect: document.getElementById("interval-select"),
  pendingBanner: document.getElementById("pending-banner"),
};

let pendingCheckInGoals = []; // goals staged during the morning check-in, before "Done" is pressed

function formatDateHeading(date) {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/** Renders the Day Arc: a horizontal bar spanning waking hours (6am-11pm)
 *  with a dot marking the current time. This is the app's signature visual
 *  element — it's a literal representation of "where you are in your day". */
function renderDayArc() {
  const startHour = 6;
  const endHour = 23;
  const now = new Date();
  const nowFraction = Math.min(
    1,
    Math.max(0, (now.getHours() + now.getMinutes() / 60 - startHour) / (endHour - startHour))
  );
  els.dayArc.innerHTML = `
    <div class="day-arc-track">
      <div class="day-arc-fill" style="width:${nowFraction * 100}%"></div>
      <div class="day-arc-dot" style="left:${nowFraction * 100}%"></div>
    </div>
    <div class="day-arc-labels">
      <span>6am</span><span>2pm</span><span>11pm</span>
    </div>
  `;
}

function renderGoalItem(goal, dateKey, { readOnly = false } = {}) {
  const li = document.createElement("li");
  li.className = "goal-item" + (goal.done ? " is-done" : "");
  if (goal.carriedFrom) li.classList.add("is-carried");

  const checkbox = document.createElement("button");
  checkbox.className = "goal-check";
  checkbox.setAttribute("aria-label", goal.done ? "Mark as not done" : "Mark as done");
  checkbox.textContent = goal.done ? "✓" : "";
  if (!readOnly) {
    checkbox.addEventListener("click", () => {
      toggleGoal(dateKey, goal.id);
      renderAll();
    });
  }

  const text = document.createElement("span");
  text.className = "goal-text";
  text.textContent = goal.text;

  li.appendChild(checkbox);
  li.appendChild(text);

  if (!readOnly) {
    const del = document.createElement("button");
    del.className = "goal-delete";
    del.setAttribute("aria-label", "Delete goal");
    del.textContent = "×";
    del.addEventListener("click", () => {
      deleteGoal(dateKey, goal.id);
      renderAll();
    });
    li.appendChild(del);
  }

  return li;
}

function renderMainView() {
  const key = todayKey();
  const goals = getDay(key);
  const carried = goals.filter((g) => g.carriedFrom);
  const fresh = goals.filter((g) => !g.carriedFrom);

  els.carriedList.innerHTML = "";
  els.todayList.innerHTML = "";

  if (carried.length > 0) {
    els.carriedSection.classList.remove("hidden");
    carried.forEach((g) => els.carriedList.appendChild(renderGoalItem(g, key)));
  } else {
    els.carriedSection.classList.add("hidden");
  }

  if (fresh.length === 0) {
    els.emptyState.classList.remove("hidden");
  } else {
    els.emptyState.classList.add("hidden");
    fresh.forEach((g) => els.todayList.appendChild(renderGoalItem(g, key)));
  }

  const pendingCount = goals.filter((g) => !g.done).length;
  if (pendingCount > 0) {
    els.pendingBanner.textContent =
      pendingCount === 1 ? "1 goal left today" : `${pendingCount} goals left today`;
    els.pendingBanner.classList.remove("hidden");
  } else {
    els.pendingBanner.classList.add("hidden");
  }
}

function renderAll() {
  renderDayArc();
  els.dateHeading.textContent = formatDateHeading(new Date());
  renderMainView();
}

/** Returns the count of incomplete goals today — used by the notification loop. */
function getTodayPendingCount() {
  return getDay(todayKey()).filter((g) => !g.done).length;
}

// ---------- Morning check-in flow ----------

function renderCheckInCarriedList(entries) {
  els.checkInCarried.innerHTML = "";
  if (entries.length === 0) {
    els.checkInCarried.innerHTML = `<p class="checkin-empty">Nothing carried over — clean slate.</p>`;
    return;
  }
  entries.forEach(({ goal }) => {
    const li = document.createElement("li");
    li.className = "goal-item is-carried";
    li.innerHTML = `<span class="goal-check">↺</span><span class="goal-text">${escapeHtml(goal.text)}</span>`;
    els.checkInCarried.appendChild(li);
  });
}

function renderCheckInNewGoals() {
  els.checkInNewGoals.innerHTML = "";
  pendingCheckInGoals.forEach((text, i) => {
    const li = document.createElement("li");
    li.className = "goal-item";
    li.innerHTML = `<span class="goal-check"></span><span class="goal-text"></span>`;
    li.querySelector(".goal-text").textContent = text;
    const del = document.createElement("button");
    del.className = "goal-delete";
    del.textContent = "×";
    del.addEventListener("click", () => {
      pendingCheckInGoals.splice(i, 1);
      renderCheckInNewGoals();
    });
    li.appendChild(del);
    els.checkInNewGoals.appendChild(li);
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function maybeShowMorningCheckIn() {
  const key = todayKey();
  const settings = readSettings();
  if (settings.lastCheckInDate === key) return; // already checked in today

  const incomplete = getIncompleteGoalsBefore(key);
  renderCheckInCarriedList(incomplete);
  pendingCheckInGoals = [];
  renderCheckInNewGoals();
  els.checkInModal.classList.remove("hidden");

  els.checkInModal.dataset.incomplete = JSON.stringify(incomplete);
}

function closeMorningCheckIn() {
  const key = todayKey();
  const incomplete = JSON.parse(els.checkInModal.dataset.incomplete || "[]");

  if (incomplete.length > 0) carryGoalsInto(key, incomplete);
  pendingCheckInGoals.forEach((text) => addGoal(key, text));

  const settings = readSettings();
  writeSettings({ ...settings, lastCheckInDate: key });

  els.checkInModal.classList.add("hidden");
  renderAll();
}

// ---------- Event wiring ----------

els.checkInAddBtn.addEventListener("click", () => {
  const text = els.checkInInput.value.trim();
  if (!text) return;
  pendingCheckInGoals.push(text);
  els.checkInInput.value = "";
  renderCheckInNewGoals();
  els.checkInInput.focus();
});

els.checkInInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") els.checkInAddBtn.click();
});

els.checkInDoneBtn.addEventListener("click", closeMorningCheckIn);

els.quickAddBtn.addEventListener("click", () => {
  const text = els.quickAddInput.value.trim();
  if (!text) return;
  addGoal(todayKey(), text);
  els.quickAddInput.value = "";
  renderAll();
});

els.quickAddInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") els.quickAddBtn.click();
});

els.settingsBtn.addEventListener("click", () => {
  const settings = readSettings();
  els.notifToggle.checked = settings.notificationsEnabled;
  els.intervalSelect.value = settings.reminderIntervalHours;
  updateNotifStatusText();
  els.settingsModal.classList.remove("hidden");
});

els.settingsClose.addEventListener("click", () => {
  els.settingsModal.classList.add("hidden");
});

function updateNotifStatusText() {
  const perm = window.DaymarkNotifications.permissionState();
  const map = {
    granted: "Notifications are allowed.",
    denied: "Notifications are blocked in your browser settings.",
    default: "You'll be asked to allow notifications.",
    unsupported: "Notifications aren't supported in this browser.",
  };
  els.notifStatus.textContent = map[perm] ?? "";
}

els.notifToggle.addEventListener("change", async () => {
  const settings = readSettings();
  if (els.notifToggle.checked) {
    const result = await window.DaymarkNotifications.requestPermission();
    if (result !== "granted") {
      els.notifToggle.checked = false;
      updateNotifStatusText();
      return;
    }
    writeSettings({ ...settings, notificationsEnabled: true });
  } else {
    writeSettings({ ...settings, notificationsEnabled: false });
  }
  updateNotifStatusText();
});

els.intervalSelect.addEventListener("change", () => {
  const settings = readSettings();
  writeSettings({ ...settings, reminderIntervalHours: Number(els.intervalSelect.value) });
});

// ---------- Init ----------

function init() {
  renderAll();
  maybeShowMorningCheckIn();
  window.DaymarkNotifications.startReminderLoop(getTodayPendingCount);

  // Keep the Day Arc's "now" dot accurate without a full re-render.
  setInterval(renderDayArc, 60 * 1000);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch((e) => {
      console.error("Daymark: service worker registration failed.", e);
    });
  }
}

init();
