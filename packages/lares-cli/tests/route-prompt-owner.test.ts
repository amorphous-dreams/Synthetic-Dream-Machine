/**
 * route-prompt-owner — EVERY ROUTE PROMPT NAMES WHOSE ROUTE IT ASKS: the vessel's, face hN's, or the backup bundle's. The question
 * a person reads at the terminal carries the owner, so a passphrase typed under it never lands on a key it was not meant for.
 * The ward door's prompt names the face by its handle index (or the worn face where the act names none).
 */
import { EventEmitter } from "node:events";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";

const asked: string[] = [];
vi.mock("../src/prompt-secret.js", async (real) => {
  const actual = await real<typeof import("../src/prompt-secret.js")>();
  return {
    ...actual,
    canPromptSecret: () => true,
    promptLine: async (label: string) => { asked.push(label); return ""; },
    promptSecret: async (label: string) => { asked.push(label); return "a-route"; },
  };
});

let gatherCredentials: typeof import("../src/custody-prompt.js").gatherCredentials;
beforeAll(async () => { vi.resetModules(); ({ gatherCredentials } = await import("../src/custody-prompt.js")); });

afterEach(() => { asked.length = 0; vi.restoreAllMocks(); });

describe("RED route prompts name their owner", () => {
  test("route-prompt-names-the-vessel", async () => {
    await gatherCredentials("lares vault unlock", { kind: "vessel" } as never);
    expect(asked[0]).toMatch(/the vessel's key/);
    expect(asked[1]).toMatch(/the vessel's passphrase/);
  });

  test("route-prompt-names-the-face", async () => {
    await gatherCredentials("lares vault bind --face 1", { kind: "face", ordinal: 1 } as never);
    expect(asked[0]).toMatch(/face h1's key/);
    expect(asked[1]).toMatch(/face h1's passphrase/);
  });

  test("route-prompt-names-the-bundle", async () => {
    await gatherCredentials("lares vessel found --hearth --restore", { kind: "bundle" } as never);
    expect(asked[0]).toMatch(/the backup bundle's key/);
  });
});

/** A terminal that answers one line once it is read. */
class FakeTty extends EventEmitter {
  isTTY = true; isRaw = false;
  setRawMode(on: boolean): void { this.isRaw = on; }
  setEncoding(): void {}
  resume(): this { queueMicrotask(() => this.emit("data", "the-ward-route\r")); return this; }
  pause(): this { return this; }
  unshift(): void {}
}

describe("RED the ward prompt names the face", () => {
  test("ward-prompt-names-the-face-ordinal", async () => {
    const { readWardPassphrase } = await vi.importActual<typeof import("../src/prompt-secret.js")>("../src/prompt-secret.js");
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((c) => { written.push(String(c)); return true; });
    const route = await (readWardPassphrase as (verb: string, opts: object) => Promise<string>)("lares vault backup --face 2", { stream: new FakeTty(), env: {}, face: 2 });
    expect(route).toBe("the-ward-route");
    expect(written.join("")).toMatch(/face h2's passphrase for this one act/);
  });

  test("a ward act naming no face asks the worn face's passphrase", async () => {
    const { readWardPassphrase } = await vi.importActual<typeof import("../src/prompt-secret.js")>("../src/prompt-secret.js");
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((c) => { written.push(String(c)); return true; });
    await readWardPassphrase("lares lei kui", { stream: new FakeTty() as never, env: {} });
    expect(written.join("")).toMatch(/the worn face's passphrase for this one act/);
  });

  test("CONTROL: the ward prompt still leads with the act that asks, and reads the typed route", async () => {
    const { readWardPassphrase } = await vi.importActual<typeof import("../src/prompt-secret.js")>("../src/prompt-secret.js");
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((c) => { written.push(String(c)); return true; });
    expect(await readWardPassphrase("lares vault backup --face 2", { stream: new FakeTty() as never, env: {} })).toBe("the-ward-route");
    expect(written.join("")).toMatch(/^lares vault backup --face 2: /);
  });
});
