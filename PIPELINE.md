# PIPELINE.md — how today's edition gets built

This is the **runnable pipeline** for The Anti-Feed. The research is done by an
agent (Claude Code / Cowork); `build_edition.mjs` does the deterministic
validation + stamping. Cowork runs this file's instructions once a day at
**1:00 PM Asia/Kolkata (IST)**.

The single scheduled command is in the README. What that run must do:

---

## Step 1 — Research each category fresh

Produce stories for the seven categories **in this order**, respecting the caps.
**One topic = one headline = its own card.** Never club distinct items together.

| # | Category | Cap | What goes in it |
|---|----------|-----|-----------------|
| 01 | Culture & Trends | 10 | IG trending *format* (Global + India as separate items), IG trending *topics*, IG trending *audio* (one card, `mini` list), Twitter/X trending (Global + India). |
| 02 | Cameras & Gear | 10 | Each new/imminent camera, lens, or gear item as its **own** story. |
| 03 | Gaming | 10 | Each new release, console/hardware item, notable port as its **own** story. |
| 04 | Cinema | 10 | Each notable film as its **own** story — cover global **and** Indian cinema (hits + reviews). |
| 05 | Rabbithole | 1 | ONE deep dive: a genuinely fascinating fact with a 3–4 paragraph rabbit-hole (mechanism → why it matters → humble caveat). |
| 06 | Psychology | 2 | One "Interesting" (surprising but well-replicated) + one "Useful" (applicable, mechanism explained). |
| 07 | Philosophy | 1 | ONE thought-provoking problem, tension kept intact. |

Most days a category won't fill its cap — **show what's genuinely there, don't pad.**
If a category has nothing new, give it fewer items or a single brief "quiet day
here" note rather than inventing filler.

## Step 2 — Hold the editorial bar (this is what makes it good)

- **Psychology & Philosophy must not be superficial.** No debunked pop-psych
  (no Mehrabian 93%, left/right brain, learning styles, power poses). Surprising
  psych findings replicate *worse* — favor robust ones and explain the mechanism.
  For philosophy, present the real argument and keep the tension; no quote-captions.
- **Rabbithole** actually goes down a hole: mechanism, why it matters, humble caveat.
  Not a one-line fun fact.
- **Tone:** warm, curious, plain-spoken — a sharp friend telling you the good parts.
  Start mid-thought where natural. No clickbait, no "you won't believe."
- **Each body is tight:** a few short paragraphs max. The headline hooks; the body delivers.
- **Relevance to the reader:** a cinematography / VFX / color-grading generalist in
  Bangalore (DaVinci Resolve, DCTL, S-Log). Camera/gear and GPU/render items are
  extra relevant when they touch grading or render performance — note that link.
- **Filter spam/SEO junk and fakes silently.** Prefer reputable sources. Trend and
  "fun fact" searches return a lot of garbage — discard it without comment.

## Step 3 — Add media where it genuinely helps

- **Image policy — priority order, per story.** There is no grey fallback box anymore:
  a card either shows a real image or has no image area at all (clean text-only).
  1. **A real subject with a free/open image** (science, nature, a person, a place) →
     set `image` to a **free-source** URL only: Wikimedia Commons first, then Openverse /
     Wikipedia. No paid APIs, no copyrighted hotlinks (posters, product shots, key art).
     Prefer a direct `upload.wikimedia.org/.../thumb/.../1280px-…` URL. A curated image
     always wins — even when the card also has a video.
  2. **Else, the story has a video →** leave `image` unset and the finalizer auto-fills it
     with that video's YouTube thumbnail (`maxresdefault`, with an `hqdefault` runtime
     fallback). This covers the cards with no free image (cameras, games, films).
  3. **Neither** (abstract topics, trends, most psychology/philosophy concept cards, or no
     free image found) → omit `image` entirely. The card renders clean, text-only.
- **Video research is MANDATORY on every run — not optional, and not inheritable.**
  For **every** story in Cameras, Gaming, Cinema, Rabbithole, Psychology, and
  Philosophy you MUST, *this run*, actually search YouTube for the most relevant
  trailer / hands-on / review / explainer and **verify the id resolves** before using
  it (oEmbed: `https://www.youtube.com/oembed?format=json&url=https://www.youtube.com/watch?v=ID`;
  a 200 with a `title` = good). Never carry over an id from a previous edition without
  re-finding and re-verifying it. Tap-to-play only, never autoplay, one per story max.
  Put the verified 11-char id in `video.id`. If after a genuine search no good video
  exists for a story, leave its `video` off — but the category must still hit its
  minimum coverage (below), so "skipped the search" is not an option.
- **This is enforced.** `verify_media.mjs` runs before every publish: it oEmbed-checks
  every `video.id` and requires minimum verified-video coverage per category
  (Cameras/Gaming/Rabbithole/Psychology/Philosophy ≥1, Cinema ≥2; Culture exempt).
  A research-skipped edition **fails the gate and cannot go live.** Culture & Trends is
  the only exempt category because IG/X content can't embed.
- **Instagram Reels / Twitter posts can't embed** — use `linkout` to the source instead.
- **Trend caveat:** IG/Twitter data comes from third-party trackers and runs a few
  days behind. Keep the small `caveat` line on those cards. Don't pretend it's live.

## Step 4 — Write the draft JSON, finalize, verify, then publish

Write the stories into `edition.json` (or a `draft.json`), then:

```
node build_edition.mjs            # 1. validate structure/caps + stamp + write edition.json (+ edition.js)
node verify_media.mjs             # 2. MEDIA GATE: oEmbed-verify every video.id + per-category coverage
# 3. publish (deliberate opt-in required — see README):
$env:ANTIFEED_PUBLISH = "1"; powershell -ExecutionPolicy Bypass -File publish.ps1
```

- `build_edition.mjs` writes nothing if structure/caps validation fails — fix and re-run.
- `verify_media.mjs` exits non-zero if any video is dead or a category is under its
  minimum — **fix the video research and re-run.** `publish.ps1` runs this gate itself
  and aborts on failure, so a research-skipped edition can never reach the live site.
- `publish.ps1` is **frozen by default** and only pushes when `ANTIFEED_PUBLISH=1` is set
  for that run — so nothing auto-publishes unless a real schedule deliberately opts in.

---

## edition.json schema

```jsonc
{
  "meta": { },                       // filled by build_edition.mjs — leave {} or omit
  "sections": [
    {
      "index": "01",                 // "01".."07", matches the table above
      "title": "Culture & Trends",   // exact title, exact order
      "stories": [
        {
          "kicker": "IG format · Global",      // small uppercase label
          "headline": "…",                      // the hook (plain text)
          "deep": false,                        // true only for Rabbithole & Philosophy (dark card)
          "image": "https://…",                 // optional; omit for video stories (auto-filled) & text-only cards
          "body": [ "<p-html>", "…" ],          // paragraphs; inline <strong>/<em>/<b> allowed
          "caveat": "…",                        // optional small grey line (e.g. trend disclaimer)
          "mini": [ "<b>…</b> — …" ],            // optional ♪ list (used for trending audio)
          "video": { "id": "abc123", "label": "Watch the trailer", "duration": "2:31" },
          "linkout": { "label": "open in Instagram", "url": "https://…" }
        }
      ]
    }
  ]
}
```

Every story needs a `headline` and either `body` or `mini`. Everything else is
optional. `meta` is overwritten on every build — you don't write it by hand.
