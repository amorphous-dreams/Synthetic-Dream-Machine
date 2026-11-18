#!/usr/bin/env node
// changelog-render — the change record, projected from git history.
//
//   node tools/changelog-render.mjs <from>..<to> [--json]
//
// The record lives in lane commits (lar:///ha.ka.ba/kahua/memory/research/record-as-projection). The renderer walks the
// integration branch's first-parent merges in `<from>..<to>`, newest first, and for each merge M reads the trailers of the
// commits M brought in (M^1..M^2) through git's own parser. The queue serialises merges, so the first-parent chain gives
// one total order on this island. Output: plain markdown — Operator acts first (each naming its merge's PR title; the
// literal `none` never lists), then Breaking, then each merge by its PR title (the merge body's first line) with its
// Changed lines. `--json` gives the same data structured.
//
// `Amends: <sha>` in a later commit replaces the named commit's trailer lines of each key the amending commit carries;
// the replacement renders once, under the target's merge. A target outside the range leaves the lines where they stand.
//
// Merge commits carry no record trailers by house rule. One that does reads red (exit 1) and its lines never count, so
// nothing counts twice. Only record keys count: a PR title shaped `lar:///…` parses as a `lar` trailer and stays quiet.
//
// Exit 0 clean · 1 a red problem (the render still prints) · 2 usage or git refused.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { canonicalKey, commitsWithTrailers, isRange } from "./trailer-keys.mjs";

/** The keys that carry the record. */
export const RECORD_KEYS = Object.freeze(["Breaking", "Operator-Act", "Changed", "Amends"]);
const isRecordKey = (key) => RECORD_KEYS.includes(canonicalKey(key));
const short = (sha) => sha.slice(0, 9);

/** The PR title: the merge body's first non-empty line after the subject; the subject when the body holds none. */
function titleOf(body) {
  const lines = body.split("\n");
  const title = lines.slice(1).map((l) => l.trim()).find((l) => l.length > 0);
  return title ?? lines[0].trim();
}

function resolveCommit(ref, cwd) {
  const r = spawnSync("git", ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], { cwd, encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
}

/** The record of `<from>..<to>`: merges newest first, the operator acts and breaks gathered, and every red problem named. */
export function renderRange(range, { cwd } = {}) {
  const problems = [];
  const merges = commitsWithTrailers(["--first-parent", "--merges", range], { cwd }).map((m) => {
    const title = titleOf(m.body);
    for (const t of m.trailers) {
      if (isRecordKey(t.key)) problems.push(`merge ${short(m.sha)} (${title}) carries the record trailer '${canonicalKey(t.key)}: ${t.value}'; merge commits carry none, so it never counts`);
    }
    const [first, ...rest] = m.parents;
    const lane = commitsWithTrailers(["--reverse", "--topo-order", `^${first}`, ...rest], { cwd }).filter((c) => {
      if (c.parents.length < 2) return true;
      for (const t of c.trailers) {
        if (isRecordKey(t.key)) problems.push(`merge ${short(c.sha)} inside ${short(m.sha)} (${title}) carries the record trailer '${canonicalKey(t.key)}: ${t.value}'; merge commits carry none, so it never counts`);
      }
      return false;
    }).map((c) => ({ sha: c.sha, lines: c.trailers.filter((t) => isRecordKey(t.key)).map((t) => ({ key: canonicalKey(t.key), value: t.value })) }));
    return { sha: m.sha, title, lane };
  });

  // Amendments apply oldest first, so a later amendment of the same key wins.
  const bySha = new Map();
  for (const m of merges) for (const c of m.lane) bySha.set(c.sha, c);
  for (const m of [...merges].reverse()) {
    for (const c of m.lane) {
      const targets = c.lines.filter((l) => l.key === "Amends").map((l) => l.value);
      if (targets.length === 0) continue;
      const keys = [...new Set(c.lines.filter((l) => l.key !== "Amends").map((l) => l.key))];
      let moved = false;
      for (const ref of targets) {
        const sha = resolveCommit(ref, cwd);
        if (sha === null) { problems.push(`${short(c.sha)} carries 'Amends: ${ref}', which names no commit`); continue; }
        const target = bySha.get(sha);
        if (!target) continue;
        target.lines = [...target.lines.filter((l) => !keys.includes(l.key)), ...c.lines.filter((l) => keys.includes(l.key))];
        moved = true;
      }
      if (moved) c.lines = c.lines.filter((l) => !keys.includes(l.key));
    }
  }

  const operatorActs = [];
  const breaking = [];
  const out = merges.map((m) => {
    const lines = m.lane.flatMap((c) => c.lines);
    const values = (key) => lines.filter((l) => l.key === key).map((l) => l.value);
    const acts = values("Operator-Act").filter((v) => v.toLowerCase() !== "none");
    const breaks = values("Breaking");
    for (const act of acts) operatorActs.push({ act, sha: m.sha, title: m.title });
    for (const text of breaks) breaking.push({ text, sha: m.sha, title: m.title });
    return { sha: m.sha, title: m.title, operatorActs: acts, breaking: breaks, changed: values("Changed") };
  });
  return { range, operatorActs, breaking, merges: out, problems };
}

/** The record as plain markdown, newest merge first. */
export function toMarkdown(data) {
  const lines = [`# Change record — ${data.range}`, ""];
  const section = (heading, items) => {
    lines.push(`## ${heading}`, "");
    if (items.length === 0) lines.push("_none_");
    else lines.push(...items);
    lines.push("");
  };
  section("Operator acts", data.operatorActs.map((a) => `- ${a.act} — ${a.title} (\`${short(a.sha)}\`)`));
  section("Breaking", data.breaking.map((b) => `- ${b.text} — ${b.title} (\`${short(b.sha)}\`)`));
  lines.push("## Merges", "");
  if (data.merges.length === 0) lines.push("_none_", "");
  for (const m of data.merges) {
    lines.push(`### ${m.title} (\`${short(m.sha)}\`)`, "");
    if (m.changed.length > 0) lines.push(...m.changed.map((c) => `- Changed: ${c}`), "");
  }
  return lines.join("\n");
}

function main(argv) {
  const json = argv.includes("--json");
  const rest = argv.filter((a) => a !== "--json");
  if (rest.length !== 1 || !isRange(rest[0])) {
    console.error("usage: node tools/changelog-render.mjs <from>..<to> [--json]");
    return 2;
  }
  let data;
  try {
    data = renderRange(rest[0]);
  } catch (e) {
    console.error(`changelog-render: ${e.message}`);
    return 2;
  }
  process.stdout.write(json ? `${JSON.stringify(data, null, 2)}\n` : toMarkdown(data));
  for (const p of data.problems) console.error(`changelog-render: ${p}`);
  return data.problems.length > 0 ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = main(process.argv.slice(2));
