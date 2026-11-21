/**
 * `lares wiki retire <slug>`: the door rides `retire-wiki`, names each refusal by its code (exit 1), releases the slug's realm id
 * from its local label once the retire lands (the label keeps its pet name), and forwards `--force --count` as the typed
 * confirmation. A `--count` with no `--force` refuses at the door and sends nothing.
 */
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const sent: Array<{ name: string; args: Record<string, unknown> }> = [];
let refusal: string | null = null;
vi.mock("../src/verb-call.js", () => ({
  DaemonUnreachable: class extends Error {},
  verbFailure: () => ({ message: "unreached" }),
  runVerbAsFace: async () => ({ status: "error", requestId: "", errorMessage: "face-not-open: shut" }),
  runVerb: async (name: string, args: Record<string, unknown>) => {
    sent.push({ name, args });
    if (name === "retire-wiki" && refusal) return { status: "error", requestId: "r", errorMessage: refusal };
    const output = name === "retire-wiki"
      ? { slug: args["slug"], status: "retired", catalogRows: ["a", "b"], ledgerRows: ["x", "y", "z"], realmId: "f".repeat(64), keyhiveBindings: ["w", "d"], records: { working: 0, draft: 0 }, forced: false, kept: { canonBag: "lar:///ha.ka.ba/bags/s", canonDoc: "automerge:c" } }
      : { holds: [] };
    return { status: "done", requestId: "r", results: { summary: { ok: true, output } } };
  },
}));
vi.mock("../src/env.js", async (orig) => ({ ...(await orig<typeof import("../src/env.js")>()), vesselDid: async () => "0x" + "ab".repeat(32) }));

import { ensureRealmLabel, readRealmLabels } from "@lararium/node";
import { cmdWikiRetire } from "../src/commands/wiki.js";
import type { RealmDoors } from "../src/commands/realm-doors.js";
import { parseArgs } from "../src/parse-args.js";

let text = "";
let projections = "";
const ID = "c".repeat(64);
const doors = (): RealmDoors => ({ projections: () => projections, seat: async () => ({ answered: true, realms: [] }), out: () => {}, err: () => {} });
beforeEach(() => {
  sent.length = 0; text = ""; refusal = null;
  projections = mkdtempSync(join(tmpdir(), "retire-cmd-"));
  vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => { text += a.join(" ") + "\n"; });
  vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => { text += a.join(" ") + "\n"; });
});
afterEach(() => { vi.restoreAllMocks(); rmSync(projections, { recursive: true, force: true }); });

test("a landed retire releases the slug's realm id (the label keeps its pet name) and drops the wiki's hold", async () => {
  ensureRealmLabel(projections, "elyncia-referee", ID);
  expect(await cmdWikiRetire(parseArgs(["wiki", "elyncia-referee", "--no-json"]), doors())).toBe(0);
  expect(sent.map((s) => s.name)).toEqual(["retire-wiki", "wiki-release"]);
  expect(sent[0]!.args).toEqual({ slug: "elyncia-referee" });
  expect(readRealmLabels(projections)).toEqual([expect.objectContaining({ petName: "elyncia-referee", realms: [{ slug: "elyncia-referee", id: null }] })]);
  expect(text).toContain("catalog rows removed:  2");
  expect(text).toContain("lares wiki init elyncia-referee");
  // The next mint's door records the realm that stands then.
  expect(ensureRealmLabel(projections, "elyncia-referee", "d".repeat(64)).label.realms).toEqual([{ slug: "elyncia-referee", id: "d".repeat(64) }]);
});

test("a refusal names its code and exits 1; nothing past the verb runs", async () => {
  ensureRealmLabel(projections, "elyncia-referee", ID);
  refusal = "not-the-owner: the workbench of \"elyncia-referee\" stands under another face's realm";
  expect(await cmdWikiRetire(parseArgs(["wiki", "elyncia-referee", "--no-json"]), doors())).toBe(1);
  expect(sent.map((s) => s.name)).toEqual(["retire-wiki"]);
  expect(text).toContain("not-the-owner");
  expect(readRealmLabels(projections)[0]!.realms).toEqual([{ slug: "elyncia-referee", id: ID }]);
});

test("--force --count rides as the typed confirmation; --count without --force refuses at the door", async () => {
  expect(await cmdWikiRetire(parseArgs(["wiki", "s", "--force", "--count", "3", "--no-json"]), doors())).toBe(0);
  expect(sent[0]!.args).toEqual({ slug: "s", force: true, count: 3 });
  sent.length = 0;
  expect(await cmdWikiRetire(parseArgs(["wiki", "s", "--count", "3", "--no-json"]), doors())).toBe(2);
  expect(sent).toEqual([]);
});
