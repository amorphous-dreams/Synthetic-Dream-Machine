/**
 * exec-lei — the executable-record lei rides the lei grammar (backlog-awakens "The executable-record lei"; state/decisions "Five
 * floors walked" (2)).
 *
 * The human strings an `exec` lei for a seat or a realm member: N returns, scoped to one wiki and, within it, to a title set or one
 * class of the mesh's executable-class list, signed by the face's hand. Each executable land spends one return in whichever
 * vessel boots it; the spend names the record's title as its head and the record's content cid as its tree, so a return
 * witnesses the very bytes that ran. An exec spend rests on no receipt (the hand's signed lei is the consent), and it never
 * spends without its scope check. Every red pairs with a CONTROL.
 */
import { describe, expect, test } from "vitest";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "../src/ed25519-door.js";
import { swarmCommand, type SwarmDoorDeps } from "../src/swarm-door.js";
import { SWARM_LEI_RITES, leiRiteCosigns, leiRiteTestifies } from "../src/swarm-lei-rite.js";
import { readLei, returnLei, signSwarmAct, swarmLeiHead, type SwarmWikiPort } from "../src/swarm-tiddlers.js";
import { admitStartupRecords, execLeiBranch, execRecordCid, spendExecLei, type ExecLeiScope } from "../src/exec-lei.js";
import { SwarmRefused } from "../src/swarm-tiddlers.js";
import { soloCosign } from "./ward-cosign-table.js";

const GROUP = "face-group", WIKI = "lar:///ha.ka.ba/wikis/notes";
const keyed = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(n)) });
const ONE_DEVICE = { accepts: () => true };
const STARTUP = { title: "Boot hello", fields: { tags: "$:/tags/StartupAction", text: "<$action-setfield $tiddler='$:/temp/x' text='ran'/>" } };

function wikiPort(): SwarmWikiPort & { rows: Map<string, string> } {
  const rows = new Map<string, string>();
  return { rows, read: async (t) => rows.get(t) ?? null, write: async (t, text) => { rows.set(t, text); }, writeNew: async (t, text) => { if (rows.has(t)) return false; rows.set(t, text); return true; },
    list: async (prefix) => [...rows.keys()].filter((t) => t.startsWith(prefix)) };
}

async function fixture() {
  const hand = await keyed(1), vessel = await keyed(2);
  const trust = { hand: (k: string) => k === hand.key, vessel: (k: string) => k === vessel.key, lead: () => false };
  const wiki = wikiPort();
  const deps: SwarmDoorDeps = {
    group: GROUP, face: { grant: (k: string) => k === hand.key, group: GROUP }, signer: hand, trust, epoch: () => 1,
    board: { records: async () => [], land: async () => {} }, wiki, who: { kind: "hand", id: "operator" }, cosign: () => soloCosign(GROUP, hand),
  };
  const string = (scope: ExecLeiScope, returns = 2) => swarmCommand({ action: "lei-kui", rite: "exec", branch: execLeiBranch(scope.wiki), after: null, reach: "wide", returns, scope }, deps);
  return { hand, vessel, trust, wiki, deps, string };
}

describe("exec-lei — the executable-record lei rides the lei grammar", () => {
  test("RED: the rite list names `exec`; an exec lei asks no co-sign and no testimony; CONTROL: push, kukulu and keep still testify", () => {
    expect([...SWARM_LEI_RITES]).toContain("exec");
    expect(leiRiteCosigns("exec")).toBe(false);
    expect(leiRiteTestifies("exec")).toBe(false);
    for (const rite of ["push", "kukulu", "keep"] as const) expect(leiRiteTestifies(rite)).toBe(true);
  });

  test("RED: the hand strings an exec lei for a seat, scoped to a class, and each executable land spends one return with no receipt; CONTROL: past its returns it refuses spent", async () => {
    const f = await fixture();
    await f.string({ wiki: WIKI, writer: "seat", class: "startup-action" }, 2);
    const at = { rite: "exec" as const, branch: execLeiBranch(WIKI) };
    expect(await readLei(f.wiki, at, f.trust, GROUP, ONE_DEVICE)).toMatchObject({ ok: true, reach: "wide", returnsLeft: 2 });
    const spend = () => spendExecLei(f.wiki, { wiki: WIKI, writer: "seat", ...STARTUP }, f.trust, GROUP, f.vessel);
    await expect(spend()).resolves.toMatchObject({ n: 1, tree: execRecordCid(STARTUP.fields) });
    await expect(spend()).resolves.toMatchObject({ n: 2 });
    await expect(spend()).rejects.toMatchObject({ code: "swarm-lei-returns-spent" });
  });

  test("RED: a record outside the lei's scope spends nothing: another class, a title outside the set, another writer, another wiki; a data record needs no lei; CONTROL: the title set admits its own title", async () => {
    const f = await fixture();
    await f.string({ wiki: WIKI, writer: "seat", titles: ["Boot hello"] }, 3);
    const spend = (over: Partial<{ wiki: string; writer: string; title: string; fields: Record<string, unknown> }>) =>
      spendExecLei(f.wiki, { wiki: WIKI, writer: "seat", ...STARTUP, ...over }, f.trust, GROUP, f.vessel);
    await expect(spend({ title: "Other" })).rejects.toMatchObject({ code: "swarm-lei-out-of-scope" });
    await expect(spend({ writer: "member-b" })).rejects.toMatchObject({ code: "swarm-lei-writer-mismatch" });
    await expect(spend({ wiki: "lar:///ha.ka.ba/wikis/works" })).rejects.toMatchObject({ code: "swarm-lei-absent" });
    await expect(spend({ fields: { text: "plain" } })).rejects.toMatchObject({ code: "swarm-lei-not-executable" });
    await expect(spend({})).resolves.toMatchObject({ n: 1 });
    const g = await fixture();
    await g.string({ wiki: WIKI, writer: "seat", class: "macro" }, 1);
    await expect(spendExecLei(g.wiki, { wiki: WIKI, writer: "seat", ...STARTUP }, g.trust, GROUP, g.vessel)).rejects.toMatchObject({ code: "swarm-lei-out-of-scope" });
    // An unlisted system tag reads `system-tag`, so a class-scoped lei for it admits it.
    await g.string({ wiki: "lar:///w/x", writer: "seat", class: "system-tag" }, 1);
    await expect(spendExecLei(g.wiki, { wiki: "lar:///w/x", writer: "seat", title: "N", fields: { tags: "$:/tags/NeverHeardOfIt" } }, g.trust, GROUP, g.vessel)).resolves.toMatchObject({ n: 1 });
  });

  test("RED: the door refuses a scope on another rite, an exec lei with no scope, a branch that is not its wiki's, and an unknown class; CONTROL: the scope rides the lei's head", async () => {
    const f = await fixture();
    const kui = (req: Record<string, unknown>) => swarmCommand({ action: "lei-kui", after: null, reach: "wide", returns: 1, ...req } as never, f.deps);
    await expect(kui({ rite: "push", branch: "feature/x", scope: { wiki: WIKI, writer: "seat" } })).rejects.toMatchObject({ code: "swarm-lei-malformed" });
    await expect(kui({ rite: "exec", branch: execLeiBranch(WIKI) })).rejects.toMatchObject({ code: "swarm-lei-malformed" });
    await expect(kui({ rite: "exec", branch: "feature/x", scope: { wiki: WIKI, writer: "seat" } })).rejects.toMatchObject({ code: "swarm-lei-malformed" });
    await expect(kui({ rite: "exec", branch: execLeiBranch(WIKI), scope: { wiki: WIKI, writer: "seat", class: "nonsense" } })).rejects.toMatchObject({ code: "swarm-lei-malformed" });
    await expect(kui({ rite: "exec", branch: execLeiBranch(WIKI), scope: { wiki: WIKI, writer: "seat", class: "macro", titles: ["a"] } })).rejects.toMatchObject({ code: "swarm-lei-malformed" });
    await expect(signSwarmAct({ act: "lei", group: GROUP, rite: "exec", branch: execLeiBranch(WIKI), after: null, reach: "wide", returns: 1 } as never, f.hand)).rejects.toMatchObject({ code: "swarm-shape" });
    const a = swarmLeiHead({ rite: "exec", branch: execLeiBranch(WIKI), after: null, reach: "wide", returns: 1, scope: { wiki: WIKI, writer: "seat", class: "macro" } });
    const b = swarmLeiHead({ rite: "exec", branch: execLeiBranch(WIKI), after: null, reach: "wide", returns: 1, scope: { wiki: WIKI, writer: "seat", class: "global" } });
    expect(a).not.toBe(b);
    await expect(kui({ rite: "exec", branch: execLeiBranch(WIKI), scope: { wiki: WIKI, writer: "seat" } })).resolves.toMatchObject({ rite: "exec" });
  });

  test("RED: an exec lei never spends through the plain return (a restart rite's road), which skips its scope; CONTROL: the scoped spend takes it", async () => {
    const f = await fixture();
    await f.string({ wiki: WIKI, writer: "seat" }, 1);
    await expect(returnLei(f.wiki, { rite: "exec", branch: execLeiBranch(WIKI), head: STARTUP.title, tree: execRecordCid(STARTUP.fields) }, f.trust, GROUP, f.vessel, ONE_DEVICE))
      .rejects.toMatchObject({ code: "swarm-lei-exec-unscoped" });
    await expect(spendExecLei(f.wiki, { wiki: WIKI, writer: "seat", ...STARTUP }, f.trust, GROUP, f.vessel)).resolves.toMatchObject({ n: 1 });
  });
});

describe("admitStartupRecords — the tab half's rule, one function for every vessel that boots a wiki", () => {
  const records = [
    { title: "Own start", fields: { tags: "$:/tags/StartupAction", text: "a" } },
    { title: "Member start", fields: { tags: "$:/tags/StartupAction/Browser", text: "b" } },
  ];
  test("RED: in a wiki the wearing face alone writes, every startup record runs and no return spends; CONTROL: the port never hears", async () => {
    const heard: string[] = [];
    const port = { spend: async (land: { title: string }) => { heard.push(land.title); return { lei: "c".repeat(64), n: 1 }; } };
    const out = await admitStartupRecords(records, { wiki: WIKI, own: true, port });
    expect([...out.admitted]).toEqual(["Own start", "Member start"]);
    expect(out.offered).toEqual([]);
    expect(heard).toEqual([]);
  });

  test("RED: in a shared wiki another writer's startup record runs only where the exec lei spends a return; a refused spend offers with the lei's reading; CONTROL: with no port every record offers", async () => {
    const f = await fixture();
    await f.string({ wiki: WIKI, writer: "member-b", titles: ["Member start"] }, 1);
    const port = { spend: (land: { wiki: string; title: string; fields: Readonly<Record<string, unknown>>; writer?: string }) => spendExecLei(f.wiki, land, f.trust, GROUP, f.vessel) };
    const out = await admitStartupRecords(records, { wiki: WIKI, own: false, port });
    expect([...out.admitted]).toEqual(["Member start"]);
    expect(out.offered).toEqual([{ title: "Own start", reason: "swarm-lei-out-of-scope" }]);
    const again = await admitStartupRecords(records, { wiki: WIKI, own: false, port });
    expect(again.offered.map((o) => o.reason)).toEqual(["swarm-lei-returns-spent", "swarm-lei-returns-spent"]);
    const none = await admitStartupRecords(records, { wiki: WIKI, own: false });
    expect(none.admitted.size).toBe(0);
    expect(none.offered.map((o) => o.reason)).toEqual(["no-exec-lei-port", "no-exec-lei-port"]);
    expect(SwarmRefused).toBeDefined();
  });
});
