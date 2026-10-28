/**
 * atom-born-group — THE GROUP IS BORN UNDER THE FACE ATOM.
 *
 * The probe campaign measured the constraints this vector states: a creator cannot leave its roster;
 * any access grade is roster membership; the creator's identifier rides every carried event in
 * CLEARTEXT. So the founding stands a random atom identity in local custody, and THAT identity creates the
 * PersonaGroup and MeshCabal sentinels. The raw vessel Individual never touches either roster, and
 * every identifier a carrier can grep out of the group's events is that face's atom.
 */
import { describe, test, expect } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import type { AutomergeUrl } from "@automerge/automerge-repo";
import { runFoundingCeremony, replayCapEvents, KeyhiveProvider, InMemoryEventStore, packPersonaCrossing, applyPersonaCrossing } from "@lararium/keyhive";
import * as ed25519 from "@noble/ed25519";
import {
  hex, faceAtomKeyFromSeed, vesselDyads,
  type LarDoc,
} from "@lararium/mesh";

const pubOf = async (seed: Uint8Array): Promise<string> => hex(await ed25519.getPublicKeyAsync(seed));
const FOUNDER_SEED = new Uint8Array(32).fill(7);

async function found() {
  const repo = new Repo({ sharePolicy: async () => true });
  const verifyingKey = await pubOf(FOUNDER_SEED);
  const f = await runFoundingCeremony({ repo,
    vesselSeed:         FOUNDER_SEED,
    placeVerifyingKey: verifyingKey,
    vesselDisplayName:  "The Strandbeest Shrine",
    binding: { mode: "self-stood", signerSeed: FOUNDER_SEED },
    hearthTrueName:       "",
    nexusPubkey:          verifyingKey,
  });
  const handle = await repo.find(f.daemonUrl as AutomergeUrl);
  return { repo, f, handle, doc: handle.doc() as unknown as LarDoc };
}

describe("the atom-born group", () => {
  test("the daemon document carries no atom seed", async () => {
    const { f, doc } = await found();
    expect(f.atomSeed).toHaveLength(32);
    expect(JSON.stringify(doc)).not.toContain(hex(f.atomSeed));
  });

  test("★ THE ROSTERS CARRY THE VEIL, NEVER THE RAW DEVICE KEY ★", async () => {
    const { f, handle } = await found();

    // Stand the atom identity exactly as boot will: open the seed, restore the Archive the founding handed
    // out (the creator's key agreement state rests there and nowhere else), hydrate over the daemon doc.
    const veilKh = new KeyhiveProvider();
    await veilKh.init({ seed: f.atomSeed, eventStore: await replayCapEvents(handle as never, f.personaGroupId), archiveBytes: f.veilArchive });
    await veilKh.hydrateFromEventStore();
    const vesselKh = new KeyhiveProvider();
    await vesselKh.init({ seed: FOUNDER_SEED, eventStore: await replayCapEvents(handle as never, f.personaGroupId) });
    await vesselKh.hydrateFromEventStore();
    const vesselId = await vesselKh.vesselIdentifierHex();

    // MEASURED SEMANTICS: `cgkaMembers` enumerates the doc's own agent plus EXPLICITLY seated
    // members — a creator never appears as a row; its hold is OPERATIONAL AUTHORITY. So the vector
    // asserts both halves as they actually exist: the raw key sits on no roster, and the re-stood
    // veil identity can EXERCISE the creator's authority (seat a member) — which is what "boot
    // stands the veil" must mean.
    const group = await veilKh.groupMembers(f.personaGroupId);
    expect(group, "the raw device key never rides the group roster").not.toContain(vesselId);

    const cabal = await veilKh.sentinelCgkaMembers(f.meshCabalDocIdHex);
    expect(cabal, "the raw device key never rides the cabal roster either").not.toContain(vesselId);

    // The functional half: the boot-stood veil EXERCISES the creator's authority.
    const guest = new KeyhiveProvider();
    await guest.init({ seed: new Uint8Array(32).fill(99), eventStore: await replayCapEvents(handle as never, f.personaGroupId) });
    const { id: guestId } = await veilKh.receiveContactCard(await guest.contactCard());
    await veilKh.addGroupMember(guestId, f.personaGroupId);
    const after = await veilKh.groupMembers(f.personaGroupId);
    expect(after, "the re-derived veil seats a member — the creator's hand works after re-standing").toContain(guestId);
  });

  test("the founder's dyad names the atom", async () => {
    const { f, doc } = await found();
    const dyads = vesselDyads(doc);
    expect(dyads).toHaveLength(1);
    expect(dyads[0]!.ref.deviceDid.toLowerCase()).toBe(faceAtomKeyFromSeed(f.atomSeed, f.personaGroupId).did.toLowerCase());
  });

  test("★ A JOINEE JOINS UNDER ITS VEIL — the veil-keyed card seats, and the veil reads ★", async () => {
    // The split's second moment: the joinee derives its veil from the CARRIED group doc id, stands a
    // veil-keyed identity, and presents THAT card. The seat then greps as a per-group veil, the raw
    // joinee key touches no roster and no carried event, and the joinee's VEIL decrypts the content
    // (the group's material keys to the prekeys the seated card carried).
    const { f, handle } = await found();
    const seat = new KeyhiveProvider();
    await seat.init({ seed: f.atomSeed, eventStore: await replayCapEvents(handle as never, f.personaGroupId), archiveBytes: f.veilArchive });
    await seat.hydrateFromEventStore();

    const founderVessel = new KeyhiveProvider();
    await founderVessel.init({ seed: FOUNDER_SEED, eventStore: await replayCapEvents(handle as never, f.personaGroupId) });
    await founderVessel.hydrateFromEventStore();

    const JOINEE_SEED = new Uint8Array(32).fill(41);
    const joineeAtomSeed = new Uint8Array(32).fill(42);
    const joineeVeil = new KeyhiveProvider();
    await joineeVeil.init({ seed: joineeAtomSeed, eventStore: new InMemoryEventStore() });
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
      { groupId: f.personaGroupId },
      [{ bagUrl: BAG, docIdHex: docId, plaintext: new TextEncoder().encode("keyed to the veil") }],
      seat,
    );
    const read = await applyPersonaCrossing(joineeVeil, {
      ...bundle, capEvents: bundle.capEvents,
    });
    expect(new TextDecoder().decode(read[0]!.plaintext)).toBe("keyed to the veil");

    const members = await seat.groupMembers(f.personaGroupId);
    expect(members, "the joinee's veil holds the seat").toContain(await joineeVeil.vesselIdentifierHex());
    expect(members, "the raw joinee key touches no roster").not.toContain(joineeRawId);
    const streamHex = bundle.capEvents.map((b64: string) =>
      Array.from(Buffer.from(b64, "base64")).map((x) => x.toString(16).padStart(2, "0")).join("")).join("|");
    expect(streamHex.includes(joineeRawId.replace(/^0x/, "").toLowerCase()), "no carried event spells the raw joinee key").toBe(false);
  });

  test("★ THE RESTORED VEIL STILL OPENS — material sealed to the first card survives the restore ★", async () => {
    // The archive's whole purpose, proven: content keyed to the veil's FIRST-boot prekeys decrypts
    // on a veil stood FROM THE ARCHIVE — never a fresh mint whose prekeys match nothing.
    const { f, handle } = await found();
    const seat = new KeyhiveProvider();
    await seat.init({ seed: f.atomSeed, eventStore: await replayCapEvents(handle as never, f.personaGroupId), archiveBytes: f.veilArchive });
    await seat.hydrateFromEventStore();
    const founderVessel = new KeyhiveProvider();
    await founderVessel.init({ seed: FOUNDER_SEED, eventStore: await replayCapEvents(handle as never, f.personaGroupId) });
    await founderVessel.hydrateFromEventStore();

    // The joinee's FIRST boot: mint the veil, export the archive, present the card, receive content.
    const JOINEE_SEED = new Uint8Array(32).fill(43);
    const joineeAtomSeed = new Uint8Array(32).fill(44);
    const firstBoot = new KeyhiveProvider();
    await firstBoot.init({ seed: joineeAtomSeed, eventStore: new InMemoryEventStore() });
    const card = await firstBoot.contactCard();
    const archive = await firstBoot.exportArchive();

    const BAG = "lar:///ha.ka.ba/bags/catalog/restore-proof";
    const { docId } = await founderVessel.registerBag(BAG);
    const bundle = await packPersonaCrossing(
      founderVessel, card,
      { groupId: f.personaGroupId },
      [{ bagUrl: BAG, docIdHex: docId, plaintext: new TextEncoder().encode("opens after the night") }],
      seat,
    );

    // The SECOND boot: the veil stands FROM THE ARCHIVE (the exact restore path the daemon walks).
    const restored = new KeyhiveProvider();
    await restored.init({
      seed: joineeAtomSeed,
      eventStore: new InMemoryEventStore(),
      archiveBytes: archive,
    });
    const read = await applyPersonaCrossing(restored, bundle);
    expect(new TextDecoder().decode(read[0]!.plaintext)).toBe("opens after the night");
  });

  test("★ NO CARRIED EVENT SPELLS THE RAW VESSEL KEY ★", async () => {
    // The byte-level law the host-surface probe measured: whatever a carrier holds, the raw device
    // identifier must not be greppable from the founded face's cap events.
    const { handle, f } = await found();
    const vesselKh = new KeyhiveProvider();
    const store = await replayCapEvents(handle as never, f.personaGroupId);
    await vesselKh.init({ seed: FOUNDER_SEED, eventStore: store });
    const vesselId = (await vesselKh.vesselIdentifierHex()).replace(/^0x/, "").toLowerCase();
    const events = await store.list();
    const streamHex = events.map((e: { bytes: Uint8Array }) =>
      Array.from(e.bytes).map((b) => b.toString(16).padStart(2, "0")).join("")).join("|");
    expect(streamHex.includes(vesselId), "the raw vessel key is not greppable from carried events").toBe(false);
  });
});
