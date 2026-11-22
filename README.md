# SEEk Web User Test

A free website for running unmoderated user tests on wireframes, with an admin dashboard.

- **Tester page** (`index.html`): testers enter their details, pick phone or computer, do each task on your screens, then rate each task with stars and an optional comment.
- **Admin site** (`admin.html`): log in to create and switch between user tests, upload screens, draw hotspots, write tasks, set a test Live, Draft or Closed, and see results (success rate, time, ratings, misclicks, click heatmaps, scroll depth, each tester's path and comments). You can download results as CSV or JSON.

Hosting is free on **GitHub Pages**, and data is stored free on **Supabase**.

## Links

| What | Link |
|---|---|
| Main tester link (opens the test marked ★ Main link) | `https://<user>.github.io/seek-web-user-test/` |
| A specific test | `…/index.html?s=<test-id>` (use **Copy link** in the admin) |
| Admin | `…/admin.html` |

## How to use the admin

1. **+ New user test**: start from Blank, the Demo, or a copy of an earlier test. New tests start as **Draft**.
2. **Edit → Screens & hotspots**: upload your Figma frames as PNG, exported at 1x or 2x. Drag on a screen to draw a hotspot over each button, then pick which screen it goes to. Mark the ★ start screen. Phone and computer versions are separate; turn off the one you don't need.
3. **Edit → Tasks**: write each task and pick its **goal screen**. Reaching that screen counts as success.
4. **Edit → Tester details**: the questions testers answer first.
5. **Edit → Basics → Status: Live**, then **Save**. Use **Copy link** on the dashboard to send it out.
6. **Preview ↗** lets you try a test without saving any results.
7. For a new round after design changes, **Duplicate** the test so each round's results stay separate.

## Setup (one time)

1. **Supabase:** create a project. In the SQL Editor, run `supabase/setup.sql`, then optionally `supabase/seed-demo.sql`.
2. **Admin login:** go to Supabase → Authentication → Users → **Add user** (email and password, with auto-confirm on). Put your email in `supabase/make-admin.sql` and run it.
   Then turn off public sign-ups: Authentication → Sign In / Providers → turn off **Allow new users to sign up**.
3. **Keys:** in Supabase → Project Settings → API, copy the Project URL and the **anon public** key into `js/config.js`.
4. **Password reset emails:** in Supabase → Authentication → URL Configuration, set Site URL to your GitHub Pages URL.
5. **GitHub Pages:** push this folder to a public repo called `seek-web-user-test`. Then go to Settings → Pages → Deploy from branch → `main` / root.

If `js/config.js` has no keys, the site runs in **demo mode**: data stays in your browser and the admin password is `admin`.

## Security notes

- The anon key in `config.js` is meant to be public. The database rules in `setup.sql` mean testers can only *save their own session*. Only admin accounts can read results or change tests.
- Testers never see results, and Draft or Closed tests can't be opened by testers.
