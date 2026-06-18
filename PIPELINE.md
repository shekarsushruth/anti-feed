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
- **Video = tap-to-play, never autoplay.** One per story max, only where it adds info
  (trailer, review, explainer). Supply a real YouTube **video id** (the 11-char id,
  not a URL) in `video.id`. Leave `id` empty only if you couldn't find a good one —
  the button then shows the placeholder.
- **Instagram Reels / Twitter posts can't embed** — use `linkout` to the source instead.
- **Trend caveat:** IG/Twitter data comes from third-party trackers and runs a few
  days behind. Keep the small `caveat` line on those cards. Don't pretend it's live.

## Step 4 — Write the draft JSON, then finalize

Write the stories into `edition.json` (or a `draft.json`) using the schema below,
then run the finalizer, which validates the rules above and stamps the date/time/count:

```
node build_edition.mjs            # finalize edition.json in place
# or:  node build_edition.mjs --from draft.json --out edition.json
```

If validation fails it prints errors and writes nothing — fix and re-run.
Then publish (see README).

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
