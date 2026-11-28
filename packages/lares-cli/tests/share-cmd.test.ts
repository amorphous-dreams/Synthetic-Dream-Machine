/**
 * share-cmd — `lares bag share` / `lares wiki share`: one row per slug over face pet-names, written through to
 * config/share.tid, set in the control document and landed by the operator's hand; `--list` reads the one resolver.
 *
 *   SH1 — a row writes to the file (hN and --face resolve to pet-names), then share-set and share-apply ride in that order
 *   SH2 — no vessel standing: the file alone takes the row, and the line says the next boot reconciles it
 *   SH3 — `--list` prints each row's resolved readers and writers, and names a pet-name no face carries
 *   SH3b — `--list json=true` prints each row as written (`*`, an unheld pet-name, workspace, owner, note kept) beside the resolver
 *   SH4 — a filter operator refuses by name and writes nothing
 *   SH6 — a row of the other kind standing for the slug refuses `share-kind-standing`, writes nothing and rides no verb;
 *         `--remove` unshares the row (file and control document), and the other kind then shares
 *   SH14 — a share that founds the workbench writes the realm id back to its realm label; `realm list` reads it (weld)
 *   SH15 — a realm label write that fails names itself on stderr and never aborts the share or its owner write-back
 */
import { afterAll, describe, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseShareFile, serializeShareFile, type ShareFace } from "@lararium/mesh/share-config";
import { cmdShare, petnamesOf, shareListJson, shareListLines } from "../src/commands/share-cmd.js";
import { cmdRealm } from "../src/commands/realm.js";
import { readBackOnExpiry, unhandedLine, type ShareDoors } from "../src/share-doors.js";
import { LocalWaitExpired, type ReceiptAnswer } from "../src/local-connector.js";

const FACES: ShareFace[] = [{ handleIndex: 0, petname: "joshua-fontany" }, { handleIndex: 1, petname: "joshua-fontany-engineer" }, { handleIndex: 2, petname: "the referee" }];

const SCRATCH: string[] = [];
afterAll(() => { for (const d of SCRATCH) rmSync(d, { recursive: true, force: true }); });

function fake(opts: { vessel?: boolean; file?: string | null; applied?: Record<string, unknown>; seat?: boolean; unread?: boolean; refuseSet?: boolean } = {}) {
  let file: string | null = opts.file ?? null;
  const projections = mkdtempSync(join(tmpdir(), "lar-share-cmd-"));
  SCRATCH.push(projections);
  const verbs: Array<{ name: string; args: Record<string, unknown> }> = [];
  const out: string[] = [], err: string[] = [];
  const doors: ShareDoors = {
    faces: async () => FACES,
    file: { read: () => file, write: (t) => { file = t; } },
    verb: async (name, args) => { verbs.push({ name, args }); if (opts.refuseSet === true && name === "share-set") throw new Error("share-needs-hand: refused"); return opts.vessel === false ? null : (name === "share-apply" ? opts.applied ?? { granted: 1, pending: 1, waiting: [] } : { ok: true }); },
    out: (l) => out.push(l), err: (l) => err.push(l),
    hand: () => (opts.seat === true ? { refusal: "hand-act-only" } : opts.unread === true ? { refusal: "hand-unattested" } : { admit: "hand" }),
    projections: () => projections,
  };
  return { doors, verbs, out, err, file: () => file, projections };
}
const args = (positional: string[], options: Record<string, string> = {}, flags: Record<string, boolean> = {}) => ({ command: "bag", positional, options, flags });

describe("the share door keeps the file with the door", () => {
  test("W1 — a refusing share-set leaves the file bytes as they were", async () => {
    const seeded = fake();
    await cmdShare("bag", seeded.doors)(args(["notes"], { read: "h1" }));
    const before = seeded.file();
    const f = fake({ file: before, refuseSet: true });
    await expect(cmdShare("bag", f.doors)(args(["notes"], { read: "h2", write: "h2" }))).rejects.toThrow(/share-needs-hand/);
    expect(f.file(), "the refusal wrote nothing").toBe(before);
  });

  test("W1 — a seat-marked run writes nothing, asks the vessel nothing, and names the terminal cure", async () => {
    const f = fake({ seat: true });
    expect(await cmdShare("bag", f.doors)(args(["notes"], { read: "h1" }))).toBe(1);
    expect(f.file()).toBeNull();
    expect(f.verbs).toEqual([]);
    expect(f.err.join("\n")).toMatch(/share-needs-hand: hand-act-only: .*`lares bag share notes …` on their own terminal/);
    const g = fake({ seat: true, file: null });
    expect(await cmdShare("bag", g.doors)(args(["notes"], {}, { remove: true }))).toBe(1);
    expect(g.verbs).toEqual([]);
    expect(await cmdShare("bag", g.doors)(args([], {}, { list: true })), "a read stays open to a seat").toBe(0);
  });

  test("RED: W1 — a run whose chain reads nothing writes nothing either: the gate reads the chain, never the mark alone", async () => {
    const f = fake({ unread: true });
    expect(await cmdShare("bag", f.doors)(args(["notes"], { read: "h1" }))).toBe(1);
    expect(f.file()).toBeNull();
    expect(f.verbs).toEqual([]);
    expect(f.err.join("\n")).toMatch(/share-needs-hand: hand-unattested: /);
  });
});

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

  test("SH3b — --list json=true keeps each row's own policy beside the resolver's answer", async () => {
    const rows = [
      { slug: "garden", kind: "wiki" as const, read: "*", write: "[[the referee]] nobody-here", workspace: "garden-bench", owner: "joshua-fontany", note: "for the walk" },
      { slug: "notes", kind: "bag" as const, read: "joshua-fontany-engineer", write: "" },
    ];
    const f = fake({ file: serializeShareFile(rows) });
    expect(await cmdShare("bag", f.doors)(args([], {}, { list: true, json: true }))).toBe(0);
    expect(f.out).toHaveLength(1);
    const printed = JSON.parse(f.out[0]!) as ReturnType<typeof shareListJson>;
    const garden = printed.rows.find((r) => r.slug === "garden")!;
    expect(garden).toMatchObject({ kind: "wiki", read: "*", write: "[[the referee]] nobody-here", workspace: "garden-bench", owner: "joshua-fontany", note: "for the walk" });
    expect(garden.resolved.waiting).toContain("nobody-here");
    expect(garden.resolved.write).toEqual([2]);
    expect(printed.rows.find((r) => r.slug === "notes")).toMatchObject({ read: "joshua-fontany-engineer", resolved: { read: [1] } });
    expect(f.verbs).toEqual([]);
  });

  test("SH4 — a filter operator refuses and writes nothing", async () => {
    const f = fake();
    expect(await cmdShare("bag", f.doors)(args(["notes"], { read: "[tag[x]]" }))).toBe(2);
    expect(f.file()).toBeNull();
    expect(() => petnamesOf("h9", FACES)).toThrow(/h9 names no face/);
  });

  test("SH6 — a row of the other kind refuses and writes nothing; --remove unshares it, then the other kind shares", async () => {
    const standing = serializeShareFile([{ slug: "cold-shelf", kind: "wiki", read: "the referee", write: "", owner: "joshua-fontany" }]);
    const f = fake({ file: standing });
    expect(await cmdShare("bag", f.doors)(args(["cold-shelf"], { read: "h1 h2" }))).toBe(2);
    expect(f.err.join("\n")).toMatch(/share-kind-standing: "cold-shelf" stands shared as a wiki row.*unshare it first \(`lares wiki share cold-shelf remove=true`\)/);
    expect(f.file(), "the wiki row stands whole").toBe(standing);
    expect(f.verbs).toEqual([]);
    expect(await cmdShare("wiki", f.doors)(args(["cold-shelf"], {}, { remove: true }))).toBe(0);
    expect(parseShareFile(f.file()!)).toEqual([]);
    expect(f.verbs.map((v) => v.name), "the landed grants revoke first, with the row still standing; then the row leaves").toEqual(["share-apply", "share-set"]);
    expect(f.verbs[0]!.args["unshare"]).toEqual(["cold-shelf"]);
    expect(f.verbs[1]).toEqual({ name: "share-set", args: { slug: "cold-shelf", remove: true } });
    f.verbs.length = 0;
    expect(await cmdShare("bag", f.doors)(args(["cold-shelf"], { read: "h1 h2" }))).toBe(0);
    expect(parseShareFile(f.file()!)).toEqual([{ slug: "cold-shelf", kind: "bag", read: "joshua-fontany-engineer [[the referee]]", write: "" }]);
    // --remove names the kind the row carries: the other kind's door refuses, and a slug no row holds reads as such.
    const g = fake({ file: standing });
    expect(await cmdShare("bag", g.doors)(args(["cold-shelf"], {}, { remove: true }))).toBe(2);
    expect(g.file()).toBe(standing);
    expect(await cmdShare("bag", g.doors)(args(["nothing-here"], {}, { remove: true }))).toBe(2);
    expect(g.verbs).toEqual([]);
  });

  test("SH9 — a remove that cannot revoke a landed grant refuses to say unshared: the row stays in the file and the control document, and the line names what still reads", async () => {
    const standing = serializeShareFile([{ slug: "notes", kind: "bag", read: "the referee", write: "" }]);
    const f = fake({ file: standing, applied: { ok: true, revoked: 0, standing: ["notes"] } });
    expect(await cmdShare("bag", f.doors)(args(["notes"], {}, { remove: true }))).toBe(1);
    expect(f.file(), "the row stands whole").toBe(standing);
    expect(f.verbs.map((v) => v.name), "no share-set remove rides").toEqual(["share-apply"]);
    expect(f.err.join("\n")).toMatch(/notes stays shared\. A grant its row landed still reads/);
    expect(f.out.join("\n")).not.toMatch(/unshared/);
  });

  test("SH10 — a remove that revoked says how many grants it took back", async () => {
    const f = fake({ file: serializeShareFile([{ slug: "notes", kind: "bag", read: "the referee", write: "" }]), applied: { ok: true, revoked: 1, standing: [] } });
    expect(await cmdShare("bag", f.doors)(args(["notes"], {}, { remove: true }))).toBe(0);
    expect(f.out.join("\n")).toMatch(/revoked: 1 grant\(s\) the row had landed/);
    expect(parseShareFile(f.file()!)).toEqual([]);
  });

  test("a non-owner landing names the owner whose wear can hand on the share", async () => {
    const file = serializeShareFile([{ slug: "elyncia-referee", kind: "wiki", read: "the referee", write: "", owner: "joshua-fontany" }]);
    const f = fake({ file, applied: { granted: 0, pending: 0, unowned: ["elyncia-referee"] } });
    expect(await cmdShare("wiki", f.doors)(args(["elyncia-referee"], { read: "h1" }))).toBe(0);
    expect(f.out.join("\n")).toMatch(/h0 owns elyncia-referee; run `lares wear 0`, then this share/);
  });

  test("SH5 — the row keeps its owner in the control document as in the file", async () => {
    const prior = fake({ file: serializeShareFile([{ slug: "notes", kind: "wiki", read: "", write: "", owner: "joshua-fontany" }]) });
    const seeded = parseShareFile(prior.file()!);
    expect(seeded[0]?.owner, "the fixture's file names the owner").toBe("joshua-fontany");
    expect(await cmdShare("wiki", prior.doors)(args(["notes"], { read: "h2" }))).toBe(0);
    expect(prior.verbs[0]).toMatchObject({ name: "share-set", args: { slug: "notes", owner: "joshua-fontany" } });
    expect(parseShareFile(prior.file()!)[0]?.owner).toBe("joshua-fontany");
    const landed = fake({ applied: { granted: 1, carried: 1, pending: 0, waiting: [], workbenches: [{ slug: "garden", realmId: "realm-0123456789ab", members: 1, owner: 0 }] } });
    expect(await cmdShare("wiki", landed.doors)(args(["garden"], { read: "h1" }))).toBe(0);
    expect(parseShareFile(landed.file()!)[0]?.owner, "the landing's owner reaches the file").toBe("joshua-fontany");
    expect(landed.verbs.map((v) => v.name), "the landing's owner reaches the control document").toEqual(["share-set", "share-apply", "share-set"]);
    expect(landed.verbs[0]!.args["owner"], "no owner stood before the landing").toBeUndefined();
    expect(landed.verbs[2]).toMatchObject({ name: "share-set", args: { slug: "garden", kind: "wiki", read: "joshua-fontany-engineer", owner: "joshua-fontany" } });
    const plain = fake();
    await cmdShare("bag", plain.doors)(args(["notes"], { read: "h1" }));
    expect(plain.verbs.map((v) => v.name), "CONTROL: a landing that names no owner sets nothing again").toEqual(["share-set", "share-apply"]);
  });

  test("SH14 (weld) — a share that founds the workbench writes the realm id back to the realm label, and `realm list` reads it", async () => {
    const ID = "cd".repeat(32);
    const f = fake({ applied: { granted: 1, carried: 0, pending: 0, waiting: [], workbenches: [{ slug: "garden", realmId: ID, members: 2, owner: 0, founded: true }] } });
    expect(await cmdShare("wiki", f.doors)(args(["garden"], { write: "h1" }))).toBe(0);
    const out: string[] = [];
    const realmDoors = { projections: () => f.projections, seat: async () => ({ answered: true, realms: [ID] }), wikis: async () => ["garden"], out: (l: string) => out.push(l), err: (l: string) => out.push(l) };
    expect(await cmdRealm({ command: "realm", positional: ["list"], options: {}, flags: { json: false } }, realmDoors)).toBe(0);
    expect(out.join("\n"), "the label records the realm the share founded").toContain(`realm ${ID.slice(0, 12)}`);
    expect(out.join("\n")).not.toContain("(realm id unread)");
  });

  test("SH15 — a realm label that cannot be written never aborts the share: the line names it on stderr, the share exits as it would, and the owner still reaches the file and the control document", async () => {
    const ID = "ef".repeat(32);
    const f = fake({ applied: { granted: 1, carried: 0, pending: 0, waiting: [], workbenches: [{ slug: "garden", realmId: ID, members: 2, owner: 0, founded: true }] } });
    const doors: ShareDoors = { ...f.doors, projections: () => { throw new Error("EACCES: permission denied, open 'realm-labels/garden.json'"); } };
    expect(await cmdShare("wiki", doors)(args(["garden"], { write: "h1" }))).toBe(0);
    expect(f.err.join("\n")).toMatch(/the realm label of garden records no id: EACCES/);
    expect(parseShareFile(f.file()!)[0]?.owner, "the owner write-back still runs").toBe("joshua-fontany");
    expect(f.verbs.map((v) => v.name)).toEqual(["share-set", "share-apply", "share-set"]);
  });

  test("SH12 — a seated face whose hand-over refused reads by name with its cure, and the line exits 1, never a bare landing", async () => {
    const cause = "seat-needs-keyholder: the owner's holder handed the new seat no lockbox (fresh-base-unavailable); wear the realm's owner face";
    const f = fake({ applied: { granted: 1, carried: 0, pending: 0, waiting: [], workbenches: [{ slug: "garden", realmId: "realm-0123456789ab", members: 1, owner: 0, unhanded: [{ handleIndex: 1, cause }] }] } });
    expect(await cmdShare("wiki", f.doors)(args(["garden"], { write: "h1" }))).toBe(1);
    expect(f.err).toContain(`lares wiki share: joshua-fontany-engineer (h1) holds a seat in the workbench of garden and took no lockbox: ${cause}`);
    const clean = fake({ applied: { granted: 1, carried: 0, pending: 0, waiting: [], workbenches: [{ slug: "garden", realmId: "realm-0123456789ab", members: 1, owner: 0 }] } });
    expect(await cmdShare("wiki", clean.doors)(args(["garden"], { write: "h1" })), "CONTROL: every seat handed exits 0").toBe(0);
  });

  test("SH13 — every door that lands the shares (wear, unlock, lay, restore) echoes the seats left without a lockbox in ONE line", () => {
    const applied = { workbenches: [
      { slug: "lares", unhanded: [{ handleIndex: 1, cause: "seat-needs-keyholder: (fresh-base-unavailable); open the wiki" }] },
      { slug: "garden", unhanded: [{ handleIndex: null, cause: "wrap-failed" }] },
      { slug: "quiet" },
    ] };
    expect(unhandedLine(applied, FACES)).toBe("shares: 2 seated face(s) took no workbench lockbox: joshua-fontany-engineer (h1) in lares: seat-needs-keyholder: (fresh-base-unavailable); open the wiki; a seated face in garden: wrap-failed");
    expect(unhandedLine({ workbenches: [{ slug: "quiet" }] }), "CONTROL: every seat handed says nothing").toBe(null);
    expect(unhandedLine(null)).toBe(null);
  });

  // THE REFEREE WALK (road/referee-walk-frictions #2, #3): a re-share changes only the parts it names, and the echo reads the row.
  test("SH11 (red) — a re-share naming --write alone leaves the readers, the note and the workspace standing; the same line again changes nothing", async () => {
    const standing = serializeShareFile([{ slug: "elyncia-referee", kind: "wiki", read: "joshua-fontany", write: "", workspace: "referee-bench", owner: "joshua-fontany", note: "for the walk" }]);
    const f = fake({ file: standing });
    expect(await cmdShare("wiki", f.doors)(args(["elyncia-referee"], { write: "h2" }))).toBe(0);
    expect(parseShareFile(f.file()!)).toEqual([{ slug: "elyncia-referee", kind: "wiki", read: "joshua-fontany", write: "[[the referee]]", workspace: "referee-bench", owner: "joshua-fontany", note: "for the walk" }]);
    expect(f.out[0]).not.toMatch(/\(none named\)/);
    const once = f.file();
    expect(await cmdShare("wiki", f.doors)(args(["elyncia-referee"], { write: "h2" }))).toBe(0);
    expect(f.file(), "the same line twice writes the same row").toBe(once);
    expect(f.out.join("\n")).toMatch(/unchanged/);
  });

  test("SH12 (red) — --read adds a reader beside the standing ones; --read-remove and --write-remove take one name out and leave the rest", async () => {
    const f = fake({ file: serializeShareFile([{ slug: "notes", kind: "bag", read: "joshua-fontany", write: "joshua-fontany" }]) });
    expect(await cmdShare("bag", f.doors)(args(["notes"], { read: "h2" }))).toBe(0);
    expect(parseShareFile(f.file()!)[0]).toMatchObject({ read: "joshua-fontany [[the referee]]", write: "joshua-fontany" });
    expect(await cmdShare("bag", f.doors)(args(["notes"], { "read-remove": "joshua-fontany", "write-remove": "h0" }))).toBe(0);
    expect(parseShareFile(f.file()!)[0]).toMatchObject({ read: "[[the referee]]", write: "" });
    expect(f.out.join("\n")).toMatch(/reads for the referee \(h2\), writes for \(none named\)/);
    // A removal over no standing row refuses: there is nothing to take a name out of.
    const g = fake();
    expect(await cmdShare("bag", g.doors)(args(["notes"], { "read-remove": "h2" }))).toBe(2);
    expect(g.file()).toBeNull();
  });

  test("SH14 (red, #428 F2) — a name taken out rides the landing as a retraction: the owner revokes its grant, and the line says so", async () => {
    const f = fake({ file: serializeShareFile([{ slug: "notes", kind: "bag", read: "joshua-fontany-engineer [[the referee]]", write: "joshua-fontany-engineer" }]), applied: { granted: 1, pending: 0, retracted: 1, stillGranted: [] } });
    expect(await cmdShare("bag", f.doors)(args(["notes"], { "read-remove": "h1", "write-remove": "h1" }))).toBe(0);
    expect(parseShareFile(f.file()!)[0]).toMatchObject({ read: "[[the referee]]", write: "" });
    expect(f.verbs.map((v) => v.name)).toEqual(["share-set", "share-apply"]);
    expect(f.verbs[1]!.args["retract"]).toEqual([{ slug: "notes", grantee: 1 }]);
    expect(f.out.join("\n")).toMatch(/revoked: 1 grant\(s\) the names this line took out had landed/);
    // A writer demoted to a reader rides the retraction too (its edit grant leaves, a read grant lands in its place).
    const g = fake({ file: serializeShareFile([{ slug: "notes", kind: "bag", read: "joshua-fontany-engineer", write: "joshua-fontany-engineer" }]), applied: { granted: 1, retracted: 1, stillGranted: [] } });
    expect(await cmdShare("bag", g.doors)(args(["notes"], { "write-remove": "h1" }))).toBe(0);
    expect(g.verbs[1]!.args["retract"]).toEqual([{ slug: "notes", grantee: 1 }]);
    // CONTROL: a line that takes no one out names no retraction.
    const h = fake({ file: serializeShareFile([{ slug: "notes", kind: "bag", read: "joshua-fontany-engineer", write: "" }]) });
    expect(await cmdShare("bag", h.doors)(args(["notes"], { read: "h2" }))).toBe(0);
    expect(h.verbs[1]!.args["retract"]).toBeUndefined();
  });

  test("SH15 (red, #428 F2) — a grant the landing cannot take back keeps the row as it stood: the door refuses, names who still reads, and the same line retries", async () => {
    const standing = serializeShareFile([{ slug: "notes", kind: "bag", read: "joshua-fontany-engineer [[the referee]]", write: "" }]);
    const f = fake({ file: standing, applied: { granted: 0, retracted: 0, stillGranted: [{ slug: "notes", grantee: 1 }] } });
    expect(await cmdShare("bag", f.doors)(args(["notes"], { "read-remove": "h1" }))).toBe(1);
    expect(f.file(), "the row stands as it stood").toBe(standing);
    expect(f.verbs.map((v) => v.name)).toEqual(["share-set", "share-apply", "share-set", "share-apply"]);
    expect(f.verbs[2]!.args).toMatchObject({ slug: "notes", read: "joshua-fontany-engineer [[the referee]]" });
    expect(f.err.join("\n")).toMatch(/joshua-fontany-engineer \(h1\) still reads notes/);
    expect(f.err.join("\n")).toMatch(/lares vault unlock face=N/);
    expect(f.out.join("\n")).not.toMatch(/reads for the referee \(h2\), writes/);
  });

  test("SH13 (red) — the echo prints the resolved row: a name given twice (by pet-name and by --face) reads once", async () => {
    const f = fake();
    expect(await cmdShare("wiki", f.doors)(args(["elyncia-referee"], { read: "joshua-fontany", face: "0" }))).toBe(0);
    expect(parseShareFile(f.file()!)[0]).toMatchObject({ read: "joshua-fontany" });
    expect(f.out[0]).toMatch(/reads for joshua-fontany \(h0\), writes for \(none named\)/);
    expect(f.out[0]).not.toMatch(/joshua-fontany.*joshua-fontany/);
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
    await expect(readBackOnExpiry("share-apply", expires, still.ports)).rejects.toThrow(/still lands after .*lares vessel request req-1/);
    const gone = ports([{ requestId: "req-1", state: "abandoned" }]);
    await expect(readBackOnExpiry("share-apply", expires, gone.ports)).rejects.toThrow(/request-abandoned/);
  });
});
