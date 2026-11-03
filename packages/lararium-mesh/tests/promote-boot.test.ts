/**
 * promote-boot — what a vessel does with its promotions at boot and on a board change, platform-blind.
 *
 * `promotedFor(wiki)` answers one wiki's promoted digests (its own rows, verified, bytes written to the CAS and pinned) and names what
 * needs the hand's attention; `arrive()` reads the board and restarts exactly the wikis whose loaded edge a raise shadowed. A locked
 * vessel loads no promoted code and never throws at boot. Every red pairs with a CONTROL.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { describe, expect, test } from "vitest";
import {
  EMPTY_KAPAE_LOCAL, EMPTY_LEDGER, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, ledgerCommit, promoteActCid, promoteDigest, promoteEdgeKey,
  readPromoteBoard, signPromoteKapae, type KapaeLocal, type PromotionLedger,
} from "../src/index.js";
import { promoteBoot, type PromoteBootReport } from "../src/promote-boot.js";
import type { PromoteItem } from "../src/promote-door.js";

const GROUP = "face-group", W1 = "field-notes", W2 = "garden";
const HAND = { kind: "hand", id: "hand-1" } as const;
const RITE = { title: "rites/a", text: "exports.startup = function(){}", fields: { "module-type": "startup" } };
const D = promoteDigest(RITE);
const itemOf = (i: typeof RITE): PromoteItem => ({ ...i, revision: "r1", origin: { seat: "s", device: "d", session: "s-1" } });

async function boot(opts: { locked?: boolean } = {}) {
  const hooks = { tornLocalRead: false, failLocalWrite: false, rotated: false };
  const root = { key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(1)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(1)) };
  const face = { group: GROUP, grant: (k: string) => k === root.key, device: () => false };
  const st = {
    ledger: [W1, W2].reduce((l, wiki) => ledgerCommit(l, { wiki, digest: D, item: RITE, revision: "r1" }, HAND), EMPTY_LEDGER) as PromotionLedger,
    local: EMPTY_KAPAE_LOCAL as KapaeLocal, acts: [] as unknown[], cas: new Map<string, Uint8Array>(), pinned: new Set<string>(),
    items: new Map<string, PromoteItem[]>([[W1, [itemOf(RITE)]], [W2, [itemOf(RITE)]]]), restarts: [] as string[], hits: [] as Array<[string, string[]]>, failRestart: new Set<string>(), defer: new Map<string, { settle: (error?: Error) => void }>(), failed: [] as string[], reports: [] as Array<{ wiki: string; report: PromoteBootReport }>, faults: [] as string[],
  };
  const b = promoteBoot({
    stores: {
      ledger: { read: async () => { if (opts.locked) throw new Error("CustodyLocked"); return st.ledger; }, write: async (l) => { st.ledger = l; } },
      local: { read: async () => { if (opts.locked) throw new Error("CustodyLocked"); if (hooks.tornLocalRead) throw new Error("torn cache"); return st.local; }, write: async (l) => { if (hooks.failLocalWrite) throw new Error("disk full"); st.local = l; } },
    },
    cas: { put: (d, bytes) => { st.cas.set(d, bytes); }, pin: (d) => { st.pinned.add(d); } },
    board: async () => readPromoteBoard(st.acts, hooks.rotated ? { ...face, grant: () => false } : face),
    itemsOf: async (wiki) => st.items.get(wiki) ?? [],
    restart: async (wiki, hit) => {
      st.hits.push([wiki, [...hit]]);
      if (st.failRestart.has(wiki)) throw new Error(`restart refused: ${wiki}`);
      if (st.defer.has(wiki)) {
        st.restarts.push(`${wiki}:deferred`);
        return { pending: new Promise<void>((resolve, reject) => { st.defer.get(wiki)!.settle = (error) => error ? reject(error) : resolve(); }) };
      }
      st.restarts.push(wiki);
    },
    onRestartFailed: (wiki) => { st.failed.push(wiki); },
    onReport: (wiki, report) => { st.reports.push({ wiki, report }); },
    onFault: (reason) => { st.faults.push(reason); },
  });
  return { b, st, hooks, raise: (wiki: string, parents: string[] = []) => signPromoteKapae({ group: GROUP, epoch: 0, wiki, digest: D, raised: true, parents }, root) };
}

describe("a wiki's boot union", () => {
  test("RED: promotedFor answers that wiki's own digests, writes and pins their bytes, and reports to the hand; CONTROL: an unknown wiki answers nothing", async () => {
    const { b, st } = await boot();
    expect(await b.promotedFor(W1)).toEqual([D]);
    expect(st.cas.has(D) && st.pinned.has(D)).toBe(true);
    expect(await b.promotedFor("no-such-wiki")).toEqual([]);
    expect(st.reports.find((r) => r.wiki === W1)?.report).toMatchObject({ orphans: [], voided: [] });
  });

  test("RED: a promoted item the wiki dropped is NAMED in the report and still loads; CONTROL: a standing item is not named", async () => {
    const { b, st } = await boot();
    st.items.set(W1, []);
    expect(await b.promotedFor(W1)).toEqual([D]);
    expect(st.reports.find((r) => r.wiki === W1)!.report.orphans).toEqual([D]);
    expect(await b.promotedFor(W2)).toEqual([D]);
    expect(st.reports.find((r) => r.wiki === W2)!.report.orphans).toEqual([]);
  });

  test("RED: a locked vessel loads no promoted code, throws nothing and names the fault; CONTROL: the unlocked vessel loads", async () => {
    const locked = await boot({ locked: true });
    expect(await locked.b.promotedFor(W1)).toEqual([]);
    expect(locked.st.faults).toEqual(["ledger-unreadable"]);
    expect(locked.st.cas.size).toBe(0);
    expect((await (await boot()).b.promotedFor(W1))).toEqual([D]);
  });
});

describe("a board change", () => {
  test("RED: a raise over (W1, D) restarts W1 once and leaves W2 running; CONTROL: a second arrive restarts nothing", async () => {
    const { b, st, raise } = await boot();
    await b.promotedFor(W1); await b.promotedFor(W2);
    st.acts.push(await raise(W1));
    expect(await b.arrive()).toEqual([W1]);
    expect(st.restarts).toEqual([W1]);
    expect(await b.arrive()).toEqual([]);
    expect(st.restarts).toEqual([W1]);
    expect(await b.promotedFor(W2)).toEqual([D]);
    expect(await b.promotedFor(W1)).toEqual([]);
  });

  test("RED: a raise over a wiki that loaded nothing restarts nothing; CONTROL: loading it first makes the same raise restart it", async () => {
    const quiet = await boot();
    quiet.st.acts.push(await quiet.raise(W1));
    expect(await quiet.b.arrive()).toEqual([]);
    expect(quiet.st.restarts).toEqual([]);
    const loaded = await boot();
    await loaded.b.promotedFor(W1);
    loaded.st.acts.push(await loaded.raise(W1));
    expect(await loaded.b.arrive()).toEqual([W1]);
    expect(promoteEdgeKey(W1, D)).toBeTruthy();
    expect(promoteActCid).toBeTypeOf("function");
  });
});

describe("the local trust record decides, never the stage copy", () => {
  test("RED: a stage item edited after the promotion changes nothing: the digest answered and the bytes written are the ledger's own; CONTROL: a ledger row whose bytes no longer hash is voided, never swapped for the stage copy", async () => {
    const { b, st } = await boot();
    st.items.set(W1, [itemOf({ ...RITE, text: "exports.startup = function(){ evil() }" })]);
    expect(await b.promotedFor(W1)).toEqual([D]);
    expect([...st.cas.keys()]).toEqual([D]);
    expect(new TextDecoder().decode(st.cas.get(D)!)).toContain("exports.startup = function(){}");
    expect(new TextDecoder().decode(st.cas.get(D)!)).not.toContain("evil");
    st.cas.clear();
    st.ledger = { ...st.ledger, rows: st.ledger.rows.map((r) => (r.wiki === W1 ? { ...r, bytes: r.bytes.replace("startup", "evil") } : r)) };
    expect(await b.promotedFor(W1)).toEqual([]);
    expect(st.cas.size).toBe(0);
    expect(st.reports.at(-1)!.report.voided).toEqual([{ digest: D, reason: "digest-mismatch" }]);
  });
});

describe("a custody read that throws leaves the promoted set empty", () => {
  test("RED: a locked vessel, a torn ledger row and a torn cache each answer EMPTY with the stage holding the item, write nothing and name the fault; CONTROL: the sound stores load", async () => {
    for (const broken of ["ledger", "local"] as const) {
      const w = await boot();
      const bad = async () => { throw new Error("torn row"); };
      const wired = promoteBoot({
        stores: { ledger: broken === "ledger" ? { read: bad, write: async () => {} } : { read: async () => w.st.ledger, write: async () => {} },
                  local: broken === "local" ? { read: bad, write: async () => {} } : { read: async () => w.st.local, write: async () => {} } },
        cas: { put: (d, bytes) => { w.st.cas.set(d, bytes); }, pin: (d) => { w.st.pinned.add(d); } },
        board: async () => readPromoteBoard(w.st.acts, { group: GROUP, grant: () => false, device: () => false }),
        itemsOf: async (wiki) => w.st.items.get(wiki) ?? [], restart: async () => {}, onFault: (r) => { w.st.faults.push(r); },
      });
      expect(await wired.promotedFor(W1), broken).toEqual([]);
      expect(w.st.cas.size, broken).toBe(0);
      expect(w.st.faults, broken).toEqual(["ledger-unreadable"]);
    }
    expect(await (await boot()).b.promotedFor(W1)).toEqual([D]);
  });
});

describe("a restart that fails converges on the next arrive", () => {
  test("RED: a restart that throws on the first arrive is named, never skips the other wikis, and the same board restarts that wiki on the next arrive; CONTROL: once restarted, a further arrive restarts nothing", async () => {
    const { b, st, raise } = await boot();
    await b.promotedFor(W1); await b.promotedFor(W2);
    st.acts.push(await raise(W1), await raise(W2));
    st.failRestart.add(W1);
    expect(await b.arrive()).toEqual([W2]);
    expect(st.failed).toEqual([W1]);
    expect(st.restarts).toEqual([W2]);
    st.failRestart.clear();
    expect(await b.arrive()).toEqual([W1]);
    expect(st.restarts).toEqual([W2, W1]);
    expect(await b.arrive()).toEqual([]);
    expect(st.restarts).toEqual([W2, W1]);
  });

  test("RED: the cache records the shadow even where a restart failed, so an offline boot still honors it; CONTROL: the restarted wiki's edge is cached too", async () => {
    const { b, st, raise } = await boot();
    await b.promotedFor(W1); await b.promotedFor(W2);
    st.acts.push(await raise(W1), await raise(W2));
    st.failRestart.add(W1);
    await b.arrive();
    expect(st.local.shadowed.sort()).toEqual([promoteEdgeKey(W1, D), promoteEdgeKey(W2, D)].sort());
    st.failRestart.clear();
    await b.arrive();
    expect(st.local.shadowed.sort()).toEqual([promoteEdgeKey(W1, D), promoteEdgeKey(W2, D)].sort());
  });
});

describe("a restart that DEFERS stays pending until it reports (a raise in flight here takes the restart to its own completion)", () => {
  test("RED: a deferred restart that then throws is named and the next arrive restarts that wiki; the arrive between them never restarts it twice", async () => {
    const { b, st, raise } = await boot();
    await b.promotedFor(W1);
    st.acts.push(await raise(W1));
    st.defer.set(W1, { settle: () => {} });
    expect(await b.arrive(), "a deferred restart is pending, never counted as done").toEqual([]);
    expect(st.restarts).toEqual([`${W1}:deferred`]);
    expect(await b.arrive(), "while it stands pending a further arrive does not restart it twice").toEqual([]);
    expect(st.restarts).toEqual([`${W1}:deferred`]);
    st.defer.get(W1)!.settle(new Error("deferred restart refused"));
    await new Promise((r) => setTimeout(r, 0));
    expect(st.failed).toEqual([W1]);
    st.defer.delete(W1);
    expect(await b.arrive(), "the failed deferred restart converges on the next arrive").toEqual([W1]);
    expect(st.restarts).toEqual([`${W1}:deferred`, W1]);
  });

  test("CONTROL: a deferred restart that succeeds leaves no retry", async () => {
    const { b, st, raise } = await boot();
    await b.promotedFor(W1);
    st.acts.push(await raise(W1));
    st.defer.set(W1, { settle: () => {} });
    await b.arrive();
    st.defer.get(W1)!.settle();
    await new Promise((r) => setTimeout(r, 0));
    st.defer.delete(W1);
    expect(await b.arrive()).toEqual([]);
    expect(st.restarts).toEqual([`${W1}:deferred`]);
    expect(st.failed).toEqual([]);
  });
});

describe("the brake outlives its cache and its history (Sol #2, #4)", () => {
  test("RED: a grant rotation that drops the raise from the board keeps the shadow in the cache and at the next boot; CONTROL: a counted signed lower releases it", async () => {
    const { b, st, hooks, raise } = await boot();
    await b.promotedFor(W1);
    const act = await raise(W1);
    st.acts.push(act);
    expect(await b.arrive()).toEqual([W1]);
    expect(st.local.shadowed).toEqual([promoteEdgeKey(W1, D)]);
    hooks.rotated = true;                                  // the old grant no longer counts: the board reads no raise
    expect(await b.arrive()).toEqual([]);
    expect(st.local.shadowed, "the reduced reading never overwrites the cache").toEqual([promoteEdgeKey(W1, D)]);
    expect(await b.promotedFor(W1), "the shadowed rite does not load again").toEqual([]);
    hooks.rotated = false;
    const lower = await signPromoteKapae({ group: GROUP, epoch: 0, wiki: W1, digest: D, raised: false, parents: [promoteActCid(act)] }, await (async () => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(1)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(1)) }))());
    st.acts.push(lower);
    await b.arrive();
    expect(st.local.shadowed).toEqual([]);
    expect(await b.promotedFor(W1)).toEqual([D]);
  });

  test("RED: a raise record deleted from the board keeps the shadow; CONTROL: with no raise ever seen the rite loads", async () => {
    const { b, st, raise } = await boot();
    expect(await (await boot()).b.promotedFor(W1)).toEqual([D]);
    await b.promotedFor(W1);
    st.acts.push(await raise(W1));
    await b.arrive();
    st.acts.length = 0;                                    // the record vanishes through sync
    expect(await b.promotedFor(W1)).toEqual([]);
  });

  test("RED: a torn cache read and a failed cache write never stop the restart, the failure is named, and the next arrive writes the cache; CONTROL: a healthy cache writes at once", async () => {
    const torn = await boot();
    await torn.b.promotedFor(W1);
    torn.st.acts.push(await torn.raise(W1));
    torn.hooks.tornLocalRead = true;
    expect(await torn.b.arrive(), "the brake runs on the board's own reading").toEqual([W1]);
    expect(torn.st.faults).toContain("ledger-unreadable");
    const failing = await boot();
    await failing.b.promotedFor(W1);
    failing.st.acts.push(await failing.raise(W1));
    failing.hooks.failLocalWrite = true;
    expect(await failing.b.arrive()).toEqual([W1]);
    expect(failing.st.local.shadowed).toEqual([]);
    expect(failing.st.faults).toContain("ledger-unreadable");
    failing.hooks.failLocalWrite = false;
    await failing.b.arrive();
    expect(failing.st.local.shadowed, "the next arrive persists it").toEqual([promoteEdgeKey(W1, D)]);
    const healthy = await boot();
    await healthy.b.promotedFor(W1);
    healthy.st.acts.push(await healthy.raise(W1));
    await healthy.b.arrive();
    expect(healthy.st.local.shadowed).toEqual([promoteEdgeKey(W1, D)]);
  });
});

describe("a pending restart suppresses only the edge it carries (Sol #6)", () => {
  test("RED: while a restart for one edge stands pending, a different edge's restart runs now; CONTROL: the same edge is not restarted twice", async () => {
    const { b, st, raise } = await boot();
    await b.promotedFor(W1);
    st.acts.push(await raise(W1));
    st.defer.set(W1, { settle: () => {} });
    await b.arrive();
    expect(st.hits).toEqual([[W1, [promoteEdgeKey(W1, D)]]]);
    await b.arrive();
    expect(st.hits, "the same edge is already carried").toHaveLength(1);
  });
});
