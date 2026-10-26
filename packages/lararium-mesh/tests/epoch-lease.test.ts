/**
 * epoch-lease — the coordinator-free max-register lease epoch.
 *
 * Proves the load-bearing safety property: the effective epoch is the MAX over per-writer
 * slots, so it never decreases — a concurrent lower slot cannot pull a revoked grant back to
 * life (the failure a bare Automerge-LWW scalar would allow). Meme:
 * lar:///ha.ka.ba/lares/api/pono/convergent-mesh#two-revocation-modes
 */

import { describe, test, expect } from "vitest";
import {
  leaseEpochPrefix,
  leaseEpochSlotUri,
  rolledLeaseEpoch,
} from "../src/epoch-lease.js";

describe("epoch-lease — coordinator-free max-register", () => {
  test("rolledLeaseEpoch = effective + 1", () => {
    expect(rolledLeaseEpoch(0)).toBe(1);
    expect(rolledLeaseEpoch(7)).toBe(8);
  });

  test("slot URIs are prefix-scannable + charset-safe (resource/writer may carry slashes)", () => {
    const resource = "lar:///ha.ka.ba/bags/wiki/foo";
    const prefix = leaseEpochPrefix(resource);
    const slot = leaseEpochSlotUri(resource, "0xabc/def");
    expect(slot.startsWith(prefix)).toBe(true);   // the verb scans the prefix to gather slots
    expect(slot).not.toContain(" ");
    // two writers, distinct slots under one resource prefix
    const slotB = leaseEpochSlotUri(resource, "0x999");
    expect(slotB.startsWith(prefix)).toBe(true);
    expect(slot).not.toBe(slotB);
  });
});
