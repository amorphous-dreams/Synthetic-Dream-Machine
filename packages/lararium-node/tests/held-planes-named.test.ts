/**
 * A HELD PLANE NAMES ITSELF IN WORDS THAT HOLD, AND ONLY THE ACT THAT RELEASES IT.
 *
 *   W1  the fall's hand act says what the plane does (it reads empty, read-only, while its bytes rest in place) and which
 *       stop clears the count (a clean stop, exit 0), never "read the held plane".
 *   W2  a PENDING boot line names no door that leaves the hold standing (the deep probe reads no fall); it names the clean
 *       stop and a fresh stand.
 *   W3  a DEGRADED plane held in quarantine names the release act at every boot, not only at the move.
 *   W4  health names held planes as a note, never flipping liveness: 200 and `ready` stand while a plane stays held.
 *   W5  the boot that moves the bytes prints one DEGRADED line per held plane: the move's own line names the move alone.
 */
import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, test } from "vitest";
import type { MountManifest } from "@lararium/mesh/open-vessel-core";
import { HELD_HAND_ACT } from "../src/engine-fall.js";
import { heldPlaneLines, quarantineMoveLine, QUARANTINE_RELEASE_ACT } from "../src/doc-load-probe.js";
import { createReadinessState, mountReadinessFace } from "../src/readiness-face.js";

const servers: Server[] = [];
afterEach(async () => {
  for (const server of servers.splice(0)) {
    if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

const manifest: MountManifest = {
  degraded: true,
  entries: [
    { bagId: "lar:///ha.ka.ba/wikis/daemon/working", documentId: "pendingDoc", status: "pending", reason: "unresolved: load exceeded 30000ms — no verdict" },
    { bagId: "lar:///ha.ka.ba/faces/one/circles", documentId: "heldDoc", status: "degraded", reason: "torn: held in quarantine since 2026-11-22" },
    { bagId: "lar:///ha.ka.ba/faces/one/identities", documentId: "liveDoc", status: "mounted" },
  ],
};

describe("held planes name themselves truly", () => {
  test("W1 — the fall's hand act names what the plane reads and the clean stop that clears the count", () => {
    expect(HELD_HAND_ACT).not.toMatch(/read the held plane/);
    expect(HELD_HAND_ACT).toMatch(/reads empty, read-only, while its bytes rest in place/);
    expect(HELD_HAND_ACT).toMatch(/a clean stop \(exit 0\)/);
  });

  test("W2 — a PENDING line names the clean stop and a fresh stand, and no door the hold outlives", () => {
    const lines = heldPlaneLines("[lararium]", manifest);
    const pending = lines.find((l) => l.includes("pendingDoc"));
    expect(pending).toMatch(/PENDING plane/);
    expect(pending).not.toMatch(/vessel doctor/);
    expect(pending).toMatch(/a clean stop \(exit 0\)/);
  });

  test("W3 — a DEGRADED plane held in quarantine names the release act at every boot", () => {
    const lines = heldPlaneLines("[lararium]", manifest);
    const held = lines.find((l) => l.includes("heldDoc"));
    expect(held).toMatch(/DEGRADED plane/);
    expect(held).toContain(QUARANTINE_RELEASE_ACT);
    expect(lines.some((l) => l.includes("liveDoc"))).toBe(false);
  });

  test("W4 — health notes held planes and stays ready", async () => {
    const server = createServer(); servers.push(server);
    const state = createReadinessState();
    mountReadinessFace({ httpServer: server, state, standing: "lararium" });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("readiness test did not bind");
    state.markReady();
    state.notePlanes?.(manifest);
    const answer = await fetch(`http://127.0.0.1:${address.port}/api/health`);
    expect(answer.status).toBe(200);
    expect(await answer.json()).toEqual({ status: "ready", held: { pending: 1, degraded: 1 } });
  });

  test("W5 — the quarantine's own boot line names the move, never a second DEGRADED line", () => {
    const line = quarantineMoveLine({ documentId: "heldDoc", status: "torn", reason: "a tear" }, "/store/quarantine-torn-snapshots-x/he__ldDoc");
    expect(line).toMatch(/QUARANTINED heldDoc/);
    expect(line).toContain("/store/quarantine-torn-snapshots-x/he__ldDoc");
    expect(line).not.toMatch(/DEGRADED/);
    // The boot's one DEGRADED line for that plane comes from the mount manifest.
    expect(heldPlaneLines("[lararium]", manifest).filter((l) => l.includes("heldDoc") && /DEGRADED/.test(l))).toHaveLength(1);
  });
});
