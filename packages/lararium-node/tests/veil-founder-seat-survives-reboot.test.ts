/**
 * veil-founder-seat-survives-reboot — the founding agent's OWN seat re-hydrates through every reboot shape.
 *
 * The veil archive exists so a lit vessel that founded a face re-knows its own PersonaGroup after the
 * night: a boot delegates bags to `personaGroupId` (the face), and a veil that could not name that
 * agent would throw `audience not known` and take the vessel down. This vector holds the invariant at the
 * grain the daemon actually reboots at — the veil stood over a real founding daemon doc, restored the four
 * ways a reboot can restore it — so a regression that stops the founder's own seat from re-hydrating reds
 * here rather than at a crossroads power-cut.
 *
 *   R1 — event store only (the FIRST daemon boot after founding, before any veil archive is written)
 *   R2 — archive + event store (the ordinary sealed reboot)
 *   R3 — archive only, empty store (the archive-only restore: cap events absent, archive kept)
 *   CONTROL — a genuinely-unknown agent stays unknown through the same restore
 */
import { describe, test, expect } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import type { AutomergeUrl } from "@automerge/automerge-repo";
import { runFoundingCeremony, KeyhiveProvider, DaemonEventStore } from "@lararium/keyhive";
import * as ed25519 from "@noble/ed25519";
import {
  hex,
  CompositeStore, DAEMON_BAG_ID, AutomergeDocStore, type LarDoc,
} from "@lararium/mesh";

const FOUNDER_SEED = new Uint8Array(32).fill(7);
const pubOf = async (seed: Uint8Array): Promise<string> => hex(await ed25519.getPublicKeyAsync(seed));
const UNKNOWN_AGENT = "cd".repeat(32); // a well-formed 32-byte identifier this vessel never met

describe("the founder's veil seat survives the night", () => {
  test("★ knowsAgent(the founding PersonaGroup) holds through every reboot shape ★", async () => {
    const repo = new Repo({ sharePolicy: async () => true });
    const verifyingKey = await pubOf(FOUNDER_SEED);
    const f = await runFoundingCeremony({ repo, vesselSeed: FOUNDER_SEED, placeVerifyingKey: verifyingKey,
      vesselDisplayName: "Reboot Shrine",
      binding: { mode: "self-stood", signerSeed: FOUNDER_SEED },
      hearthTrueName: "", nexusPubkey: verifyingKey,
    });
    const handle = await repo.find(f.daemonUrl as AutomergeUrl);
    const veilSeed = f.atomSeed;

    // The composite the daemon worker's onEa receives: an AutomergeDocStore layer over the daemon doc.
    const composite = new CompositeStore();
    composite.addLayer({ bagId: DAEMON_BAG_ID, store: new AutomergeDocStore(handle as never, DAEMON_BAG_ID), writable: true });
    const eventStore = new DaemonEventStore({ daemon: composite, face: f.personaGroupId });

    // R1 — event store only (the first daemon boot, no veil archive yet).
    const r1 = new KeyhiveProvider();
    await r1.init({ seed: veilSeed, eventStore });
    await r1.hydrateFromEventStore();
    expect(await r1.knowsAgent(f.personaGroupId), "R1 event-store boot re-knows the face").toBe(true);
    const archive = await r1.exportArchive();

    // R2 — archive + event store (the ordinary sealed reboot).
    const r2 = new KeyhiveProvider();
    await r2.init({ seed: veilSeed, eventStore, archiveBytes: archive });
    await r2.hydrateFromEventStore();
    expect(await r2.knowsAgent(f.personaGroupId), "R2 sealed reboot re-knows the face").toBe(true);
    expect(await r2.knowsAgent(UNKNOWN_AGENT), "CONTROL — an unmet agent stays unknown").toBe(false);

    // R3 — archive only, cap events gone (the archive-only restore).
    const emptyStore = { put: async () => {}, list: async () => [] };
    const r3 = new KeyhiveProvider();
    await r3.init({ seed: veilSeed, eventStore: emptyStore, archiveBytes: archive });
    await r3.hydrateFromEventStore();
    expect(await r3.knowsAgent(f.personaGroupId), "R3 archive-only restore re-knows the face").toBe(true);

    await r1.dispose(); await r2.dispose(); await r3.dispose();
    await repo.shutdown();
  });
});
