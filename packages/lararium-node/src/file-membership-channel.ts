/**
 * file-membership-channel — the FILE/POST impl of the membership shore (MembershipChannel),
 * node-side. Envelopes ride as JSON files in a shared directory; a per-recipient seen-set
 * gives deliver-once. Cross-PROCESS by construction (the files are the shared state; each
 * process keeps its own seen-set) — a shared Docker VOLUME makes it cross-CONTAINER.
 *
 * The shore's deployed impl: it rides a shared volume, with no relay service to stand.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/cabal-realm
 */

import { mkdirSync, writeFileSync, readdirSync, readFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import {
  MEMBERSHIP_BROADCAST,
  type MembershipChannel, type MembershipEnvelope,
} from "@lararium/mesh";

function forRecipient(e: MembershipEnvelope, recipient: string): boolean {
  return e.from !== recipient && (e.to === recipient || e.to === MEMBERSHIP_BROADCAST);
}

/**
 * A file-backed membership channel over a shared directory. `offer` writes an envelope as a file named by
 * PER-WRITER IDENTITY, never wall time — a fresh random writer id minted once per channel instance (collision-
 * free across processes without needing `process.pid`, which a container/namespace can recycle) plus a local
 * monotonic sequence (collision-free within this writer). `poll` reads the dir, delivers unseen envelopes
 * addressed to the recipient (or broadcast, never self), and remembers them (deliver-once per recipient, per
 * process). Filename order carries NO causal meaning — two concurrent writers' envelopes may land in either
 * order, and delivery never claims otherwise; only (writerId, seq) identifies and dedupes a message.
 */
export class FileMembershipChannel implements MembershipChannel {
  private readonly writerId = randomBytes(8).toString("hex");
  private seq = 0;
  private readonly seen = new Map<string, Set<string>>();

  constructor(private readonly dir: string) { mkdirSync(dir, { recursive: true }); }

  offer(env: MembershipEnvelope): Promise<void> {
    // Name = this writer's id + its own local seq → collision-free across processes, with no wall clock and no
    // reliance on a reusable pid. Carries no cross-writer ordering claim. Padded to 15 digits — the same width
    // `epoch-lease`'s decimal fences use — so a long-lived writer's sequence cannot overtake the padding and
    // invert lexical order (L3); order carries no causal claim regardless, so this only protects within-writer
    // delivery order, never a correctness property.
    const name = `${this.writerId}-${String(this.seq++).padStart(15, "0")}.json`;
    // ATOMIC WRITE: a poll reading mid-write must never see a half-written file. Write under a `.tmp` name
    // (same directory, so the rename is a same-filesystem metadata op, not a copy) and rename it into place —
    // the rename is the only operation that makes the envelope visible at its real name, so every reader that
    // lists the directory sees either nothing or the WHOLE envelope, never a partial one.
    const finalPath = join(this.dir, name);
    const tmpPath   = `${finalPath}.tmp`;
    writeFileSync(tmpPath, JSON.stringify(env));
    renameSync(tmpPath, finalPath);
    return Promise.resolve();
  }

  poll(recipient: string): Promise<readonly MembershipEnvelope[]> {
    const seen = this.seen.get(recipient) ?? new Set<string>();
    const out: MembershipEnvelope[] = [];
    for (const f of readdirSync(this.dir).filter((x) => x.endsWith(".json")).sort()) {
      if (seen.has(f)) continue;
      let env: MembershipEnvelope;
      try { env = JSON.parse(readFileSync(join(this.dir, f), "utf8")) as MembershipEnvelope; }
      catch { continue; }    // a torn/unreadable file — DO NOT mark seen; retry next poll, as the comment always claimed
      seen.add(f);            // mark seen ONLY after a clean parse, so a parse failure costs no envelope forever
      if (forRecipient(env, recipient)) out.push(env);
    }
    this.seen.set(recipient, seen);
    return Promise.resolve(out);
  }
}
