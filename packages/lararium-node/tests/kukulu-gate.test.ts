/**
 * kukulu-gate — the pūlama serves a kūkulu only beside a strung lei and a vouch, over the swarm's own lei family: the lei the
 * face's hand strung under its ward, the family's reader and return in the pūlama's record store, and the tessera's two halves.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  conferre, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, kukuluVouchDigest, signKukuluVouch, signSwarmAct, swarmActCid, swarmLeiNarrowedTitle,
  swarmLeiReturnedPrefix, swarmLeiRowTitle, swarmReceiptTitle, swarmTesseraPrefix, verifySwarmRecord,
  type KukuluVouchParts, type SignedKukuluVouch, type SignedSwarmAct, type SwarmLeiTerms, type SwarmSignerPort, type SwarmTrust, type SwarmWikiPort,
} from "@lararium/mesh";
import type { CustodyHolder } from "../src/custody-holder.js";
import { KUKULU_COLD_READS, kukuluGate, pulamaSignerOf, vouchSignerOf } from "../src/kukulu-gate.js";
import { KUKULU_VOUCH_CHECK, kukuluRiteOver } from "../src/kukulu-lei-seat.js";
import { generateOrLoadPersonaGroupRoot, loadPersonaGroupRootVerifyingKey } from "../src/node-vessel-identity.js";
import { personaGroupDigest } from "../src/persona-group-file.js";
import { pulamaRecords } from "../src/pulama-state.js";
import { wardRootSigner } from "../src/ward-signer.js";
import { fixtureWard } from "./custody-seat-fixture.js";
import { fixtureRoute, fixtureSlots, standPulama, type PulamaFixture } from "./pulama-fixture.js";

vi.setConfig({ testTimeout: 180_000 });

const GROUP = "group-kukulu";
const BRANCH = "feature/kukulu";
const HEAD = "a".repeat(40);
const TREE = "b".repeat(40);
const IMAGE = "sha256:" + "ab".repeat(32);
const HOT = ".persona-admissions.json";

let fx: PulamaFixture | null = null;
const dirs: string[] = [];
afterEach(async () => { await fx?.drop(); fx = null; for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

async function stand() {
  const dir = mkdtempSync(join(tmpdir(), "lar-kukulu-records-"));
  dirs.push(dir);
  const records: SwarmWikiPort = pulamaRecords(dir);
  let raised: string | null = IMAGE;
  fx = await standPulama("kukulu-gate", (kept: CustodyHolder) => kukuluGate({
    // The product's own reading of the hand: the face's root key, off its roster row, through the seated holder.
    holder: kept, hand: (ordinal) => loadPersonaGroupRootVerifyingKey(ordinal), rite: kukuluRiteOver(records), image: () => raised,
  }));
  const face = await fx.kept.foundFace({ group: personaGroupDigest(GROUP), ordinal: 0, slots: fixtureSlots });
  // The vessel's own holder opens the face and founds its root under the ward, as a founding does.
  expect((await fx.local.unlockFace({ ordinal: 0 }, fixtureRoute)).reading).toBe("opens");
  const root = await generateOrLoadPersonaGroupRoot(0, fixtureWard());
  // THE HAND strings a lei as the swarm door does: the root signs once, opened fresh under the ward's route.
  const hand: SwarmSignerPort = { key: root.verifyingKey, sign: async (bytes) => (await wardRootSigner(0, fixtureWard(), "a swarm control")).sign(bytes) };
  const string = (terms: SwarmLeiTerms, more: { after?: string | null; branch?: string; signer?: SwarmSignerPort } = {}): Promise<SignedSwarmAct> =>
    signSwarmAct({ act: "lei", group: GROUP, rite: "kukulu", branch: more.branch ?? BRANCH, after: more.after ?? null, ...terms }, more.signer ?? hand);
  // THE STANDING VESSEL vouches under the custody root's vouch child, which its in-process holder derives as the pūlama does.
  const vouch = async (parts: Partial<KukuluVouchParts> = {}): Promise<SignedKukuluVouch> =>
    signKukuluVouch({ group: GROUP, branch: BRANCH, head: HEAD, tree: TREE, image: IMAGE, verdict: "pass", receipt: null, ...parts }, await vouchSignerOf(fx!.local));
  const hello = async (offer: unknown): Promise<string> => {
    try { return (await fx!.vessel(offer).unlock([])).reading; }
    catch (err) { return (err as { reading?: string }).reading ?? String(err); }
  };
  const pulamaKey = (await pulamaSignerOf(fx.kept)).key;
  const trust: SwarmTrust = { hand: (k) => k === root.verifyingKey, vessel: (k) => k === pulamaKey, lead: () => false };
  const returns = async (lei: SignedSwarmAct): Promise<number> => (await records.list(swarmLeiReturnedPrefix(swarmActCid(lei)))).length;
  return { fx, face, records, string, vouch, hello, hand, trust, pulamaKey, returns, raise: (digest: string | null) => { raised = digest; } };
}

describe("RED pulama-serves-a-strung-vouched-kukulu", () => {
  test("a wide kukulu lei the hand strung, beside a vouch at the image the host raises, opens a session; its return and both tessera halves rest under the pūlama's key", async () => {
    const s = await stand();
    const lei = await s.string({ reach: "wide", returns: 2 });
    const v = await s.vouch();
    const cid = swarmActCid(lei);
    const vessel = s.fx.vessel({ lei, vouch: v });
    expect((await vessel.unlock([])).reading).toBe("opens");
    expect(vessel.wears()).toBe(0);
    await vessel.writeRow("identity", HOT, Uint8Array.from([1]));
    expect(await vessel.readRow("identity", HOT)).toEqual({ reading: "opens", plaintext: Uint8Array.from([1]) });
    expect(KUKULU_COLD_READS).toEqual(["face-proof-key", "intent-relay-key"]);
    await expect(vessel.updateColdRow("identity", "intent-relay-key.bin", () => ({ plaintext: new Uint8Array(32), value: null }))).rejects.toMatchObject({ reading: "needs-the-human" });

    // The offered lei landed at the family's own title and reads there as the hand's.
    const leiTitle = swarmLeiRowTitle("kukulu", BRANCH, cid);
    expect(verifySwarmRecord(await s.records.read(leiTitle), leiTitle, s.trust, GROUP)).toMatchObject({ ok: true, cid });
    // THE RETURN, the receipt and the guest half each carry the pūlama's own key: no key a vessel holds signed them.
    const returned = JSON.parse((await s.records.read(`${swarmLeiReturnedPrefix(cid)}1`))!) as SignedSwarmAct;
    expect(returned.signer).toBe(s.pulamaKey);
    expect(returned.body).toMatchObject({ act: "lei-returned", lei: cid, n: 1, head: HEAD, tree: TREE, branch: BRANCH });
    const receipt = JSON.parse((await s.records.read(swarmReceiptTitle(TREE)))!) as SignedSwarmAct;
    expect(receipt.signer).toBe(s.pulamaKey);
    expect(receipt.body).toMatchObject({ act: "receipt", verdict: "pass", checks: [KUKULU_VOUCH_CHECK], definitions: kukuluVouchDigest(v) });
    expect((await vouchSignerOf(s.fx.kept)).key).not.toBe(s.pulamaKey);

    // CONFERRE before the vessel composed: the guest half stands alone and reads red. After `landRite`, the pair reads par.
    expect(await conferre(s.records, s.trust, GROUP)).toMatchObject({ par: [], red: [{ rite: "kukulu", red: "landed-absent" }] });
    expect(await vessel.landRite()).toEqual({ par: true });
    const matched = await conferre(s.records, s.trust, GROUP);
    expect(matched.red).toEqual([]);
    expect(matched.par).toHaveLength(1);
    expect((await s.records.list(swarmTesseraPrefix())).map((t) => t.split("/").pop()).sort()).toEqual(["guest", "host"]);
    // A landing rests once.
    await expect(vessel.landRite()).rejects.toMatchObject({ name: "SwarmRefused" });

    // THE COUNT: the wide lei holds two returns. A second kūkulu spends the last; a third finds none.
    expect(await s.hello({ lei, vouch: v })).toBe("opens");
    expect(await s.returns(lei)).toBe(2);
    expect(await s.hello({ lei, vouch: v })).toBe("swarm-lei-returns-spent");
    expect(await s.returns(lei)).toBe(2);
    expect(s.fx.server.sessions()).toBe(2);
  });

  test("a head lei serves the head its vouch names, once; a session with no rite begun lands nothing", async () => {
    const s = await stand();
    const lei = await s.string({ reach: "head", head: HEAD });
    expect(await s.hello({ lei, vouch: await s.vouch() })).toBe("opens");
    expect(await s.returns(lei)).toBe(1);
    // CONTROL: the lei pins its head. A vouch walked at another head never spends it.
    const other = await s.string({ reach: "head", head: "c".repeat(40) }, { after: swarmActCid(lei) });
    expect(await s.hello({ lei: [lei, other], vouch: await s.vouch() })).toBe("swarm-lei-head-mismatch");
    expect(await s.returns(other)).toBe(0);
  });
});

describe("RED pulama-refuses-an-unvouched-kukulu", () => {
  test("no vouch, a forged vouch, a vouch another key signed, a lei a stranger strung and a lei for another branch each open no session and claim no return", async () => {
    const s = await stand();
    const lei = await s.string({ reach: "wide", returns: 3 });
    const v = await s.vouch();
    expect(await s.hello({})).toBe("pulama-image-unadmitted");
    expect(await s.hello({ lei })).toBe("kukulu-unvouched");
    expect(await s.hello({ lei, vouch: { ...v, body: { ...v.body, image: "sha256:" + "cd".repeat(32) } } })).toBe("kukulu-vouch-signature");
    expect(await s.hello({ lei, vouch: "not-a-vouch" })).toBe("kukulu-vouch-shape");
    // A key the custody root never yielded signs a well-formed vouch: the pūlama derives the vouch key itself and refuses it.
    const seed = new Uint8Array(32).fill(7);
    const stranger: SwarmSignerPort = { key: await ed25519VerifyingKeyFromSeed(seed), sign: ed25519SignerFromSeed(seed) };
    expect(await s.hello({ lei, vouch: await signKukuluVouch(v.body, stranger) })).toBe("kukulu-vouch-signer");
    // A vouched hello with no lei, a lei a stranger strung, a lei for another branch, a push lei: none reads as this face's kukulu lei.
    expect(await s.hello({ vouch: v })).toBe("swarm-lei-absent");
    expect(await s.hello({ lei: await s.string({ reach: "wide", returns: 3 }, { signer: stranger }), vouch: v })).toBe("swarm-lei-absent");
    expect(await s.hello({ lei: await s.string({ reach: "wide", returns: 3 }, { branch: "main" }), vouch: v })).toBe("swarm-lei-absent");
    expect(await s.hello({ lei: await signSwarmAct({ act: "lei", group: GROUP, rite: "push", branch: BRANCH, after: null, reach: "wide", returns: 3 }, s.hand), vouch: v })).toBe("swarm-lei-absent");
    expect(await s.hello({ lei: { body: "junk" }, vouch: v })).toBe("swarm-lei-absent");
    // THE HOST REPORTS THE IMAGE: none reported, or another than the vouch walked, refuses before the lei reads.
    s.raise(null);
    expect(await s.hello({ lei, vouch: v })).toBe("kukulu-image-unreported");
    s.raise("sha256:" + "ee".repeat(32));
    expect(await s.hello({ lei, vouch: v })).toBe("kukulu-image-mismatch");
    // A locked face and an unlit pūlama refuse too.
    s.raise(IMAGE);
    await s.fx.kept.lockFace(s.face.fcid);
    expect(await s.hello({ lei, vouch: v })).toBe("kukulu-face-locked");
    expect(await s.returns(lei)).toBe(0);
    expect(await s.records.list(swarmTesseraPrefix())).toEqual([]);
    expect(s.fx.server.sessions()).toBe(0);
    await s.fx.server.lock();
    expect(await s.hello({ lei, vouch: v })).toBe("pulama-locked");
  });

  test("a red walk refuses and narrows a wide lei; CONTROL: a fresh lei restrings the line and a passing vouch then serves", async () => {
    const s = await stand();
    const lei = await s.string({ reach: "wide", returns: 3 });
    expect(await s.hello({ lei, vouch: await s.vouch({ verdict: "fail" }) })).toBe("swarm-lei-testimony-red");
    expect(await s.returns(lei)).toBe(0);
    expect(await s.records.read(swarmLeiNarrowedTitle(swarmActCid(lei)))).not.toBeNull();
    // The narrowed lei spends nothing, even beside a passing vouch.
    expect(await s.hello({ lei, vouch: await s.vouch() })).toBe("swarm-lei-narrowed");
    const fresh = await s.string({ reach: "wide", returns: 1 }, { after: swarmActCid(lei) });
    expect(await s.hello({ lei: [lei, fresh], vouch: await s.vouch() })).toBe("opens");
    expect(await s.returns(fresh)).toBe(1);
  });
});

describe("each hello returns under its own vouch's verdict", () => {
  test("RED: a red vouch and a passing vouch for one tree, offered at once, never trade verdicts: the red one opens no session in either order", async () => {
    const s = await stand();
    let after: string | null = null;
    for (const order of [["fail", "pass"], ["pass", "fail"]] as const) {
      const lei: SignedSwarmAct = await s.string({ reach: "head", head: HEAD }, { after });
      after = swarmActCid(lei);
      const vouches = { fail: await s.vouch({ verdict: "fail" }), pass: await s.vouch() };
      const [first, second] = await Promise.all(order.map((verdict) => s.hello({ lei, vouch: vouches[verdict] })));
      const read = { [order[0]]: first, [order[1]]: second } as Record<"fail" | "pass", string>;
      // The red hello meets its own red receipt, or, where the passing one went first, a lei already returned: never a session.
      expect(read.fail, order.join(" then ")).toBe(order[0] === "fail" ? "swarm-lei-testimony-red" : "swarm-lei-returned");
      expect(read.pass, order.join(" then ")).toBe("opens");
      expect(await s.returns(lei)).toBe(1);
    }
  });
});

describe("RED pulama-refuses-a-returned-lei", () => {
  test("a head lei returned once serves no second kūkulu; an unstrung lei serves none; CONTROL: the lei served the first", async () => {
    const s = await stand();
    const lei = await s.string({ reach: "head", head: HEAD });
    const v = await s.vouch();
    expect(await s.hello({ lei, vouch: v })).toBe("opens");
    expect(await s.hello({ lei, vouch: v })).toBe("swarm-lei-returned");
    expect(await s.hello({ lei, vouch: await s.vouch({ tree: "d".repeat(40) }) })).toBe("swarm-lei-returned");
    expect(await s.returns(lei)).toBe(1);
    expect(s.fx.server.sessions()).toBe(1);
    // A vessel that offers nothing still meets the return the pūlama's own records hold.
    expect(await s.hello({ vouch: v })).toBe("swarm-lei-returned");

    // THE HAND UNSTRINGS a lei that still holds returns: the offered unstringing lands, and the lei serves nothing after.
    const wide = await s.string({ reach: "wide", returns: 5 }, { after: swarmActCid(lei) });
    expect(await s.hello({ lei: wide, vouch: v })).toBe("opens");
    const unstrung = await signSwarmAct({ act: "lei-unstrung", group: GROUP, rite: "kukulu", branch: BRANCH, lei: swarmActCid(wide) }, s.hand);
    expect(await s.hello({ lei: wide, unstrung, vouch: v })).toBe("swarm-lei-unstrung");
    expect(await s.hello({ lei: wide, vouch: v })).toBe("swarm-lei-unstrung");
    expect(await s.returns(wide)).toBe(1);
    // An unstringing a stranger signed lands nowhere: only the hand ends its own lei.
    const next = await s.string({ reach: "wide", returns: 2 }, { after: swarmActCid(wide) });
    const seed = new Uint8Array(32).fill(9);
    const forged = await signSwarmAct({ act: "lei-unstrung", group: GROUP, rite: "kukulu", branch: BRANCH, lei: swarmActCid(next) }, { key: await ed25519VerifyingKeyFromSeed(seed), sign: ed25519SignerFromSeed(seed) });
    expect(await s.hello({ lei: next, unstrung: forged, vouch: v })).toBe("opens");
  });
});
