/**
 * vessel-face-rows — A PRODUCTION FACE KEEPS ITS ROWS UNDER ITS OWN TREE (browser-vessel-lift slice 3's production reach;
 * k15-custody-step-zero#/row-census-browser).
 *
 *   FR1 RED a production founding binds the founder face's tree before its first row, and every face-private row it lands
 *       (the persona root, the atom, the address secret, the veil Archive, the sealed anchor) rests at
 *       `face-sealed/<fcid>/<row>` under that face's own key, the fcid the clear index names for the founded PersonaGroup;
 *       no face-private row rests under the shared tree (`sealed/<row>` or a clear row). CONTROL: the shared tree keeps the
 *       place seed (`vessel-key`) alone.
 *   FR2 RED a face whose last session left reads nothing while the place key stands held for another face: its atom
 *       refuses `face-locked`, and a second face bound on the same browser opens only under its own unlock and opens none
 *       of the first face's rows. CONTROL: the first face's own unlock reads its atom again.
 *   FR4 RED a face switch (row `B8`) rests its intent and its outcome in the switching session's face-private home: the
 *       target face's own tree holds `face-switch/<sessionId>`, the intent before the fence and the outcome after the advance.
 *   FR3 RED a face row never rests under the place tree: a keystore holding a face's row beside the place seed (an
 *       `h<N>`-keyed persona root, a clear or sealed face row) refuses the boot `face-row-shared`, and the row door
 *       refuses the `h<N>` spelling `face-names-a-handle`.
 *
 * Faces and secrets stay synthetic, over scratch stores. Each tree derives with scrypt, so the cases run slow.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift
 */
import { describe, expect, test } from "vitest";
import { openBrowserVessel, type BrowserVesselOptions } from "../src/open-browser-vessel.js";
import { openVesselIdb, idbGet, idbKeys, idbPut } from "../src/browser-vessel-identity.js";
import { readKeystoreRow, sealBrowserKeystore } from "../src/browser-custody.js";
import { bindFirstFaceSlot, faceKeyOpens, lockFaceCustody, unlockFaceCustody } from "../src/browser-face-custody.js";
import { readBrowserFaceAtom } from "../src/browser-face-atom.js";
import { readFaceRow, writeFaceRow } from "../src/browser-face-custody.js";
import { standVesselHouse, type LitVessel } from "../src/vessel-sessions.js";
import { BootHalted } from "./wire-vessel-rig.js";

const SLOW = 300_000;
const ROUTE = { kind: "passphrase", passphrase: "the founder face keeps its own fire" } as const;
const OTHER = { kind: "passphrase", passphrase: "a second face keeps another fire" } as const;

async function keystoreKeys(idbName: string): Promise<string[]> {
  const db = await openVesselIdb(idbName);
  try { return await idbKeys(db, "keystore"); } finally { db.close(); }
}
async function digest(face: string): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(face)))].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** Found a fresh vessel through the production door: the boot asks its first slot, and halts once the bootstrap rests. */
async function foundHalted(tag: string): Promise<{ idbName: string; group: string; asked: string[] }> {
  const idbName = `face-rows-${tag}-${crypto.randomUUID()}`;
  const asked: string[] = [];
  const opts = {
    idbName,
    askCustody: async (q: { readonly kind: string }) => { asked.push(q.kind); return ROUTE; },
    onPhase: (phase: string) => { if (phase === "bootstrap-kept") throw new BootHalted(); },
  };
  await expect(openBrowserVessel(opts as unknown as BrowserVesselOptions)).rejects.toBeInstanceOf(BootHalted);
  const db = await openVesselIdb(idbName);
  try {
    const bootstrap = await idbGet<{ personaGroupId?: string }>(db, "bootstrap", "social-bootstrap");
    if (!bootstrap?.personaGroupId) throw new Error("the founding kept no bootstrap");
    return { idbName, group: bootstrap.personaGroupId, asked };
  } finally { db.close(); }
}

const FACE_PRIVATE = /^(?:sealed\/)?(?:persona-root-h|veil-archive-g|face-atom\/|face-anchor\/|face-address-secret\/|vessel-face-tag\/|fleet-join-pending\/|vessel-face-key\/|nexus-key\/|promoted\/|kapae\/)/;

describe("a production founding keeps its face's rows under the face's own tree", () => {
  test("FR1 RED the founding's face rows rest at face-sealed/<fcid>/<row>, none under the shared tree — CONTROL: the shared tree keeps the place seed alone", async () => {
    const { idbName, group, asked } = await foundHalted("found");
    expect(asked, "the founding asked one first bind, for both trees").toEqual(["bind-first"]);
    const keys = await keystoreKeys(idbName);
    expect(keys.filter((k) => FACE_PRIVATE.test(k)), "no face-private row rests under the shared tree").toEqual([]);
    const db = await openVesselIdb(idbName);
    let fcid: string;
    try {
      const index = JSON.parse(new TextDecoder().decode(await idbGet<Uint8Array>(db, "keystore", "face-index"))) as { entries: { group: string; fcid: string }[] };
      expect(index.entries.map((e) => e.group), "the index routes the founded group by its digest").toEqual([await digest(group)]);
      fcid = index.entries[0]!.fcid;
    } finally { db.close(); }
    const under = keys.filter((k) => k.startsWith(`face-sealed/${fcid}/`)).map((k) => k.slice(`face-sealed/${fcid}/`.length)).sort();
    expect(under, "the face's rows rest under its own tree").toEqual(["anchor", "face-address-secret", "face-anchor", "face-atom", "veil-archive", "vessel-face-tag"]);
    expect(keys, "the face's tree stands").toContain(`face-slots/${fcid}`);
    // The face's root rests under its own ward, never under a custody tree; the ward's public roster rests beside the place seed.
    expect(keys, "the face's root rests under its ward").toContain("ward/h0/persona-root");
    expect(keys.filter((k) => k.startsWith("sealed/")), "CONTROL: the shared tree keeps the place seed, the ward's public roster and the vessel's secret home's address alone").toEqual(["sealed/persona-root-roster", "sealed/secret-home", "sealed/vessel-key"]);
  }, SLOW);

  test("FR2 RED a face whose last session left reads nothing, and a second face opens only under its own unlock — CONTROL: the face's own unlock reads again", async () => {
    const { idbName, group } = await foundHalted("second");
    expect(await readBrowserFaceAtom(idbName, group), "the founded face reads its atom while it stands unlocked").toBeDefined();
    // The founded face's last session leaves; the place key stays held for another face's session.
    lockFaceCustody(idbName, group);
    await expect(readBrowserFaceAtom(idbName, group), "a locked face's atom reads nothing under the place key").rejects.toMatchObject({ reading: "face-locked" });
    const second = `pg-second-${crypto.randomUUID()}`;
    await bindFirstFaceSlot(idbName, second, OTHER);
    expect(await faceKeyOpens(idbName, second, group, "face-atom"), "the second face's key opens none of the first face's rows").toBe(false);
    expect(await faceKeyOpens(idbName, second, group, "vessel-face-tag")).toBe(false);
    expect((await unlockFaceCustody(idbName, group, [OTHER])).reading, "the second face's route opens no tree of the first").toBe("no-slot-opens");
    expect((await unlockFaceCustody(idbName, group, [ROUTE])).reading, "CONTROL: the face's own route opens it").toBe("opens");
    expect(await readBrowserFaceAtom(idbName, group)).toBeDefined();
  }, SLOW);
});

describe("a face row never rests under the place tree", () => {
  test("FR3 RED a face's row beside the place seed refuses the boot face-row-shared; the h<N> spelling refuses at the row door", async () => {
    const idbName = `face-rows-old-${crypto.randomUUID()}`;
    await sealBrowserKeystore(idbName, ROUTE);
    // A persona root keyed by its handle index beside the place seed, under the place tree.
    const db = await openVesselIdb(idbName);
    try { await idbPut(db, "keystore", "sealed/persona-root-h0", new Uint8Array([1, 2, 3])); } finally { db.close(); }
    const refused = await openBrowserVessel({ idbName, askCustody: async () => ROUTE } as unknown as BrowserVesselOptions).catch((e: unknown) => e);
    expect(String(refused)).toMatch(/face-row-shared/);
    expect((refused as { reading?: unknown }).reading).toBe("face-row-shared");
    await expect(readKeystoreRow(idbName, "nexus-key/h0/aid")).rejects.toMatchObject({ reading: "face-names-a-handle" });
    await expect(readKeystoreRow(idbName, "persona-root-h0")).rejects.toMatchObject({ reading: "ward-needs-fresh-unlock" });
  }, SLOW);
});

describe("the face switch rests its records under the face it moves to", () => {
  test("FR4 RED the switch's intent and outcome rest at face-switch/<sessionId> under the target face's tree", async () => {
    const idbName = `face-rows-switch-${crypto.randomUUID()}`;
    const a = `pg-a-${crypto.randomUUID()}`, b = `pg-b-${crypto.randomUUID()}`;
    await bindFirstFaceSlot(idbName, a, ROUTE);
    await bindFirstFaceSlot(idbName, b, OTHER);
    await writeFaceRow(idbName, b, "recipe/1", new TextEncoder().encode("B's recipe"));
    lockFaceCustody(idbName, a); lockFaceCustody(idbName, b);
    const house = await standVesselHouse({ idbName, light: (): Promise<LitVessel> => Promise.resolve({ close: async () => undefined }) });
    try {
      const s = house.open({ tabId: "t", face: a });
      await house.admit(s.sessionId, { ask: async () => ROUTE });
      const seen: string[] = [];
      await house.switchFace(s.sessionId, b, {
        ask: async () => OTHER,
        intent: async () => { const at = await readFaceRow(idbName, b, `face-switch/${s.sessionId}`); seen.push(at === null ? "absent" : String(JSON.parse(new TextDecoder().decode(at)).phase)); },
      });
      expect(seen, "the intent rests before the fence runs").toEqual(["intent"]);
      const rested = await readFaceRow(idbName, b, `face-switch/${s.sessionId}`);
      expect(rested, "the outcome rests under the target face").not.toBeNull();
      expect(JSON.parse(new TextDecoder().decode(rested!))).toEqual({ phase: "outcome", sessionId: s.sessionId, from: await digest(a), to: await digest(b), generation: 1 });
    } finally { await house.release(); }
  }, SLOW);
});
