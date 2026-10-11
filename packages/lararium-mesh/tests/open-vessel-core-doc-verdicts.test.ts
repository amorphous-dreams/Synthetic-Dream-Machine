/**
 * H2 — `assembleVessel`'s social-plane mount (`mountSocial`) must never treat a probe's
 * `unresolved` verdict (its own patience spent, or a signal-less boundary death) as grounds to
 * quarantine. Before this fix, `isCondemned` read `status !== "ok"`, so a `timeout` verdict
 * quarantined the doc exactly like a real tear — proven live by the episkopos's SIGSTOP freeze
 * probe, which relocated five healthy docs, the daemon doc among them, under a frozen
 * clean-tail child.
 *
 * Proven here against the REAL `assembleVessel`, with a minimal in-memory keel (no genesis/
 * persona plumbing — `daemonUrl` is the only social-plane doc mounted):
 *   · a `torn` verdict with no recovery quarantines and mounts read-only, `status:"degraded"`.
 *   · an `unresolved` verdict NEVER quarantines, mounts read-only, `status:"pending"` — and
 *     the manifest's `degraded` flag stays false (liveness is not safety evidence).
 *   · a clean-tail recovery that itself answers `unresolved` does NOT count as a promotion —
 *     the ORIGINAL (torn) verdict's quarantine still fires.
 *   · a clean-tail recovery that answers `ok` promotes and mounts writable.
 *   · MUTATION PROOF: re-enacting the retired `isCondemned` (`status !== "ok"`) against the
 *     `unresolved` verdict reads `true` — the exact shape that quarantined the daemon doc.
 */
import { describe, expect, it, vi } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { assembleVessel, type VesselKeel, type MountEntry } from "../src/open-vessel-core.js";
import { emptyLarDoc, type LarDoc } from "../src/base-doc.js";
import { isCondemned, type ProbeResult, type DocLoadProbe } from "../src/doc-load-probe-contract.js";

function documentIdFromUrl(url: string): string {
  return url.startsWith("automerge:") ? url.slice("automerge:".length) : url;
}

async function buildKeel(opts: {
  probe: DocLoadProbe["probe"];
  quarantineDoc?: VesselKeel["quarantineDoc"];
  recoverCleanTail?: VesselKeel["recoverCleanTail"];
}): Promise<{ keel: VesselKeel; daemonDocId: string }> {
  const repo = new Repo();
  const catalogHandle = repo.create<LarDoc>(emptyLarDoc());
  const islandHandle  = repo.create<LarDoc>(emptyLarDoc());
  const daemonHandle  = repo.create<LarDoc>(emptyLarDoc());

  const keel: VesselKeel = {
    repo,
    catalogHandle,
    waitHandle: async <T>(url: string) => repo.find(url as never) as unknown as Promise<never> as never,
    loadGenesis: async () => ({
      islandHandle,
      coreHash: "test-core-hash",
      bootstrap: { daemonUrl: daemonHandle.url, personaPlanes: [] },
    }),
    tempStore: () => ({ }) as never,
    docLoadProbe: { probe: opts.probe },
    ...(opts.quarantineDoc ? { quarantineDoc: opts.quarantineDoc } : {}),
    ...(opts.recoverCleanTail ? { recoverCleanTail: opts.recoverCleanTail } : {}),
  };
  return { keel, daemonDocId: documentIdFromUrl(daemonHandle.url) };
}

function findEntry(entries: readonly MountEntry[], documentId: string): MountEntry | undefined {
  return entries.find((e) => e.documentId === documentId);
}

describe("assembleVessel — doc-load-probe verdicts decide the mount (H2)", () => {
  it("torn, no recovery: quarantines, mounts read-only degraded", async () => {
    const quarantineDoc = vi.fn();
    const { keel, daemonDocId } = await buildKeel({
      probe: async (documentId) => ({ documentId, status: "torn", reason: "framing gate" } as ProbeResult),
      quarantineDoc,
    });
    const { mountManifest } = await assembleVessel(keel);
    expect(quarantineDoc).toHaveBeenCalledTimes(1);
    expect(findEntry(mountManifest.entries, daemonDocId)?.status).toBe("degraded");
    expect(mountManifest.degraded).toBe(true);
  });

  it("unresolved: NEVER quarantines, mounts pending, manifest stays non-degraded", async () => {
    const quarantineDoc = vi.fn();
    const { keel, daemonDocId } = await buildKeel({
      probe: async (documentId) => ({ documentId, status: "unresolved", reason: "load exceeded 30000ms — no verdict" } as ProbeResult),
      quarantineDoc,
    });
    const { mountManifest } = await assembleVessel(keel);
    expect(quarantineDoc).not.toHaveBeenCalled();
    const entry = findEntry(mountManifest.entries, daemonDocId);
    expect(entry?.status).toBe("pending");
    expect(mountManifest.degraded).toBe(false);
  });

  it("torn + recovery itself unresolved: still quarantines on the ORIGINAL evidence, never masquerades as a torn-base reject", async () => {
    const quarantineDoc = vi.fn();
    const { keel, daemonDocId } = await buildKeel({
      probe: async (documentId) => ({ documentId, status: "torn", reason: "framing gate" } as ProbeResult),
      quarantineDoc,
      recoverCleanTail: async (verdict) => ({ documentId: verdict.documentId, status: "unresolved", reason: "clean-tail timed out" }),
    });
    const { mountManifest } = await assembleVessel(keel);
    expect(quarantineDoc).toHaveBeenCalledTimes(1);
    expect(findEntry(mountManifest.entries, daemonDocId)?.status).toBe("degraded");
  });

  it("torn + recovery answers ok: promotes, mounts writable, no quarantine", async () => {
    const quarantineDoc = vi.fn();
    const { keel, daemonDocId } = await buildKeel({
      probe: async (documentId) => ({ documentId, status: "torn", reason: "framing gate" } as ProbeResult),
      quarantineDoc,
      recoverCleanTail: async (verdict) => ({
        documentId: verdict.documentId, status: "ok", heads: [],
        cleanTail: { kept: 3, movedAside: ["a"] },
      }),
    });
    const { mountManifest } = await assembleVessel(keel);
    expect(quarantineDoc).not.toHaveBeenCalled();
    expect(findEntry(mountManifest.entries, daemonDocId)?.status).toBe("promoted");
    expect(mountManifest.degraded).toBe(false);
  });

  it("MUTATION PROOF: the retired isCondemned (status !== \"ok\") reads an unresolved verdict as condemned", () => {
    const unresolved: ProbeResult = { documentId: "x", status: "unresolved" };
    const oldIsCondemned = (r: ProbeResult): boolean => r.status !== "ok";
    expect(oldIsCondemned(unresolved)).toBe(true);     // the exact shape that quarantined the daemon doc
    expect(isCondemned(unresolved)).toBe(false);        // the fix: unresolved is never condemned
  });
});
