# Tracker app

A personal app for tracking water (and soon running) on your phone. It installs from the
browser and works offline. Plain HTML, CSS and JavaScript with no build step: the folder
you upload is exactly what runs on the phone.

## Run it in VS Code

1. Open the `tracker-app` folder in VS Code (File → Open Folder).
2. Right-click `index.html` → **Open with Live Server** (install the *Live Server*
   extension if you don't have it). It must run through Live Server, not by
   double-clicking the file, because the app uses modules and offline support.
3. In Chrome, press F12 → the phone icon (device toolbar) to see it phone-sized.

## Put it on your phone (GitHub Pages)

1. Create a repository called `tracker-app` on GitHub and upload this folder's contents.
2. Repository → Settings → Pages → Source: *Deploy from a branch*, branch `main`, folder `/ (root)`.
3. After a minute or two open `https://<your-username>.github.io/tracker-app/` on the phone,
   then the browser menu → **Add to Home screen** / **Install app**.

## How the code is organised

| Part | Where | What it does |
|---|---|---|
| Start page | `index.html` | Loads the styles and `js/app.js` |
| Pages and routes | `js/app.js` | Water, Today's log, Running, Calendar; each page has an address like `#/water/log` |
| Shared screen parts | `js/ui.js` | Sheets (back gesture + pull down to close), toasts, banner, icons, formatting |
| Data while running | `js/state.js` | Settings and drinks in memory, kept in step with the database; goal history (`goalFor(day)`) |
| Water | `js/water.js` | Bottles, 24-hour branch line, cups, confirm, custom amount, pour animation, log page |
| Themes | `js/themes.js` | The theme list and switching; the colours are in `css/style.css` |
| Running | `js/running.js` | The Running page: weekly track, week strip, log / change a run (outdoor or treadmill with incline) |
| Running calendar | `js/runcal.js` | Month (with week rings), Week and Day for runs; addresses like `#/calendar/run/week/2026-11-17` |
| Notes | `js/notes.js` | Quick notes: write box, colours, search, colour filter, edit / delete |
| Notes calendar | `js/notescal.js` | Month only, a stripe per note; tap a day for its notes; `#/calendar/notes/month/2026-11-20` |
| Calendar | `js/calendar.js` | Month, Week and Day views, Day/Week/Month switch, pinch to zoom; addresses like `#/calendar/week/2026-11-17` |
| Settings | `js/settings.js` | Goal, bonus size, "ask before adding", cup buttons, Trash, Backup |
| Backup | `js/backup.js` | Save all data to a file (share sheet → Drive/Files, or download) and load it back |
| Data safety | `js/safety.js` | Persistent storage request, weekly backup reminder, restore offer on an empty start |
| Saved data | `js/db.js` | The phone's built-in database (IndexedDB): drinks, runs, notes, trash, settings |
| Version | `js/version.js` | Shown in Settings; must match `sw.js` |
| Look | `css/style.css` | All styles, grouped by part |
| Offline | `sw.js` | Saves the app files on the phone; its version tells phones to update |
| Install | `manifest.webmanifest`, `icons/` | Name, colours and icon for the home screen |
| Tests | `tests/` | Automated checks, one file per feature or fix |

Rules the code follows:

- Your data never leaves the phone, except backup files you save yourself.
- A change to the database layout comes with a migration (`migrate()` in `js/db.js`), so existing data carries over.
- Deleted drinks go to the Trash first and can be restored for 30 days. (Undo right after adding removes the drink for good — that was a mis-tap, not a deletion.)
- Every sheet closes with the phone's back gesture, the × button, tapping outside or pulling it down.

## Releasing an update

1. Raise the version by one in **both** `sw.js` (`VERSION`) and `js/version.js` — e.g. `tracker-v2`.
   This is what tells your phone a new version exists; without it the phone keeps the old files.
   If you add a new file to `js/`, add it to the `FILES` list in `sw.js` too (test t11 checks this).
2. Add a short section below saying what changed.
3. Run the tests (next section).
4. Upload to GitHub. The phone picks up the new version and refreshes itself once.

## Running the tests

The tests open the app in a phone-sized browser, tap through it and check the results.
One-time setup in VS Code's terminal (Terminal → New Terminal), needs [Node.js](https://nodejs.org):

```
npm install
npx playwright install chromium
```

Then any time:

```
npm test            # all tests
npm test t05        # just one
```

The `tests/`, `package.json` and `node_modules/` folders don't affect the app. Don't upload
`node_modules/` to GitHub (the included `.gitignore` leaves it out).

## Updates

### Update 7 · tracker-v7 — Past days, week totals, data safety
- **Add a drink to any day:** Calendar → a day → **Add a drink**. The same cup buttons as Today plus **Other amount…**, quick times (Morning 09:00, Noon 12:00, Afternoon 15:00, Evening 19:00) or an exact time, and a preview of the day's new total before adding. The button says exactly what it will do ("Add 500 ml at 15:00"). Times that haven't happened yet are greyed out for today. The log page's "Add a drink" uses the same sheet. **All N drinks ›** opens the day's list to edit or delete.
- **Week totals in the water month:** a WEEK column with a ring per week. It fills toward the week's goal so far (each day's goal × the days that have happened), the inner light ring shows extra, and the middle shows the week's litres. Tap a ring to open that week.
- **Data safety** (after data was lost when Chrome's site data was cleared):
  - The app asks Chrome for **persistent storage**, so Chrome won't clear it on its own when space is low. Settings shows "Protected from clean-up: On", or a **Turn on** button.
  - Settings explains that every app at the same address (here `karasahmet2.github.io`) shares one storage: clearing Chrome data for one clears them all.
  - A **backup button** on the Today page gets an amber dot when the last backup is over a week old, and the app reminds you once. On the phone, **Save backup file** opens the share sheet so it can go straight to Google Drive or Files.
  - If the app opens with no data at all, it offers to **restore a backup**.
  - A newer version of the app no longer gets stuck behind an older open copy: the old copy steps aside and reloads.
- Tests: t05, t12, t14, t15 adjusted; new t27 (add to a past day), t28 (week rings), t29 (data safety and two open copies). Tests switch off the start-up reminders except in t29.

### Update 6 · tracker-v6 — Notes
- **Notes tab** (the bottom bar now has Water · Running · Notes · Calendar). Notes use yellow, like a sticky note.
- **Quick note:** type in "What's on your mind?" and tap Save or press Enter (Shift+Enter for a new line). Pick one of six colours; the next note starts with the colour you used last. Each note keeps the date and time it was written. Undo right after saving.
- **List:** newest at the top, grouped by day (Today, Yesterday, Fri 20 Nov…), with the time and "edited" if you changed it.
- **Edit:** tap a note to change its text or colour (the written time stays) or delete it. Deleted notes go to the Trash for 30 days.
- **Search:** the magnifier opens a search bar. Every word must appear, in any order and any case; matches are highlighted. **Colour filters** show only one colour.
- **Notes calendar:** month only. Each day has a stripe per note in its colour (up to four, then "+N"). Tap a day to see its notes under the month; **Show in list** jumps to that day in the list.
- **Saved data:** the database goes to version 3 (adds notes). Phones upgrade automatically and keep everything; backups include notes, so keep backup files private.
- Tests: t22 updated; new t23 (writing notes), t24 (edit, colour, delete, Trash), t25 (search and colour filter), t26 (notes calendar).

### Update 5 · tracker-v5 — Running
- **Running page:** the week's goal (15 km by default) is a running track that fills lap by lap. A white runner dot runs to the new total when you save a run, small markers show where each run ended, and past the goal a lighter **bonus lap** (5 km) fills on the inside. Below: the week's days as small orange pills (a slope mark for treadmill days), **Log a run**, and **Same as last** to repeat your usual run.
- **Log a run:** Outdoor or Treadmill; distance (or quick 3/5/8/10/21.1 km); time as 28:40, 1:02:30 or just minutes; for treadmill, the incline in % (0–15, quick 0/1/2/4/6). Pace, speed and metres climbed are worked out as you type. Pick another date and time for runs you forgot. Times in the future are refused.
- **Change or delete a run** by tapping it in the running calendar's Day view. Deleted runs go to the Trash (30 days), which now holds drinks and runs.
- **Calendar:** a Water / Running switch. Running Month fills each day orange by distance (full at goal ÷ 2.5, e.g. 6 km) with a slope mark for treadmill runs, plus a column of week rings (inner ring = bonus). Week shows 7 cards and a summary (goal %, time, bonus or climbed). Day lists the runs and lets you add one.
- **Settings:** weekly running goal and bonus lap; like water, a new goal counts from this week and past weeks keep theirs.
- **Themes:** each theme has its own running colour.
- **Saved data:** the database goes to version 2 (adds runs). Phones on the old version upgrade automatically and keep everything; backups include runs.
- Tests: t09 updated; new t19 (log a run), t20 (goal, bonus lap, edit, delete, Trash), t21 (running calendar), t22 (database upgrade + Running page fits the screen).

### Update 4 · tracker-v4 — Fits the screen
- The Today page now fits the phone's screen without scrolling. The bottle and the 24-hour line grow or shrink with the screen height (between 170 and 306 px), and on shorter screens the cups, numbers and spacing get a little more compact.
- Twigs on the 24-hour line are placed by percentage, so they stay at the right time at any size; the pour animation measures the bottle instead of assuming its size.
- Tests: t06 updated; new t18 checks five screen sizes (including the Redmi with and without Chrome's bars) for no scrolling.

### Update 3 · tracker-v3 — Edit any day, goal history, themes
- **Edit any day:** Calendar → a day → "Change this day's drinks" opens that day's log. Tap a drink to change its amount or time, delete it (Trash, with Undo), or add a drink you forgot with its time. Times in the future are refused.
- **Past days keep their progress:** the daily goal and bonus size now have a history. A new goal counts from today; every earlier day keeps the goal it had, so its fill, extra and "at goal" never change after the fact. Editing one day's drinks only changes that day. (Phones coming from v2 start the history with the goal they have now.)
- **Themes:** Midnight (the original), Daylight (light), Ocean (teal) and Berry (purple with pink extra). Pick one in Settings; it's remembered and the phone's top bar follows it. Every colour now comes from the theme, including the bottles, waves and calendar.
- Tests: new t15 (edit a past day), t16 (goal history), t17 (themes).

### Update 2 · tracker-v2 — Calendar
- New **Calendar** tab (replaces Stats) with three zoom levels: Day, Week and Month. Switch with the buttons at the top, or pinch (fingers apart = closer, together = wider). On a laptop, a trackpad pinch works too.
- **Month:** square days that fill with rising water, the date in the top-right. Days past the goal get a lighter "extra" layer rising over the blue. Today has an amber outline; future days are dashed and can't be opened.
- **Week:** Monday–Sunday as cards, 4 on top and 3 below, each with a big bottle and a small bonus bottle that fills with that day's extra. The eighth card shows the average, days at goal and total extra.
- **Day:** that day's bottles, its 24-hour twig line, when the goal was reached, and every drink. Today links to Today's log for editing.
- ‹ › step through months, weeks or days; you can't step into the future.
- Removed the streak everywhere.
- The bonus bottle is now the same blue as the big bottle. Light blue now means "extra" (twigs after the goal, calendar extra layers).
- Tests: t01 and t08 updated for the streak removal; new t12 (month), t13 (week), t14 (day, zoom switch, pinch).

### Update 1 · tracker-v1 — Water
- Big 2.5 L bottle with a moving wave, and a 1 L bonus bottle that unlocks when the goal is reached.
- Cup buttons 200 ml, 330 ml, 500 ml, 1 L, each asking "Add 330 ml?" first (can be turned off in Settings).
- Pour animation: the cap pops off, a cup tilts and pours, the water rises; past the goal a second stream arcs into the bonus bottle and a "Goal reached!" banner shows.
- Custom amount with −50/+50, recent amounts and "Save as a cup button".
- 24-hour branch line beside the bottle: one twig per drink at its time, length by amount, cyan after the goal, amber "now" dot.
- Undo after adding; Today's log with an hourly chart and delete; Trash with restore for 30 days.
- Midnight reset, Settings (goal, bonus size, cups), Backup save/load, offline support, home-screen install.
- Tests t01–t11.

## Next
- Update 8: sync with Supabase (Google sign-in), designed around the data as it is now.
- Pin a note to a run or a day; privacy settings for notes.
- Ideas: "how it felt" on runs; Stats across water and running.
