/**
 * kukulu-offer — the standing vessel rests what a kūkulu carries, and the next vessel offers it to the pūlama once: the line's
 * lei out of the vessel's own control records, the vouch it signs over the image the host named, one file in the config home.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, kukuluVouchDigest, restReceipt, signSwarmAct, swarmActCid, swarmLeiRecordTitle, swarmLeiUnstrungTitle,
  verifyKukuluVouch, type SignedSwarmAct, type SwarmLeiTerms, type SwarmSignerPort, type SwarmTrust, type SwarmWikiPort,
} from "@lararium/mesh";
import type { CustodyHolder } from "../src/custody-holder.js";
import { kukuluGate, vouchKeyOf } from "../src/kukulu-gate.js";
import { kukuluRiteOver } from "../src/kukulu-lei-seat.js";
import { KUKULU_OFFER_FILE, consumeKukuluOffer, writeKukuluOffer, type KukuluOffer } from "../src/kukulu-offer.js";
import { generateOrLoadPersonaGroupRoot, loadPersonaGroupRootVerifyingKey } from "../src/node-vessel-identity.js";
import { personaGroupDigest } from "../src/persona-group-file.js";
import { pulamaStandBy, readKukuluOffer } from "../src/pulama-seat.js";
import { pulamaRecords } from "../src/pulama-state.js";
import { wardRootSigner } from "../src/ward-signer.js";
import { fixtureWard } from "./custody-seat-fixture.js";
import { fixtureRoute, fixtureSlots, standPulama, type PulamaFixture } from "./pulama-fixture.js";

vi.setConfig({ testTimeout: 180_000 });

const GROUP = "group-offer";
const BRANCH = "main";
const HEAD = "a".repeat(40);
const TREE = "b".repeat(40);
const IMAGE = "sha256:" + "ab".repeat(32);
const NO_COSIGN = { accepts: () => true };

let fx: PulamaFixture | null = null;
const dirs: string[] = [];
afterEach(async () => { await fx?.drop(); fx = null; for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

/** The standing vessel's control records, in memory: where its lei, its receipts and its unstringings rest. */
function controlWiki(): SwarmWikiPort {
  const rows = new Map<string, string>();
  return {
    read: async (t) => rows.get(t) ?? null, write: async (t, text) => { rows.set(t, text); },
    writeNew: async (t, text) => { if (rows.has(t)) return false; rows.set(t, text); return true; },
    list: async (prefix) => [...rows.keys()].filter((t) => t.startsWith(prefix)),
  };
}

async function stand() {
  const dir = mkdtempSync(join(tmpdir(), "lar-kukulu-offer-"));
  dirs.push(dir);
  const path = join(dir, "config", KUKULU_OFFER_FILE);
  let raised: string | null = IMAGE;
  fx = await standPulama("kukulu-offer", (kept: CustodyHolder) => kukuluGate({
    holder: kept, hand: (ordinal) => loadPersonaGroupRootVerifyingKey(ordinal), rite: kukuluRiteOver(pulamaRecords(join(dir, "pulama-state"))), image: () => raised,
  }));
  await fx.kept.foundFace({ group: personaGroupDigest(GROUP), ordinal: 0, slots: fixtureSlots });
  expect((await fx.local.unlockFace({ ordinal: 0 }, fixtureRoute)).reading).toBe("opens");
  const root = await generateOrLoadPersonaGroupRoot(0, fixtureWard());
  const hand: SwarmSignerPort = { key: root.verifyingKey, sign: async (bytes) => (await wardRootSigner(0, fixtureWard(), "a swarm control")).sign(bytes) };
  // THE STANDING VESSEL'S OWN WITNESS: its device atom signs the receipts in its control records.
  const seed = new Uint8Array(32).fill(4);
  const atom: SwarmSignerPort = { key: await ed25519VerifyingKeyFromSeed(seed), sign: ed25519SignerFromSeed(seed) };
  const trust: SwarmTrust = { hand: (k) => k === root.verifyingKey, vessel: (k) => k === atom.key, lead: () => false };
  const wiki = controlWiki();
  const string = async (terms: SwarmLeiTerms, after: string | null = null): Promise<SignedSwarmAct> => {
    const lei = await signSwarmAct({ act: "lei", group: GROUP, rite: "kukulu", branch: BRANCH, after, ...terms }, hand);
    await wiki.write(swarmLeiRecordTitle("kukulu", BRANCH, swarmActCid(lei)), JSON.stringify(lei));
    return lei;
  };
  const receipt = (verdict: "pass" | "fail") => restReceipt(wiki, { tree: TREE, checks: ["typecheck", "mesh"], verdict, definitions: "d".repeat(64) }, trust, GROUP, atom);
  const offer = (image = IMAGE) => writeKukuluOffer({ wiki, faces: [{ group: GROUP, trust, ward: NO_COSIGN }], branch: BRANCH, head: HEAD, tree: TREE, image, holder: fx!.local, path });
  const hello = async (offered: unknown): Promise<string> => {
    try { return (await fx!.vessel(offered).unlock([])).reading; }
    catch (err) { return (err as { reading?: string }).reading ?? String(err); }
  };
  return { fx, path, wiki, hand, string, receipt, offer, hello, raise: (d: string | null) => { raised = d; } };
}

describe("RED kukulu-offer-reaches-the-new-vessel", () => {
  test("the standing vessel's offer file carries the line's lei and its vouch; the next vessel reads it, the pūlama serves it, and the file goes after that one session", async () => {
    const s = await stand();
    const first = await s.string({ reach: "wide", returns: 1 });
    const lei = await s.string({ reach: "wide", returns: 3 }, swarmActCid(first));
    await s.receipt("pass");
    const wrote = await s.offer();
    expect(wrote).toMatchObject({ path: s.path, lei: 2, verdict: "pass" });
    expect(statSync(s.path).mode & 0o777).toBe(0o600);

    // THE FILE: the whole line, and a vouch this vessel's custody root signed over the image the host named.
    const file = JSON.parse(readFileSync(s.path, "utf8")) as KukuluOffer;
    expect(file.lei.map((l) => swarmActCid(l)).sort()).toEqual([swarmActCid(first), swarmActCid(lei)].sort());
    expect(file.unstrung).toEqual([]);
    // ONE VOUCH PER LENT FACE, each naming its own face's group.
    expect(file.vouch).toHaveLength(1);
    const vouched = verifyKukuluVouch(file.vouch[0], await vouchKeyOf(s.fx.kept));
    expect(vouched).toMatchObject({ ok: true, digest: wrote.vouch[0] });
    expect(file.vouch[0]!.body).toMatchObject({ group: GROUP, branch: BRANCH, head: HEAD, tree: TREE, image: IMAGE, verdict: "pass" });
    expect(kukuluVouchDigest(file.vouch[0]!)).toBe(wrote.vouch[0]);
    // Nothing secret rests in the file: no route, no key the holder holds.
    expect(readFileSync(s.path, "utf8")).not.toContain(Buffer.from(s.fx.treeKey).toString("hex"));

    // THE NEW VESSEL wakes holding nothing, reads the file its environment names, and stands by the pūlama.
    const composed: boolean[] = [], lines: string[] = [];
    const vessel = s.fx.vessel(readKukuluOffer(s.path));
    const by = pulamaStandBy({
      holder: vessel, recompose: async (sovereign) => { composed.push(sovereign); return { standing: sovereign ? "hearth" : "floor" }; },
      onLog: (l) => lines.push(l), consumeOffer: () => consumeKukuluOffer(s.path),
    });
    expect(await by.dial()).toEqual({ session: true, waits: null });
    expect(composed).toEqual([true]);
    expect(lines.join("\n")).toMatch(/the tessera reads par/);
    // ONE KŪKULU, ONE OFFER: the file left with the session, so a plain restart afterwards wears nothing.
    expect(existsSync(s.path)).toBe(false);
    expect(readKukuluOffer(s.path)).toEqual({});
    expect(await s.hello(readKukuluOffer(s.path))).toBe("pulama-image-unadmitted");
    // CONTROL: the lei still holds returns; a fresh rite writes a fresh offer, and that one serves.
    await s.offer();
    expect(await s.hello(readKukuluOffer(s.path))).toBe("opens");
  });

  test("a later offer supersedes the last; an unstringing rides the offer; a hello the pūlama refuses leaves the file for the next dial", async () => {
    const s = await stand();
    const lei = await s.string({ reach: "wide", returns: 2 });
    await s.receipt("pass");
    const one = await s.offer();
    const two = await s.offer("sha256:" + "cd".repeat(32));
    expect(two.vouch).not.toEqual(one.vouch);
    expect((JSON.parse(readFileSync(s.path, "utf8")) as KukuluOffer).vouch[0]!.body.image).toBe("sha256:" + "cd".repeat(32));
    // The host raises another image than the newest offer names: the pūlama refuses, and the file stays.
    const vessel = s.fx.vessel(readKukuluOffer(s.path));
    const by = pulamaStandBy({ holder: vessel, recompose: async () => ({ standing: "floor" }), onLog: () => {}, consumeOffer: () => consumeKukuluOffer(s.path) });
    expect(await by.dial()).toEqual({ session: false, waits: "kukulu-image-mismatch" });
    expect(existsSync(s.path)).toBe(true);
    // The host's report moves to the image the offer names: the SAME vessel dials again with the same file and stands.
    s.raise("sha256:" + "cd".repeat(32));
    expect(await by.dial()).toEqual({ session: true, waits: null });
    expect(existsSync(s.path)).toBe(false);

    // THE HAND UNSTRINGS the lei in the vessel's records: the next offer carries the unstringing, and the pūlama serves nothing.
    const unstrung = await signSwarmAct({ act: "lei-unstrung", group: GROUP, rite: "kukulu", branch: BRANCH, lei: swarmActCid(lei) }, s.hand);
    await s.wiki.write(swarmLeiUnstrungTitle(swarmActCid(lei)), JSON.stringify(unstrung));
    await s.offer("sha256:" + "cd".repeat(32));
    expect((JSON.parse(readFileSync(s.path, "utf8")) as KukuluOffer).unstrung).toHaveLength(1);
    expect(await s.hello(readKukuluOffer(s.path))).toBe("swarm-lei-unstrung");
  });

  test("an offer with no lei, no receipt or no image digest writes nothing; a red receipt rides the vouch and the pūlama refuses it", async () => {
    const s = await stand();
    await expect(s.offer()).rejects.toMatchObject({ code: "swarm-lei-absent" });
    await s.string({ reach: "wide", returns: 2 });
    await expect(s.offer()).rejects.toMatchObject({ code: "rite-offer-testimony-absent" });
    await s.receipt("fail");
    await expect(s.offer("lares-surface:local")).rejects.toMatchObject({ code: "rite-offer-malformed" });
    expect(existsSync(s.path)).toBe(false);
    expect((await s.offer()).verdict).toBe("fail");
    expect(await s.hello(readKukuluOffer(s.path))).toBe("swarm-lei-testimony-red");
    expect(consumeKukuluOffer(s.path)).toBe(true);
    expect(consumeKukuluOffer(s.path)).toBe(false);
    expect(consumeKukuluOffer(undefined)).toBe(false);
  });
});
