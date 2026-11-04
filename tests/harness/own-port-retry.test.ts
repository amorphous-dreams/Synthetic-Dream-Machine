/** standOnFreePort — a daemon that dies naming "already in use" stands again on a fresh port, bounded; nothing else retries. */
import { describe, expect, test } from "vitest";
import { standOnFreePort } from "./instance.js";

const taken = (port: number): Error => new Error(`staged daemon exited 1 before live:\nport ${port} is already in use`);

describe("standOnFreePort", () => {
  test("RED: a daemon that exits 'already in use' once stands on a second port and goes live", async () => {
    const ports = [4002];
    const tried: number[] = [];
    const said: string[] = [];
    const out = await standOnFreePort(async (port) => { tried.push(port); if (port === 4001) throw taken(port); return "live"; },
      { first: 4001, pick: async () => ports.shift()!, say: (line) => said.push(line) });
    expect(tried).toEqual([4001, 4002]);
    expect(out).toMatchObject({ value: "live", port: 4002, retries: 1 });
    expect(said).toHaveLength(1);
    expect(said[0]).toContain("4001");
    expect(said[0]).toContain("4002");
  });
  test("CONTROL: three busy ports in a row fail after the bound, naming the last", async () => {
    let next = 5000;
    await expect(standOnFreePort(async (port) => { throw taken(port); }, { first: 5000, pick: async () => ++next, say: () => {} })).rejects.toThrow(/already in use/);
  });
  test("CONTROL: any other failure is final at once, and a caller-fixed port never retries", async () => {
    let calls = 0;
    await expect(standOnFreePort(async () => { calls++; throw new Error("staged daemon exited 1 before live: boom"); }, { first: 6000, pick: async () => 6001, say: () => {} })).rejects.toThrow(/boom/);
    expect(calls).toBe(1);
    let fixed = 0;
    await expect(standOnFreePort(async (port) => { fixed++; throw taken(port); }, { port: 7000, pick: async () => 7001, say: () => {} })).rejects.toThrow();
    expect(fixed).toBe(1);
  });
});
