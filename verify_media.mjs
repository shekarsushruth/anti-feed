#!/usr/bin/env node
/*
 * verify_media.mjs -- publish gate that forces real video research on every run.
 *
 * It does what the manual editions did by hand, but automatically:
 *   1. RESOLUTION: every story's video.id is checked against YouTube's oEmbed
 *      endpoint. A dead / private / wrong id fails the run.
 *   2. COVERAGE: each category must meet a minimum number of *verified* videos.
 *      A research-skipped edition (few/no videos in the explainer & trailer
 *      categories) fails here, so it can never publish.
 *
 * Exit code: 0 = OK to publish, non-zero = blocked. publish.ps1 runs this first.
 *
 *   node verify_media.mjs              # check edition.json
 *   node verify_media.mjs --from x.json
 *
 * Network: uses Node's global fetch (Node 18+). If YouTube is unreachable it
 * fails closed (blocks publish) rather than letting an unverified edition ship.
 */

import { readFileSync } from "node:fs";

// Minimum count of VERIFIED (resolving) videos required per category.
// Culture & Trends is exempt: IG/X content can't embed and uses link-outs.
// The explainer/trailer categories must have coverage -- that is the signal a
// real per-story video hunt happened. Tune here if editorial reality changes.
const MIN_VIDEOS = {
  "Culture & Trends": 0,
  "Cameras & Gear": 1,
  "Gaming": 1,
  "Cinema": 2,
  "Rabbithole": 1,
  "Psychology": 1,
  "Philosophy": 1,
};
const MIN_TOTAL = 6; // overall backstop across the whole edition

function parseArgs(argv) {
  const args = { src: "edition.json" };
  for (let i = 0; i < argv.length; i++) if (argv[i] === "--from") args.src = argv[++i];
  return args;
}

async function resolves(id) {
  const url = `https://www.youtube.com/oembed?format=json&url=https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    // Connection: close avoids lingering keep-alive sockets that can crash Node on exit (Windows libuv).
    const res = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "anti-feed-verify", "Connection": "close" } });
    if (!res.ok) return { ok: false, why: `oEmbed HTTP ${res.status}` };
    const j = await res.json();
    if (!j || !j.title) return { ok: false, why: "no title in oEmbed" };
    return { ok: true, title: j.title, author: j.author_name };
  } catch (e) {
    return { ok: false, why: `unreachable (${e.name})` };
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  const { src } = parseArgs(process.argv.slice(2));
  let data;
  try {
    data = JSON.parse(readFileSync(src, "utf-8"));
  } catch (e) {
    console.error(`verify_media: cannot read/parse ${src}: ${e.message}`);
    process.exit(2);
  }

  // Gather every (category, storyIndex, id) with a video id.
  const jobs = [];
  for (const sec of data.sections || [])
    (sec.stories || []).forEach((st, i) => {
      if (st.video && st.video.id) jobs.push({ cat: sec.title, i, id: st.video.id, head: st.headline });
    });

  // Resolve all ids in parallel.
  const results = await Promise.all(jobs.map(async (j) => ({ ...j, ...(await resolves(j.id)) })));

  const dead = results.filter((r) => !r.ok);
  const verifiedByCat = {};
  for (const sec of data.sections || []) verifiedByCat[sec.title] = 0;
  for (const r of results) if (r.ok) verifiedByCat[r.cat] = (verifiedByCat[r.cat] || 0) + 1;

  // Report.
  console.log("=== media verification ===");
  for (const sec of data.sections || []) {
    const title = sec.title;
    const have = verifiedByCat[title] || 0;
    const need = MIN_VIDEOS[title] ?? 0;
    const flag = have >= need ? "ok " : "LOW";
    console.log(`  [${flag}] ${title.padEnd(18)} verified ${have} / need ${need} (of ${sec.stories?.length || 0} stories)`);
  }
  const totalVerified = Object.values(verifiedByCat).reduce((a, b) => a + b, 0);
  console.log(`  total verified videos: ${totalVerified} (need >= ${MIN_TOTAL})`);

  const errors = [];
  for (const r of dead) errors.push(`unresolved video id "${r.id}" [${r.cat}] "${(r.head || "").slice(0, 40)}" -- ${r.why}`);
  for (const sec of data.sections || []) {
    const title = sec.title;
    const have = verifiedByCat[title] || 0;
    const need = MIN_VIDEOS[title] ?? 0;
    if (have < need) errors.push(`category "${title}" has ${have} verified videos, needs >= ${need} (research likely skipped)`);
  }
  if (totalVerified < MIN_TOTAL) errors.push(`only ${totalVerified} verified videos total, needs >= ${MIN_TOTAL}`);

  if (errors.length) {
    console.error("\nBLOCKED -- not safe to publish:");
    for (const e of errors) console.error(`  - ${e}`);
    console.error("\nDo the per-story video hunt (search + oEmbed-verify) and re-run. See PIPELINE.md.");
    process.exitCode = 1; // set, don't process.exit(), so pending sockets close cleanly
    return;
  }
  console.log("\nOK -- media verified, safe to publish.");
}

main();
