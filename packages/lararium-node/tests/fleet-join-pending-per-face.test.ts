/**
 * fleet-join-pending, per face — each face's half-done join rests in its own row, so two faces join at once and one
 * face's pending join never answers for, blocks or clears another's. Reds: a second DIFFERENT join for the same face
 * refuses; clearing one face's join leaves the other's; the carrier names no shared row. Controls: the same join again
 * is idempotent; each face reads its own.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { withLarRoot } from "../../../tests/harness/with-lar-root.js";
import { seatedCustody, unseatCustody } from "../src/custody-seat.js";
import {
  clearPendingFleetJoin, fleetJoinPendingFile, keepPendingFleetJoin, listPendingFleetJoinGroups, readPendingFleetJoin,
} from "../src/fleet-join-custody.js";
import { sealTestCustody } from "./found-route.js";

const root = mkdtempSync(join(tmpdir(), "lar-pending-per-face-"));
const A = "aa".repeat(16), B = "bb".repeat(16);
const join_ = (group: string, nonce: string) => ({ request: { nonce }, offer: { personaGroup: group }, sealSecret: "11".repeat(32) });

afterAll(async () => {
  await withLarRoot(root, async () => { const h = seatedCustody(); if (h) { await h.lock(); unseatCustody(h); } });
  rmSync(root, { recursive: true, force: true });
});

describe("fleet-join-pending per face", () => {
  test("two faces join at once; each reads, clears and refuses on its own row", async () => {
    await withLarRoot(root, async () => {
      await sealTestCustody();
      expect(fleetJoinPendingFile(A)).not.toBe(fleetJoinPendingFile(B));
      await keepPendingFleetJoin(A, join_(A, "n-a"));
      await keepPendingFleetJoin(B, join_(B, "n-b"));
      await keepPendingFleetJoin(A, join_(A, "n-a"));                                   // CONTROL: the same join again changes nothing
      expect((await readPendingFleetJoin(A))?.request).toEqual({ nonce: "n-a" });
      expect((await readPendingFleetJoin(B))?.request).toEqual({ nonce: "n-b" });
      await expect(keepPendingFleetJoin(A, join_(A, "n-other"))).rejects.toBeDefined();   // RED: another join for the same face
      expect((await listPendingFleetJoinGroups()).sort()).toEqual([A, B]);
      expect(await clearPendingFleetJoin(A, "n-b")).toBe(false);                         // RED: B's nonce clears nothing of A's
      expect(await clearPendingFleetJoin(A, "n-a")).toBe(true);
      expect(await readPendingFleetJoin(A)).toBeNull();
      expect((await readPendingFleetJoin(B))?.request).toEqual({ nonce: "n-b" });        // B stands
    });
  });
});
