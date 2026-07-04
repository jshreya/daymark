# Daymark

A small, installable PWA for setting daily intentions and staying mindful of
them through the day. Each morning it asks what matters today and surfaces
anything left unfinished from before; the rest of the day it's a quiet place
to check in.

Built as a hands-on exercise in AI-assisted engineering: using an AI pair
programmer for implementation while making the architecture, scope, and
trade-off calls myself.

## Why this exists

I wanted a project that let me talk concretely, in interviews, about *how*
I use AI to build software — not just that I use it. That meant treating
the AI as a fast implementer of decisions I'd already made, not as the
decision-maker. The interesting parts of this project are the constraints
I ran into and the calls I made around them (see **Design decisions** below).

## Features

- **Morning check-in** — on first open each day, prompts for today's
  intentions and shows anything incomplete from previous days.
- **Carry-over** — unfinished goals roll forward automatically instead of
  silently disappearing.
- **The Day Arc** — a horizontal timeline across the top of the screen
  showing where "now" sits in your waking day. It's the app's one
  deliberate visual flourish, and it's functional, not decorative: it's a
  reminder, at a glance, of how much day is left.
- **In-app reminders** — periodic browser notifications nudge you back to
  the app if goals are still open (see limitations below for what this
  does and doesn't cover on iOS).
- **Installable on iPhone** — add to home screen for a standalone,
  full-screen app experience with an offline-capable app shell.

## Architecture

No framework, no build step — deliberately. At this scope (one screen,
a handful of interactions), a small vanilla JS app is easier to reason
about end-to-end, and easier for me to walk through line-by-line in an
interview than a component tree with hidden framework behavior.

```
daymark/
├── index.html          # App shell + both modals (check-in, settings)
├── manifest.json        # PWA install metadata
├── sw.js                 # Service worker: cache-first app shell, offline support
├── css/style.css        # All styling
├── js/
│   ├── storage.js        # Data layer — localStorage read/write, date-keyed goal storage
│   ├── notifications.js  # Notification permission handling + in-app reminder loop
│   └── app.js             # Rendering, event wiring, morning check-in flow
└── icons/                # App icons (generated programmatically, see generate_icons.py)
```

**Data model**: goals are stored under `daymark:days` in localStorage,
keyed by local date (`YYYY-MM-DD`), each holding a list of
`{ id, text, done, carriedFrom }`. Using the local date (not UTC) matters —
`toISOString()` would roll the day over at UTC midnight, which is wrong for
whatever timezone the person is actually in.

**Why localStorage over IndexedDB**: the data is small, flat, and doesn't
need complex queries. IndexedDB would add async complexity for no real
benefit at this scale. If this app grew to store attachments, history
search, or large datasets, that calculus would flip.

## Design decisions worth knowing about

**Reminders are in-app, not push, in this version — on purpose.**
iOS Safari only supports notifications for PWAs added to the home screen
(iOS 16.4+), and even then, there's no way for client-side JavaScript alone
to schedule a notification that fires later while the app is closed or the
phone is locked. That requires the Push API plus a server sending the push
at the right moment — which means a static GitHub Pages site can't do it
without adding backend infrastructure.

So `notifications.js` implements the honest version: reminders fire on an
interval while the app is open, and — more importantly — every time the app
is opened, it immediately shows what's still pending. That covers most of
the actual mindfulness use case; true background push is a natural v2 (see
below), not a missing feature of v1.

**Cache-first service worker.** The app shell (HTML/CSS/JS/icons) is cached
on install and served from cache first, falling back to network. This
means the app opens instantly and works offline once installed — a natural
fit for something you might open first thing in the morning before you
have signal.

## Roadmap / v2

- **Real push notifications**: add a small serverless backend (e.g. a
  Cloudflare Worker) to hold push subscriptions and send reminders on a
  schedule via the Web Push API, so reminders work even when the app isn't
  open.
- **iCloud/cross-device sync**: currently all data is local to one device
  by design (no backend = no accounts = no sync). A sync layer would need
  its own backend and a decision about auth.

## Running locally

No build step required.

```bash
git clone <your-repo-url>
cd daymark
python3 -m http.server 8000
# visit http://localhost:8000
```

## Deploying to GitHub Pages

1. Push this folder to a GitHub repository.
2. In the repo, go to **Settings → Pages**.
3. Under **Source**, select the branch (e.g. `main`) and root folder.
4. Save — GitHub will publish at `https://<username>.github.io/<repo>/`.

## Installing on iPhone

1. Open the deployed URL in **Safari** (must be Safari, not Chrome — iOS
   only allows installing PWAs from Safari).
2. Tap the **Share** button, then **Add to Home Screen**.
3. Open Daymark from the home screen icon — it now runs full-screen, like
   a native app.
4. To enable reminders: open **Settings** (gear icon) inside the app and
   turn on **Reminders**. iOS will prompt for notification permission.

## Tech stack

HTML, CSS, vanilla JavaScript, the Web Notifications API, Service Worker
API, and the Web App Manifest spec. No dependencies, no build tooling —
deployable as static files.
