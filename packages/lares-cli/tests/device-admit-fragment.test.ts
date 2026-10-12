/**
 * device-admit fragment — the `#admit=` line encodes the CARRIED form, so a taking browser reads the hearth's
 * gate key, the canon documents it names and its resolved island kind and scope beside the signed payload. The extras ride by spread AFTER
 * signing, so the bytes the signature covers (the payload fields) arrive unchanged inside the fragment.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import * as ed from "@noble/ed25519";

const seed = new Uint8Array(32).fill(9);
const payload = {
  kind: "device-admit/v1", signerDid: "did:key:zSynthetic", personaKelPrefix: "Esynthetic",
  hearthTrueName: "synthetic-hearth", deviceEdge: { joinee: "ab".repeat(32) },
};
const signed = { ...payload, signature: "" };
const CANON = { "lar:///ha.ka.ba/bags/lares": "automerge:synthetic-lares", "lar:///ha.ka.ba/bags/lararium": "automerge:synthetic-lararium" };
const carried = { ...signed, hearthGatePubKey: "cd".repeat(32), hearthCanonDocs: CANON, hearthIslandKind: "own", hearthIslandScope: "cd".repeat(32) };

vi.mock("../src/store-door.js", () => ({ storeVerb: async () => ({ output: { payload: mockPayload, carried: mockCarried } }) }));
let mockPayload: unknown = signed;
let mockCarried: unknown = carried;

afterEach(() => vi.restoreAllMocks());

async function fragmentOf(): Promise<string> {
  const { cmdDeviceAdmit } = await import("../src/commands/device-admit.js");
  const { parseArgs } = await import("../src/parse-args.js");
  const lines: string[] = [];
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  vi.spyOn(console, "log").mockImplementation((s?: unknown) => { lines.push(String(s)); });
  expect(await cmdDeviceAdmit(parseArgs(["device-admit", "--joinee-key", "ab".repeat(32)]))).toBe(0);
  const line = lines.find((l) => l.trim().startsWith("#admit="));
  expect(line).toBeDefined();
  return line!.trim().slice("#admit=".length);
}

const decode = (b64: string) => JSON.parse(Buffer.from(b64, "base64url").toString("utf8")) as Record<string, unknown>;

describe("device-admit fragment", () => {
  test("carries the gate key and the resolved island kind and scope", async () => {
    const got = decode(await fragmentOf());
    expect(got["hearthGatePubKey"]).toBe(carried.hearthGatePubKey);
    expect(got["hearthIslandKind"]).toBe("own");
    expect(got["hearthIslandScope"]).toBe(carried.hearthIslandScope);
  });

  test("carries the canon documents the hearth names, whole", async () => {
    expect(decode(await fragmentOf())["hearthCanonDocs"]).toEqual(CANON);
  });

  test("CONTROL: the signed payload inside still verifies over the bytes it covers", async () => {
    const pub = await ed.getPublicKeyAsync(seed);
    const covered = new TextEncoder().encode(JSON.stringify(payload));
    const sig = Buffer.from(await ed.signAsync(covered, seed)).toString("hex");
    mockPayload = { ...payload, signature: sig };
    mockCarried = { ...(mockPayload as object), hearthGatePubKey: carried.hearthGatePubKey, hearthCanonDocs: CANON, hearthIslandKind: "own", hearthIslandScope: carried.hearthIslandScope };
    const got = decode(await fragmentOf());
    const { signature, hearthGatePubKey: _g, hearthCanonDocs: _c, hearthIslandKind: _k, hearthIslandScope: _s, ...rest } = got;
    expect(await ed.verifyAsync(Buffer.from(String(signature), "hex"), new TextEncoder().encode(JSON.stringify(rest)), pub)).toBe(true);
  });
});
