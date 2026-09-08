/**
 * veil-born-group — THE GROUP IS BORN UNDER THE VEIL (G1's exit, at ceremony grain).
 *
 * The probe campaign measured the constraints this vector states: a creator cannot leave its roster;
 * any access grade is roster membership; the creator's identifier rides every carried event in
 * CLEARTEXT. So the founding must stand a VEIL-KEYED identity — seed derived from the vessel seed by
 * a minted founding tag, the tag persisted in the daemon doc — and THAT identity creates the
 * PersonaGroup and MeshCabal sentinels. The raw vessel Individual never touches either roster, and
 * every identifier a carrier can grep out of the group's events is a per-group veil.
 */
import { describe, test, expect } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import type { AutomergeUrl } from "@automerge/automerge-repo";
import { runFoundingCeremony, replayCapEvents, KeyhiveProvider, InMemoryEventStore, packPersonaCrossing, applyPersonaCrossing } from "@lararium/keyhive";
import * as ed25519 from "@noble/ed25519";
import {
  hex, hexToBytes, deriveDyadVeil, DYAD_VEIL_TAG_TIDDLER, tiddlerText, vesselDyads,
  type LarDoc,
} from "@lararium/mesh";

const pubOf = async (seed: Uint8Array): Promise<string> => hex(await ed25519.getPublicKeyAsync(seed));
const FOUNDER_SEED = new Uint8Array(32).fill(7);

async function found() {
  const repo = new Repo({ sharePolicy: async () => true });
  const verifyingKey = await pubOf(FOUNDER_SEED);
  const f = await runFoundingCeremony({
    repo,
    vesselSeed:         FOUNDER_SEED,
    vesselVerifyingKey: verifyingKey,
    vesselDisplayName:  "The Strandbeest Shrine",
    binding: { mode: "self-stood", signerSeed: FOUNDER_SEED },
    hearthTrueName:       "",
    nexusPubkey:          verifyingKey,
  });
  const handle = await repo.find(f.daemonUrl as AutomergeUrl);
  return { repo, f, handle, doc: handle.doc() as unknown as LarDoc };
}

describe("the veil-born group", () => {
  test("★ THE FOUNDING PERSISTS ITS VEIL TAG — boot can re-derive the creator ★", async () => {
    const { doc } = await found();
    const tag = tiddlerText(doc.tiddlers[DYAD_VEIL_TAG_TIDDLER]);
    expect(tag, "a founded face carries the tag its veil derives from").toBeTruthy();
    expect(tag).toMatch(/^[0-9a-f]{64}$/);
  });

  test("★ THE ROSTERS CARRY THE VEIL, NEVER THE RAW DEVICE KEY ★", async () => {
    const { f, handle, doc } = await found();
    const tag = tiddlerText(doc.tiddlers[DYAD_VEIL_TAG_TIDDLER]);
    expect(tag).toBeTruthy();

    // Stand the veil identity exactly as boot will: derive the seed, hydrate over the daemon doc.
    const veil = await deriveDyadVeil(FOUNDER_SEED, tag!);
    const veilKh = new KeyhiveProvider();
    await veilKh.init({ seed: hexToBytes(veil.signingKey), eventStore: await replayCapEvents(handle as never) });
    await veilKh.hydrateFromEventStore();
    const vesselKh = new KeyhiveProvider();
    await vesselKh.init({ seed: FOUNDER_SEED, eventStore: await replayCapEvents(handle as never) });
    await vesselKh.hydrateFromEventStore();
    const vesselId = await vesselKh.vesselIdentifierHex();

    // MEASURED SEMANTICS: `cgkaMembers` enumerates the doc's own agent plus EXPLICITLY seated
    // members — a creator never appears as a row; its hold is OPERATIONAL AUTHORITY. So the vector
    // asserts both halves as they actually exist: the raw key sits on no roster, and the re-stood
    // veil identity can EXERCISE the creator's authority (seat a member) — which is what "boot
    // stands the veil" must mean.
    const group = await veilKh.sentinelCgkaMembers(f.personaGroupDocIdHex);
    expect(group, "the raw device key never rides the group roster").not.toContain(vesselId);

    const cabal = await veilKh.sentinelCgkaMembers(f.meshCabalDocIdHex);
    expect(cabal, "the raw device key never rides the cabal roster either").not.toContain(vesselId);

    // The functional half: the boot-stood veil EXERCISES the creator's authority.
    const guest = new KeyhiveProvider();
    await guest.init({ seed: new Uint8Array(32).fill(99), eventStore: await replayCapEvents(handle as never) });
    const { id: guestId } = await veilKh.receiveContactCard(await guest.contactCard());
    await veilKh.addSentinelMember(guestId, f.personaGroupDocIdHex);
    const after = await veilKh.sentinelCgkaMembers(f.personaGroupDocIdHex);
    expect(after, "the re-derived veil seats a member — the creator's hand works after re-standing").toContain(guestId);
  });

  test("★ THE FOUNDER'S DYAD WEARS THE TAG-DERIVED VEIL ★", async () => {
    const { doc } = await found();
    const tag = tiddlerText(doc.tiddlers[DYAD_VEIL_TAG_TIDDLER]);
    expect(tag).toBeTruthy();
    const veil = await deriveDyadVeil(FOUNDER_SEED, tag!);
    const dyads = vesselDyads(doc);
    expect(dyads).toHaveLength(1);
    expect(dyads[0]!.ref.veilDid.toLowerCase()).toContain(veil.verifyingKey);
  });

  test("★ A JOINEE JOINS UNDER ITS VEIL — the veil-keyed card seats, and the veil reads ★", async () => {
    // The split's second moment: the joinee derives its veil from the CARRIED group doc id, stands a
    // veil-keyed identity, and presents THAT card. The seat then greps as a per-group veil, the raw
    // joinee key touches no roster and no carried event, and the joinee's VEIL decrypts the content
    // (the group's material keys to the prekeys the seated card carried).
    const { f, handle } = await found();
    const tag = tiddlerText((handle.doc() as unknown as LarDoc).tiddlers[DYAD_VEIL_TAG_TIDDLER])!;
    const founderVeilKeys = await deriveDyadVeil(FOUNDER_SEED, tag);
    const seat = new KeyhiveProvider();
    await seat.init({ seed: hexToBytes(founderVeilKeys.signingKey), eventStore: await replayCapEvents(handle as never) });
    await seat.hydrateFromEventStore();

    const founderVessel = new KeyhiveProvider();
    await founderVessel.init({ seed: FOUNDER_SEED, eventStore: await replayCapEvents(handle as never) });
    await founderVessel.hydrateFromEventStore();

    const JOINEE_SEED = new Uint8Array(32).fill(41);
    const joineeVeilKeys = await deriveDyadVeil(JOINEE_SEED, f.personaGroupDocIdHex);
    const joineeVeil = new KeyhiveProvider();
    await joineeVeil.init({ seed: hexToBytes(joineeVeilKeys.signingKey), eventStore: new InMemoryEventStore() });
    const joineeRawId = await (async () => {
      const raw = new KeyhiveProvider();
      await raw.init({ seed: JOINEE_SEED, eventStore: new InMemoryEventStore() });
      return raw.vesselIdentifierHex();
    })();

    const BAG = "lar:///ha.ka.ba/bags/catalog/veil-joinee-shared";
    const { docId } = await founderVessel.registerBag(BAG);
    const bundle = await packPersonaCrossing(
      founderVessel,
      await joineeVeil.contactCard(),
      { docIdHex: f.personaGroupDocIdHex, agentIdHex: f.personaGroupAgentIdHex },
      [{ bagUrl: BAG, docIdHex: docId, plaintext: new TextEncoder().encode("keyed to the veil") }],
      seat,
    );
    const read = await applyPersonaCrossing(joineeVeil, {
      ...bundle, capEvents: bundle.capEvents,
    });
    expect(new TextDecoder().decode(read[0]!.plaintext)).toBe("keyed to the veil");

    const members = await seat.sentinelCgkaMembers(f.personaGroupDocIdHex);
    expect(members, "the joinee's veil holds the seat").toContain(await joineeVeil.vesselIdentifierHex());
    expect(members, "the raw joinee key touches no roster").not.toContain(joineeRawId);
    const streamHex = bundle.capEvents.map((b64: string) =>
      Array.from(Buffer.from(b64, "base64")).map((x) => x.toString(16).padStart(2, "0")).join("")).join("|");
    expect(streamHex.includes(joineeRawId.replace(/^0x/, "").toLowerCase()), "no carried event spells the raw joinee key").toBe(false);
  });

  test("★ NO CARRIED EVENT SPELLS THE RAW VESSEL KEY ★", async () => {
    // The byte-level law the host-surface probe measured: whatever a carrier holds, the raw device
    // identifier must not be greppable from the founded face's cap events.
    const { handle } = await found();
    const vesselKh = new KeyhiveProvider();
    const store = await replayCapEvents(handle as never);
    await vesselKh.init({ seed: FOUNDER_SEED, eventStore: store });
    const vesselId = (await vesselKh.vesselIdentifierHex()).replace(/^0x/, "").toLowerCase();
    const events = await store.list();
    const streamHex = events.map((e: { bytes: Uint8Array }) =>
      Array.from(e.bytes).map((b) => b.toString(16).padStart(2, "0")).join("")).join("|");
    expect(streamHex.includes(vesselId), "the raw vessel key is not greppable from carried events").toBe(false);
  });
});
