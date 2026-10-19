import { describe, expect, test } from "vitest";
import { BrowserCustodyRefused, lockBrowserCustody, readBrowserCustody, readKeystoreRow, sealBrowserKeystore, writeKeystoreRow } from "../src/browser-custody.js";
import { openBrowserVessel } from "../src/open-browser-vessel.js";
import { generateOrLoadBrowserVesselIdentity } from "../src/browser-vessel-identity.js";
import { holdVesselLock, type LockHost } from "../src/vessel-lock.js";
import { clearCustodyVerb, standBrowserCustody } from "../src/browser-boot-custody.js";
import { CLEAR_CUSTODY_CLEARS, CLEAR_CUSTODY_QUESTION } from "../src/browser-custody.js";

let serial = 0;
const vessel = () => `lares:test-boot-custody:${Date.now()}:${serial++}`;
function lockHost(): { host: LockHost; held: Set<string> } {
  const held = new Set<string>();
  const host: LockHost = {
    request: async (name, _opts, callback) => {
      if (held.has(name)) return callback(null);
      held.add(name);
      try { return await callback({ name }); } finally { held.delete(name); }
    },
    query: async () => ({ held: [...held].map((name) => ({ name, clientId: "test", mode: "exclusive" })) }),
  };
  return { host, held };
}

async function snapshot(idbName: string): Promise<unknown[]> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(idbName);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  try {
    const tx = db.transaction("keystore", "readonly");
    const store = tx.objectStore("keystore");
    const [keys, values] = await Promise.all([
      new Promise<IDBValidKey[]>((resolve, reject) => { const q = store.getAllKeys(); q.onsuccess = () => resolve(q.result); q.onerror = () => reject(q.error); }),
      new Promise<unknown[]>((resolve, reject) => { const q = store.getAll(); q.onsuccess = () => resolve(q.result); q.onerror = () => reject(q.error); }),
    ]);
    return keys.map((key, i) => [key, values[i]]);
  } finally { db.close(); }
}

describe("browser boot custody asks before secret rows rest", () => {
  test("RED: the clear verb asks the custody door nothing before the yes; the yes asks once and clears", async () => {
    const idbName = vessel();
    await generateOrLoadBrowserVesselIdentity(idbName);
    const route = { kind: "passphrase", passphrase: "right route" } as const;
    await sealBrowserKeystore(idbName, route);
    const asked: unknown[] = [];
    const askCustody = async (question: { readonly kind: "clear" }) => { asked.push(question); return route; };
    for (const confirmed of [undefined, "no", "true", true]) {
      expect(await clearCustodyVerb({ idbName, confirmed, clears: CLEAR_CUSTODY_CLEARS, askCustody }), String(confirmed)).toEqual({ reading: "asks", question: CLEAR_CUSTODY_QUESTION });
    }
    // A yes binds to the scope its question named: a yes over any other scope, or none, clears nothing and asks the true question.
    for (const clears of [undefined, "", "the rows of another face"]) {
      expect(await clearCustodyVerb({ idbName, confirmed: "yes", clears, askCustody }), String(clears)).toEqual({ reading: "asks", question: CLEAR_CUSTODY_QUESTION });
    }
    expect(asked, "no route was asked before a yes over the scope this act clears").toEqual([]);
    expect((await readBrowserCustody(idbName)).reading).toBe("sealed");

    const declined = await clearCustodyVerb({ idbName, confirmed: "yes", clears: CLEAR_CUSTODY_CLEARS, askCustody: async () => null });
    expect(declined).toEqual({ reading: "declined" });
    expect((await readBrowserCustody(idbName)).reading, "a declined route clears nothing").toBe("sealed");

    const cleared = await clearCustodyVerb({ idbName, confirmed: "yes", clears: CLEAR_CUSTODY_CLEARS, askCustody });
    expect(cleared.reading).toBe("cleared");
    expect(asked).toEqual([{ kind: "clear" }]);
    expect((await readBrowserCustody(idbName)).reading).toBe("clear");
  });

  test("RED: a boot over a locked seal refuses sealed-locked and gives the store lock back; the stand then opens and the same page reads", async () => {
    const idbName = vessel();
    await generateOrLoadBrowserVesselIdentity(idbName);
    await sealBrowserKeystore(idbName, { kind: "passphrase", passphrase: "right route" });
    lockBrowserCustody(idbName);
    const { host, held } = lockHost();
    const refused = await openBrowserVessel({ wikiId: "w", idbName, locks: host, teardownBudgetMs: 5_000 } as never).catch((e: unknown) => e);
    expect(refused, String(refused)).toBeInstanceOf(BrowserCustodyRefused);
    expect((refused as BrowserCustodyRefused).reading).toBe("sealed-locked");
    expect(held.size, "the refused boot gave the store lock back").toBe(0);
    const retry = await holdVesselLock(idbName, host);
    expect(retry.held).toBe(true);
    await retry.release();
    const verdict = await standBrowserCustody({ idbName, ask: async () => ({ kind: "passphrase", passphrase: "right route" }) });
    expect(verdict.reading).toBe("opens");
    expect(await readKeystoreRow(idbName, "vessel-key"), "the device seed opens in this page").not.toBeUndefined();
  });

  test("RED: a locked seal refuses the custody read sealed-locked; the stand opens on the right route and the same page reads", async () => {
    const idbName = vessel();
    await generateOrLoadBrowserVesselIdentity(idbName);
    await sealBrowserKeystore(idbName, { kind: "passphrase", passphrase: "right route" });
    lockBrowserCustody(idbName);
    await expect(readKeystoreRow(idbName, "vessel-key")).rejects.toMatchObject({ reading: "sealed-locked" });
    const verdict = await standBrowserCustody({ idbName, ask: async () => ({ kind: "passphrase", passphrase: "right route" }) });
    expect(verdict.reading).toBe("opens");
    expect(await readKeystoreRow(idbName, "vessel-key")).not.toBeUndefined();
  });

  test("CONTROL: wrong routes make three asks and preserve every keystore row", async () => {
    const idbName = vessel();
    await generateOrLoadBrowserVesselIdentity(idbName);
    await sealBrowserKeystore(idbName, { kind: "passphrase", passphrase: "right route" });
    lockBrowserCustody(idbName);
    const before = await snapshot(idbName);
    const asks: unknown[] = [];
    const verdict = await standBrowserCustody({ idbName, attempts: 3, ask: async (q) => { asks.push(q); return { kind: "passphrase", passphrase: "wrong route" }; } });
    expect(verdict).toMatchObject({ reading: "no-slot-opens", attempts: 3 });
    expect(asks).toHaveLength(3);
    expect(asks.map((q) => (q as { attempt: number }).attempt)).toEqual([1, 2, 3]);
    expect(asks.map((q) => (q as { notes: readonly string[] }).notes)).toEqual([[], [], []]);
    expect(await snapshot(idbName)).toEqual(before);
  });

  test("declining unlock or first bind writes nothing; clear and held states ask only when required", async () => {
    const locked = vessel();
    await generateOrLoadBrowserVesselIdentity(locked);
    await sealBrowserKeystore(locked, { kind: "passphrase", passphrase: "x" });
    lockBrowserCustody(locked);
    const before = await snapshot(locked);
    expect((await standBrowserCustody({ idbName: locked, ask: async () => null })).reading).toBe("declined");
    expect(await snapshot(locked)).toEqual(before);
    const clear = vessel();
    await generateOrLoadBrowserVesselIdentity(clear);
    let calls = 0;
    expect((await standBrowserCustody({ idbName: clear, ask: async () => { calls++; return null; } })).reading).toBe("clear");
    expect(calls).toBe(0);
    expect((await standBrowserCustody({ idbName: clear, secretMintDue: true, ask: async (q) => { calls++; expect(q.kind).toBe("bind-first"); return null; } })).reading).toBe("declined");
    expect(calls).toBe(1);
    expect((await readBrowserCustody(clear)).reading).toBe("clear");
    await sealBrowserKeystore(clear, { kind: "passphrase", passphrase: "x" });
    calls = 0;
    expect((await standBrowserCustody({ idbName: clear, ask: async () => { calls++; return null; } })).reading).toBe("held");
    expect(calls).toBe(0);
    await expect(standBrowserCustody({ idbName: clear, attempts: 0, ask: async () => { calls++; return null; } })).rejects.toThrow(RangeError);
    await expect(standBrowserCustody({ idbName: clear, attempts: 1.5, ask: async () => { calls++; return null; } })).rejects.toThrow(RangeError);
    expect(calls).toBe(0);
  });

  test("RED: a clear keystore binds its first slot before a face secret mints, and the write that refused lands after", async () => {
    const idbName = vessel();
    await generateOrLoadBrowserVesselIdentity(idbName);
    await expect(writeKeystoreRow(idbName, "persona-root-roster", { roots: [0] })).rejects.toMatchObject({ reading: "no-custody-slot" });
    const verdict = await standBrowserCustody({ idbName, secretMintDue: true, ask: async () => ({ kind: "passphrase", passphrase: "first route" }) });
    expect(verdict.reading).toBe("bound");
    await writeKeystoreRow(idbName, "persona-root-roster", { roots: [0] });
    expect(await readKeystoreRow(idbName, "persona-root-roster")).toEqual({ roots: [0] });
  });
});
