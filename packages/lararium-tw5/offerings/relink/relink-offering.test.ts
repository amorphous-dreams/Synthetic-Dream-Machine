/**
 * relink-offering.test.ts — the Relink offering (adopt-relink research, lane 1:
 * the operator signs) folds and verifies once SIGNED, and a recipe naming the signed result selects
 * EXACTLY its one blob — never more, never less, and never when the recipe does not name it.
 *
 * `offering.json` is an UNSIGNED source descriptor (M5), minted by `scripts/pack-relink-offering.ts`
 * reproducibly from the upstream's pinned commit — no `sig`, no `offeror`, no `pluginsCid`. It
 * carries no custody claim of its own; signing moves to wherever custody actually lives (an
 * operator's `nexus publish plugins --source`). This test mints its OWN throwaway test-seed signature
 * over the committed descriptor's blobs, exactly as `nexus-publish.ts` does over a real persona's
 * root key, and proves the RESULT verifies and selects correctly — never a fixed, committed
 * signature nobody but a test could have minted (`project_sealed_archive_write_holes` surfaced this
 * exact shape of hazard for a DIFFERENT committed secret; a signed, publicly-derivable offering was
 * M5's own finding here).
 *
 * This test reads the committed descriptor rather than re-running the pack (packing shells out to
 * the TW5 CLI; re-running it on every test run would make this suite as slow and as
 * network-bound as the pack step itself, which fetches the public upstream). The suite stays offline;
 * `tsx scripts/pack-relink-offering.ts --verify` re-packs and diffs the bytes, run by hand when
 * re-pinning.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  bagUri, CompositeStore,
  verifyPluginOffering, pluginOfferingCid, selectPluginBlobs, selectedPluginCids, signPluginOffering,
  computePluginsCid, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed,
  type PluginOffering, type PluginProvenance,
} from "@lararium/mesh";
import { CARRIER_TYPE } from "@lararium/mesh/carrier-type";
import { casBlobPreloads, modulePinsOf } from "../../src/module-pins.js";
import { makeTiddlerRenameReactor } from "../../src/tiddler-verbs.js";
import type { VerbContext } from "../../src/verb-dispatcher.js";
import { bootTestWiki, skipNote, wikiSkip } from "../../tests/test-wiki.js";

interface SourceBlob { readonly id: string; readonly version: string; readonly sha256: string; readonly provenance: PluginProvenance; readonly file: string }
interface SourceDescriptor { readonly blobs: readonly SourceBlob[] }

const OFFERING = new URL("./offering.json", import.meta.url);
const descriptor = JSON.parse(readFileSync(OFFERING, "utf8")) as SourceDescriptor;

/** A throwaway TEST seed — never the committed record, never a publicly derivable PoC key. */
const TEST_SEED = new TextEncoder().encode("relink-offering.test.ts — not a real persona").slice(0, 32);

async function signForTest(): Promise<PluginOffering> {
  const blobs = descriptor.blobs.map(({ file: _file, ...rest }) => rest);
  const offeror = await ed25519VerifyingKeyFromSeed(TEST_SEED);
  return signPluginOffering({ offeror, pluginsCid: computePluginsCid(blobs), blobs }, ed25519SignerFromSeed(TEST_SEED));
}

describe("the relink offering, once signed", () => {
  test("verifies: signature, fold, and shape all hold", async () => {
    const offering = await signForTest();
    const verdict = await verifyPluginOffering(offering);
    expect(verdict.ok).toBe(true);
  });

  test("CONTROL: a tampered licence claim moves the CID and breaks the signature", async () => {
    const offering = await signForTest();
    const tampered: PluginOffering = {
      ...offering,
      blobs: offering.blobs.map((b) => ({ ...b, provenance: { ...b.provenance!, licence: "MIT" } })),
    };
    const verdict = await verifyPluginOffering(tampered);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.code).toBe("bad-signature");
  });

  test("a recipe naming its CID selects exactly its one blob", async () => {
    const offering = await signForTest();
    const CID = pluginOfferingCid(offering);
    const lookup = (cid: string) => (cid === CID ? offering : undefined);
    const verdict = await selectPluginBlobs([CID], lookup);
    expect(verdict.ok).toBe(true);
    if (verdict.ok) {
      expect(verdict.blobs.map((b) => b.id)).toEqual(["$:/plugins/flibbles/relink"]);
      expect(selectedPluginCids(verdict.blobs)).toEqual([offering.blobs[0]!.sha256]);
    }
  });

  test("CONTROL: an empty recipe (never naming it) selects nothing", async () => {
    const lookup = () => undefined;
    const verdict = await selectPluginBlobs([], lookup);
    expect(verdict.ok).toBe(true);
    if (verdict.ok) expect(verdict.blobs).toEqual([]);
  });

  test("a recipe naming an unannounced CID refuses as unknown, never an empty success", async () => {
    const lookup = () => undefined;
    const verdict = await selectPluginBlobs(["sha256:not-announced-anywhere"], lookup);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.failure.code).toBe("unknown");
  });
});

describe("the relink offering's pinned bytes", () => {
  const blob = descriptor.blobs[0]!;
  const pluginBytes = readFileSync(new URL(`./${blob.file}`, import.meta.url));

  test("names one immutable commit and the licence it carries", () => {
    expect(blob.provenance.commit).toBe("51266a1e853c616c5f0b401a9c881d518dddb9bc");
    expect(blob.provenance.licence).toBe("BSD-3-Clause");
    expect(readFileSync(new URL("./NOTICES.txt", import.meta.url), "utf8")).toContain("Cameron Fischer");
  });

  test("the packed file hashes to the descriptor's sha256", () => {
    expect(createHash("sha256").update(pluginBytes).digest("hex")).toBe(blob.sha256);
  });

  test("carries its licence tiddler", () => {
    const plugin = JSON.parse(pluginBytes.toString("utf8")) as { text: string };
    expect(Object.keys(JSON.parse(plugin.text).tiddlers)).toContain("$:/plugins/flibbles/relink/license");
  });

  test("the pack carries Relink alone: the relink-titles add-on stays out", () => {
    const plugin = JSON.parse(pluginBytes.toString("utf8")) as { title: string; version: string; text: string };
    expect(plugin.title).toBe("$:/plugins/flibbles/relink");
    expect(plugin.version).toBe(blob.version);
    expect(Object.keys(JSON.parse(plugin.text).tiddlers).some((t) => t.includes("relink-titles"))).toBe(false);
  });
});

// ── THE RENAME DOOR WITH THE OFFERING IN THE BOOT PLUGIN SET ─────────────────────────────────────────
// A scratch island boots the two house skins and the offering's verified bytes (pinned as a verified offering's modules are
// pinned), and the door's dry run captures each record Relink's relinkers rewrite before anything moves.

const DAEMON = bagUri("daemon");
const HOME = { "$origin-bag": DAEMON } as const;
const WORKING_POINTER = "lar:///ha.ka.ba/lararium/config/current-wiki-bag";
const OLD = "lar:///t/old";
const NEW = "lar:///t/new";
const SLOT = "lar:///t/shrine#/edges";
const writer: VerbContext["cap"] = async (access, bag) => (bag === DAEMON || access === "read" ? { ok: true } : { ok: false, reason: "no-grant" });
const ctx: VerbContext = { daemon: {} as CompositeStore, invocation: { requestId: "r1" } as VerbContext["invocation"], cap: writer };

/** The meme slot a referrer carries: a sigil link, a pranala edge into a slot of the moved title, a wikitext link and a transclusion. */
const slotText = (title: string): string =>
  `<<~ loulou uri=\`${title}\`>>\n` +
  `<<~ pranala slot=\`#source\` from=\`?\` to=\`${title}#/a\` family=\`code\` role=\`has\`>>\n\n` +
  `See [[${title}]] and {{${title}}}.\n`;

/** A container pair in one carrier: its opener's edge and its body's link both name the moved title. */
const pairText = (title: string): string =>
  `<<~ ahu slot=\`#/a\`>>\n\n<<~ loulou uri=\`${title}\`>>\n\nSee [[${title}]].\n\n<<~/ahu>>\n`;

async function island(withRelink: boolean) {
  const blob = descriptor.blobs[0]!;
  const bytes = new Uint8Array(readFileSync(new URL(`./${blob.file}`, import.meta.url)));
  const engine = await bootTestWiki({
    ...(withRelink ? { extraPlugins: [JSON.parse(Buffer.from(bytes).toString("utf8")) as Record<string, unknown>], modulePins: modulePinsOf(casBlobPreloads(bytes, blob.sha256)) } : {}),
    tiddlers: [
      { title: WORKING_POINTER, text: DAEMON },
      { title: OLD, type: "text/vnd.tiddlywiki", text: "the record that moves", ...HOME },
      { title: "Linker", type: "text/vnd.tiddlywiki", text: `see [[${OLD}]] today`, ...HOME },
      { title: "Handover", type: "text/vnd.tiddlywiki", text: `Tonight: {{${OLD}}}`, ...HOME },
      { title: SLOT, type: CARRIER_TYPE, text: slotText(OLD), "$fragment-parent": "lar:///t/shrine", ...HOME },
      { title: "Pair", type: CARRIER_TYPE, text: pairText(OLD), ...HOME },
      { title: "Bystander", type: CARRIER_TYPE, text: "<<~ loulou uri=`lar:///t/older`>>\n\n[[lar:///t/older]]\n", ...HOME },
    ],
  });
  const rename = await makeTiddlerRenameReactor({ composite: new CompositeStore(), tw5: engine })({ recipe: "default", title: OLD, to: NEW }, ctx);
  return { wiki: engine.wiki, rename };
}

describe.skipIf(wikiSkip)(`the relink offering inside a scratch island (rides the tiddler door rename verb)${skipNote}`, () => {
  test("a rename dry run captures a rewritten [[Old]] link, a {{Old}} transclusion and a meme slot's lar: references (a container pair's body included) when the offering stands in the boot plugin set; CONTROL: a title that only shares the prefix stays", async () => {
    const { wiki, rename } = await island(true);
    expect(rename).toMatchObject({ decision: "renamed", forwarder: OLD });
    expect([...(rename["relinked"] as string[])].sort()).toEqual(["Handover", "Linker", "Pair", SLOT].sort());
    expect(wiki.getTiddler("Linker")!.fields["text"]).toBe(`see [[${NEW}]] today`);
    expect(wiki.getTiddler("Handover")!.fields["text"]).toBe(`Tonight: {{${NEW}}}`);
    expect(wiki.getTiddler(SLOT)!.fields["text"]).toBe(slotText(NEW));
    expect(wiki.getTiddler("Pair")!.fields["text"]).toBe(pairText(NEW));
    expect(wiki.getTiddler("Bystander")!.fields["text"]).toBe("<<~ loulou uri=`lar:///t/older`>>\n\n[[lar:///t/older]]\n");
  });

  test("CONTROL: with the offering absent the house's handler stands inert: the island boots and the rename relinks no body", async () => {
    const { wiki, rename } = await island(false);
    expect(rename).toMatchObject({ decision: "renamed", forwarder: OLD });
    expect(rename["relinked"]).toEqual([]);
    expect(wiki.getTiddler(SLOT)!.fields["text"]).toBe(slotText(OLD));
  });
});
