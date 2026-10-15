/**
 * nexus-kapae-two-vault — a kapae or un_kapae of a two-founder Nexus crosses its two vaults as a PARTIAL, judged
 * before every signature and again right before the write, and lands on each vault's own antigen board once both
 * seats signed. Each vault stands under its own scratch root, custody and Repo; the joint Nexus founds through the
 * cofound door, and every file crosses as JSON text.
 *
 *   K1  A opens a kapae (A's seat signs); B judges it `ready`, cosigns and lands it (`complete`); A lands the
 *       completed partial too. Both boards fold the nym Kapae'd, and neither vault ever held the other's seat.
 *   K2  RED: nothing signs or lands where the judge refuses: the same act again (`replay`), a lift A opened before
 *       its own board held the ban (`stale`), a partial under another Nexus, a torn file, an admit partial, a
 *       partial its own vault cannot advance, a lift carried where the person named a ban; the board B holds keeps
 *       its count through every refusal.
 *   K3  RED: the board moves while B's seat signs (a handshake inside the signer lands the ban first): the lift B
 *       just cosigned reads stale against the board as it stands after the signature, and nothing lands.
 *   K4  RED: the board moves while A's seat signs an open: the lift A signed reads stale on A's own judge, and no
 *       partial leaves. CONTROL: opened again, it cites the ban and reads ready.
 *   K5  The store door's rows carry the same act, and a refusal answers under the row's own name.
 */
import { afterEach, describe, expect, test, vi } from "vitest";

/** A handshake inside every seat signature: a vector may run one step before the next signature completes. */
const signing = vi.hoisted(() => ({ calls: 0, before: null as null | (() => Promise<void>) }));
vi.mock("../src/seat-key-store.js", async (importOriginal) => {
  const real = await importOriginal<typeof import("../src/seat-key-store.js")>();
  return {
    ...real,
    signAsSeat: async (key: string, image: Uint8Array): Promise<Uint8Array> => {
      signing.calls += 1;
      const before = signing.before;
      signing.before = null;
      if (before) await before();
      return real.signAsSeat(key, image);
    },
  };
});
import { mintColdKey, seatFingerprint, cidV1Sha256, foundingRoster, kapaeAntigenDocUrl, materializeSharedLarDoc,
  antigenEntriesFromBoard, foldAntigenSet, isKapaed, makeMultiSigQuorumVerifier, type CofoundOffer } from "@lararium/mesh";
import { charterHomeFor } from "../src/carried-set.js";
import { NexusKapaeError, runNexusKapaeList, runNexusKapaeOpen, runNexusKapaePartial } from "../src/commands/nexus-kapae.js";
import { runNexusContractOpen } from "../src/commands/nexus-contract.js";
import { readNexusDoc } from "../src/nexus-doc.js";
import { generateOrLoadPersonaGroupRoot, generateOrLoadVesselIdentity, loadVesselVerifyingKey } from "../src/node-vessel-identity.js";
import { mintNexusLeaf } from "../src/nexus-leaf.js";
import { nodeNexusIsland } from "../src/nexus-standing.js";
import { runSealedAct, type SealedActContext } from "../src/sealed-acts.js";
import { storeDoorReactors } from "../src/store-door-verbs.js";
import { heldSeatKey } from "../src/seat-key-store.js";
import { larDataDir, larSealHome } from "../src/vessel-paths.js";
import { seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";
import { restEvery, restingRepo, type RestingRepo } from "./resting-repo.js";

vi.setConfig({ testTimeout: 180_000, hookTimeout: 180_000 });

const ctx: SealedActContext = { kelHead: null, personaSelves: null, walk: null, hosting: null, backup: null };
const drops: SeatedScratchCustody[] = [];
afterEach(async () => {
  await restEvery();
  for (const c of drops.splice(0).reverse()) await c.drop();
});

const VICTIM = "beadfeed".repeat(8);
const cidOf = (text: string): string => cidV1Sha256(new TextEncoder().encode(text));
const MANIFEST = { image: `sha256:${"ab".repeat(32)}`, genesis: cidOf("genesis"), engine: cidOf("engine"), grammar: cidOf("grammar") };
const LAW = "lar:///ha.ka.ba/lararium/mesh/kahu#/seed-and-nexus";
const courier = <T>(v: T): Record<string, unknown> => JSON.parse(JSON.stringify(v)) as Record<string, unknown>;
const act = (name: string, args: Record<string, unknown>) => runSealedAct(name, args, ctx);
const nextDigest = async (): Promise<string> => { const k = await mintColdKey(); k.seed.fill(0); return k.digest; };

interface Vault { readonly c: SeatedScratchCustody; readonly repo: RestingRepo }
async function vault(label: string): Promise<Vault> {
  const c = await seatScratchCustody(label);
  drops.push(c);
  await generateOrLoadVesselIdentity();
  await generateOrLoadPersonaGroupRoot(0);
  return { c, repo: restingRepo(larDataDir()) };
}
const at = (v: Vault): void => { process.env["LAR_ROOT"] = v.c.root; };

/** Found one joint Nexus across A and B through the cofound door; answers its AID and both seats. */
async function jointNexus(A: Vault, B: Vault): Promise<{ aid: string; aSeat: string; bSeat: string }> {
  at(A);
  const opened = await act("cofound.open", { face: 0, next: await nextDigest(), charterLaw: LAW, manifest: MANIFEST }) as { offer: CofoundOffer };
  at(B);
  const joined = await act("cofound.join", { face: 0, offer: courier(opened.offer), heard: seatFingerprint(opened.offer.seat), next: await nextDigest() }) as { join: { seat: string } };
  at(A);
  const sealed = await act("cofound.seal", { join: courier(joined.join), heard: seatFingerprint(joined.join.seat) }) as { inception: unknown; charter: { aid: string } };
  at(B);
  await act("cofound.accept", { inception: courier(sealed.inception) });
  return { aid: sealed.charter.aid, aSeat: opened.offer.seat, bSeat: joined.join.seat };
}

/** This vault's own antigen board for the joint Nexus: how many entries it holds, and whether it folds `nym` Kapae'd. */
async function antigenHere(v: Vault, aid: string, nym = VICTIM): Promise<{ count: number; kapaed: boolean }> {
  at(v);
  const home = charterHomeFor(larSealHome(), aid)!;
  const roster = foundingRoster(readNexusDoc(home));
  const handle = await materializeSharedLarDoc(v.repo, kapaeAntigenDocUrl(nodeNexusIsland({ ownVesselKey: await loadVesselVerifyingKey(), sealHome: home })), "board:kapae-antigen");
  const entries = antigenEntriesFromBoard(handle.doc());
  return { count: entries.length, kapaed: isKapaed(nym, await foldAntigenSet(entries, roster, makeMultiSigQuorumVerifier())) };
}

const refusal = async (run: Promise<unknown>): Promise<string> =>
  run.then(() => "ran", (e: unknown) => (e instanceof NexusKapaeError ? e.message : `${(e as Error).constructor.name}: ${(e as Error).message}`));

describe("a two-founder Nexus raises and lifts a kapae across its two vaults", () => {
  test("K1 — A opens a kapae, B judges, cosigns and lands it, A lands the completed act", async () => {
    const A = await vault("kap-a"), B = await vault("kap-b");
    const { aid, aSeat, bSeat } = await jointNexus(A, B);
    at(A);
    expect(heldSeatKey(bSeat)).toBeNull();
    const opened = await runNexusKapaeOpen({ action: "kapae", nym: VICTIM, sealHome: larSealHome(), repo: A.repo, aid });
    expect(opened.verdict).toBe("ready");
    expect(opened.signed).toEqual([aSeat]);
    expect(opened.landed).toBeNull();
    expect(opened.partial.act.family).toBe("kapae");
    expect(await antigenHere(A, aid)).toEqual({ count: 0, kapaed: false });

    at(B);
    expect(heldSeatKey(aSeat)).toBeNull();
    const cosigned = await runNexusKapaePartial({ partial: courier(opened.partial), sealHome: larSealHome(), repo: B.repo });
    expect(cosigned.verdict).toBe("complete");
    expect(cosigned.signed).toEqual([aSeat, bSeat].sort());
    expect(cosigned.landed?.kapaedNow).toBe(true);
    expect(cosigned.landed?.signers).toEqual([aSeat, bSeat].sort());
    expect(await antigenHere(B, aid)).toEqual({ count: 1, kapaed: true });

    at(A);
    const landed = await runNexusKapaePartial({ partial: courier(cosigned.partial), sealHome: larSealHome(), repo: A.repo });
    expect(landed.verdict).toBe("complete");
    expect(landed.landed?.actCid).toBe(cosigned.landed?.actCid);
    expect(await antigenHere(A, aid)).toEqual({ count: 1, kapaed: true });
    // The list reads the same joint board by its AID.
    at(A);
    expect((await runNexusKapaeList({ sealHome: larSealHome(), repo: A.repo, aid })).kapaed).toEqual([VICTIM]);
  });

  test("K2 — nothing signs or lands where the judge refuses", async () => {
    const A = await vault("kap-ra"), B = await vault("kap-rb");
    const { aid } = await jointNexus(A, B);
    at(A);
    const opened = await runNexusKapaeOpen({ action: "kapae", nym: VICTIM, sealHome: larSealHome(), repo: A.repo, aid });
    // A holds one seat of two: its own partial waits on B's, and A's door says so rather than signing twice.
    expect(await refusal(runNexusKapaePartial({ partial: courier(opened.partial), sealHome: larSealHome(), repo: A.repo }))).toMatch(/waits on a seat this vessel does not hold/);
    // A lift A opens now cites A's board, where the ban has not landed.
    const lift = await runNexusKapaeOpen({ action: "un_kapae", nym: VICTIM, sealHome: larSealHome(), repo: A.repo, aid });
    // An admit partial reads well at its own family, and the kapae door still takes it as no kapae partial.
    const leaf = await mintNexusLeaf(0, aid);
    const admit = await runNexusContractOpen({ action: "admit", nym: leaf.verifyingKey, sealHome: larSealHome(), repo: A.repo, aid });

    at(B);
    const cosigned = await runNexusKapaePartial({ partial: courier(opened.partial), sealHome: larSealHome(), repo: B.repo });
    expect(cosigned.verdict).toBe("complete");
    const before = signing.calls;
    at(B);
    expect(await refusal(runNexusKapaePartial({ partial: courier(opened.partial), sealHome: larSealHome(), repo: B.repo }))).toMatch(/reads replay/);
    expect(await refusal(runNexusKapaePartial({ partial: courier(cosigned.partial), sealHome: larSealHome(), repo: B.repo }))).toMatch(/reads replay/);
    // The lift A opened before its board held the ban names a line B's board moved past: stale, and the ban stands.
    expect(await refusal(runNexusKapaePartial({ partial: courier(lift.partial), sealHome: larSealHome(), repo: B.repo }))).toMatch(/reads stale/);
    const foreign = { ...courier(opened.partial), aid: `nexus-${"cd".repeat(32)}` };
    expect(await refusal(runNexusKapaePartial({ partial: foreign, sealHome: larSealHome(), repo: B.repo }))).toMatch(/holds no charter/);
    expect(await refusal(runNexusKapaePartial({ partial: { ...courier(opened.partial), extra: 1 }, sealHome: larSealHome(), repo: B.repo }))).toMatch(/reads as no kapae partial/);
    expect(await refusal(runNexusKapaePartial({ partial: courier(admit.partial), sealHome: larSealHome(), repo: B.repo }))).toMatch(/reads as no kapae partial/);
    // The person named a lift and carried a ban: refused before any judge.
    expect(await refusal(runNexusKapaePartial({ partial: courier(lift.partial), action: "kapae", sealHome: larSealHome(), repo: B.repo }))).toMatch(/carries a un_kapae, and you named a kapae/);
    expect(signing.calls).toBe(before);
    expect(await antigenHere(B, aid)).toEqual({ count: 1, kapaed: true });
  });

  test("K3 — a board that moves while B's seat signs takes no stale act", async () => {
    const A = await vault("kap-ma"), B = await vault("kap-mb");
    const { aid } = await jointNexus(A, B);
    at(A);
    // Both acts cite A's empty line for the nym.
    const ban = await runNexusKapaeOpen({ action: "kapae", nym: VICTIM, sealHome: larSealHome(), repo: A.repo, aid });
    const lift = await runNexusKapaeOpen({ action: "un_kapae", nym: VICTIM, sealHome: larSealHome(), repo: A.repo, aid });
    at(B);
    // HANDSHAKE: B's seat signs the lift only after the ban lands on B's board.
    signing.before = async () => {
      const first = await runNexusKapaePartial({ partial: courier(ban.partial), sealHome: larSealHome(), repo: B.repo });
      expect(first.landed?.kapaedNow).toBe(true);
    };
    expect(await refusal(runNexusKapaePartial({ partial: courier(lift.partial), sealHome: larSealHome(), repo: B.repo }))).toMatch(/reads stale on this vessel/);
    expect(signing.before).toBeNull();
    expect(await antigenHere(B, aid)).toEqual({ count: 1, kapaed: true });
  });

  test("K4 — an open whose board moves while its seat signs hands back no stale partial", async () => {
    const A = await vault("kap-oa"), B = await vault("kap-ob");
    const { aid } = await jointNexus(A, B);
    at(A);
    const ban = await runNexusKapaeOpen({ action: "kapae", nym: VICTIM, sealHome: larSealHome(), repo: A.repo, aid });
    at(B);
    const done = await runNexusKapaePartial({ partial: courier(ban.partial), sealHome: larSealHome(), repo: B.repo });
    expect(done.verdict).toBe("complete");
    // HANDSHAKE: A's seat signs the lift only after the completed ban lands on A's board.
    signing.before = async () => {
      const landed = await runNexusKapaePartial({ partial: courier(done.partial), sealHome: larSealHome(), repo: A.repo });
      expect(landed.landed?.kapaedNow).toBe(true);
    };
    at(A);
    expect(await refusal(runNexusKapaeOpen({ action: "un_kapae", nym: VICTIM, sealHome: larSealHome(), repo: A.repo, aid }))).toMatch(/the partial this vessel signed reads stale here/);
    expect(signing.before).toBeNull();
    // CONTROL: opened now, the lift cites the ban and reads ready.
    at(A);
    const lift = await runNexusKapaeOpen({ action: "un_kapae", nym: VICTIM, sealHome: larSealHome(), repo: A.repo, aid });
    expect(lift.verdict).toBe("ready");
    expect(lift.partial.act.family === "kapae" && lift.partial.act.entry.parents).toEqual([done.partial.act.family === "kapae" ? done.partial.act.entry.actCid : ""]);
  });

  test("K5 — the store door's rows open, cosign and land the act, and a refusal answers by the row's name", async () => {
    const A = await vault("kap-da"), B = await vault("kap-db");
    const { aid } = await jointNexus(A, B);
    const rows = (v: Vault) => { at(v); return storeDoorReactors({ storageDir: larDataDir(), sealHome: larSealHome(), repo: v.repo }); };
    const opened = await rows(A)["nexus-kapae-open"]({ action: "kapae", nym: VICTIM, aid }, {} as never);
    expect(opened["verdict"]).toBe("ready");
    const cosigned = await rows(B)["nexus-kapae-partial"]({ partial: courier(opened["partial"]) }, {} as never);
    expect(cosigned["verdict"]).toBe("complete");
    expect((cosigned["landed"] as { kapaedNow: boolean }).kapaedNow).toBe(true);
    const again = await rows(B)["nexus-kapae-partial"]({ partial: courier(opened["partial"]) }, {} as never);
    expect(again["refusal"]).toBe("nexus-kapae-partial-refused");
    expect(String(again["refused"])).toMatch(/reads replay/);
    const landed = await rows(A)["nexus-kapae-partial"]({ partial: courier(cosigned["partial"]) }, {} as never);
    expect(landed["verdict"]).toBe("complete");
    expect(await antigenHere(A, aid)).toEqual({ count: 1, kapaed: true });
  });
});
