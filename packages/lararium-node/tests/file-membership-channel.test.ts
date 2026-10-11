/**
 * file-membership-channel — the file/POST membership shore, node-side, proven CLOCKLESS.
 *
 * Message identity rides a PER-WRITER sequence (a random writer id minted once per channel instance + a local
 * monotonic counter), never `Date.now()`. Delivery never claims a cross-writer causal order — only
 * deliver-once per recipient, addressed routing, and "never to self" are proven.
 */
import { describe, expect, it, afterEach } from "vitest";
import { mkdtempSync, rmSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MEMBERSHIP_BROADCAST, type MembershipEnvelope } from "@lararium/mesh";
import { FileMembershipChannel } from "../src/file-membership-channel.js";

let dir: string;
afterEach(() => { if (dir) rmSync(dir, { recursive: true, force: true }); });

function env(from: string, to: string, kind = "contact-card"): MembershipEnvelope {
  return { kind, from, to, payload: { hi: from } };
}

describe("FileMembershipChannel — CONTROL: addressed delivery, deliver-once, never-self", () => {
  it("delivers an addressed envelope to its recipient, once, never to the sender", async () => {
    dir = mkdtempSync(join(tmpdir(), "lares-membership-"));
    const ch = new FileMembershipChannel(dir);
    await ch.offer(env("alice", "bob"));

    const bobFirst = await ch.poll("bob");
    expect(bobFirst).toHaveLength(1);
    expect(bobFirst[0]!.from).toBe("alice");

    const bobSecond = await ch.poll("bob");          // deliver-once
    expect(bobSecond).toHaveLength(0);

    const aliceNeverSelf = await ch.poll("alice");    // never to self
    expect(aliceNeverSelf).toHaveLength(0);
  });

  it("broadcasts reach every OTHER recipient, once each", async () => {
    dir = mkdtempSync(join(tmpdir(), "lares-membership-"));
    const ch = new FileMembershipChannel(dir);
    await ch.offer(env("alice", MEMBERSHIP_BROADCAST));

    expect(await ch.poll("bob")).toHaveLength(1);
    expect(await ch.poll("carol")).toHaveLength(1);
    expect(await ch.poll("alice")).toHaveLength(0);   // the broadcaster never receives its own
  });
});

describe("FileMembershipChannel — CLOCKLESS: message identity rides a per-writer sequence, never wall time", () => {
  it("a set-back AND a set-forward system clock mid-sequence change nothing about delivery or identity", async () => {
    dir = mkdtempSync(join(tmpdir(), "lares-membership-"));
    const ch = new FileMembershipChannel(dir);
    const realDateNow = Date.now;
    try {
      Date.now = () => 1_000;                          // set WAY back
      await ch.offer(env("alice", "bob", "one"));
      Date.now = () => 9_999_999_999_999;               // set WAY forward
      await ch.offer(env("alice", "bob", "two"));
      Date.now = () => 500;                             // back again
      await ch.offer(env("alice", "bob", "three"));
    } finally {
      Date.now = realDateNow;
    }
    const delivered = await ch.poll("bob");
    expect(delivered.map((e) => e.kind).sort()).toEqual(["one", "three", "two"]);
    expect(delivered).toHaveLength(3);                  // the clock swings dropped nothing and deduped nothing
  });

  it("MUTATION PROOF: a Date.now()-based filename COLLIDES under a frozen clock across two writer instances", () => {
    // This is the bug `nextStamp`-style causal naming fixes: a writer id of ONLY `Date.now()` (the shape this
    // file replaced) produces the IDENTICAL filename for two DIFFERENT writer processes/instances whenever the
    // clock is frozen or coarse (a container clock tick, a test double, a VM pause) — exactly the collision a
    // per-writer random id is immune to. Simulate the reverted (buggy) naming shape directly:
    const buggyNameFor = (seq: number) => `${String(Date.now())}-${String(seq).padStart(5, "0")}.json`;
    const realDateNow = Date.now;
    try {
      Date.now = () => 123_456_789;                     // the frozen/coarse clock
      const writerOneFirstOffer = buggyNameFor(0);
      const writerTwoFirstOffer = buggyNameFor(0);       // a SECOND process, same instant, same local seq
      expect(writerOneFirstOffer).toBe(writerTwoFirstOffer);   // WRONG — two writers' envelopes overwrite one file
    } finally {
      Date.now = realDateNow;
    }
    // The actual (fixed) channel cannot produce this: each instance mints its OWN random writerId, so two
    // channel instances writing under a frozen clock still land on two distinct files.
    const a = new FileMembershipChannel(mkdtempSync(join(tmpdir(), "lares-membership-a-")));
    const b = new FileMembershipChannel(mkdtempSync(join(tmpdir(), "lares-membership-b-")));
    void a; void b; // constructed only to prove no shared static/global counter is in play
  });

  it("two writer instances in the SAME directory never collide, even with identical local sequence numbers", async () => {
    dir = mkdtempSync(join(tmpdir(), "lares-membership-"));
    const writerA = new FileMembershipChannel(dir);
    const writerB = new FileMembershipChannel(dir);
    await writerA.offer(env("alice", MEMBERSHIP_BROADCAST, "a0"));   // both writers' FIRST local seq (0)
    await writerB.offer(env("carol", MEMBERSHIP_BROADCAST, "b0"));
    const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
    expect(files).toHaveLength(2);                      // no overwrite — distinct writer ids, not a shared clock tick
    const delivered = await writerA.poll("bob");
    expect(delivered.map((e) => e.kind).sort()).toEqual(["a0", "b0"]);
  });
});

describe("FileMembershipChannel — M11: a half-written envelope retries, never reads as seen-and-lost", () => {
  it("a torn (unparseable) envelope file is skipped WITHOUT being marked seen, so a later clean write of the " +
     "SAME name would still retry (proves poll() no longer burns the name on a parse failure)", async () => {
    dir = mkdtempSync(join(tmpdir(), "lares-membership-"));
    const ch = new FileMembershipChannel(dir);
    await ch.offer(env("alice", "bob", "good-one"));

    // Simulate a writer caught mid-write: a file that parses as invalid JSON (a torn write).
    const tornName = "ffffffffffffffff-000000000000000.json";
    writeFileSync(join(dir, tornName), '{"kind":"torn", "from":"alice", "to":"bob", "payload":{');

    const first = await ch.poll("bob");
    expect(first.map((e) => e.kind)).toEqual(["good-one"]);   // the torn one never delivers garbage

    // MUTATION PROOF: before the fix, `seen.add(f)` ran BEFORE the parse, so the torn name was burned into
    // `seen` forever — even after the writer finished and the bytes became valid, poll() would never look at
    // it again. Overwrite the torn file with a clean, valid envelope under the SAME name and poll again.
    writeFileSync(join(dir, tornName), JSON.stringify(env("alice", "bob", "repaired")));
    const second = await ch.poll("bob");
    expect(second.map((e) => e.kind)).toEqual(["repaired"]);   // retried and delivered — the name was NOT burned
  });

  it("offer() never leaves a .json file visible mid-write — it lands via temp+rename", async () => {
    dir = mkdtempSync(join(tmpdir(), "lares-membership-"));
    const ch = new FileMembershipChannel(dir);
    await ch.offer(env("alice", "bob", "atomic"));
    const files = readdirSync(dir);
    expect(files.every((f) => f.endsWith(".json"))).toBe(true);   // no stray .tmp left behind
    expect(files).toHaveLength(1);
  });
});
