# Hourbox

A simple time-boxing planner: top 3 priorities, brain dump, parking lot, a daily timeline (one activity per box, any length in 10-minute steps; boxes never overlap), a month view, and a "Finish day" review with optional reflection.

**Live app:** https://segaldev.github.io/hourbox/

## Boxes and moving things around

- Tap a free hour to box it (1 hour by default). In the box editor, set the start and length in 10-minute steps.
- Drag a box's bottom edge to make it longer or shorter. On a Mac, select a box and use ↑/↓ to move it by 10 minutes, Shift+↑/↓ to change its length.
- Drag anything between the day, the brain dump and the parking lot. Boxes move as they are: a 20-minute box taken off the day and put back later is still 20 minutes. Hold Option or Shift while dragging a box to copy it.
- Dropping onto a taken time: flexible boxes step aside; otherwise the box goes to the nearest free time. New items shrink to fit a smaller gap.
- On a phone: tap the clock on an item, then tap a free time.
- Undo: ⌘Z (Ctrl+Z on Windows/Android keyboards), redo: ⇧⌘Z. Moves, resizes and deletes also show an **Undo** button. Typing in a text field is undone by the browser as usual.

## Daily routine

Open **Settings** (the sliders button) to set up boxes every new day starts with, such as "6:00 Get ready". Each item has a start time, length, tag, weekdays, and can be marked **Flexible**. Flexible items have a dashed outline. When you drop something on one, it moves to the nearest free time instead of being sent to the brain dump. Days that already exist get an **Add routine** button.

## Google Calendar (read-only)

On a day, **Day options → Sync Google Calendar** reads that day's events from the Google calendars you pick in its preview (your choice is saved in your account) and shows a preview before changing anything. Hourbox never changes your calendar. Timed events become boxes (snapped to 10 minutes, tagged Meetings); flexible boxes move aside; boxes you planned yourself are never overwritten; events that don't fit can go to the brain dump; all-day and declined events are skipped. Syncing again updates only the calendar boxes and keeps their status.

Write-back (moves, renames, adding your own boxes) is built but switched off: set `CAL_WRITE = true` in `js/calendar.js` and add the `calendar.events` scope to turn it on.

Setup in the Firebase project's Google Cloud: enable the Google Calendar API, add the `calendar.events.readonly` and `calendar.calendarlist.readonly` scopes to the OAuth consent screen, and (in Testing mode) add yourself as a test user.

## Day menu

The **Day options ▾** menu on each day holds **Finish day**, **Journal** (a free-writing space saved with that day), **Add routine** when needed, and **Clear day** (deletes everything on that day after a confirmation, with Undo). On a finished day it offers Reopen day and Edit reflection. The journal icon in the top bar shows all journal entries, newest first, with Edit and Open day links.

## Photo credits

The photo styles use pictures from Wikimedia Commons, slightly blurred, dimmed or tiled:

- River Stone: [Ryōan-ji zen garden](https://commons.wikimedia.org/wiki/File:Le_jardin_zen_du_temple_Ry%C3%B4an-ji_(Kyoto,_Japon)_(32162405237).jpg) by Jean-Pierre Dalbéra, [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/)
- Pine Forest: [Pines in fog](https://commons.wikimedia.org/wiki/File:Nature-forest-trees-fog.jpg) by Jaymantri (Pexels), free to use
- Oak Desk: [Oak texture](https://commons.wikimedia.org/wiki/File:Oak_Texture_-_5106733699_c1d5b0df29_b.jpg) by William Warby, [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/)
- Desert Dune: [Thar Desert sand dunes](https://commons.wikimedia.org/wiki/File:Thar_Desert,_India,_Sand_dunes.jpg) © Vyacheslav Argenberg, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

## Zen mode

The circle button in the top bar hides everything except the box you're in right now, shown big, with a circle that slowly fills as its time passes. Back-to-back boxes with the same name count as one block. Press Esc or the small × to leave.

## Quote of the day

Turn it on in Settings to see a short Stoic or Zen quote at the top of the planner, a different one each day. The quotes are kept in `js/quotes.js`, so they work offline.

## Notifications

In **Settings → Notifications**, turn on notifications for this device. While Hourbox is open (even in the background), you get a notification when a box ends and the next one starts, with a **Mark done** button for the box that just ended. `sw.js` is a tiny service worker that shows notifications, handles that button, and makes sure the app always loads its newest files; it stores nothing.

## Where your data lives

You log in with Google. Plans are stored in Firebase (Firestore) under `users/<your id>/docs`. The security rules in `firestore.rules` let each signed-in user read and write only their own documents. The Firebase config in `js/store.js` only identifies the project; it is public by design and grants no access by itself.

Firestore also keeps an offline copy on each device, so the app works without a connection and syncs when it's back. Logging out removes that copy.

To use it like an app: on a Mac in Safari, **File → Add to Dock**. On an iPhone in Safari, **Share → Add to Home Screen**.

## Running locally

Plain HTML, CSS and JavaScript modules with no build step. Serve the folder with any static server (modules don't load from `file://`):

```
python3 -m http.server 8000
```

## Code layout

| File | What's in it |
| --- | --- |
| `index.html` | Page markup only |
| `css/app.css` | Layout and components |
| `css/themes/*.css` | One file per style (colors, fonts, shapes, background) |
| `js/boot.js` | Applies the saved style before the page draws |
| `js/main.js` | Starts the app and the clock |
| `js/util.js` | Dates, time slots, small helpers |
| `js/state.js` | App state, the day model, daily routine |
| `js/store.js` | Saving: Firebase and this-device-only mode |
| `js/render.js` | Picks which view to draw |
| `js/day.js`, `js/month.js` | Day and month views |
| `js/actions.js` | Clicks, typing, drag and drop |
| `js/modals.js` | Box editor, journal, finish day, clear day |
| `js/settings.js` | Settings, Look panel, sign-in |
| `js/calendar.js` | Google Calendar (read-only) |
| `js/notify.js` | Box notifications |
| `js/quotes.js` | Quote of the day |
| `js/zen.js` | Zen mode |
| `js/ui.js` | Toasts, banner, save status |

To add a style: add `css/themes/<name>.css`, link it in `index.html`, and add it to `STYLES` in `js/settings.js` (and its fonts to `js/boot.js`).
