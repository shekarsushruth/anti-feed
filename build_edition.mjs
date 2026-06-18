#!/usr/bin/env node
/*
 * build_edition.mjs — finalizer + validator for The Anti-Feed.
 *
 * The *research* half of the pipeline is done by an agent (Claude Code / Cowork)
 * that follows PIPELINE.md and writes the day's stories into a draft JSON file.
 * This script is the *deterministic* half: it validates that draft against the
 * brief's rules, enforces the per-category caps, stamps the edition with the
 * current IST date / time / story-count, and writes edition.json.
 *
 * Usage
 *   node build_edition.mjs                  # validate + re-stamp edition.json in place
 *   node build_edition.mjs --from draft.json    # finalize a fresh draft -> edition.json
 *   node build_edition.mjs --check          # validate only, write nothing
 *
 * Exits non-zero when validation fails, so a scheduled job stops on error.
 * No dependencies — plain Node (>=16).
 */

import { readFileSync, writeFileSync } from "node:fs";

// The seven categories, in order, with their hard caps. Single source of truth.
const CATEGORIES = [
  { index: "01", title: "Culture & Trends", cap: 10 },
  { index: "02", title: "Cameras & Gear",   cap: 10 },
  { index: "03", title: "Gaming",           cap: 10 },
  { index: "04", title: "Cinema",           cap: 10 },
  { index: "05", title: "Rabbithole",       cap: 1 },
  { index: "06", title: "Psychology",       cap: 2 },
  { index: "07", title: "Philosophy",       cap: 1 },
];

const DEEP_TITLES = new Set(["Rabbithole", "Philosophy"]);
const EDITION_TIME_LABEL = "1:00 PM IST"; // the fixed daily slot the brief schedules

// --- IST clock (UTC+05:30), no external tz data needed ---
function istNow() {
  const now = new Date();
  return new Date(now.getTime() + (330 + now.getTimezoneOffset()) * 60000);
}
function dateLabel(d) {
  // e.g. "TUE · 16 JUN 2026"
  const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const mons = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  const dd = String(d.getDate()).padStart(2, "0");
  return `${days[d.getDay()]} · ${dd} ${mons[d.getMonth()]} ${d.getFullYear()}`;
}
function istIso(d) {
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
         `T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}+05:30`;
}

function validate(data) {
  const errors = [], warnings = [];
  const sections = data.sections;
  if (!Array.isArray(sections)) return { errors: ["'sections' missing or not a list"], warnings };

  const titles = sections.map((s) => s.title);
  const expected = CATEGORIES.map((c) => c.title);
  if (JSON.stringify(titles) !== JSON.stringify(expected)) {
    errors.push(
      "Section titles/order must be exactly:\n  " + expected.join(" -> ") +
      "\ngot:\n  " + titles.join(" -> ")
    );
  }

  const caps = Object.fromEntries(CATEGORIES.map((c) => [c.title, c.cap]));

  for (const sec of sections) {
    const title = sec.title ?? "<untitled>";
    const stories = sec.stories;
    if (!Array.isArray(stories)) { errors.push(`[${title}] 'stories' is not a list`); continue; }

    const cap = caps[title];
    if (cap != null && stories.length > cap)
      errors.push(`[${title}] has ${stories.length} stories, cap is ${cap}`);
    if (stories.length === 0)
      warnings.push(`[${title}] is empty — a 'quiet day here' note is fine, padding is not`);

    stories.forEach((st, idx) => {
      const where = `[${title}] story ${idx + 1}`;
      if (!st.headline) errors.push(`${where}: missing headline`);
      if (!st.kicker) warnings.push(`${where}: missing kicker`);

      const hasBody = Array.isArray(st.body) && st.body.some(Boolean);
      const hasMini = Array.isArray(st.mini) && st.mini.some(Boolean);
      if (!hasBody && !hasMini) errors.push(`${where}: needs a 'body' (paragraphs) or 'mini' (list)`);

      if (DEEP_TITLES.has(title) && !st.deep)
        warnings.push(`${where}: ${title} stories are usually rendered as deep cards ("deep": true)`);

      if (st.video !== undefined) {
        if (typeof st.video !== "object" || st.video === null) errors.push(`${where}: 'video' must be an object`);
        else if (!st.video.id) warnings.push(`${where}: video has no YouTube id yet — button shows the placeholder`);
      }
      if (st.linkout !== undefined && !st.linkout?.label) errors.push(`${where}: 'linkout' needs a label`);
    });
  }
  return { errors, warnings };
}

function stamp(data, now = istNow()) {
  const total = (data.sections || []).reduce((a, s) => a + (s.stories?.length || 0), 0);
  data.meta = data.meta || {};
  data.meta.date_label = dateLabel(now);
  data.meta.time_label = EDITION_TIME_LABEL;
  data.meta.story_count = total;
  data.meta.generated_at = istIso(now);
  return data;
}

function summary(data) {
  const lines = [];
  for (const sec of data.sections || [])
    lines.push(`  ${sec.index ?? "??"} ${(sec.title ?? "?").padEnd(18)} ${sec.stories?.length || 0}`);
  const total = (data.sections || []).reduce((a, s) => a + (s.stories?.length || 0), 0);
  lines.push(`     ${"TOTAL".padEnd(18)} ${total}`);
  return lines.join("\n");
}

function parseArgs(argv) {
  const args = { src: "edition.json", out: "edition.json", check: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--from") args.src = argv[++i];
    else if (argv[i] === "--out") args.out = argv[++i];
    else if (argv[i] === "--check") args.check = true;
  }
  if (args.src !== "edition.json" && args.out === "edition.json") args.out = "edition.json";
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  let data;
  try {
    data = JSON.parse(readFileSync(args.src, "utf-8"));
  } catch (e) {
    console.error(`ERROR: could not read/parse ${args.src}: ${e.message}`);
    process.exit(2);
  }

  const { errors, warnings } = validate(data);
  for (const w of warnings) console.error(`warn: ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`ERROR: ${e}`);
    console.error(`\nValidation failed with ${errors.length} error(s). Nothing written.`);
    process.exit(1);
  }

  if (args.check) {
    console.log("Validation passed.\n" + summary(data));
    return;
  }

  stamp(data);
  writeFileSync(args.out, JSON.stringify(data, null, 2) + "\n", "utf-8");
  console.log(`Wrote ${args.out} — ${data.meta.date_label} · ${data.meta.story_count} stories`);
  console.log(summary(data));
}

main();
