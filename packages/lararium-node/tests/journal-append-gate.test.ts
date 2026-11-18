/**
 * The journal-append door, measured on both sides of the wire (`docs/pono/mesh-goldens`): the event a projecting
 * wiki island posts travels the vessel's event route (`verbArgsFromPayload`, the `requestedBy` and `listenable` it
 * places) into the daemon's admission, and the daemon admits only a projector's entry over a mirror that stands.
 */
import { describe, test, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verbArgsFromPayload } from "@lararium/mesh";
import { admitJournalAppend, bagProjectedEvent, mirrorStands } from "../src/journal-append-gate.js";

const roots: string[] = [];
afterEach(() => { for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true }); });
function scratch(): string { const r = mkdtempSync(join(tmpdir(), "journal-append-")); roots.push(r); return r; }

/** The vessel's worker.event route (`open-node-vessel.ts` afterLive), as the daemon receives it. */
function routed(event: ReturnType<typeof bagProjectedEvent>): { invocation: { requestedBy: string; listenable: string }; args: Record<string, unknown> } {
  const { payload, listenable } = event;
  return {
    invocation: { requestedBy: typeof payload["requestedBy"] === "string" ? payload["requestedBy"] : listenable, listenable },
    args: verbArgsFromPayload(payload),
  };
}

describe("a projecting island's bag-projected event reaches the daemon journal", () => {
  test("RED: the event an island posts over a laid mirror admits as the bag's entry", () => {
    const root = scratch();
    writeFileSync(join(root, "note.tid"), "title: note\n\nbody");
    const { invocation, args } = routed(bagProjectedEvent("lar:///wiki", { bagId: "lares", path: root }));
    expect(admitJournalAppend(invocation, args)).toEqual({ ok: true, append: { kind: "bag-projected", data: { bagId: "lares", path: root } } });
  });

  test("RED: an entry naming a mirror where no carrier stands refuses by name", () => {
    const empty = scratch();
    const { invocation, args } = routed(bagProjectedEvent("lar:///wiki", { bagId: "lares", path: empty }));
    const verdict = admitJournalAppend(invocation, args);
    expect(verdict.ok).toBe(false);
    expect(verdict.ok ? null : verdict.refusal).toBe("mirror-not-standing");
    expect(mirrorStands(join(empty, "absent"))).toBe(false);
  });

  test("RED: a journal-append placed by any requester but the projector refuses", () => {
    const root = scratch();
    writeFileSync(join(root, "note.tid"), "x");
    const { args } = routed(bagProjectedEvent("lar:///wiki", { bagId: "lares", path: root }));
    const verdict = admitJournalAppend({ requestedBy: "wiki-surface", listenable: "projection:bag-projected" }, args);
    expect(verdict.ok ? null : verdict.refusal).toBe("not-a-projector");
    const offListenable = admitJournalAppend({ requestedBy: "disk-projector", listenable: "verse:click" }, args);
    expect(offListenable.ok ? null : offListenable.refusal).toBe("not-a-projector");
  });

  test("CONTROL: a malformed payload refuses as invalid, never as a projector refusal", () => {
    const verdict = admitJournalAppend({ requestedBy: "disk-projector", listenable: "projection:bag-projected" }, { kind: "bag-projected", data: { bagId: "lares" } }, () => true);
    expect(verdict.ok ? null : verdict.refusal).toBe("invalid-payload");
  });
});
