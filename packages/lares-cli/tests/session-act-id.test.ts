/**
 * session-act-id.test — a `session:act` rides a request id its CALLER owns (K20): the caller names one stable id per
 * act, the frame carries it to the vessel, and the act's result hands it back, so an answer the socket lost can be
 * recovered under that id (the vessel reads a retry under it as the receipt of the act that ran).
 */
import { EventEmitter } from "node:events";
import { expect, test, vi } from "vitest";

const netMock = vi.hoisted(() => ({ socket: undefined as unknown }));
vi.mock("node:net", () => ({ createConnection: () => netMock.socket }));

class FakeSocket extends EventEmitter {
  readonly frames: Array<Record<string, unknown>> = [];
  setEncoding(): this { return this; }
  write(line: string): boolean {
    const frame = JSON.parse(line) as Record<string, unknown>;
    this.frames.push(frame);
    const common = { requestId: frame["requestId"] };
    const reply = frame["op"] === "session:open"
      ? { kind: "session:opened", ...common, ownerEpoch: "epoch", sessionId: "session", generation: 0, faceRef: "proof" }
      : { kind: "session:act-result", ...common, answer: { status: "done", output: { acted: true } } };
    queueMicrotask(() => this.emit("data", `${JSON.stringify(reply)}\n`));
    return true;
  }
  end(): this { queueMicrotask(() => this.emit("close")); return this; }
  destroy(): this { queueMicrotask(() => this.emit("close")); return this; }
}

type ActWithId = (name: string, args: Record<string, unknown>, options?: { requestId: string }) => Promise<Record<string, unknown>>;

test("RED: session act accepts and returns its caller recovery id", async () => {
  const socket = new FakeSocket();
  netMock.socket = socket;
  const { openLocalSession } = await import("../src/session-connector.js");
  const session = await openLocalSession({ faceRef: "h0", dataDir: "/recovery-id-fixture" });
  const act = session.act as unknown as ActWithId;
  const result = await act("fixture-act", {}, { requestId: "caller-act-1" });
  expect(socket.frames.find((f) => f["op"] === "session:act")?.["requestId"]).toBe("caller-act-1");
  expect(result).toEqual({ requestId: "caller-act-1", answer: { status: "done", output: { acted: true } } });
  await session.close();
});

test("CONTROL: an act whose caller names no id still rides one id, and its answer still arrives", async () => {
  const socket = new FakeSocket();
  netMock.socket = socket;
  const { openLocalSession } = await import("../src/session-connector.js");
  const session = await openLocalSession({ faceRef: "h0", dataDir: "/recovery-id-fixture" });
  const result = await (session.act as unknown as ActWithId)("fixture-act", {});
  const sent = socket.frames.find((f) => f["op"] === "session:act")?.["requestId"];
  expect(typeof sent).toBe("string");
  expect(JSON.stringify(result)).toContain("acted");
  await session.close();
});
