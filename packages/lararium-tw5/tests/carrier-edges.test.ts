/**
 * carrier-edges — the reading that looks OUTWARD from a carrier.
 *
 * `carrier-shape` asks whether a file is whole; `meme-coordinates` asks whether its own two
 * coordinates agree; `bcc` asks whether its bytes match their check. A `lar:` URI names and does not
 * fetch, so a carrier whose target moved satisfies all three and points at nothing.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/memetic-wikitext
 */

import { describe, expect, test } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import { readCarrierEdges } from "../src/carrier-edges.js";
import { carrierFiles } from "../src/carrier-files.js";
import { REPO } from "./test-wiki.js";

describe("carrier-edges — every address a carrier points at", () => {
  /**
   * FIVE SPELLINGS, ONE RELATION. A reader counting only `loulou` sees 147 of the corpus's dangling
   * edges and reports a clean move over a broken one.
   */
  test("every form a carrier can name an address in is read", () => {
    const src = [
      "<<~ loulou lar:///ha.ka.ba/a/one>>",
      // Both ends stated, so this also holds the reader to the end that TRAVELS: the source is
      // `a/source` and the edge is `a/two`. A reader taking the first address passes every other
      // assertion here and still names the wrong carrier.
      '<<~ pranala #x from=lar:///ha.ka.ba/a/source -> to=lar:///ha.ka.ba/a/two family=control>>',
      "<<~ kahea ahu lar:///ha.ka.ba/a/three>>",
      "[[a name|lar:///ha.ka.ba/a/four]]",
      "[[lar:///ha.ka.ba/a/five]]",
    ].join("\n\n");
    const got = readCarrierEdges(src);
    expect(got.map((e) => e.address!).sort())
      .toEqual(["ha.ka.ba/a/five", "ha.ka.ba/a/four", "ha.ka.ba/a/one", "ha.ka.ba/a/three", "ha.ka.ba/a/two"]);
    expect(new Set(got.map((e) => e.form))).toEqual(new Set(["loulou", "pranala", "kahea", "wikilink"]));
  });

  /**
   * THE SPEC MEMES TEACH THESE FORMS BY QUOTING THEM. Unmasked, a lesson's example reads as a broken
   * link and sends a reader chasing an address nobody meant to stand. Measured over the corpus: 18 raw matches
   * are lessons rather than links.
   */
  test("an edge quoted inside a fence is a lesson, never a link", () => {
    const taught = "````\nShow one:\n\n<<~ loulou lar:///ha.ka.ba/not/real>>\n````\n\n<<~ loulou lar:///ha.ka.ba/is/real>>";
    expect(readCarrierEdges(taught).map((e) => e.address)).toEqual(["ha.ka.ba/is/real"]);
  });

  /** A fragment rides the written form and never the address a resolver looks up. */
  test("the fragment stays on the writing and off the lookup", () => {
    const [e] = readCarrierEdges("<<~ loulou lar:///ha.ka.ba/a/one#part>>");
    expect(e!.address).toBe("ha.ka.ba/a/one");
    expect(e!.written).toBe("ha.ka.ba/a/one#part");
  });

  /** Prose punctuation belongs to the sentence, never to the name. */
  test("a trailing period is not part of an address", () => {
    expect(readCarrierEdges("See [[lar:///ha.ka.ba/a/one]].")[0]!.address).toBe("ha.ka.ba/a/one");
  });

  /**
   * THE CORPUS, AS A CEILING RATHER THAN A FLOOR. Some edges here name no carrier — a corpus writes
   * toward addresses before it stands them, and an aspirational pointer is not a fault. The number
   * below is the count that stands today, held as a ceiling so a rename that breaks edges raises it.
   * `lares meme check --edges` takes the reading either side of a move.
   *
   * ''Lower this whenever it can go lower.'' A ceiling left slack absorbs the next break in silence.
   *
   * TWO REASONS THE CEILING RISES, AND THEY ARE NOT THE SAME ACT. A rename that orphans a target is a
   * corpus break, and the repair is to the corpus. A reader that learns to see a form it was blind to
   * raises the count without anything having broken — the edges it surfaces dangled all along, unread.
   * A rise is only allowed to be absorbed here for the second reason, and only with the cause named;
   * absorbing the first one silently is how a ceiling stops measuring anything.
   *
   * TWO READERS, TWO CORPORA (measured 2026-09-13): `lares meme check --edges $(git ls-files 'bags/*.mem')` reads
   * 176 over bags/ alone; this test walks `carrierFiles` — every declared carrier, tiddlers and memory
   * included — and reads 179. The ceiling here is THIS reader's number; lowering it to the CLI's would red on
   * three edges the CLI never sees. 196 → 198, and the cause is the SECOND kind. The corpus finder learned to read the DECLARATION
   * rather than a `bags/**` path, and the runtime kernel face at
   * packages/lararium-tw5/tiddlers/memetic-wikitext.tid entered a corpus no reader had ever walked.
   * Its four edges — three at `…/api/pono/invariant`, one at `lararium-node/MEME-STORE-FOUNDATIONS` —
   * pointed at nothing before this test could see them, and two of them are offset by the uri-paths
   * that same carrier now holds. Nothing broke; a blind spot closed.
   */
  test("the corpus points at no more nothing than it already did", () => {
    const files = carrierFiles(REPO);
    const held = new Set<string>(), texts: string[] = [];
    for (const f of files) {
      const t = readFileSync(path.join(REPO, f), "utf8");
      texts.push(t);
      const u = /^uri-path\s*=\s*"([^"]+)"/m.exec(t)?.[1];
      if (u) held.add(u);
    }
    // An `md-target` edge names a FILE and carries no address, so it can neither resolve nor dangle.
    // Counting it here would fold a known, separately-gated class into this one and hide a real break.
    const dangling = texts.flatMap(readCarrierEdges)
      .filter((e) => e.address !== null && !held.has(e.address));
    expect(files.length).toBeGreaterThan(500);
    // 2026-09-12: 201 -> 178. The harvest room emptied and went: `bags/lares-history` held 51 files
    // whose own edges named addresses nothing answered, and three living carriers named into it. Each
    // of those three welded onto the carrier that inherited the material — `docs/history/consume-archive`,
    // `docs/pattern-integrities`, `docs/infrastructure-as-myth` — before the room burned, and the room's
    // own 23 outbound danglers went with it. A CEILING ONLY EVER LOWERS, and it lowers by the same
    // measurement either side of the change: `lares meme check --edges` read 198 before the rite and 175
    // after, over the shelf; this reading adds the runtime kernel face and the fixtures the finder sees.
    //
    // 178 -> 179, the SECOND kind again and named: `node/genesis-island.mem` teaches the carrier-gradient
    // law by pointing at `lares/api/pono/carrier-gradient`, a carrier nobody has written — the law lives
    // in `carrier-files.ts` and in the session record and has never had a `.mem` of its own. Its sibling
    // edge in the same commit was the FIRST kind, a plain typo naming `lares/api/residency-model` where
    // the carrier stands at `lararium/api/residency-model`, and that one was repaired rather than absorbed.
    //
    // Every remaining forward reference stands written down on purpose — `live-equivocation.mem` names
    // `elyncia/characters/primary-characters/telarus`, `lararium/mesh/ahi-ka` and
    // `lares/api/pono/recovery-registration`, three carriers nobody has written yet. A FORWARD REFERENCE
    // IS INTENT RECORDED AHEAD OF ITS CARRIER.
    expect(dangling.length, "an edge broke — run `lares meme check --edges` to name it").toBeLessThanOrEqual(179);
  });
});
