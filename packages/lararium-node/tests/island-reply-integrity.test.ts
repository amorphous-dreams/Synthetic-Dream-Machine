/** The island checks the answer to its own fetch and waits for clearance before counting a rest. */
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { describe, expect, test } from "vitest";

function wire() {
  const emitter = new EventEmitter();
  const posted: Array<Record<string, unknown>> = [];
  const port = {
    postMessage: (message: unknown) => { posted.push(message as Record<string, unknown>); },
    on: (_event: "message", listener: (message: unknown) => void) => { emitter.on("message", listener); },
  };
  return { port, posted, reply: (message: unknown) => emitter.emit("message", message) };
}

async function islandDoors() {
  const module = await import("../src/sovereign-island-model.js").catch(() => null) as {
    portTransit?: (port: ReturnType<typeof wire>["port"]) => { fetchBlock(cid: string): Promise<Uint8Array | null> };
    vesselRestAsker?: (port: ReturnType<typeof wire>["port"], patienceMs: number, gateClear: Promise<void>) => (ids: readonly string[]) => Promise<void>;
  } | null;
  expect(module?.portTransit, "the island exports its checked fetch door for a reply witness").toBeTypeOf("function");
  expect(module?.vesselRestAsker, "the island exports its rest door for a reply witness").toBeTypeOf("function");
  return module!;
}

const cidOf = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

// The production browser island composes the same mesh CID verifier; this witness drives the node island's IPC door.
describe("the sovereign island's reply integrity", () => {
  test("a block under the asked CID refuses mismatched bytes by name; matching bytes cross", async () => {
    const { portTransit } = await islandDoors();
    const w = wire(); const transit = portTransit!(w.port);
    const good = new TextEncoder().encode("the named block");
    const cid = cidOf(good);
    const rejected = transit.fetchBlock(cid);
    const first = w.posted.at(-1)!;
    expect(first, "the fetch door names the wanted CID").toMatchObject({ type: "cas:want", cid });
    w.reply({ type: "cas:block", requestId: first.requestId, bytes: new TextEncoder().encode("other bytes") });
    await expect(rejected, "a CID mismatch refuses the answer by name").rejects.toThrow(/cid.*mismatch|mismatch.*cid/i);
    const accepted = transit.fetchBlock(cid);
    w.reply({ type: "cas:block", requestId: w.posted.at(-1)!.requestId, bytes: good });
    await expect(accepted, "control: bytes that hash to the asked CID cross").resolves.toEqual(good);
  });

  test("a pre-clear rest answer stays provisional and the island asks again after clearance", async () => {
    const { vesselRestAsker } = await islandDoors();
    const w = wire();
    let clear!: () => void;
    const gateClear = new Promise<void>((resolve) => { clear = resolve; });
    const rest = vesselRestAsker!(w.port, 1_000, gateClear);
    let durable = false;
    const pending = rest(["doc-a"]).then(() => { durable = true; });
    const first = w.posted.at(-1)!;
    expect(first, "the first rest ask names the document").toMatchObject({ type: "doc:rest", documentIds: ["doc-a"] });
    w.reply({ type: "doc:rested", requestId: first.requestId, rested: true });
    await Promise.resolve();
    expect(durable, "a pre-clear answer counts no document durable").toBe(false);
    clear();
    await expect.poll(() => w.posted.filter((message) => message.type === "doc:rest").length).toBe(2);
    const second = w.posted.at(-1)!;
    expect(second.requestId, "the post-clear rest ask carries a fresh request ID").not.toBe(first.requestId);
    expect(second.documentIds).toEqual(["doc-a"]);
    w.reply({ type: "doc:rested", requestId: second.requestId, rested: true });
    await pending;
    expect(durable, "control: the post-clear answer counts the document durable").toBe(true);
  });
});
