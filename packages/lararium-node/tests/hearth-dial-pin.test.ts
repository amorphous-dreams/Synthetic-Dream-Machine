/**
 * hearth-dial-pin — the PIN names the dial. A joinee founded by an admit edge holds, in its bootstrap, the
 * hearth's `ws://` sync url and the hearth's gate key; the boot dials them when no `LAR_JOIN_*` rides the env.
 * CONTROL: a bootstrap carrying no pin (a self-founded vessel) reads null; a torn pin (one half) reads null.
 */
import { describe, test, expect } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hearthDialTiddlers, readHearthDialPin } from "../src/hearth-dial-pin.js";

const bootstrapWith = (tiddlers: Record<string, unknown>): string => {
  const dir = mkdtempSync(join(tmpdir(), "lares-hearth-pin-"));
  const path = join(dir, "social-bootstrap.json");
  writeFileSync(path, JSON.stringify({ title: "$:/plugins/lares/bootstrap", text: JSON.stringify({ tiddlers }) }));
  return path;
};

describe("the pinned edge's hearth dial", () => {
  test("a bootstrap carrying the pin answers the sync url + gate key", () => {
    const gate = "ab".repeat(32);
    const path = bootstrapWith({ ...hearthDialTiddlers("ws://127.0.0.1:4242/ws", gate) });
    expect(readHearthDialPin(path)).toEqual({ syncUrl: "ws://127.0.0.1:4242/ws", gatePubKey: gate });
    rmSync(join(path, ".."), { recursive: true, force: true });
  });

  test("CONTROL — no pin (a self-founded vessel) → null; a torn pin → null; a malformed gate key → null", () => {
    const none = bootstrapWith({ "lar:///ha.ka.ba/bags/daemon": { title: "x", text: "automerge:abc" } });
    expect(readHearthDialPin(none)).toBeNull();
    const torn = bootstrapWith({ ...hearthDialTiddlers("ws://127.0.0.1:4242/ws", "ab".repeat(32)) });
    const t = JSON.parse(JSON.parse(readFileSync(torn, "utf8")).text) as { tiddlers: Record<string, unknown> };
    delete t.tiddlers[Object.keys(t.tiddlers).find((k) => k.endsWith("gate-key"))!];
    writeFileSync(torn, JSON.stringify({ text: JSON.stringify(t) }));
    expect(readHearthDialPin(torn)).toBeNull();
    const bad = bootstrapWith({ ...hearthDialTiddlers("ws://127.0.0.1:4242/ws", "not-a-key") });
    expect(readHearthDialPin(bad)).toBeNull();
    expect(readHearthDialPin("/nonexistent/social-bootstrap.json")).toBeNull();
  });
});
