/** standOnFreePort — a daemon that dies naming "already in use" stands again on a fresh port, bounded; nothing else retries. */
import { describe, expect, test } from "vitest";
import { freePort, standOnFreePort } from "./instance.js";

const taken = (port: number): Error => new Error(`staged daemon exited 1 before live:\nport ${port} is already in use`);

describe("standOnFreePort", () => {
  test("RED: a daemon that exits 'already in use' once stands on a second port and goes live", async () => {
    const first = await freePort();
    let second = await freePort();
    while (second === first) second = await freePort();
    const ports = [second];
    const tried: number[] = [];
    const said: string[] = [];
    const out = await standOnFreePort(async (port) => { tried.push(port); if (port === first) throw taken(port); return "live"; },
      { first, pick: async () => ports.shift()!, say: (line) => said.push(line) });
    expect(tried).toEqual([first, second]);
    expect(out).toMatchObject({ value: "live", port: second, retries: 1 });
    expect(said).toHaveLength(1);
    expect(said[0]).toContain(String(first));
    expect(said[0]).toContain(String(second));
  });
  test("CONTROL: three busy ports in a row fail after the bound, naming the last", async () => {
    let next = 5000;
    await expect(standOnFreePort(async (port) => { throw taken(port); }, { first: 5000, pick: async () => ++next, say: () => {} })).rejects.toThrow(/already in use/);
  });
  test("CONTROL: any other failure is final at once, and a caller-fixed port never retries", async () => {
    let calls = 0;
    await expect(standOnFreePort(async () => { calls++; throw new Error("staged daemon exited 1 before live: boom"); }, { first: 6000, pick: async () => 6001, say: () => {} })).rejects.toThrow(/boom/);
    expect(calls).toBe(1);
    const fixedPort = await freePort();
    const alternatePort = await freePort();
    let fixed = 0;
    await expect(standOnFreePort(async (port) => { fixed++; throw taken(port); }, { port: fixedPort, pick: async () => alternatePort, say: () => {} })).rejects.toThrow();
    expect(fixed).toBe(1);
  });
});
