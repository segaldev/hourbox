# Hourbox

A simple time-boxing planner: top 3 priorities, brain dump, parking lot, a daily hour grid (one activity per box; any hour can be split into 30- or 15-minute boxes), a month view, and a "Finish day" review with optional reflection.

**Live app:** https://segaldev.github.io/hourbox/

## Daily routine

Open **Settings** (the sliders button) to set up boxes every new day starts with, such as "6:00 Get ready". Each item has a start time, length, tag, weekdays, and can be marked **Flexible**. Flexible items have a dashed outline. When you drop something on one, it moves to the nearest free time instead of being sent to the brain dump. Days that already exist get an **Add routine** button.

## Google Calendar

On any day you're planning, **Sync calendar** syncs that day both ways with your primary Google Calendar, after a preview:

- **To Google:** moving or renaming a calendar box moves or renames the event (keeping its real minutes; guests get Google's update email). Your own Hourbox boxes can be added as events (back-to-back boxes with the same name become one event; routine boxes only if you tick that option). Deleting a box deletes its event only if Hourbox created it.
- **From Google:** timed events become boxes (snapped to 15 minutes); flexible boxes move aside; boxes you planned yourself are never overwritten; events that don't fit can go to the brain dump; all-day and declined events are skipped.
- Events organized by someone else can't be moved from Hourbox; if changed in both places, Google's version wins.

Setup in the Firebase project's Google Cloud: enable the Google Calendar API, add the `calendar.events` scope to the OAuth consent screen, and (in Testing mode) add yourself as a test user.

## Notifications

In **Settings → Notifications**, turn on notifications for this device. While Hourbox is open (even in the background), you get a notification when a box ends and the next one starts, with a **Mark done** button for the box that just ended. `sw.js` is a tiny service worker used only to show notifications and handle that button; it doesn't cache anything.

## Where your data lives

You log in with Google. Plans are stored in Firebase (Firestore) under `users/<your id>/docs`. The security rules in `firestore.rules` let each signed-in user read and write only their own documents. The Firebase config in `index.html` only identifies the project; it is public by design and grants no access by itself.

Firestore also keeps an offline copy on each device, so the app works without a connection and syncs when it's back. Logging out removes that copy.

To use it like an app: on a Mac in Safari, **File → Add to Dock**. On an iPhone in Safari, **Share → Add to Home Screen**.

## Running locally

It's a single static `index.html` with no build step. Open it in a browser or serve the folder with any static server.
