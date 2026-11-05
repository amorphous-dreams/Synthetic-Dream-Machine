/** The island checks the answer to its own fetch and waits for clearance before counting a receipt. */
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

async function islandAskers() {
  const module = await import("../src/sovereign-island-model.js").catch(() => null) as {
    portTransit?: (port: ReturnType<typeof wire>["port"]) => { fetchBlock(cid: string): Promise<Uint8Array | null> };
    vesselReceiptAsker?: (port: ReturnType<typeof wire>["port"], patienceMs: number, gateClear: Promise<void>) => (ids: readonly string[]) => Promise<void>;
  } | null;
  expect(module?.portTransit, "the island exports its checked cas asker for a reply witness").toBeTypeOf("function");
  expect(module?.vesselReceiptAsker, "the island exports its receipt asker for a reply witness").toBeTypeOf("function");
  return module!;
}

const cidOf = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

// The production browser island composes the same mesh CID verifier; this witness drives the node island's IPC asks.
describe("the sovereign island's reply integrity", () => {
  test("a block under the asked CID refuses mismatched bytes by name; matching bytes cross", async () => {
    const { portTransit } = await islandAskers();
    const w = wire(); const transit = portTransit!(w.port);
    const good = new TextEncoder().encode("the named block");
    const cid = cidOf(good);
    const rejected = transit.fetchBlock(cid);
    const first = w.posted.at(-1)!;
    expect(first, "the cas ask names the wanted CID").toMatchObject({ type: "cas:want", cid });
    w.reply({ type: "cas:block", requestId: first.requestId, bytes: new TextEncoder().encode("other bytes") });
    await expect(rejected, "a CID mismatch refuses the answer by name").rejects.toThrow(/cid.*mismatch|mismatch.*cid/i);
    const accepted = transit.fetchBlock(cid);
    w.reply({ type: "cas:block", requestId: w.posted.at(-1)!.requestId, bytes: good });
    await expect(accepted, "control: bytes that hash to the asked CID cross").resolves.toEqual(good);
  });

  test("a pre-clear receipt stays provisional and the island asks again after clearance", async () => {
    const { vesselReceiptAsker } = await islandAskers();
    const w = wire();
    let clear!: () => void;
    const gateClear = new Promise<void>((resolve) => { clear = resolve; });
    const receipt = vesselReceiptAsker!(w.port, 1_000, gateClear);
    let durable = false;
    const pending = receipt(["doc-a"]).then(() => { durable = true; });
    const first = w.posted.at(-1)!;
    expect(first, "the first receipt ask names the document").toMatchObject({ type: "receipt:request", documentIds: ["doc-a"] });
    w.reply({ type: "receipt:issued", requestId: first.requestId, issued: true });
    await Promise.resolve();
    expect(durable, "a pre-clear answer counts no document durable").toBe(false);
    clear();
    await expect.poll(() => w.posted.filter((message) => message.type === "receipt:request").length).toBe(2);
    const second = w.posted.at(-1)!;
    expect(second.requestId, "the post-clear receipt ask carries a fresh request ID").not.toBe(first.requestId);
    expect(second.documentIds).toEqual(["doc-a"]);
    w.reply({ type: "receipt:issued", requestId: second.requestId, issued: true, proof: { documentIds: ["doc-a"] } });
    await pending;
    expect(durable, "control: the post-clear answer counts the document durable").toBe(true);
  });

  test("an issued receipt without the document named in its storage proof refuses", async () => {
    const { vesselReceiptAsker } = await islandAskers();
    const w = wire();
    const receipt = vesselReceiptAsker!(w.port, 1_000, Promise.resolve());
    const pending = receipt(["doc-a"]);
    await expect.poll(() => w.posted.filter((message) => message.type === "receipt:request").length).toBe(2);
    const second = w.posted.at(-1)!;
    w.reply({ type: "receipt:issued", requestId: second.requestId, issued: true, proof: { documentIds: ["other-doc"] } });
    await expect(pending).rejects.toThrow(/missing storage proof/);
  });
});
