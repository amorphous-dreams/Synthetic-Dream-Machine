/**
 * second-face-founds — a per-persona founding (Path 1, persona-policy Ruling 2/2b) stands a SECOND face as
 * its OWN cryptographic individual, WITHOUT unseating the first.
 *
 * Canon rules each PersonaGroup stands as its own individual; a human `#has` several. So an added
 * compartment founds a real face — its own PersonaGroup + MeshCabal + planes + persona-KEL — and lands a
 * register-many bootstrap PLANE ENTRY the boot's `readPersonaPlanes` consumes, while the ONE mounted face
 * (h0) stays byte-unchanged. The daemon doc carries the MOUNTED face's binding pins (singular, one key
 * each); an added face's material must NOT overwrite them, or h0's continuity anchor (its persona-KEL
 * prefix) forks the instant a second face is minted.
 *
 *   ★ mount:false founds a DISTINCT, fully-founded individual and leaves h0's mount pins standing (CONTROL)
 *   CONTROL — the founding face (mount default) writes the singular pins exactly
 *   register-many — the plane entry an added compartment writes registers it beside h0
 *
 * The wear-reboot mount-switch (a reboot re-pinning the daemon doc from the worn index) is a DEFERRED
 * increment (Gate-B ruling): this proves the FOUNDING of the face, not that a reboot mounts it.
 */
import { describe, test, expect } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { foundThePlace, foundTheFace } from "@lararium/keyhive";
import * as ed25519 from "@noble/ed25519";
import {
  hex, tiddlerText, type LarDoc,
  personaScopedBagIds, personaMembershipEntries, readPersonaPlanes, type PlaneEntry,
  PERSONA_GROUP_DOC_ID_TIDDLER, MESH_CABAL_DOC_ID_TIDDLER, PERSONA_KEL_PREFIX_TIDDLER,
  SIGNER_DID_TIDDLER, DEVICE_DELEGATION_SELF_TIDDLER,
} from "@lararium/mesh";

const VESSEL_SEED = new Uint8Array(32).fill(9);
// The two persona ROOTS — each face its own sovereign signing key (distinct from the vessel and each other).
const ROOT_H0 = new Uint8Array(32).fill(1);
const ROOT_H1 = new Uint8Array(32).fill(2);
const pubOf = async (s: Uint8Array): Promise<string> => hex(await ed25519.getPublicKeyAsync(s));

type DaemonHandle = Awaited<ReturnType<typeof foundThePlace>>["daemonHandle"];
const pins = (h: DaemonHandle): Record<string, string | undefined> => {
  const doc = h.doc() as unknown as LarDoc;
  const read = (t: string): string | undefined => tiddlerText(doc.tiddlers[t]);
  // The device edge rides as STRUCTURED fields (not a `text` body), so read its bound persona-root did.
  const edgeRec = doc.tiddlers[DEVICE_DELEGATION_SELF_TIDDLER]?.tiddler as Record<string, string> | undefined;
  return {
    group:  read(PERSONA_GROUP_DOC_ID_TIDDLER),
    cabal:  read(MESH_CABAL_DOC_ID_TIDDLER),
    kel:    read(PERSONA_KEL_PREFIX_TIDDLER),
    signer: read(SIGNER_DID_TIDDLER),
    edge:   edgeRec?.["personaRootDid"],
  };
};

async function foundFace(
  repo: Repo, daemonHandle: DaemonHandle, signerSeed: Uint8Array, opts: { mount?: boolean } = {},
): Promise<{ groupId: string; cabalId: string; prefix: string; personaUrl: string; identitiesUrl: string; circlesUrl: string; sessionsUrl: string }> {
  const verifyingKey = await pubOf(VESSEL_SEED);
  const face = await foundTheFace({
    repo,
    daemonHandle,
    vesselSeed:         VESSEL_SEED,
    vesselVerifyingKey: verifyingKey,
    vesselDisplayName:  "Multitude Shrine",
    binding:            { mode: "self-stood", signerSeed },
    hearthTrueName:     "",
    nexusPubkey:        verifyingKey,
    ...(opts.mount === undefined ? {} : { mount: opts.mount }),
  });
  return {
    groupId: face.personaGroupDocIdHex, cabalId: face.meshCabalDocIdHex, prefix: face.personaKelPrefix,
    personaUrl: face.personaUrl, identitiesUrl: face.identitiesUrl, circlesUrl: face.circlesUrl, sessionsUrl: face.sessionsUrl,
  };
}

describe("a per-persona founding stands a second face without unseating the first", () => {
  test("★ mount:false founds a DISTINCT, fully-founded individual and leaves h0's mount pins standing ★", async () => {
    const repo = new Repo({ sharePolicy: async () => true });
    const place = await foundThePlace({ repo, vesselSeed: VESSEL_SEED, hearthTrueName: "" });

    // ── h0 lights the hearth fire and MOUNTS (the operator's live founding path) ──
    const h0 = await foundFace(repo, place.daemonHandle, ROOT_H0);
    const mounted = pins(place.daemonHandle);
    expect(mounted.group).toBe(h0.groupId);
    expect(mounted.kel).toBe(h0.prefix);

    // ── an added compartment founds a real SECOND face — its own individual, not mounted ──
    const h1 = await foundFace(repo, place.daemonHandle, ROOT_H1, { mount: false });
    // Fully founded: its own group, cabal, and persona-KEL inception (a non-empty, distinct prefix).
    expect(h1.groupId, "each PersonaGroup is its OWN individual").not.toBe(h0.groupId);
    expect(h1.cabalId, "each face founds its OWN cabal").not.toBe(h0.cabalId);
    expect(h1.prefix.length, "the second face incepts a persona-KEL").toBeGreaterThan(0);
    expect(h1.prefix, "its continuity anchor is its own").not.toBe(h0.prefix);

    // THE CONTROL — the ONE mounted face is still h0. Founding h1 must not move the pins the operator's
    // live boot reads to run h0's Binding Gate.
    const after = pins(place.daemonHandle);
    expect(after.group,  "h0 stays the mounted PersonaGroup").toBe(mounted.group);
    expect(after.cabal,  "h0 stays the mounted MeshCabal").toBe(mounted.cabal);
    expect(after.kel,    "h0's continuity anchor is unforked").toBe(mounted.kel);
    expect(after.signer, "h0's signer pin stands").toBe(mounted.signer);
    expect(after.edge,   "h0's device edge stands").toBe(mounted.edge);

    await repo.shutdown();
  });

  test("CONTROL — the founding face (mount default) writes the singular pins exactly", async () => {
    const repo = new Repo({ sharePolicy: async () => true });
    const place = await foundThePlace({ repo, vesselSeed: VESSEL_SEED, hearthTrueName: "" });
    const h0 = await foundFace(repo, place.daemonHandle, ROOT_H0);   // no mount arg → defaults true

    const p = pins(place.daemonHandle);
    expect(p.group).toBe(h0.groupId);
    expect(p.cabal).toBe(h0.cabalId);
    expect(p.kel).toBe(h0.prefix);
    expect(p.signer, "the mounting face pins its signer").toBeTruthy();
    expect(p.edge,   "the mounting face pins its device edge").toBeTruthy();
    await repo.shutdown();
  });

  test("register-many — an added compartment's plane entry registers it beside the mounted face", () => {
    // The register-many entry the node adapter writes for each face: the four plane urls + the membership
    // that names the group. Two faces' entries in one bootstrap resolve to BOTH — the boot mounts one and
    // registers all, so the boot's own `readPersonaPlanes` is the contract this pins.
    const G0 = "a".repeat(64), G1 = "b".repeat(64);
    const planeEntries = (g: string): PlaneEntry[] => {
      const face = personaScopedBagIds(g);
      const url = `automerge:${g.slice(0, 8)}`;
      return [
        { title: face.identities, text: `${url}-id` },
        { title: face.circles,    text: `${url}-ci` },
        { title: face.sessions,   text: `${url}-se` },
        ...personaMembershipEntries({ personaGroupId: g, url }),
      ];
    };
    const entries = [...planeEntries(G0), ...planeEntries(G1)];
    const family = readPersonaPlanes(entries);
    expect(family.map((p) => p.personaGroupId).sort()).toEqual([G0, G1].sort());
  });
});
