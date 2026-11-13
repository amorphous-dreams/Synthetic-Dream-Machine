/**
 * share-cmd — `lares bag share` / `lares wiki share`: one row per slug over face pet-names, written through to
 * config/share.tid, set in the control document and landed by the operator's hand; `--list` reads the one resolver.
 *
 *   SH1 — a row writes to the file (hN and --face resolve to pet-names), then share-set and share-apply ride in that order
 *   SH2 — no vessel standing: the file alone takes the row, and the line says the next boot reconciles it
 *   SH3 — `--list` prints each row's resolved readers and writers, and names a pet-name no face carries
 *   SH4 — a filter operator refuses by name and writes nothing
 */
import { describe, expect, test } from "vitest";
import { parseShareFile, type ShareFace } from "@lararium/mesh";
import { cmdShare, petnamesOf, shareListLines } from "../src/commands/share-cmd.js";
import { readBackOnExpiry, type ShareDoors } from "../src/share-doors.js";
import { LocalWaitExpired, type ReceiptAnswer } from "../src/local-connector.js";

const FACES: ShareFace[] = [{ handleIndex: 0, petname: "joshua-fontany" }, { handleIndex: 1, petname: "joshua-fontany-engineer" }, { handleIndex: 2, petname: "the referee" }];

function fake(opts: { vessel?: boolean; file?: string | null } = {}) {
  let file: string | null = opts.file ?? null;
  const verbs: Array<{ name: string; args: Record<string, unknown> }> = [];
  const out: string[] = [], err: string[] = [];
  const doors: ShareDoors = {
    faces: async () => FACES,
    file: { read: () => file, write: (t) => { file = t; } },
    verb: async (name, args) => { verbs.push({ name, args }); return opts.vessel === false ? null : (name === "share-apply" ? { granted: 1, pending: 1, waiting: [] } : { ok: true }); },
    out: (l) => out.push(l), err: (l) => err.push(l),
  };
  return { doors, verbs, out, err, file: () => file };
}
const args = (positional: string[], options: Record<string, string> = {}, flags: Record<string, boolean> = {}) => ({ command: "bag", positional, options, flags });

describe("the share door", () => {
  test("SH1 — a row writes through, then share-set and share-apply ride", async () => {
    const f = fake();
    expect(await cmdShare("bag", f.doors)(args(["notes"], { read: "h1", write: "joshua-fontany", face: "2", note: "for the walk" }))).toBe(0);
    const [row] = parseShareFile(f.file()!);
    expect(row).toEqual({ slug: "notes", kind: "bag", read: "joshua-fontany-engineer [[the referee]]", write: "joshua-fontany", note: "for the walk" });
    expect(f.verbs.map((v) => v.name)).toEqual(["share-set", "share-apply"]);
    expect(f.verbs[1]!.args["faces"]).toEqual(FACES.map((x) => ({ handleIndex: x.handleIndex, petname: x.petname })));
    expect(f.out.join("\n")).toMatch(/landed: 1 grant\(s\); 1 wait for a shut face/);
  });

  test("SH2 — no vessel: the file alone takes the row", async () => {
    const f = fake({ vessel: false });
    expect(await cmdShare("wiki", f.doors)(args(["garden"], { read: "*" }))).toBe(0);
    expect(parseShareFile(f.file()!)[0]).toMatchObject({ slug: "garden", kind: "wiki", read: "*" });
    expect(f.out.join("\n")).toMatch(/the next boot reconciles the file/);
  });

  test("SH3 — --list reads the one resolver and names a pet-name no face carries", async () => {
    const f = fake();
    await cmdShare("bag", f.doors)(args(["notes"], { read: "nobody-here h2" }));
    const lines = shareListLines(parseShareFile(f.file()!), FACES);
    expect(lines[0]).toMatch(/^bag notes: read the referee \(h2\)/);
    expect(lines.join("\n")).toMatch(/"nobody-here" names no face here/);
    const g = fake({ file: f.file() });
    expect(await cmdShare("bag", g.doors)(args([], {}, { list: true }))).toBe(0);
    expect(g.verbs).toEqual([]);
  });

  test("SH4 — a filter operator refuses and writes nothing", async () => {
    const f = fake();
    expect(await cmdShare("bag", f.doors)(args(["notes"], { read: "[tag[x]]" }))).toBe(2);
    expect(f.file()).toBeNull();
    expect(() => petnamesOf("h9", FACES)).toThrow(/h9 names no face/);
  });
});

describe("a share verb that outruns the local wait", () => {
  const ports = (answers: ReceiptAnswer[]) => {
    const asked: string[] = [], notes: string[] = [];
    let clock = 0;
    return { asked, notes, ports: {
      receipt: async (id: string) => { asked.push(id); return answers[Math.min(asked.length - 1, answers.length - 1)]!; },
      pause: async (ms: number) => { clock += ms; }, now: () => clock, patienceMs: 5_000, note: (l: string) => notes.push(l),
    } };
  };
  const expires = async () => { throw new LocalWaitExpired("share-apply", 30_000, "req-1"); };

  test("the landing's own receipt answers once the local wait ends: the outcome reads off the request id, never as unknown", async () => {
    const p = ports([{ requestId: "req-1", state: "committed" }, { requestId: "req-1", state: "committed" }, { requestId: "req-1", state: "done", results: { summary: { ok: true } } }]);
    let runs = 0;
    const result = await readBackOnExpiry("share-apply", async () => { runs += 1; return expires(); }, p.ports);
    expect(result).toMatchObject({ status: "done", requestId: "req-1", results: { summary: { ok: true } } });
    expect(p.asked).toEqual(["req-1", "req-1", "req-1"]);
    expect(runs).toBe(1);   // a read-back never dispatches the verb a second time
    expect(p.notes.join("\n")).toMatch(/share-apply still lands.*req-1/);
    // CONTROL: a verb that answers inside the wait reads no receipt at all.
    const quick = ports([]);
    expect(await readBackOnExpiry("share-set", async () => ({ status: "done" as const, requestId: "req-2" }), quick.ports)).toMatchObject({ requestId: "req-2" });
    expect(quick.asked).toEqual([]);
  });

  test("a landing still running when the read-back's patience ends names the receipt door, and a vessel that abandoned it says so", async () => {
    const still = ports([{ requestId: "req-1", state: "committed" }]);
    await expect(readBackOnExpiry("share-apply", expires, still.ports)).rejects.toThrow(/still lands after .*lares receipt req-1/);
    const gone = ports([{ requestId: "req-1", state: "abandoned" }]);
    await expect(readBackOnExpiry("share-apply", expires, gone.ports)).rejects.toThrow(/request-abandoned/);
  });
});
