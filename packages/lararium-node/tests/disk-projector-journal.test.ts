/**
 * The projector names the bag it laid. A `LarDiskProjector` standing over a vessel journal appends one
 * `bag-projected` entry per bag, after that bag's first carrier stands on disk, so a reader awaiting the entry
 * finds the files already there. The mesh goldens' first script (herm-reshares step ③) awaits this entry
 * instead of polling a clock (`docs/pono/mesh-goldens`).
 */
import { describe, test, expect, afterEach } from "vitest";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { memoryJournal, type JournalEntry } from "@lararium/mesh";
import { LarDiskProjector } from "../src/disk-projector.js";
import type { CarrierFile } from "@lararium/tw5";

const roots: string[] = [];
afterEach(() => { for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true }); });
function scratch(): string { const r = mkdtempSync(join(tmpdir(), "projector-journal-")); roots.push(r); return r; }

type Flushing = { flush: (bagId: string, uri: string) => Promise<void> };
const carrier = async (): Promise<CarrierFile> => ({ ext: ".tid", body: "title: note\ntype: text/vnd.tiddlywiki\n\nbody", defaultRelPath: "note.tid" });

function filesUnder(dir: string): number {
  if (!existsSync(dir)) return 0;
  let n = 0;
  for (const e of readdirSync(dir, { withFileTypes: true, recursive: true })) if (e.isFile()) n++;
  return n;
}

describe("a projector over a journal names each bag it lays", () => {
  test("RED: the first carrier written into a bag appends one bag-projected entry, and the files stand when it resolves", async () => {
    const root = scratch();
    const journal = memoryJournal("epoch-test", "daemon");
    const projector = new LarDiskProjector({ mirrors: [{ bagId: "lares", mirrorRoot: root }], carrierFileFn: carrier, journal });
    const seen = journal.waitFor((e) => e.kind === "bag-projected").then((e: JournalEntry) => ({ e, files: filesUnder(root) }));
    await (projector as unknown as Flushing).flush("lares", "lar:///ha.ka.ba/lares/api/note");
    const { e, files } = await seen;
    expect(e.kind).toBe("bag-projected");
    expect(e.data).toEqual({ bagId: "lares", path: root });
    expect(files).toBeGreaterThan(0);
  });

  test("RED: a second carrier in the same bag appends no second entry", async () => {
    const root = scratch();
    const journal = memoryJournal("epoch-test", "daemon");
    const projector = new LarDiskProjector({ mirrors: [{ bagId: "lares", mirrorRoot: root }], carrierFileFn: carrier, journal }) as unknown as Flushing;
    await projector.flush("lares", "lar:///ha.ka.ba/lares/api/note");
    await projector.flush("lares", "lar:///ha.ka.ba/lares/api/other");
    expect(journal.since().filter((e) => e.kind === "bag-projected")).toHaveLength(1);
  });

  test("RED: a bag the journal already names as projected in this epoch appends nothing on a fresh projector", async () => {
    const root = scratch();
    const journal = memoryJournal("epoch-test", "daemon");
    journal.append("bag-projected", { bagId: "lares", path: root });
    const projector = new LarDiskProjector({ mirrors: [{ bagId: "lares", mirrorRoot: root }], carrierFileFn: carrier, journal }) as unknown as Flushing;
    await projector.flush("lares", "lar:///ha.ka.ba/lares/api/note");
    expect(journal.since().filter((e) => e.kind === "bag-projected")).toHaveLength(1);
  });

  test("CONTROL: a carrier that writes no file appends no entry, and a later laid bag's entry is the one a waiter receives", async () => {
    const root = scratch();
    const other = scratch();
    const journal = memoryJournal("epoch-test", "daemon");
    const projector = new LarDiskProjector({
      mirrors: [{ bagId: "lares", mirrorRoot: root }, { bagId: "lararium", mirrorRoot: other }],
      carrierFileFn: async (uri: string) => (uri.includes("/lararium/") ? carrier() : null),
      journal,
    }) as unknown as Flushing;
    const first = journal.waitFor((e) => e.kind === "bag-projected");
    await projector.flush("lares", "lar:///ha.ka.ba/lares/api/absent");
    await projector.flush("lararium", "lar:///ha.ka.ba/lararium/api/note");
    const e = await first;
    expect(e.data).toEqual({ bagId: "lararium", path: other });
    expect(filesUnder(root)).toBe(0);
  });
});
