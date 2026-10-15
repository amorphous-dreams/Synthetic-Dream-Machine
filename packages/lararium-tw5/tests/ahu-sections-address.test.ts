// vm-grammar-boundary: exempt — reads fence-mask.ts's OWN fenceLineOpen/fenceLineClose to
// toggle fences the same way the compile layer does — it drives no meme-ast parse at all, only
// the mask layer's line-fence rule, the same reasoning as fence-mask-info-string.test.ts.
/**
 * ahu-sections-address — every named `ahu` section becomes an addressable tiddler.
 *
 * A meme splits into one tiddler per `<<~ ahu #name>>` child, and the section's address
 * (`lar:///<uri-path>#name`) resolves to that tiddler. That is the whole premise of a fragment in a
 * `lar:` URI: the name points at a thing.
 *
 * NO OTHER INSTRUMENT SEES THIS. The block check verifies bytes and passes; round-trip verifies that a
 * carrier re-renders to what the wiki parsed and passes; the frame witness checks that marks are
 * declared and passes. All three stay green on a carrier whose sections collapsed into its root — the
 * bytes are intact, the render is faithful, and the names point at nothing.
 *
 * The two tests below split the fault by cause:
 *
 *   ① EVERY OPEN CLOSES.        A `<<~ ahu #x>>` with no `<<~/ahu>>` swallows the sections that
 *                               follow it, so they never open a tiddler of their own.
 *
 *                               A NESTED section is not that fault. Nesting is deliberate house
 *                               structure — an OODA-HA phase carries its ha/ka/ba triple — and it
 *                               addresses under a ROOTED path, `#/observe/observe-ha`. ② reads
 *                               the LEAF, so a nest passes and a swallowed section fails.
 *   ② EVERY OPEN ADDRESSES.     The stronger claim, and the one that catches the rest: whatever the
 *                               cause, an opened section resolves to a tiddler.
 *
 * ① is a subset of ②'s failures. Both run because a balance fault and an addressing fault want
 * different repairs, and a single red would hide which one a carrier has.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { memeticWikitextDeserializer } from "../src/deserializer.js";
import { carrierFiles } from "../src/carrier-files.js";
import { fenceLineOpen, fenceLineClose, type FenceOpen } from "@lararium/memetic-frame";

const REPO = new URL("../../..", import.meta.url).pathname;

/** THE WHOLE CORPUS. Every carrier the tree declares answers this law. */
const carriers = (): string[] => carrierFiles(REPO);

/**
 * Section opens and closes, counted outside fenced blocks — a fence carries examples, never
 * structure. `fenceLineOpen`/`fenceLineClose` (fence-mask.ts) read CommonMark §4.5's own rule: a
 * line opening with a 3+ backtick or tilde run whose INFO STRING itself carries that character never
 * opens a fence at all (it reads as ordinary prose) — a naive `line.startsWith("```")` toggle flips on that line
 * anyway and desyncs every open/close count that follows it.
 */
export function frame(text: string): { opens: string[]; closes: number } {
  const opens: string[] = [];
  let closes = 0;
  let fence: FenceOpen | null = null;
  for (const line of text.split("\n")) {
    if (fence) { if (fenceLineClose(line, fence)) fence = null; continue; }
    fence = fenceLineOpen(line);
    if (fence) continue;
    const open = /^(?:<<~ ahu|<<fragment) #\/?([a-z0-9-]+)/.exec(line);
    if (open) opens.push(open[1]!);
    if (/^(?:<<~\/ahu|<<\/fragment)/.test(line)) closes += 1;
  }
  return { opens, closes };
}

/** The section names the wiki actually addresses, read from the split the deserialiser performs. */
function addressed(file: string, disk: string): Set<string> | null {
  const uri = /^uri-path\s*=\s*"([^"]+)"/m.exec(disk)?.[1];
  if (!uri) return null;
  let records: Array<Record<string, unknown>>;
  try {
    records = memeticWikitextDeserializer(disk, { title: `lar:///${uri}` }, {} as never) as Array<Record<string, unknown>>;
  } catch {
    return null;
  }
  const out = new Set<string>();
  for (const r of records) {
    // A NESTED SECTION ADDRESSES UNDER A COMPOUND FRAGMENT — `#parent/child`. The leaf is the name
    // the `<<~ ahu #child>>` open wrote, so the leaf is what an open must be found under.
    const frag = /#\/?([a-z0-9-]+(?:\/[a-z0-9-]+)*)$/i.exec(String(r["title"] ?? ""));
    if (frag) { const leaf = frag[1]!.split("/").pop()!; if (!leaf.startsWith("$")) out.add(leaf); }
  }
  return out;
}

describe("frame() — fence toggling reads CommonMark §4.5, never a naive line.startsWith", () => {
  test("RED→GREEN — a hard-wrapped prose line opening with a quad-backtick inline span does NOT desync the count", () => {
    // CommonMark §4.5: a backtick fence's own info string may not itself carry a backtick — a line
    // shaped "```memetic-wikitext tangle`more prose" never opens a fence at all; it reads as
    // ordinary text. A naive `line.startsWith("```")` toggle flips `fenced` on anyway, and every
    // real `<<~ ahu …>>` open/close that follows it in the SAME carrier silently stops counting.
    const text = [
      "prose before",
      "```memetic-wikitext tangle`more prose",
      "<<~ ahu #a>>",
      "body",
      "<<~/ahu>>",
    ].join("\n");
    const { opens, closes } = frame(text);
    expect(opens).toEqual(["a"]);
    expect(closes).toBe(1);
  });

  test("CONTROL — a real fence (clean info string) still masks the open/close it carries", () => {
    const text = [
      "```text",
      "<<~ ahu #fenced-example>>",
      "<<~/ahu>>",
      "```",
      "<<~ ahu #real>>",
      "<<~/ahu>>",
    ].join("\n");
    const { opens, closes } = frame(text);
    expect(opens).toEqual(["real"]);
    expect(closes).toBe(1);
  });
});

/** A walk that deserializes every corpus carrier scales with the corpus; measured ~2.7 s alone, past
 *  the 5 s default under the full suite's parallel load. */
const CORPUS_WALK_MS = 30_000;

describe("★ every named ahu section addresses ★", () => {
  test("① every ahu open carries a close", () => {
    const drift: string[] = [];
    for (const f of carriers()) {
      const { opens, closes } = frame(readFileSync(path.join(REPO, f), "utf8"));
      if (opens.length !== closes) drift.push(`${f}: ${opens.length} open, ${closes} close`);
    }
    expect(drift).toEqual([]);
  });

  test("③ every child slot roots at the carrier — `#/name`, never a bare `#name`", () => {
    // A slot names the string it addresses. The child mints `parentUri#/name`, so an open that omits
    // the slash says one thing and resolves another — and every reader that pairs them by name has to
    // carry a special case. NO SLOT IS EXEMPT: the exempt-slot class retired, so every slot a carrier
    // declares opens a child, and a child answers to an address.
    const bare: string[] = [];
    for (const f of carriers()) {
      const disk = readFileSync(path.join(REPO, f), "utf8");
      let fence: FenceOpen | null = null;
      disk.split("\n").forEach((line, i) => {
        if (fence) { if (fenceLineClose(line, fence)) fence = null; return; }
        fence = fenceLineOpen(line);
        if (fence) return;
        const m = /^<<(?:~ ?ahu|fragment|~ ?kahea ahu) #(?!\/)([a-z0-9-]+)/i.exec(line);
        if (m) bare.push(`${f}:${i + 1} #${m[1]}`);
      });
    }
    expect(bare).toEqual([]);
  });

  test("② every ahu open resolves to a tiddler", () => {
    const drift: string[] = [];
    for (const f of carriers()) {
      const disk = readFileSync(path.join(REPO, f), "utf8");
      const { opens } = frame(disk);
      if (opens.length === 0) continue;
      const have = addressed(f, disk);
      if (have === null) continue;
      const lost = opens.filter((n) => !have.has(n));
      if (lost.length) drift.push(`${f}: ${lost.length} unaddressable — ${lost.slice(0, 4).join(" ")}`);
    }
    expect(drift).toEqual([]);
  }, CORPUS_WALK_MS);
});
