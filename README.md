# Hourbox

A simple time-boxing planner: top 3 priorities, brain dump, parking lot, a daily hour grid (one activity per box; any hour can be split into 30- or 15-minute boxes), a month view, and a "Finish day" review with optional reflection.

**Live app:** https://segaldev.github.io/hourbox/

## Daily routine

Open **Settings** (the sliders button) to set up boxes every new day starts with, such as "6:00 Get ready". Each item has a start time, length, tag, weekdays, and can be marked **Flexible**. Flexible items have a dashed outline. When you drop something on one, it moves to the nearest free time instead of being sent to the brain dump. Days that already exist get an **Add routine** button.

## Where your data lives

You log in with Google. Plans are stored in Firebase (Firestore) under `users/<your id>/docs`. The security rules in `firestore.rules` let each signed-in user read and write only their own documents. The Firebase config in `index.html` only identifies the project; it is public by design and grants no access by itself.

Firestore also keeps an offline copy on each device, so the app works without a connection and syncs when it's back. Logging out removes that copy.

To use it like an app: on a Mac in Safari, **File → Add to Dock**. On an iPhone in Safari, **Share → Add to Home Screen**.

## Running locally

It's a single static `index.html` with no build step. Open it in a browser or serve the folder with any static server.
