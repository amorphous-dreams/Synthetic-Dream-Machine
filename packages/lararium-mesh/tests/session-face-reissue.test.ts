/** The gate accepts the verified hand-over head; local session supply must read the same head. */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { checkVesselChain, foldWithdrawals } from "../src/face-authority.js";
import { followNexusKeyLine, signNexusKeyHandOver } from "../src/nexus-key-line.js";
import { supplySessionFace, type FaceAdmitReading } from "../src/session-face.js";
import { chain, pair, signHex } from "./face-proof-fixture.js";

const red = process.env.LAR_UNBUILT_REDS === "1" ? test : test.skip;
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

  red("REISSUED_FACE_OPENS_LOCAL_SESSION: admitted old nym plus verified new head supplies the new face", async () => {
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
  });

  red("JOINED_VESSEL_CERTIFIES_OWN_KEY: a borrowed face certificate cannot open a local session", async () => {
    const c = await chain("joined-vessel", NEXUS);
    const other = await chain("joined-vessel-other", NEXUS);
    const fold = foldWithdrawals(c.scope);
    if (!("memory" in fold)) throw new Error(fold.refusal);
    const checked = checkVesselChain({ admitted: c.scope, certificate: c.certificate, memory: fold.memory });
    if (checked.verdict !== "verified") throw new Error(checked.verdict);
    const admit = { verdict: { state: "held", reason: "held", nym: c.face.key }, head: c.face.key,
      nexus: NEXUS, admitRef: "admit-ref", revision: "board-head" };
    const grant = { personaGroup: GROUP, faceKey: c.face.key, nexus: NEXUS, revision: "grant-head" };
    // The pure supplier already refuses this. The red asks for the missing production join/session caller.
    expect(supplySessionFace({ chain: checked.chain, vesselFaceKey: other.vessel.key, admit, grant })).toEqual({ refusal: "chain-other-vessel" });
    const caller = readFileSync(new URL("../src/session-face.ts", import.meta.url), "utf8");
    expect(/openJoinedFaceSession/.test(caller)).toBe(true);
  });
});
