/**
 * dispatch-sealed-refusal — a sealed act the vessel refused reaches the person as ONE plain line and a non-zero exit,
 * never a stack trace, whichever command let it travel (the dispatcher renders it, as it renders a shut row).
 */
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("../src/sealed-act-door.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/sealed-act-door.js")>();
  const { SealedActRefused } = await import("@lararium/node");
  return { ...actual, sealedAct: vi.fn(async () => { throw new SealedActRefused("act-refused", "this vessel stands faces h0, h1 open and wears none of them"); }) };
});

import { dispatch } from "../src/bin/lares.js";

afterEach(() => vi.restoreAllMocks());

async function run(argv: string[]): Promise<{ code: number; err: string[]; out: string[] }> {
  const err: string[] = [], out: string[] = [];
  vi.spyOn(console, "error").mockImplementation((...a) => { err.push(a.map((x) => (x instanceof Error ? `${x.name}: ${x.stack}` : String(x))).join(" ")); });
  vi.spyOn(console, "log").mockImplementation((...a) => { out.push(a.map(String).join(" ")); });
  vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => { out.push(String(chunk).trim()); return true; });
  return { code: await dispatch(argv), err, out };
}

describe("a refused sealed act through the dispatcher", () => {
  test("★ `lares surface face` prints one plain line and exits non-zero ★", async () => {
    const r = await run(["surface", "face", "json=false"]);
    expect(r.code).not.toBe(0);
    expect(r.err).toEqual(["lares surface: this vessel stands faces h0, h1 open and wears none of them"]);
  });

  test("under json=true the refusal travels as one object under its reason", async () => {
    const r = await run(["surface", "face", "json=true"]);
    expect(r.code).not.toBe(0);
    const answer = JSON.parse(r.out.at(-1)!) as { ok: boolean; error: { code: string } };
    expect(answer).toMatchObject({ ok: false, error: { code: "act-refused" } });
  });
});
