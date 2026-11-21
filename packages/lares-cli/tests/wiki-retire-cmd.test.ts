/**
 * `lares wiki retire <slug>`: the door rides `retire-wiki` on a session of the worn face (the `cli` hand), names each refusal by
 * its code (exit 1), and once the retire lands runs the local half: the hold drops, the workbench folder steps aside BY RENAME,
 * and the slug's realm label releases its realm id (only where a realm retired). A run that died midway finishes on a second run
 * (`no-such-wiki` while the ledger binds the slug nowhere). `--count` needs `--force`; `--dry-run` writes nothing locally.
 */
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const sent: Array<{ name: string; args: Record<string, unknown> }> = [];
vi.mock("../src/verb-call.js", () => ({
  DaemonUnreachable: class extends Error {},
  verbFailure: (e: unknown) => ({ message: String(e) }),
  runVerbAsFace: async () => ({ status: "error", requestId: "", errorMessage: "unused" }),
  runVerb: async (name: string, args: Record<string, unknown>) => {
    sent.push({ name, args });
    return { status: "done", requestId: "r", results: { summary: { ok: true, output: { holds: [] } } } };
  },
}));
vi.mock("../src/env.js", async (orig) => ({ ...(await orig<typeof import("../src/env.js")>()), vesselDid: async () => "0x" + "ab".repeat(32) }));

import { ensureRealmLabel, readRealmLabels } from "@lararium/node";
import { cmdWikiRetire, type RetireDoors } from "../src/commands/wiki.js";
import type { RealmDoors } from "../src/commands/realm-doors.js";
import { parseArgs } from "../src/parse-args.js";

const SLUG = "elyncia-referee";
const ID = "c".repeat(64);
let text = "";
let projections = "";
let bound: string[] = [];
let answer: { status: string; errorMessage?: string; output?: Record<string, unknown> } = { status: "done" };
const calls: Array<{ verb: string; args: Record<string, unknown>; face: number }> = [];
const realmDoors = (): RealmDoors => ({ projections: () => projections, seat: async () => ({ answered: true, realms: bound }), out: () => {}, err: () => {} });
const retireDoors: RetireDoors = {
  wornFace: async () => 2,
  call: async (verb, args, face) => {
    calls.push({ verb, args, face });
    return answer.status === "error" ? { status: "error", requestId: "r", errorMessage: answer.errorMessage! }
      : { status: "done", requestId: "r", results: { summary: { ok: true, output: answer.output ?? {} } } } as never;
  },
};
const retired = (realmId: string | null): typeof answer => ({ status: "done", output: { slug: SLUG, status: "retired", catalogRows: ["a", "b"], ledgerRows: ["x"], realmId, keyhiveBindings: ["w"], slotBindings: [], records: { working: 0, draft: 0, personal: 0 }, forced: false, kept: { canonBag: "lar:///ha.ka.ba/bags/s" } } });
const folder = (): string => join(projections, "realms", SLUG, "wikis", SLUG);
const run = (...extra: string[]) => cmdWikiRetire(parseArgs(["wiki", SLUG, "--no-json", ...extra]), realmDoors(), retireDoors);

beforeEach(() => {
  sent.length = 0; calls.length = 0; text = ""; bound = []; answer = retired(ID);
  projections = mkdtempSync(join(tmpdir(), "retire-cmd-"));
  ensureRealmLabel(projections, SLUG, ID);
  mkdirSync(folder(), { recursive: true });
  writeFileSync(join(folder(), "Old Note.tid"), "title: Old Note\n\nthe retired shell's words\n");
  vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => { text += a.join(" ") + "\n"; });
  vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => { text += a.join(" ") + "\n"; });
});
afterEach(() => { vi.restoreAllMocks(); rmSync(projections, { recursive: true, force: true }); });

test("a landed retire rides the worn face's session, drops the hold, sets the folder aside by rename, and releases the realm id", async () => {
  expect(await run()).toBe(0);
  expect(calls).toEqual([{ verb: "retire-wiki", args: { slug: SLUG }, face: 2 }]);
  expect(sent.map((s) => s.name)).toEqual(["wiki-release"]);
  expect(existsSync(folder())).toBe(false);
  const aside = readdirSync(join(projections, "realms", SLUG, "wikis")).filter((n) => n.startsWith(`${SLUG}.retired-`));
  expect(aside).toHaveLength(1);
  expect(readdirSync(join(projections, "realms", SLUG, "wikis", aside[0]!))).toEqual(["Old Note.tid"]);   // renamed, never deleted
  expect(readRealmLabels(projections)[0]!.realms).toEqual([{ slug: SLUG, id: null }]);
  expect(text).toContain("folder set aside");
  // The next mint's door records the realm that stands then.
  expect(ensureRealmLabel(projections, SLUG, "d".repeat(64)).label.realms).toEqual([{ slug: SLUG, id: "d".repeat(64) }]);
});

test("RED (L2) a retire that retired no realm (a never-stood shell) leaves the label's id alone", async () => {
  answer = retired(null);
  expect(await run()).toBe(0);
  expect(readRealmLabels(projections)[0]!.realms).toEqual([{ slug: SLUG, id: ID }]);
});

test("a refusal names its code and exits 1; nothing local runs", async () => {
  answer = { status: "error", errorMessage: "wiki-shared: \"elyncia-referee\" is reached by 1 other face seat" };
  expect(await run()).toBe(1);
  expect(sent).toEqual([]);
  expect(existsSync(folder())).toBe(true);
  expect(readRealmLabels(projections)[0]!.realms).toEqual([{ slug: SLUG, id: ID }]);
  expect(text).toContain("wiki-shared");
});

test("RED (L2) a run that died after this face's retire finishes: `no-such-wiki` naming the label's own realm, with the ledger binding nothing, runs the local half", async () => {
  answer = { status: "error", errorMessage: `no-such-wiki: this face holds no shell of "${SLUG}": no catalog row and no workbench (own realm ${ID})` };
  expect(await run()).toBe(0);
  expect(sent.map((s) => s.name)).toEqual(["wiki-release"]);
  expect(existsSync(folder())).toBe(false);
  expect(readRealmLabels(projections)[0]!.realms).toEqual([{ slug: SLUG, id: null }]);
  expect(text).toContain("already-retired");
});

test("RED (F4) `no-such-wiki` for a slug this face never held (its label names another realm, or none) refuses, drops no hold and moves nothing", async () => {
  for (const own of ["f".repeat(64), null]) {
    sent.length = 0;
    answer = { status: "error", errorMessage: `no-such-wiki: this face holds no shell of "${SLUG}"${own ? ` (own realm ${own})` : ""}` };
    expect(await run()).toBe(1);
    expect(sent).toEqual([]);
    expect(existsSync(folder())).toBe(true);
    expect(readRealmLabels(projections)[0]!.realms).toEqual([{ slug: SLUG, id: ID }]);
  }
  // CONTROL: the label names this face's realm, but the ledger still binds the slug (a shell another face stood): it refuses.
  bound = ["e".repeat(64)];
  answer = { status: "error", errorMessage: `no-such-wiki: this face holds no shell of "${SLUG}" (own realm ${ID})` };
  expect(await run()).toBe(1);
  expect(sent).toEqual([]);
  expect(existsSync(folder())).toBe(true);
});

test("F3: a landed retire names the canon document it kept", async () => {
  answer = retired(ID);
  (answer.output!["kept"] as Record<string, unknown>)["canonDoc"] = "automerge:kept-canon";
  expect(await run()).toBe(0);
  expect(text).toContain("canon doc kept:        automerge:kept-canon");
});

test("--force --count rides as the typed confirmation; --count without --force and --dry-run with --force refuse at the door; --dry-run moves nothing locally", async () => {
  expect(await run("--force", "--count", "3")).toBe(0);
  expect(calls[0]!.args).toEqual({ slug: SLUG, force: true, count: 3 });
  calls.length = 0;
  expect(await run("--count", "3")).toBe(2);
  expect(await run("--dry-run", "--force")).toBe(2);
  expect(calls).toEqual([]);
  mkdirSync(folder(), { recursive: true }); writeFileSync(join(folder(), "y.tid"), "y");
  answer = { status: "done", output: { slug: SLUG, status: "would-retire", catalogRows: [], realmId: ID, records: { working: 1, draft: 0, personal: 0 }, total: 1 } };
  sent.length = 0;
  expect(await run("--dry-run")).toBe(0);
  expect(calls.at(-1)!.args).toEqual({ slug: SLUG, "dry-run": true });
  expect(sent).toEqual([]);
  expect(existsSync(folder())).toBe(true);
});

test("RED (referee walk #5, the record of leaving stays) --dry-run and the landed retire name the house's effect records apart from the authored ones, and where they go", async () => {
  const where = { title: "lar:///ha.ka.ba/lararium/retired-shells/elyncia-referee", bag: "lar:///ha.ka.ba/wikis/daemon/working" };
  answer = { status: "done", output: { slug: SLUG, status: "would-retire", catalogRows: ["a"], realmId: ID, records: { working: 0, draft: 0, personal: 0, effects: 1 }, total: 0, carryTo: where } };
  expect(await run("--dry-run")).toBe(0);
  expect(text).toMatch(/authored records: 0 \(working 0, draft 0, personal 0\)/);
  expect(text).toMatch(/effect records:\s+1 \(the house's own residency rows; carried to lar:\/\/\/ha\.ka\.ba\/lararium\/retired-shells\/elyncia-referee in lar:\/\/\/ha\.ka\.ba\/wikis\/daemon\/working before the shell goes\)/);
  text = "";
  answer = retired(ID);
  (answer.output!["records"] as Record<string, number>)["effects"] = 1;
  answer.output!["carried"] = { ...where, records: 1, added: 1 };
  expect(await run()).toBe(0);
  expect(text).toMatch(/records destroyed:\s+none authored/);
  expect(text).toMatch(/effect records:\s+1 carried to lar:\/\/\/ha\.ka\.ba\/lararium\/retired-shells\/elyncia-referee \(lar:\/\/\/ha\.ka\.ba\/wikis\/daemon\/working; 1 new\), then erased with the shell/);
});

test("RED (the record of leaving stays) a carry that cannot land refuses by its code and exits 1; nothing local runs", async () => {
  answer = { status: "error", errorMessage: "retire-carry-unlanded: the face's daemon working layer holds no durable document; nothing retired" };
  expect(await run()).toBe(1);
  expect(sent).toEqual([]);
  expect(existsSync(folder())).toBe(true);
  expect(text).toContain("retire-carry-unlanded");
});
