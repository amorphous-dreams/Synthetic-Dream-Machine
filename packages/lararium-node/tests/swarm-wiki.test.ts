/** Swarm custody survives reopen in pūlama; lane and roster rows follow their face board. */
import { expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Repo } from "@automerge/automerge-repo";
import { emptyLarDoc, type LarDoc } from "@lararium/mesh/base-doc";
import { swarmLeiRecordTitle, swarmLeiTitle, swarmLeiReturnedTitle, SWARM_URI_PREFIX } from "@lararium/mesh/swarm-tiddlers";
import { docSwarmWiki } from "@lararium/mesh/doc-swarm-wiki";
import { swarmOwners } from "@lararium/mesh/swarm-owner";
import { pulamaRecords } from "../src/pulama-state.js";

async function withOwners(run: (v: { dir: string; wiki: ReturnType<typeof swarmOwners>; board: ReturnType<Repo["create"]> }) => Promise<void>) {
  const dir = mkdtempSync(join(tmpdir(), "pulama-swarm-")), repo = new Repo();
  const board = repo.create<LarDoc>(emptyLarDoc());
  try { await run({ dir, board, wiki: swarmOwners(pulamaRecords(dir), docSwarmWiki(async () => board)) }); }
  finally { await repo.shutdown(); rmSync(dir, { recursive: true, force: true }); }
}

test("signed custody bytes survive reopen; face-owned lane rows never enter custody", async () => withOwners(async ({ dir, wiki, board }) => {
  const title = swarmLeiTitle("push", "feature/x"), text = '{"body":{"returns":3},"signer":"hand","sig":"signed bytes"}';
  await wiki.write(title, text);
  expect(await pulamaRecords(dir).read(title)).toBe(text);
  expect(board.doc()?.tiddlers[title]).toBeUndefined();
  const lane = `${SWARM_URI_PREFIX}lane/feature-x/state`;
  await wiki.write(lane, "lane-state");
  expect(await pulamaRecords(dir).read(lane)).toBeNull();
  expect(await wiki.read(lane)).toBe("lane-state");
}));

test("independent pūlama adapters atomically claim one spend and preserve its count across restart", async () => withOwners(async ({ dir, wiki }) => {
  const cid = "c".repeat(64), title = swarmLeiReturnedTitle(cid, 1);
  const claims = await Promise.all([1, 2, 3, 4].map(n => pulamaRecords(dir).writeNew(title, `spender-${n}`)));
  expect(claims.filter(Boolean)).toHaveLength(1);
  expect(await wiki.read(title)).toBe(`spender-${claims.indexOf(true) + 1}`);
  expect(await pulamaRecords(dir).list(`${SWARM_URI_PREFIX}lei-returned/${cid}/`)).toHaveLength(1);
  expect(await pulamaRecords(dir).writeNew(title, "retry")).toBe(false);
  expect(await wiki.writeNew(swarmLeiReturnedTitle(cid, 2), "second-spend")).toBe(true);
  expect(await pulamaRecords(dir).list(`${SWARM_URI_PREFIX}lei-returned/${cid}/`)).toHaveLength(2);
}));

test("custody listing keeps the branch boundary and treats prototype names as absent", async () => withOwners(async ({ wiki }) => {
  const a = swarmLeiRecordTitle("push", "feature/x", "a".repeat(64)), b = swarmLeiRecordTitle("push", "feature/x", "b".repeat(64));
  await wiki.writeNew(a, "a"); await wiki.writeNew(b, "b");
  await wiki.writeNew(swarmLeiRecordTitle("push", "feature/x/y", "c".repeat(64)), "other");
  expect([...await wiki.list(`${swarmLeiTitle("push", "feature/x")}/`)].sort()).toEqual([a, b].sort());
  expect(await wiki.read("__proto__")).toBeNull(); expect(await wiki.read("constructor")).toBeNull();
}));
