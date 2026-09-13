/**
 * STAGE 3 — THE LAMPLIGHTERS' HALF: presentation ⊥ condemnation, over an OFFERING.
 *
 * `lamplighters.mem` states the immune architecture and this enacts it without softening a line:
 *   · Innate — tenders PATROL, NOTICE, REPAIR. "They hold no read-cap, no persona, and no verdict."
 *   · Adaptive — a kahu quorum, "the only condemning body".
 *   · "The quorum needs its full k, always. N tenders converging lowers nothing."
 *
 * A presentation therefore carries ZERO threshold weight by construction: it lands in a different record
 * type, under a different domain, and the fold that decides standing never reads it. A design where
 * presentations accumulated toward a verdict would hand a captured Union blocking power — and the same
 * carrier warns that if presentation ever became REQUIRED, "the quorum MUST retain the ability to
 * self-present and condemn with no tender at all". So the quorum stands alone here too.
 *
 * The condemnation reuses the antigen machinery under its OWN domain: that board shadows a PRESENTER,
 * this one an OFFERING, and a signature minted over one must never verify as the other.
 */
import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import * as ed from "@noble/ed25519";
import { hex } from "../src/crypto.js";
import {
  presentOffering, verifyOfferingPresentation,
  signOfferingKapae, foldOfferingAntigen, offeringStandsAside,
  type OfferingKapaeEntry,
} from "../src/offering-antigen.js";
import { OFFERING_PRESENTATION_DOMAIN, OFFERING_KAPAE_DOMAIN, KAPAE_ANTIGEN_DOMAIN } from "../src/domains.js";
import type { KahuRoster } from "../src/kapae-antigen.js";

const seedOf = (n: number): Uint8Array => new Uint8Array(32).fill(n);
const keyOf = async (n: number): Promise<string> => hex(await ed.getPublicKeyAsync(seedOf(n)));
const signWith = (n: number) => async (b: Uint8Array): Promise<string> => hex(await ed.signAsync(b, seedOf(n)));
const OFFERING_CID = "bafyOfferingRegion";
const EPOCH = "epoch-cid-0";

async function roster(threshold: number): Promise<KahuRoster> {
  return { keys: [await keyOf(1), await keyOf(2), await keyOf(3)], threshold, sealEpochCid: EPOCH };
}

async function kapae(signers: readonly number[], version = 1): Promise<OfferingKapaeEntry> {
  return signOfferingKapae(
    { pluginsCid: OFFERING_CID, action: "kapae", version, sealEpochCid: EPOCH },
    await Promise.all(signers.map(async (n) => ({ signer: await keyOf(n), sign: signWith(n) }))),
  );
}

describe("a tender PRESENTS; only a quorum CONDEMNS", () => {
  test("★ a presentation carries ZERO threshold weight — N tenders converging lowers nothing ★", async () => {
    const r = await roster(2);
    // Five tenders all present the same offering. Not one of them is a kahu.
    const presentations = await Promise.all([4, 5, 6, 7, 8].map(async (n) =>
      presentOffering({ pluginsCid: OFFERING_CID, noticed: "the blobs fold elsewhere on my shelf", presenter: await keyOf(n) }, signWith(n))));
    for (const p of presentations) await expect(verifyOfferingPresentation(p)).resolves.toEqual({ ok: true });

    // The fold that decides standing reads the QUORUM board alone. Five honest presentations move it none.
    expect(await offeringStandsAside(OFFERING_CID, await foldOfferingAntigen([], r))).toBe(false);
  });

  test("★ the quorum keeps its full k — a sub-quorum condemns nothing ★", async () => {
    const r = await roster(2);
    const one = await foldOfferingAntigen([await kapae([1])], r);
    expect(await offeringStandsAside(OFFERING_CID, one), "one signer set an offering aside").toBe(false);

    const two = await foldOfferingAntigen([await kapae([1, 2])], r);
    expect(await offeringStandsAside(OFFERING_CID, two), "a full quorum failed to condemn").toBe(true);
  });

  test("★ the quorum self-presents: it condemns with NO tender at all ★", async () => {
    // The carrier's own guard against a captured Union holding blocking power. No presentation exists here.
    const r = await roster(2);
    const folded = await foldOfferingAntigen([await kapae([1, 2])], r);
    expect(await offeringStandsAside(OFFERING_CID, folded)).toBe(true);
  });

  test("★ a presentation can never be replayed as a verdict — the domains hold apart ★", async () => {
    const p = await presentOffering({ pluginsCid: OFFERING_CID, noticed: "dark stretch", presenter: await keyOf(4) }, signWith(4));
    expect(p.kind).toBe(OFFERING_PRESENTATION_DOMAIN);
    expect(p.kind).not.toBe(OFFERING_KAPAE_DOMAIN);
    // And the OFFERING board stands apart from the PRESENTER board: one shadows a collection, the other
    // an identity, and a signature over one must not verify as the other.
    expect(OFFERING_KAPAE_DOMAIN).not.toBe(KAPAE_ANTIGEN_DOMAIN);
    const k = await kapae([1, 2]);
    expect(k.kind).toBe(OFFERING_KAPAE_DOMAIN);
  });

  test("a LIFT at a higher version re-admits; a stale one cannot roll it back", async () => {
    const r = await roster(2);
    const banned = await foldOfferingAntigen([await kapae([1, 2], 1)], r);
    expect(await offeringStandsAside(OFFERING_CID, banned)).toBe(true);

    const lift = await signOfferingKapae(
      { pluginsCid: OFFERING_CID, action: "un_kapae", version: 2, sealEpochCid: EPOCH },
      await Promise.all([1, 2].map(async (n) => ({ signer: await keyOf(n), sign: signWith(n) }))));
    expect(await offeringStandsAside(OFFERING_CID, await foldOfferingAntigen([await kapae([1, 2], 1), lift], r))).toBe(false);

    // A stale raise at a LOWER version never rolls the lift back.
    const stale = await kapae([1, 2], 1);
    expect(await offeringStandsAside(OFFERING_CID, await foldOfferingAntigen([lift, stale], r))).toBe(false);
  });

  test("CONTROL — an UNBOUND roster condemns nothing, however many signatures arrive", async () => {
    const unbound: KahuRoster = { keys: [], threshold: 2, sealEpochCid: EPOCH };
    expect(await offeringStandsAside(OFFERING_CID, await foldOfferingAntigen([await kapae([1, 2, 3])], unbound))).toBe(false);
  });

  test("CONTROL — an entry rooting on ANOTHER charter epoch condemns nothing", async () => {
    const r = await roster(2);
    const elsewhere = await signOfferingKapae(
      { pluginsCid: OFFERING_CID, action: "kapae", version: 1, sealEpochCid: "epoch-cid-OTHER" },
      await Promise.all([1, 2].map(async (n) => ({ signer: await keyOf(n), sign: signWith(n) }))));
    expect(await offeringStandsAside(OFFERING_CID, await foldOfferingAntigen([elsewhere], r))).toBe(false);
  });
});

/**
 * THE FOLD STANDS READY, AND NOTHING CONSULTS IT YET.
 *
 * `foldOfferingAntigen` decides whether an offering stands aside, and no caller asks it — the CLI reads
 * the region, the daemon serves it, and neither consults this board. That state is fine; DESCRIBING it as
 * live would not be. This tree already carried one guard whose comment claimed a corruption was
 * "structurally impossible" while nothing invoked it, and an auditor reading the offering path deserves
 * better than the same trap one module over.
 *
 * A comment tracks its CALLERS and nothing checks that by itself, so this does. It fails the moment a
 * production caller appears, and the cure is to re-word the module header as live enforcement and delete
 * this test — never to widen an exemption.
 *
 * THE SCAN READS THE WHOLE WORKSPACE, NEVER ONE PACKAGE. `offering.mem` #/must-not rules that
 * "condemnation is the RECEIVER's opt-in, at the receiving Nexus" — so the offer path never consults the
 * fold and the FIRST honest caller lands on the TAKER's door, in `@lares/cli`, one package over. A weld
 * scanning only its own `src/` would therefore stay green for the entire life of the claim it guards:
 * it would certify an absence in the one place a caller can never appear, and read as a cleared guard
 * while going quietly false. A guard that cannot expire reads worse than no guard at all.
 *
 * So the walk covers every TypeScript source under `packages/<pkg>/src`, minus the declaring module and any build
 * output (`dist/`, `node_modules/`). Two CONTROLs keep the walk honest: a FLOOR on how many files it
 * actually read (a scan that stops matching reports the cleanest run it ever produced), and a PROBE for
 * a symbol that DOES have production callers (proving the matcher finds one when one exists).
 */
describe("what the offering fold may claim", () => {
  const SRC_DIR = join(import.meta.dirname, "..", "src");
  const PACKAGES = join(import.meta.dirname, "..", "..");

  /** Every TypeScript source under every `packages/<pkg>/src`, absolute, minus build output. */
  function workspaceSources(): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.name === "dist" || e.name === "node_modules") continue;
        const p = join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith(".ts") && !e.name.endsWith(".d.ts")) out.push(p);
      }
    };
    for (const pkg of readdirSync(PACKAGES, { withFileTypes: true })) {
      if (!pkg.isDirectory()) continue;
      const src = join(PACKAGES, pkg.name, "src");
      if (existsSync(src)) walk(src);
    }
    return out;
  }

  /** Files (workspace-relative) whose text calls any of `symbols`, excluding the declaring module. */
  function callersOf(symbols: readonly string[], sources: readonly string[]): string[] {
    const re = new RegExp(symbols.map((s) => `\\b${s}\\s*\\(`).join("|"));
    return sources
      .filter((p) => !p.endsWith(join("lararium-mesh", "src", "offering-antigen.ts")))
      .filter((p) => re.test(readFileSync(p, "utf8")))
      .map((p) => relative(PACKAGES, p));
  }

  test("★ no production caller consults the fold — so the header says READY, never enforced ★", () => {
    const callers = callersOf(["foldOfferingAntigen", "offeringStandsAside"], workspaceSources());
    expect(
      callers,
      "a caller appeared — WIRE the claim: re-word offering-antigen.ts's header as live enforcement and delete this test",
    ).toEqual([]);

    const header = readFileSync(join(SRC_DIR, "offering-antigen.ts"), "utf8").slice(0, 2600);
    expect(header, "the header claims an enforcement no caller performs").toMatch(/READY|not yet consulted|no caller/i);
  });

  test("CONTROL — the scan really WALKS the workspace, several packages deep", () => {
    const sources = workspaceSources();
    // A floor, never a ceiling: a scan that quietly stops matching reports the cleanest run it ever
    // produced, so the emptiness above means nothing without a witness that the walk read a real corpus.
    expect(sources.length, "the workspace walk collapsed — the empty caller list above proves nothing").toBeGreaterThan(200);
    const packagesSeen = new Set(sources.map((p) => relative(PACKAGES, p).split(/[\\/]/)[0]));
    expect(packagesSeen.size, "the walk read one package — it must reach the TAKER's door in @lares/cli").toBeGreaterThan(2);
    expect([...packagesSeen], "the CLI holds the taker's door; a walk that misses it cannot expire").toContain("lares-cli");
    // And no build output leaked in — a `dist/` hit would fire the weld on a stale compiled copy.
    expect(sources.filter((p) => p.includes(`${"dist"}/`))).toEqual([]);
  });

  test("CONTROL — the matcher FINDS a caller when one exists (a symbol that is genuinely wired)", () => {
    // `standAs` (vessel-standing.ts) IS consulted in production — the node's boot reads it. If the matcher
    // reports zero here, it reports zero for the fold by defect, not by fact.
    const wired = callersOf(["standAs"], workspaceSources());
    expect(wired.length, "the matcher found NO caller for a symbol that has one — the scan is broken").toBeGreaterThan(0);
  });

  test("CONTROL — the fold still DECIDES what it names, so the law stands ready to wire", async () => {
    const r = await roster(2);
    expect(await offeringStandsAside(OFFERING_CID, await foldOfferingAntigen([await kapae([1, 2])], r))).toBe(true);
  });
});
