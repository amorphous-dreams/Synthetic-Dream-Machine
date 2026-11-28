/**
 * iris — the messenger core that holds a client's MCP seat across its child's sleep (road L45a).
 *
 * The pure frame machine alone runs here: client frames in, child frames in, child-state events in; frames and spawn/kill
 * intents out. No process spawns and no clock ticks. A scripted child answers the frames the seat hands it.
 */
import { describe, expect, test } from "vitest";
import { HEARTH_SLEEPS, OUTCOME_UNKNOWN, VESSEL_LOCKED, iris, type IrisEffect, type IrisEvent, type IrisFrame } from "../src/iris.js";

const INIT_PARAMS = { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "fixture-client", version: "1" } };
const tool = (name: string) => ({ name, description: `the ${name} door`, inputSchema: { type: "object" } });

/** A seat with a scripted child beside it. The child answers `initialize` and `tools/list`, and holds every other request open. */
function fixture(firstTools: readonly string[] = ["status", "recall"]) {
  const seat = iris();
  const seen = { client: [] as IrisFrame[], child: [] as IrisFrame[], effects: [] as IrisEffect[] };
  let tools = firstTools, up = false;
  const answer = (frame: IrisFrame): IrisFrame | null => {
    if (frame["method"] === "initialize") return { jsonrpc: "2.0", id: frame["id"], result: { protocolVersion: "2025-06-18", capabilities: { tools: { listChanged: false } }, serverInfo: { name: "fixture-surface", version: "7" }, instructions: "read the house" } };
    if (frame["method"] === "tools/list") return { jsonrpc: "2.0", id: frame["id"], result: { tools: tools.map(tool) } };
    return null;
  };
  const step = (event: IrisEvent): IrisEffect[] => {
    const out: IrisEffect[] = [], queue: IrisEvent[] = [event];
    while (queue.length > 0) {
      for (const effect of seat.step(queue.shift()!)) {
        out.push(effect); seen.effects.push(effect);
        if (effect.type === "to-client") seen.client.push(effect.frame);
        if (effect.type === "to-child") {
          seen.child.push(effect.frame);
          const reply = up ? answer(effect.frame) : null;
          if (reply) queue.push({ type: "child-frame", frame: reply });
        }
      }
    }
    return out;
  };
  const api = {
    seat, seen, step,
    client: (frame: IrisFrame) => step({ type: "client-frame", frame }),
    child: (frame: IrisFrame) => step({ type: "child-frame", frame }),
    up: (next?: readonly string[]) => { if (next) tools = next; up = true; return step({ type: "child-up" }); },
    down: () => { up = false; return step({ type: "child-down" }); },
    /** The whole opening: the seat starts, its first child stands, the client initializes and reads the tools. */
    open: () => {
      step({ type: "start" });
      api.up();
      api.client({ jsonrpc: "2.0", id: 1, method: "initialize", params: INIT_PARAMS });
      api.client({ jsonrpc: "2.0", method: "notifications/initialized" });
      return api;
    },
  };
  return api;
}

const toClient = (effects: readonly IrisEffect[]): IrisFrame[] => effects.flatMap((e) => (e.type === "to-client" ? [e.frame] : []));
const toChild = (effects: readonly IrisEffect[]): IrisFrame[] => effects.flatMap((e) => (e.type === "to-child" ? [e.frame] : []));
const kinds = (effects: readonly IrisEffect[]): string[] => effects.map((e) => e.type);
const errorText = (frame: IrisFrame | undefined): unknown => ((frame?.["result"] as { content?: { text?: string }[] } | undefined)?.content ?? [])[0]?.text;

describe("seat-outlives-child", () => {
  test("RED: a child's death draws a spawn intent and no exit, through three deaths; CONTROL: the client's close ends the seat", () => {
    const f = fixture();
    expect(kinds(f.step({ type: "start" }))).toContain("spawn");
    f.up();
    f.client({ jsonrpc: "2.0", id: 1, method: "initialize", params: INIT_PARAMS });
    for (let i = 0; i < 3; i++) {
      const died = f.down();
      expect(kinds(died)).toContain("spawn");
      expect(kinds(died)).not.toContain("exit");
      // The seat still answers while none stands.
      expect(toClient(f.client({ jsonrpc: "2.0", id: 100 + i, method: "ping" }))).toEqual([{ jsonrpc: "2.0", id: 100 + i, result: {} }]);
      f.up();
    }
    const closed = f.step({ type: "client-closed" });
    expect(kinds(closed)).toEqual(expect.arrayContaining(["kill", "exit"]));
    // A seat that closed asks for no further child.
    expect(kinds(f.down())).not.toContain("spawn");
  });

  test("RED: an initialize that arrives before the first child stands waits for that child's own answer; CONTROL: it reads the child's serverInfo", () => {
    const f = fixture();
    f.step({ type: "start" });
    // The client writes at once; the first spawn has neither stood nor fallen.
    expect(toClient(f.client({ jsonrpc: "2.0", id: 1, method: "initialize", params: INIT_PARAMS }))).toEqual([]);
    const stood = toClient(f.up());
    expect(stood).toHaveLength(1);
    expect(stood[0]).toMatchObject({ id: 1, result: { serverInfo: { name: "fixture-surface" }, instructions: "read the house" } });
  });

  test("RED: a first child that falls with the initialize unanswered leaves the client a plain answer, never silence", () => {
    const f = fixture();
    f.step({ type: "start" });
    f.client({ jsonrpc: "2.0", id: 1, method: "initialize", params: INIT_PARAMS });
    const fell = toClient(f.down());
    expect(fell).toHaveLength(1);
    expect(fell[0]).toMatchObject({ id: 1, result: { serverInfo: { name: "iris" }, capabilities: { tools: { listChanged: true } } } });
  });

  test("RED: a child that never stood leaves the client an answered initialize and an empty tool list, and the first real list draws one list_changed", () => {
    const f = fixture();
    f.step({ type: "start" });
    // The first spawn failed: the seat knows no child stands.
    f.down();
    const init = toClient(f.client({ jsonrpc: "2.0", id: 1, method: "initialize", params: INIT_PARAMS }));
    expect(init).toHaveLength(1);
    expect(init[0]).toMatchObject({ id: 1, result: { protocolVersion: "2025-06-18", capabilities: { tools: { listChanged: true } } } });
    f.client({ jsonrpc: "2.0", method: "notifications/initialized" });
    expect(toClient(f.client({ jsonrpc: "2.0", id: 2, method: "tools/list" }))).toEqual([{ jsonrpc: "2.0", id: 2, result: { tools: [] } }]);
    expect(toClient(f.up())).toEqual([{ jsonrpc: "2.0", method: "notifications/tools/list_changed" }]);
    expect(toClient(f.client({ jsonrpc: "2.0", id: 3, method: "tools/list" }))[0]).toMatchObject({ id: 3, result: { tools: [{ name: "status" }, { name: "recall" }] } });
  });
});

describe("seat-resumes-without-reinit", () => {
  test("RED: the seat replays the client's own initialize and the initialized notice to a new child, and the client sees no frame; CONTROL: the first child read the same params", () => {
    const f = fixture().open();
    const firstInit = f.seen.child.find((x) => x["method"] === "initialize")!;
    expect(firstInit["params"]).toEqual(INIT_PARAMS);
    const clientFramesBefore = f.seen.client.length;
    f.down();
    const woke = f.up();
    const sent = toChild(woke);
    expect(sent.map((x) => x["method"])).toEqual(["initialize", "notifications/initialized", "tools/list"]);
    expect(sent[0]!["params"]).toEqual(INIT_PARAMS);
    expect(kinds(woke)).toContain("standing");
    // The same tools came back, so the respawn reaches the client as nothing at all.
    expect(f.seen.client.length).toBe(clientFramesBefore);
    expect(f.seen.client.filter((x) => (x["result"] as { serverInfo?: unknown } | undefined)?.serverInfo !== undefined)).toHaveLength(1);
  });

  test("RED: a call after the respawn reaches the new child and answers under the client's own id", () => {
    const f = fixture().open();
    f.down(); f.up();
    const forwarded = toChild(f.client({ jsonrpc: "2.0", id: "call-9", method: "tools/call", params: { name: "status", arguments: {} } }));
    expect(forwarded).toHaveLength(1);
    expect(forwarded[0]).toMatchObject({ method: "tools/call", params: { name: "status", arguments: {} } });
    const back = toClient(f.child({ jsonrpc: "2.0", id: forwarded[0]!["id"], result: { content: [{ type: "text", text: "ok" }] } }));
    expect(back).toEqual([{ jsonrpc: "2.0", id: "call-9", result: { content: [{ type: "text", text: "ok" }] } }]);
  });
});

describe("seat-in-flight-unknown", () => {
  test("RED: a call in flight at the child's death answers `outcome-unknown` once, and no later child receives it; CONTROL: a call the child answered returns its answer", () => {
    const f = fixture().open();
    const done = toChild(f.client({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "status", arguments: {} } }))[0]!;
    f.child({ jsonrpc: "2.0", id: done["id"], result: { content: [{ type: "text", text: "answered" }] } });
    f.client({ jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "pour", arguments: { text: "one" } } });
    const died = toClient(f.down());
    expect(died).toHaveLength(1);
    expect(died[0]).toMatchObject({ jsonrpc: "2.0", id: 6, result: { isError: true } });
    expect(errorText(died[0])).toBe(OUTCOME_UNKNOWN);
    expect(OUTCOME_UNKNOWN).toBe("outcome-unknown: re-read before re-trying");
    const before = f.seen.child.length;
    f.up();
    expect(f.seen.child.slice(before).filter((x) => x["method"] === "tools/call")).toEqual([]);
    // A second death answers nothing more for the call the first one closed.
    f.down();
    expect(f.seen.client.filter((x) => x["id"] === 6)).toHaveLength(1);
    expect(f.seen.client.find((x) => x["id"] === 5)).toMatchObject({ result: { content: [{ text: "answered" }] } });
  });

  test("RED: a call that arrives while no child stands answers `hearth-sleeps` at once and never reaches a later child", () => {
    const f = fixture().open();
    f.down();
    const said = f.client({ jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "pour", arguments: { text: "two" } } });
    expect(toChild(said)).toEqual([]);
    expect(toClient(said)).toHaveLength(1);
    expect(toClient(said)[0]).toMatchObject({ id: 7, result: { isError: true } });
    expect(String(errorText(toClient(said)[0]))).toMatch(/^hearth-sleeps\b/);
    expect(HEARTH_SLEEPS).toMatch(/^hearth-sleeps\b/);
    const before = f.seen.child.length;
    f.up();
    expect(f.seen.child.slice(before).filter((x) => x["method"] === "tools/call")).toEqual([]);
  });

  test("RED: a request of another method in flight at the death answers a JSON-RPC error naming `outcome-unknown`", () => {
    const f = fixture().open();
    f.client({ jsonrpc: "2.0", id: 8, method: "resources/read", params: { uri: "x:y" } });
    const died = toClient(f.down());
    expect(died).toEqual([{ jsonrpc: "2.0", id: 8, error: { code: -32000, message: OUTCOME_UNKNOWN } }]);
  });
});

describe("seat-lists-from-cache", () => {
  test("RED: with no child standing, `tools/list` and `initialize` answer from the child's cached answers; CONTROL: the standing child's list read the same", () => {
    const f = fixture().open();
    const live = toClient(f.client({ jsonrpc: "2.0", id: 2, method: "tools/list" }))[0]!;
    expect(live).toEqual({ jsonrpc: "2.0", id: 2, result: { tools: [tool("status"), tool("recall")] } });
    f.down();
    const cold = f.client({ jsonrpc: "2.0", id: 3, method: "tools/list" });
    expect(toChild(cold)).toEqual([]);
    expect(toClient(cold)).toEqual([{ ...live, id: 3 }]);
    const init = toClient(f.client({ jsonrpc: "2.0", id: 4, method: "initialize", params: INIT_PARAMS }))[0]!;
    expect(init).toMatchObject({ id: 4, result: { serverInfo: { name: "fixture-surface", version: "7" }, instructions: "read the house", capabilities: { tools: { listChanged: true } } } });
  });

  test("RED: the client's initialize answer carries the child's own answer, with the seat's list_changed vow added", () => {
    const f = fixture().open();
    expect(f.seen.client[0]).toEqual({ jsonrpc: "2.0", id: 1, result: { protocolVersion: "2025-06-18", capabilities: { tools: { listChanged: true } }, serverInfo: { name: "fixture-surface", version: "7" }, instructions: "read the house" } });
  });
});

describe("seat-list-changed-on-new-tools", () => {
  const changed = (frames: readonly IrisFrame[]) => frames.filter((x) => x["method"] === "notifications/tools/list_changed");

  test("RED: a new child with another tool list draws exactly one list_changed, and the cache turns; CONTROL: a mere respawn draws none", () => {
    const f = fixture().open();
    f.down();
    expect(changed(toClient(f.up()))).toEqual([]);
    f.down();
    expect(changed(toClient(f.up(["get", "put", "act"])))).toEqual([{ jsonrpc: "2.0", method: "notifications/tools/list_changed" }]);
    expect((toClient(f.client({ jsonrpc: "2.0", id: 9, method: "tools/list" }))[0]!["result"] as { tools: unknown[] }).tools).toHaveLength(3);
    f.down();
    expect(changed(toClient(f.up()))).toEqual([]);
    expect(changed(f.seen.client)).toHaveLength(1);
  });

  test("RED: a tool whose schema alone moved reads as a new list; CONTROL: the same tools in another order read as the same list", () => {
    const f = fixture(["a", "b"]).open();
    f.down();
    expect(changed(toClient(f.up(["b", "a"])))).toEqual([]);
    f.down();
    // The next child lists `a` under a new description; the test answers for it by hand.
    f.step({ type: "child-up" });
    const init = f.seen.child.filter((x) => x["method"] === "initialize").at(-1)!;
    f.step({ type: "child-frame", frame: { jsonrpc: "2.0", id: init["id"], result: { protocolVersion: "2025-06-18", capabilities: {}, serverInfo: { name: "s", version: "8" } } } });
    const list = f.seen.child.filter((x) => x["method"] === "tools/list").at(-1)!;
    const out = f.step({ type: "child-frame", frame: { jsonrpc: "2.0", id: list["id"], result: { tools: [{ ...tool("a"), description: "moved" }, tool("b")] } } });
    expect(changed(toClient(out))).toHaveLength(1);
  });

  test("RED: a client that never sent its initialized notice draws no list_changed", () => {
    const f = fixture();
    f.step({ type: "start" }); f.up();
    f.client({ jsonrpc: "2.0", id: 1, method: "initialize", params: INIT_PARAMS });
    f.down();
    expect(changed(toClient(f.up(["other"])))).toEqual([]);
  });
});

describe("seat-logs-no-payload", () => {
  test("RED: no log effect carries a byte of any frame: ids, params, results, tool names; CONTROL: the frames themselves carry the marker", () => {
    const MARK = "s3cr3t-payload-marker";
    const f = fixture([`${MARK}-tool`]);
    f.step({ type: "start" }); f.up();
    f.client({ jsonrpc: "2.0", id: `${MARK}-init`, method: "initialize", params: { ...INIT_PARAMS, clientInfo: { name: MARK, version: "1" } } });
    f.client({ jsonrpc: "2.0", method: "notifications/initialized" });
    const call = toChild(f.client({ jsonrpc: "2.0", id: `${MARK}-1`, method: "tools/call", params: { name: `${MARK}-tool`, arguments: { text: MARK } } }))[0]!;
    f.child({ jsonrpc: "2.0", id: call["id"], result: { content: [{ type: "text", text: MARK }] } });
    f.client({ jsonrpc: "2.0", id: `${MARK}-2`, method: "tools/call", params: { name: `${MARK}-tool`, arguments: { text: MARK } } });
    f.client({ jsonrpc: "2.0", id: `${MARK}-3`, method: `${MARK}/method`, params: {} });
    f.down();
    f.client({ jsonrpc: "2.0", id: `${MARK}-4`, method: "tools/call", params: { name: `${MARK}-tool`, arguments: { text: MARK } } });
    f.client(MARK as unknown as IrisFrame);
    f.child([MARK] as unknown as IrisFrame);
    f.up([`${MARK}-tool`, `${MARK}-other`]);
    f.step({ type: "client-closed" });
    const logs = f.seen.effects.filter((e) => e.type === "log");
    expect(logs.length).toBeGreaterThan(4);
    expect(JSON.stringify(logs)).not.toContain(MARK);
    // A log names an event from the seat's own list, and counts; nothing else rides it.
    for (const log of logs) {
      expect(Object.keys(log).sort()).toEqual(["event", "generation", "pending", "type"]);
      expect(typeof (log as { generation: unknown }).generation).toBe("number");
      expect(typeof (log as { pending: unknown }).pending).toBe("number");
    }
    expect(JSON.stringify(f.seen.client)).toContain(MARK);
    expect(JSON.stringify(f.seen.child)).toContain(MARK);
  });
});

describe("the seat keeps the two id spaces apart", () => {
  test("RED: a client id that equals one of the seat's own child-side ids never crosses an answer; a cancel names the child-side id", () => {
    const f = fixture().open();
    const a = toChild(f.client({ jsonrpc: "2.0", id: 0, method: "tools/call", params: { name: "status" } }))[0]!;
    const b = toChild(f.client({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "recall" } }))[0]!;
    expect(a["id"]).not.toBe(b["id"]);
    const cancel = toChild(f.client({ jsonrpc: "2.0", method: "notifications/cancelled", params: { requestId: 1, reason: "r" } }));
    expect(cancel).toEqual([{ jsonrpc: "2.0", method: "notifications/cancelled", params: { requestId: b["id"], reason: "r" } }]);
    expect(toClient(f.child({ jsonrpc: "2.0", id: b["id"], result: { content: [] } }))).toEqual([{ jsonrpc: "2.0", id: 1, result: { content: [] } }]);
    expect(toClient(f.child({ jsonrpc: "2.0", id: a["id"], error: { code: -1, message: "no" } }))).toEqual([{ jsonrpc: "2.0", id: 0, error: { code: -1, message: "no" } }]);
    // An answer naming no request the seat forwarded reaches nobody.
    expect(toClient(f.child({ jsonrpc: "2.0", id: 424242, result: {} }))).toEqual([]);
  });

  test("RED: a request the child sends the client answers back to that child alone, and a dead child's request answers to nobody", () => {
    const f = fixture().open();
    const asked = toClient(f.child({ jsonrpc: "2.0", id: 3, method: "roots/list" }));
    expect(asked).toHaveLength(1);
    expect(asked[0]).toMatchObject({ method: "roots/list" });
    expect(toChild(f.client({ jsonrpc: "2.0", id: asked[0]!["id"], result: { roots: [] } }))).toEqual([{ jsonrpc: "2.0", id: 3, result: { roots: [] } }]);
    const stale = toClient(f.child({ jsonrpc: "2.0", id: 4, method: "roots/list" }))[0]!;
    f.down(); f.up();
    expect(toChild(f.client({ jsonrpc: "2.0", id: stale["id"], result: { roots: [] } }))).toEqual([]);
  });
});

describe("seat-tells-locked-from-down", () => {
  const call = (f: ReturnType<typeof fixture>, id: number) => toChild(f.client({ jsonrpc: "2.0", id, method: "tools/call", params: { name: "status", arguments: {} } }))[0]!;
  const answer = (f: ReturnType<typeof fixture>, rides: IrisFrame, text: string, isError = true) =>
    f.child({ jsonrpc: "2.0", id: rides["id"], result: { content: [{ type: "text", text }], isError } });
  const states = (effects: readonly IrisEffect[]) => effects.flatMap((e) => (e.type === "state" ? [e.state] : []));

  test("RED: a child that stands answers a call `vessel-locked`, and the seat's state reads `locked`, apart from `sleeps`", () => {
    const f = fixture();
    f.step({ type: "start" });
    expect(f.seat.state()).toBe("sleeps");
    f.up();
    f.client({ jsonrpc: "2.0", id: 1, method: "initialize", params: INIT_PARAMS });
    expect(f.seat.state()).toBe("standing");
    const out = answer(f, call(f, 2), "vessel-locked: run lares vault unlock");
    expect(states(out)).toEqual(["locked"]);
    expect(f.seat.state()).toBe("locked");
    // The client still reads the surface's own answer, untouched.
    expect(errorText(toClient(out)[0])).toBe("vessel-locked: run lares vault unlock");
    // A second locked answer changes nothing.
    expect(states(answer(f, call(f, 3), `${VESSEL_LOCKED}: again`))).toEqual([]);
  });

  test("RED: the child's fall reads `sleeps`, never `locked`; CONTROL: an ordinary answer after an unlock reads `standing` again", () => {
    const f = fixture().open();
    answer(f, call(f, 2), `${VESSEL_LOCKED}: run lares vault unlock`);
    expect(f.seat.state()).toBe("locked");
    expect(states(f.down())).toEqual(["sleeps"]);
    // A call with no child answers `hearth-sleeps`, the down reading.
    expect(errorText(toClient(f.client({ jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: "status" } }))[0])).toBe(HEARTH_SLEEPS);
    f.up();
    expect(f.seat.state()).toBe("standing");
    answer(f, call(f, 10), `${VESSEL_LOCKED}: run lares vault unlock`);
    expect(f.seat.state()).toBe("locked");
    const open = toClient(answer(f, call(f, 11), "ok", false));
    expect(open).toHaveLength(1);
    expect(f.seat.state()).toBe("standing");
  });

  test("CONTROL: another tool error leaves the state `standing`", () => {
    const f = fixture().open();
    answer(f, call(f, 2), "no such page");
    expect(f.seat.state()).toBe("standing");
  });
});

describe("a call belongs to the child that took it", () => {
  test("RED: a cancel for a call a dead child took reaches no replacement child, and a late answer under that child's id reaches no client; CONTROL: a cancel for a live call reaches its child", () => {
    const f = fixture().open();
    const taken = toChild(f.client({ jsonrpc: "2.0", id: 41, method: "tools/call", params: { name: "pour" } }))[0]!;
    expect(toClient(f.down())).toHaveLength(1);
    f.up();
    // The client cancels the call it already read as outcome-unknown: the new child never hears of it.
    expect(toChild(f.client({ jsonrpc: "2.0", method: "notifications/cancelled", params: { requestId: 41 } }))).toEqual([]);
    // An answer under the dead child's id arrives late: the seat already answered that call, once.
    expect(toClient(f.child({ jsonrpc: "2.0", id: taken["id"], result: { content: [{ type: "text", text: "late" }] } }))).toEqual([]);
    expect(f.seen.client.filter((x) => x["id"] === 41)).toHaveLength(1);
    // The same client id, asked again, rides a fresh child-side id that the dead child's never equals.
    const again = toChild(f.client({ jsonrpc: "2.0", id: 41, method: "tools/call", params: { name: "pour" } }))[0]!;
    expect(again["id"]).not.toBe(taken["id"]);
    expect(toChild(f.client({ jsonrpc: "2.0", method: "notifications/cancelled", params: { requestId: 41 } }))).toEqual([{ jsonrpc: "2.0", method: "notifications/cancelled", params: { requestId: again["id"] } }]);
    expect(toClient(f.child({ jsonrpc: "2.0", id: taken["id"], result: {} }))).toEqual([]);
  });

  test("RED: `hearth-sleeps` and `outcome-unknown` each ride a whole tools/call result, `isError: true`, under the caller's exact id, whatever its type", () => {
    for (const id of [0, -7, 3.5, "", "0", "call-x", 9007199254740991]) {
      const f = fixture().open();
      f.client({ jsonrpc: "2.0", id, method: "tools/call", params: { name: "pour" } });
      const unknown = toClient(f.down());
      expect(unknown, String(id)).toEqual([{ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: OUTCOME_UNKNOWN }], isError: true } }]);
      const asleep = toClient(f.client({ jsonrpc: "2.0", id, method: "tools/call", params: { name: "pour" } }));
      expect(asleep, String(id)).toEqual([{ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: HEARTH_SLEEPS }], isError: true } }]);
      for (const frame of [...unknown, ...asleep]) expect("error" in frame).toBe(false);
    }
  });
});

