/**
 * who-face-cap.test.ts — the isomorphic WHO-plane cap, through the real compose engine.
 *
 * Proven: composing whoFaceCap resolves the Nexus's WHO board through crossroads, layers it into the
 * substrate composite (writable, so a relay syncs it), announces NOTHING, and exposes an ingest that
 * recognises what's on the board. This is the vessel-boot unit both node and browser compose.
 */
import { describe, test, expect } from "vitest";
import { Repo, type DocHandle } from "@automerge/automerge-repo";
import * as ed from "@noble/ed25519";
import { composeVessel, type CapModule } from "../src/cap-compose.js";
import { whoFaceCap, WHO_FACE_CAP, type WhoFaceComponent } from "../src/who-face-cap.js";
import { CompositeStore } from "../src/composite-store.js";
import { HandleBook } from "../src/handle-book.js";
import { mintHandleInception, type HandleKelEvent } from "../src/handle-kel.js";
import { signHandleCard, type HandleCard } from "../src/handle-card.js";
import { emptyLarDoc, mutableLarRecord, type LarDoc } from "../src/base-doc.js";
import { nexusHandlesUri } from "../src/lar-uris.js";
import { whoBoardDocUrl } from "../src/deterministic-doc.js";
import { hex } from "../src/crypto.js";

const FASTJACK_SEED = new Uint8Array(32).fill(9);
const NEXUS = "abcdef0123456789";
const signer = (seed: Uint8Array) => (bytes: Uint8Array) => ed.signAsync(bytes, seed).then(hex);
const rawPub = (seed: Uint8Array) => ed.getPublicKeyAsync(seed).then(hex);
const RECOVERY = "ab".repeat(32);
function chainOf(pub: string): HandleKelEvent[] { const d = `0x${pub}`; return [mintHandleInception(d, d, RECOVERY, `hkeynext-${"cd".repeat(32)}`)]; }
/** The identity a recogniser keys on — the handle-KEL PREFIX (the nym retired onto the chain). */
const pubOf  = async (seed: Uint8Array): Promise<string> => chainOf(await rawPub(seed))[0]!.prefix;

async function publish(seed: Uint8Array, glamour: string): Promise<HandleCard> {
  const chain = chainOf(await rawPub(seed));
  return signHandleCard({
    nym: chain[0]!.prefix, chain, glamour, parents: [], standing: null,
  }, signer(seed));
}

/** A minimal substrate cap standing in for the vessel core — only the composite the WHO cap layers into. */
function substrateStub(composite: CompositeStore): CapModule {
  return { id: "substrate", requires: [], build: () => ({ composite }) };
}

describe("whoFaceCap — the isomorphic WHO-plane vessel cap", () => {
  // Binding-the-vessels ⊥ announcing-the-identity: composing the cap must never publish a face. A vessel
  // resolves the board to RECOGNISE peers; disclosure rides a deliberate holder act, never a boot side-effect.
  test("composing publishes NOTHING — announce() is the only way a face lands", { timeout: 15_000 }, async () => {
    const repo = new Repo({ sharePolicy: async () => true });
    const crossroads = repo.create<LarDoc>(emptyLarDoc());
    const composite = new CompositeStore();

    const v = await composeVessel([
      substrateStub(composite),
      whoFaceCap({ repo, crossroadsHandle: crossroads, nexusPubkey: NEXUS }),
    ]);
    const who = v.get<WhoFaceComponent>(WHO_FACE_CAP)!;

    // the board resolved and layered (recognition intact) …
    expect(who.handle.url).toBe(whoBoardDocUrl(NEXUS));
    expect(crossroads.doc()?.tiddlers?.[nexusHandlesUri(NEXUS)]).toBeUndefined();   // the cap writes no pointer
    expect(composite.layerIds).toContain(nexusHandlesUri(NEXUS));

    // … and NOTHING of ours published: an ingest finds no face at all
    const book = new HandleBook();
    await who.ingest(book);
    expect(book.get(await pubOf(FASTJACK_SEED))).toBeUndefined();

    // the deliberate act — and ONLY then does a face land
    who.announce(await publish(FASTJACK_SEED, "FastJack"));
    const after = new HandleBook();
    await who.ingest(after);
    expect(after.get(await pubOf(FASTJACK_SEED))?.card.glamour).toBe("FastJack");

    await v.dispose();
  });

  test("composing it resolves the board and layers it writable; an announced card then reads back", { timeout: 15_000 }, async () => {
    const repo = new Repo({ sharePolicy: async () => true });
    const crossroads = repo.create<LarDoc>(emptyLarDoc());
    const composite = new CompositeStore();

    const v = await composeVessel([
      substrateStub(composite),
      whoFaceCap({ repo, crossroadsHandle: crossroads, nexusPubkey: NEXUS }),
    ]);
    const who = v.get<WhoFaceComponent>(WHO_FACE_CAP)!;
    who.announce(await publish(FASTJACK_SEED, "FastJack"));   // the holder's deliberate act

    // announced: ingesting the board recognises the Handle this holder published
    const book = new HandleBook();
    await who.ingest(book);
    expect(book.get(await pubOf(FASTJACK_SEED))?.card.glamour).toBe("FastJack");

    // the crossroads doc holds no tiddler there; the composite carries the board layer (so a relay syncs it)
    expect(crossroads.doc()?.tiddlers?.[nexusHandlesUri(NEXUS)]).toBeUndefined();
    expect(who.handle.url).toBe(whoBoardDocUrl(NEXUS));
    expect(composite.layerIds).toContain(nexusHandlesUri(NEXUS));

    await v.dispose();
  });

  test("a second vessel on the SAME nexus resolves the SAME board — one shared island board", { timeout: 15_000 }, async () => {
    const repo = new Repo({ sharePolicy: async () => true });
    const crossroads = repo.create<LarDoc>(emptyLarDoc());
    // vessel A composes, then vessel B composes over the SAME crossroads
    const vA = await composeVessel([substrateStub(new CompositeStore()),
      whoFaceCap({ repo, crossroadsHandle: crossroads, nexusPubkey: NEXUS })]);
    const vB = await composeVessel([substrateStub(new CompositeStore()),
      whoFaceCap({ repo, crossroadsHandle: crossroads, nexusPubkey: NEXUS })]);

    const whoA = vA.get<WhoFaceComponent>(WHO_FACE_CAP)!;
    const whoB = vB.get<WhoFaceComponent>(WHO_FACE_CAP)!;
    whoA.announce(await publish(FASTJACK_SEED, "FastJack"));
    whoB.announce(await publish(new Uint8Array(32).fill(22), "Dodger"));
    expect(whoB.handle.url).toBe(whoA.handle.url);   // both resolved the one shared island board

    await vA.dispose(); await vB.dispose();
  });

  // The board's address DERIVES from the Nexus key; a peer-writable crossroads doc cannot redirect it.
  test("a foreign pointer planted on crossroads never redirects the board", { timeout: 15_000 }, async () => {
    const repo = new Repo({ sharePolicy: async () => true });
    const crossroads = repo.create<LarDoc>(emptyLarDoc());
    const foreign = repo.create<LarDoc>(emptyLarDoc());
    crossroads.change((d) => { d.tiddlers[nexusHandlesUri(NEXUS)] = mutableLarRecord(nexusHandlesUri(NEXUS), { text: foreign.url }, "peer"); });
    const v = await composeVessel([substrateStub(new CompositeStore()),
      whoFaceCap({ repo, crossroadsHandle: crossroads, nexusPubkey: NEXUS })]);
    const who = v.get<WhoFaceComponent>(WHO_FACE_CAP)!;
    expect(who.handle.url).toBe(whoBoardDocUrl(NEXUS));
    expect(who.handle.url).not.toBe(foreign.url);
    await v.dispose();
  });

  // CONTROL: two Nexus scopes yield two boards.
  test("two Nexus scopes yield two boards", { timeout: 15_000 }, async () => {
    const repo = new Repo({ sharePolicy: async () => true });
    const crossroads = repo.create<LarDoc>(emptyLarDoc());
    const a = await composeVessel([substrateStub(new CompositeStore()), whoFaceCap({ repo, crossroadsHandle: crossroads, nexusPubkey: "aa11" })]);
    const b = await composeVessel([substrateStub(new CompositeStore()), whoFaceCap({ repo, crossroadsHandle: crossroads, nexusPubkey: "bb22" })]);
    expect(a.get<WhoFaceComponent>(WHO_FACE_CAP)!.handle.url).not.toBe(b.get<WhoFaceComponent>(WHO_FACE_CAP)!.handle.url);
    await a.dispose(); await b.dispose();
  });
});
