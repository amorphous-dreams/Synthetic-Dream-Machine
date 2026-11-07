/**
 * seal-cost-flat — a seal's work stays bounded as a bag's ledger grows (vessel-reboot, step 13).
 *
 * A vessel that seals each write of a long-lived document (the daemon's outcome ledger) rests one manifest per
 * batch. Each manifest's parents named EVERY manifest the vessel had verified under the version, and the holder read
 * every resting manifest to find them: the Nth seal read N records, each one naming the N before it, so a seal's work
 * grew with the ledger and a long session's reads crawled to the verb's wait. The vector counts the records each
 * seal and each open reads from rest, and the bytes it reads, at three ledger sizes. No clock decides.
 */

import { describe, expect, it } from "vitest";
import { utf8Bytes } from "../src/crypto.js";
import { logicalRefOf } from "../src/sealed-doc-store.js";
import { said, vessel, world, type Vessel } from "./content-key-fixture.js";

const BAG = "lar:///ha.ka.ba/@test/bags/outcome-ledger";

/** Count the rest reads and the bytes one act takes. */
function meter(v: Vessel): { take: () => { gets: number; bytes: number } } {
  let gets = 0, bytes = 0;
  const get = v.rest.get.bind(v.rest);
  (v.rest as { get: typeof get }).get = async (kind, name) => {
    const got = await get(kind, name);
    gets++; bytes += got?.byteLength ?? 0;
    return got;
  };
  return { take: () => { const out = { gets, bytes }; gets = 0; bytes = 0; return out; } };
}

const change = (n: number) => ({ role: "change" as const, ref: logicalRefOf(["ledger", "incremental", `c${n}`]), parents: [], plaintext: utf8Bytes(`outcome ${n}`) });

/** Seal up to `n` one-value batches, then meter one more seal and one open. */
async function costAt(n: number): Promise<{ seal: { gets: number; bytes: number }; open: { gets: number; bytes: number }; manifestBytes: number }> {
  const v = await vessel(world(), "a");
  for (let i = 0; i < n; i++) {
    const out = await v.holder.sealValues({ bagId: BAG, values: [change(i)], signer: v.signer });
    if ("refusal" in out) throw new Error(said(out));
  }
  const m = meter(v);
  const out = await v.holder.sealValues({ bagId: BAG, values: [change(n)], signer: v.signer });
  if ("refusal" in out) throw new Error(said(out));
  const seal = m.take();
  const opened = await v.holder.openValue({ bagId: BAG, role: "change", ref: change(n).ref });
  if ("refusal" in opened) throw new Error(said(opened));
  const open = m.take();
  const manifestBytes = [...v.rest.values].filter(([k]) => k.startsWith(`manifest/${out.manifest}`)).reduce((s, [, b]) => s + b.byteLength, 0);
  return { seal, open, manifestBytes };
}

describe("a seal's work stays flat as the ledger grows", () => {
  it("F1 — the records a seal reads, the bytes it reads and the manifest it rests hold the same at 10, 40 and 75 prior seals", async () => {
    const at = { 10: await costAt(10), 40: await costAt(40), 75: await costAt(75) };
    process.stderr.write(`seal-cost-flat: ${JSON.stringify(at)}\n`);
    expect(at[75].seal.gets).toBe(at[10].seal.gets);
    expect(at[40].seal.gets).toBe(at[10].seal.gets);
    expect(at[75].manifestBytes).toBe(at[10].manifestBytes);
    // An open reads its row and its value; the manifest it names stays verified in the holder's reading.
    expect(at[75].open.gets).toBe(at[10].open.gets);
  });

  it("F0 — control: a small ledger seals and opens, and the second seal cites the first", async () => {
    const v = await vessel(world(), "a");
    const first = await v.holder.sealValues({ bagId: BAG, values: [change(0)], signer: v.signer });
    if ("refusal" in first) throw new Error(said(first));
    const second = await v.holder.sealValues({ bagId: BAG, values: [change(1)], signer: v.signer });
    if ("refusal" in second) throw new Error(said(second));
    expect((await v.store.record("manifest", second.manifest))[0]!.body.parents).toEqual([first.manifest]);
    const opened = await v.holder.openValue({ bagId: BAG, role: "change", ref: change(0).ref });
    expect("plaintext" in opened).toBe(true);
  });
});
