/**
 * offering-inspection — the receiver's pure evidence seam.
 *
 * The Mesh can certify one immutable signed gift and ask a vessel-local CAS for its bytes. It cannot
 * decide adoption, grammar, or an Antigen verdict here. These tests keep those planes apart by giving
 * the seam only one injected read capability and by proving the three honest custody readings.
 */
import { describe, expect, test } from "vitest";
import * as ed from "@noble/ed25519";
import {
  computePluginsCid,
  hex,
  pluginOfferingCid,
  sha256HexBytesSync,
  signPluginOffering,
  type PluginOffering,
} from "../src/index.js";
import { inspectPluginOffering } from "../src/offering-inspection.js";

const SEED = new Uint8Array(32).fill(91);
const sign = (bytes: Uint8Array): Promise<string> => ed.signAsync(bytes, SEED).then(hex);
const offeror = (): Promise<string> => ed.getPublicKeyAsync(SEED).then(hex);

async function offeringFor(bytes: Uint8Array): Promise<{ offering: PluginOffering; cid: string }> {
  const blob = {
    id: "$:/plugins/example/one",
    version: "alpha",
    sha256: sha256HexBytesSync(bytes),
  } as const;
  const offering = await signPluginOffering(
    { offeror: await offeror(), pluginsCid: computePluginsCid([blob]), blobs: [blob] }, sign,
  );
  return { offering, cid: pluginOfferingCid(offering) };
}

describe("inspectPluginOffering — pure local receiver evidence", () => {
  test("a complete local read is inspectable and proves the exact signed CID", async () => {
    const bytes = new TextEncoder().encode("one complete plugin");
    const { offering, cid } = await offeringFor(bytes);
    const reads: string[] = [];
    const result = await inspectPluginOffering({ offeringCid: cid, offering, read: (readCid) => {
      reads.push(readCid);
      return bytes;
    } });

    expect(result.status).toBe("inspectable");
    expect(result.verification).toMatchObject({ ok: true, pluginsCid: offering.pluginsCid, blobCount: 1 });
    expect(result.bytes).toEqual({ held: [offering.blobs[0]!.sha256], pending: [], corrupt: [] });
    expect(reads).toEqual([offering.blobs[0]!.sha256]);
  });

  test("a missing local byte stays pending and never becomes adoption or Antigen evidence", async () => {
    const bytes = new TextEncoder().encode("one absent plugin");
    const { offering, cid } = await offeringFor(bytes);
    const result = await inspectPluginOffering({ offeringCid: cid, offering, read: () => null });

    expect(result.status).toBe("pending");
    expect(result.bytes).toEqual({ held: [], pending: [offering.blobs[0]!.sha256], corrupt: [] });
    expect(Object.keys(result)).not.toContain("antigen");
    expect(Object.keys(result)).not.toContain("adoption");
  });

  test("a locally present byte with the wrong hash is corrupt, not held", async () => {
    const bytes = new TextEncoder().encode("one corrupt plugin");
    const { offering, cid } = await offeringFor(bytes);
    const result = await inspectPluginOffering({
      offeringCid: cid,
      offering,
      read: () => new TextEncoder().encode("tampered bytes"),
    });

    expect(result.status).toBe("corrupt");
    expect(result.bytes).toEqual({ held: [], pending: [], corrupt: [offering.blobs[0]!.sha256] });
  });

  test("a CID mismatch refuses before touching the injected CAS capability", async () => {
    const bytes = new TextEncoder().encode("wrong record address");
    const { offering, cid } = await offeringFor(bytes);
    let reads = 0;
    const result = await inspectPluginOffering({
      offeringCid: `sha256:${"a".repeat(64)}`,
      offering,
      read: () => { reads += 1; return bytes; },
    });

    expect(result.status).toBe("refused");
    expect(result.verification.ok).toBe(false);
    expect(result.reason).toMatch(/cid/i);
    expect(result.bytes).toEqual({ held: [], pending: [], corrupt: [] });
    expect(reads).toBe(0);
    expect(cid).not.toBe(result.offeringCid);
  });

  test("a malformed digest refuses before touching the injected CAS capability", async () => {
    const bytes = new TextEncoder().encode("malformed descriptor bytes");
    const blob = { id: "$:/plugins/example/malformed", version: "alpha", sha256: "not-a-digest" } as const;
    const offering = await signPluginOffering(
      { offeror: await offeror(), pluginsCid: computePluginsCid([blob]), blobs: [blob] }, sign,
    );
    let reads = 0;
    const result = await inspectPluginOffering({
      offeringCid: pluginOfferingCid(offering), offering,
      read: () => { reads += 1; return bytes; },
    });

    expect(result.status).toBe("refused");
    expect(result.verification.ok).toBe(false);
    expect(result.reason).toMatch(/malformed/i);
    expect(reads).toBe(0);
  });

  test("duplicate blob IDs refuse before touching the injected CAS capability", async () => {
    const first = { id: "$:/plugins/example/duplicate", version: "a", sha256: "a".repeat(64) } as const;
    const second = { id: first.id, version: "b", sha256: "b".repeat(64) } as const;
    const offering = await signPluginOffering(
      { offeror: await offeror(), pluginsCid: computePluginsCid([first, second]), blobs: [first, second] }, sign,
    );
    let reads = 0;
    const result = await inspectPluginOffering({
      offeringCid: pluginOfferingCid(offering), offering,
      read: () => { reads += 1; return new Uint8Array(); },
    });

    expect(result.status).toBe("refused");
    expect(result.verification.ok).toBe(false);
    expect(result.reason).toMatch(/malformed/i);
    expect(reads).toBe(0);
  });
});
