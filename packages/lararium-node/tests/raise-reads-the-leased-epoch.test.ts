/**
 * THE RAISE FENCE READS THE EPOCH THE BOARD LEASES.
 *
 * `effectiveLeaseEpochOnBoard` answers the epoch a raise must match: the maximum over every writer's slot
 * for the resource on the daemon board. A roll (`rollLeaseEpochOnBoard`) advances it, and a raise standing
 * against the earlier epoch then reads stale. The reader takes each slot through the one read door
 * (`tiddlerText`): a slot stands as a record whose `text` rests as an immutable scalar.
 *
 * Control: a board that holds no slot for the resource answers 0, and a roll under another resource leaves
 * this resource's epoch where it stood.
 */
import { describe, test, expect, afterEach } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { emptyLarDoc, type LarDoc } from "@lararium/mesh";
import { rollLeaseEpochOnBoard } from "../src/lease-rekey.js";
import { effectiveLeaseEpochOnBoard } from "../src/vessel-raise.js";

const NEXUS = "0x" + "11".repeat(32);
const OTHER = "0x" + "22".repeat(32);
const WRITER = "0x" + "aa".repeat(32);

const repos: Repo[] = [];
afterEach(async () => { await Promise.all(repos.splice(0).map((r) => r.shutdown())); });

describe("the raise fence reads the leased epoch", () => {
  test("a roll under the resource advances the epoch the raise door reads", () => {
    const repo = new Repo({ network: [] });
    repos.push(repo);
    const board = repo.create<LarDoc>(emptyLarDoc());
    expect(effectiveLeaseEpochOnBoard(board, NEXUS)).toBe(0);

    rollLeaseEpochOnBoard(board, NEXUS, WRITER);
    expect(effectiveLeaseEpochOnBoard(board, NEXUS)).toBe(1);
    rollLeaseEpochOnBoard(board, NEXUS, WRITER);
    expect(effectiveLeaseEpochOnBoard(board, NEXUS)).toBe(2);

    // CONTROL: another resource's roll leaves this one's epoch standing, and reads its own.
    rollLeaseEpochOnBoard(board, OTHER, WRITER);
    expect(effectiveLeaseEpochOnBoard(board, NEXUS)).toBe(2);
    expect(effectiveLeaseEpochOnBoard(board, OTHER)).toBe(1);
  });
});
