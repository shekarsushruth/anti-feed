# The Anti-Feed

A calm, finite daily reader. It works like a newspaper: a fixed set of headlines
you can scan, you open only what pulls you, and it has a clear ending. The
opposite of an infinite feed — nothing autoplays, nothing pings, nothing scrolls
forever.

## What's in here

| File | Role |
|------|------|
| `index.html` | The **shell** — fixed design, fonts, and interactions. On load it fetches `edition.json` and renders the headlines, expandable details, images, tap-to-play videos, and link-out chips. The design is unchanged from `the-anti-feed-v2.html`. |
| `edition.json` | The **content** — the day's stories as structured data. This is the only file that changes day to day. |
| `build_edition.mjs` | The **finalizer** — validates a draft against the brief's category order, caps, and rules, then stamps the IST date/time/story-count and writes `edition.json`. Plain Node, no dependencies. |
| `PIPELINE.md` | The **research playbook** the agent (Claude Code / Cowork) follows to produce each day's stories. |
| `publish.ps1` | Commits + pushes the new edition to GitHub Pages. |
| `the-anti-feed-v2.html` | The original static design, kept for reference. |

The split is deliberate: the **shell** never changes, only the **content** refreshes.

## Run it locally

**Just double-click `index.html`.** When opened from disk (`file://`), the browser
blocks `fetch()` of local files, so the app automatically falls back to `edition.js`
(a JS twin of `edition.json` the finalizer writes) and renders normally.

To preview exactly as hosted (over http), run a tiny server instead:

```powershell
# from this folder
node --version            # needs Node 16+ (you have it)
npx --yes serve -l 5173   # or: python -m http.server 5173  (if you install Python)
# then open http://localhost:5173/
```

## Regenerate the edition (the pipeline)

The research half is done by the agent following `PIPELINE.md`; the deterministic
half is this script:

```powershell
# validate the current edition.json without writing
node build_edition.mjs --check

# validate + stamp date/time/count, write edition.json in place
node build_edition.mjs

# finalize a fresh draft the agent wrote
node build_edition.mjs --from draft.json --out edition.json
```

Validation **fails loudly** (non-zero exit) if a category is over cap, out of
order, or a story is missing required fields — so a scheduled run stops instead of
publishing a broken edition.

## Hosting — GitHub Pages

**Live at: https://shekarsushruth.github.io/anti-feed/** — open this on your phone anytime.

Repo: https://github.com/shekarsushruth/anti-feed (public, Pages serving from `main` / root).
Setup is already done; the steps below are kept for reference or re-creating it elsewhere.

1. Create an empty repo on GitHub, e.g. `anti-feed` (public).
2. From this folder:
   ```powershell
   git init
   git add .
   git commit -m "the anti-feed: shell + first edition"
   git branch -M main
   git remote add origin https://github.com/<you>/the-anti-feed.git
   git push -u origin main
   ```
3. On GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a
   branch → Branch: `main` / `(root)` → Save.**
4. Your stable URL appears there in ~1 minute:
   `https://<you>.github.io/the-anti-feed/`. Open that on your phone anytime.

After this, every publish is just one command (below), which overwrites
`edition.json` at that URL.

## The daily 1:00 PM IST job (Cowork)

Schedule **one Cowork task** at **1:00 PM Asia/Kolkata**, whose instruction is:

> Follow `PIPELINE.md` in this project to research today's edition, write the
> stories into `edition.json`, run `node build_edition.mjs` to validate and stamp
> it, then run `powershell -ExecutionPolicy Bypass -File publish.ps1` to push it
> live. If validation fails, fix the content and re-run before publishing.

That sequence — **research → `node build_edition.mjs` → `publish.ps1`** — is the
whole pipeline. Delivery is just the refresh: the job overwrites `edition.json` at
the hosted URL, and you see the new edition next time you open the page. No email,
no push, no notification.

## Notes

- **Images:** if a story's `image` URL fails to load, the shell falls back to the
  labeled placeholder automatically — nothing breaks.
- **Videos:** tap-to-play only, one per story, never autoplay. Supply the 11-char
  YouTube id in `video.id`. An empty id shows a "loads on tap" placeholder.
- **IG / Twitter trends** come from third-party trackers and run a few days behind;
  those cards keep a small caveat line. That's expected, not a bug.
