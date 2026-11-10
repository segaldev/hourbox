# Hourbox

A simple time-boxing planner: top 3 priorities, brain dump, parking lot, a daily hour grid (one activity per box; any hour can be split into 30- or 15-minute boxes), a month view, and a "Finish day" review with optional reflection.

**Live app:** https://segaldev.github.io/hourbox/

## Daily routine

Open **Settings** (the sliders button) to set up boxes every new day starts with, such as "6:00 Get ready". Each item has a start time, length, tag, weekdays, and can be marked **Flexible**. Flexible items have a dashed outline. When you drop something on one, it moves to the nearest free time instead of being sent to the brain dump. Days that already exist get an **Add routine** button.

## Google Calendar (read-only)

In **Settings → Google Calendar**, **Sync** reads that day's events from the Google calendars you pick in its preview (your choice is saved in your account) and shows a preview before changing anything. Hourbox never changes your calendar. Timed events become boxes (snapped to 15 minutes, tagged Meetings); flexible boxes move aside; boxes you planned yourself are never overwritten; events that don't fit can go to the brain dump; all-day and declined events are skipped. Syncing again updates only the calendar boxes and keeps their status.

Write-back (moves, renames, adding your own boxes) is built but switched off: set `CAL_WRITE = true` in `index.html` and add the `calendar.events` scope to turn it on.

Setup in the Firebase project's Google Cloud: enable the Google Calendar API, add the `calendar.events.readonly` and `calendar.calendarlist.readonly` scopes to the OAuth consent screen, and (in Testing mode) add yourself as a test user.

## Day menu

The **Day options ▾** menu on each day holds **Finish day**, **Journal** (a free-writing space saved with that day), **Add routine** when needed, and **Clear day** (deletes everything on that day after a confirmation, with Undo). On a finished day it offers Reopen day and Edit reflection. The journal icon in the top bar shows all journal entries, newest first, with Edit and Open day links.

## Notifications

In **Settings → Notifications**, turn on notifications for this device. While Hourbox is open (even in the background), you get a notification when a box ends and the next one starts, with a **Mark done** button for the box that just ended. `sw.js` is a tiny service worker used only to show notifications and handle that button; it doesn't cache anything.

## Where your data lives

You log in with Google. Plans are stored in Firebase (Firestore) under `users/<your id>/docs`. The security rules in `firestore.rules` let each signed-in user read and write only their own documents. The Firebase config in `index.html` only identifies the project; it is public by design and grants no access by itself.

Firestore also keeps an offline copy on each device, so the app works without a connection and syncs when it's back. Logging out removes that copy.

To use it like an app: on a Mac in Safari, **File → Add to Dock**. On an iPhone in Safari, **Share → Add to Home Screen**.

## Running locally

It's a single static `index.html` with no build step. Open it in a browser or serve the folder with any static server.
