/** The gate accepts the verified hand-over head; local session supply must read the same head. */
import { describe, expect, test } from "vitest";
import * as ed25519 from "@noble/ed25519";
import { checkVesselChain, foldWithdrawals, type VesselFaceKeyCustody } from "../src/face-authority.js";
import { followNexusKeyLine, signNexusKeyHandOver } from "../src/nexus-key-line.js";
import { SessionTable, sessionBinding } from "../src/session-contract.js";
import { openJoinedFaceSession, supplySessionFace, type FaceAdmitReading } from "../src/session-face.js";
import { chain, history, pair, signHex, vesselOf, type Pair } from "./face-proof-fixture.js";

const NEXUS = "nexus-reissue.synthetic";
const GROUP = "b7f1c2a9d4e60381";

describe("a reissued face opens its local session", () => {
  test("CONTROL: a signed hand-over resolves to its successor and an unreissued admit supplies a face", async () => {
    const c = await chain("reissue-current", NEXUS);
    const old = await pair("reissue-prior");
    const record = await signNexusKeyHandOver({ nexus: NEXUS, from: old.key, to: c.face.key },
      (bytes) => signHex(bytes, old), (bytes) => signHex(bytes, c.face));
    const line = followNexusKeyLine({ nexus: NEXUS, admitted: old.key, carried: [record] });
    expect("head" in line && line.head).toBe(c.face.key);
    const fold = foldWithdrawals(c.scope);
    if (!("memory" in fold)) throw new Error(fold.refusal);
    const checked = checkVesselChain({ admitted: c.scope, certificate: c.certificate, memory: fold.memory });
    if (checked.verdict !== "verified") throw new Error(checked.verdict);
    const grant = { personaGroup: GROUP, faceKey: c.scope.faceKey, nexus: NEXUS, revision: "grant-head" };
    const current: FaceAdmitReading = { verdict: { state: "held", reason: "held", nym: c.face.key },
      head: c.face.key, nexus: NEXUS, admitRef: "admit-ref", revision: "board-head" };
    expect("face" in supplySessionFace({ chain: checked.chain, vesselFaceKey: c.vessel.key, admit: current, grant })).toBe(true);
  });

  test("REISSUED_FACE_OPENS_LOCAL_SESSION: admitted old nym plus verified new head supplies the new face", async () => {
    const c = await chain("reissue-current", NEXUS);
    const old = await pair("reissue-prior");
    const record = await signNexusKeyHandOver({ nexus: NEXUS, from: old.key, to: c.face.key },
      (bytes) => signHex(bytes, old), (bytes) => signHex(bytes, c.face));
    const line = followNexusKeyLine({ nexus: NEXUS, admitted: old.key, carried: [record] });
    if (!("head" in line)) throw new Error(line.refusal);
    const fold = foldWithdrawals(c.scope);
    if (!("memory" in fold)) throw new Error(fold.refusal);
    const checked = checkVesselChain({ admitted: c.scope, certificate: c.certificate, memory: fold.memory });
    if (checked.verdict !== "verified") throw new Error(checked.verdict);
    const admit: FaceAdmitReading = { verdict: { state: "held", reason: "held", nym: old.key },
      head: line.head, nexus: NEXUS, admitRef: "admit-ref", revision: "board-head" };
    const grant = { personaGroup: GROUP, faceKey: c.scope.faceKey, nexus: NEXUS, revision: "grant-head" };
    expect("face" in supplySessionFace({ chain: checked.chain, vesselFaceKey: c.vessel.key, admit, grant })).toBe(true);
    // CONTROL: the same admit read as if the nym answered (head left at the old key) refuses.
    expect(supplySessionFace({ chain: checked.chain, vesselFaceKey: c.vessel.key, admit: { ...admit, head: old.key }, grant }))
      .toEqual({ refusal: "admit-other-face" });
  });

  test("JOINED_VESSEL_CERTIFIES_OWN_KEY: a borrowed face certificate cannot open a local session", async () => {
    const c = await chain("joined-vessel", NEXUS);
    const other = await chain("joined-vessel-other", NEXUS);
    const fold = foldWithdrawals(c.scope);
    if (!("memory" in fold)) throw new Error(fold.refusal);
    const admit = { verdict: { state: "held", reason: "held", nym: c.face.key }, head: c.face.key,
      nexus: NEXUS, admitRef: "admit-ref", revision: "board-head" };
    const grant = { personaGroup: GROUP, faceKey: c.face.key, nexus: NEXUS, revision: "grant-head" };
    const custodyOf = (by: Pair): VesselFaceKeyCustody => ({ signAsVesselFace: (_scope, _key, image) => ed25519.signAsync(image, by.secret) });
    const base = { binding: sessionBinding("socket"), profile: "verb", admitted: c.scope, memory: fold.memory, admit, grant, apart: [] };

    // CONTROL: the vessel's own certificate, over the key its custody row names, opens and mints its signer.
    const table = new SessionTable("owner-epoch-joined");
    const opened = await openJoinedFaceSession({ ...base, table, certificate: c.certificate, vesselFaceKey: c.vessel.key, custody: custodyOf(c.vessel) });
    if (!("signer" in opened)) throw new Error(opened.refusal);
    expect(opened.signer.certificate.vesselFaceKey).toBe(c.vessel.key);
    expect(table.size).toBe(1);

    // A sibling vessel of the same face holds its own certificate, which verifies under the face key as well as
    // this vessel's own. Borrowed here, it opens nothing: this vessel's custody row names another key.
    const sibling = await vesselOf(c, "joined-vessel-sibling");
    const shut = new SessionTable("owner-epoch-joined");
    expect(await openJoinedFaceSession({ ...base, table: shut, certificate: sibling.certificate, vesselFaceKey: c.vessel.key, custody: custodyOf(c.vessel) }))
      .toEqual({ refusal: "chain-other-vessel" });
    // Nor does the sibling's certificate open with the sibling's key named, where this vessel's custody signs.
    expect(await openJoinedFaceSession({ ...base, table: shut, certificate: sibling.certificate, vesselFaceKey: sibling.vessel.key, custody: custodyOf(c.vessel) }))
      .toEqual({ refusal: "custody-astray", cause: expect.anything() });
    // A withdrawn key opens nothing, whoever holds its certificate.
    const learned = foldWithdrawals(c.scope, await history(c, [c.vessel.key]));
    if (!("memory" in learned)) throw new Error(learned.refusal);
    expect(await openJoinedFaceSession({ ...base, table: shut, memory: learned.memory, certificate: c.certificate, vesselFaceKey: c.vessel.key, custody: custodyOf(c.vessel) }))
      .toEqual({ refusal: "chain-refused", verdict: "withdrawn" });
    // The other face's certificate refuses at this vessel's ground.
    expect(await openJoinedFaceSession({ ...base, table: shut, certificate: other.certificate, vesselFaceKey: c.vessel.key, custody: custodyOf(c.vessel) }))
      .toEqual({ refusal: "chain-refused", verdict: "invalid", cause: "certificate-other-face" });
    expect(shut.size).toBe(0);
  });
});
