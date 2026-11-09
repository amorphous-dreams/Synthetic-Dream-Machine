/**
 * daemon-verse-one-forward — one summon in the daemon surface crosses to the vessel as ONE verb event.
 *
 * Every island boots on the sovereign kernel, and `IslandKernel.bootTw5` already forwards each `tm-verse-event` the
 * reaction router fires as one `event` on the island wire. A behavior that subscribes its own forwarder on top posts
 * the same summon a second time, and the vessel places the verb twice: one click on a `kahua-propose` button signs two
 * proposals (lararium-web e2e/stage-walk, S4: "the outcome names no proposal id: expected 2 to be 1"). Driven over the
 * kernel's real engine, the real daemon behavior and the real router.
 */
import { memoryControlStore } from "./control-store-fixture.js";
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { CompositeStore, HULLS_TS_ONLY } from "@lararium/mesh";
import { LARES_DISPATCH_FIELD, LARES_VERB_ARG_PREFIX } from "@lararium/mesh/lar-uris";
import { IslandKernel } from "../src/island-kernel.js";
import { makeDaemonBehavior } from "../src/daemon-behavior.js";
import { makeWikiBehavior } from "../src/wiki-behavior.js";
import type { IslandBehavior, IslandContext } from "../src/island-context.js";
import LARES_MEMETIC_WIKITEXT_PLUGIN from "../plugins/lares-memetic-wikitext.json" with { type: "json" };
import { CORE_PATH, wikiSkip, skipNote } from "./test-wiki.js";

const VERB = "lar:///lararium.local.vm/verb/kahua-propose";
const turns = async (n = 32): Promise<void> => { for (let i = 0; i < n; i++) await new Promise<void>((resolve) => setImmediate(resolve)); };

/** The kernel's engine under `behavior`, kernel and behavior posting onto one wire; answers every verb event posted. */
async function standIsland(slug: string, behavior: IslandBehavior) {
  const wire: Array<{ type: string; payload?: Record<string, unknown> }> = [];
  const post = (msg: unknown): void => { wire.push(msg as { type: string; payload?: Record<string, unknown> }); };
  const kernel = new IslandKernel(post as never);
  const wikiUri = `lar:///ha.ka.ba/wikis/${slug}`;
  await kernel.bootTw5(wikiUri, new Uint8Array(readFileSync(CORE_PATH)), [LARES_MEMETIC_WIKITEXT_PLUGIN as unknown as Record<string, unknown>]);
  const tw5 = kernel.tw5()!;
  const ctx = {
    wikiUri, composite: new CompositeStore(), control: memoryControlStore(), tw5, handles: new Map(), post,
    repo: undefined, catalogUrl: null, oracleUrl: null, engine: { sha256: "", version: "" }, recipe: { wikiSlug: slug },
  } as unknown as IslandContext;
  await behavior.onEa(ctx);
  await turns();
  const summon = async (): Promise<void> => {
    tw5.setTiddler({ title: VERB, verb: "kahua-propose", [LARES_DISPATCH_FIELD]: "1", [`${LARES_VERB_ARG_PREFIX}titles`]: "L4/page-new" });
    await turns();
  };
  const verbEvents = () => wire.filter((m) => m.type === "event" && m.payload?.["verb"] === "kahua-propose");
  return { summon, verbEvents };
}

describe.skipIf(wikiSkip)(`one summon in an island crosses as one verb event${skipNote}`, () => {
  test("RED: the daemon island under the kernel posts ONE kahua-propose event for one marked summon", async () => {
    const island = await standIsland("daemon", makeDaemonBehavior({ runnableHulls: HULLS_TS_ONLY, verifierFactory: async () => undefined }));
    await island.summon();
    expect(island.verbEvents().length, "the daemon island forwarded one summon more than once").toBe(1);
  }, 60_000);

  test("CONTROL: a pool wiki island under the same kernel posts one event for the same summon", async () => {
    const island = await standIsland("lares", makeWikiBehavior({}));
    await island.summon();
    expect(island.verbEvents().length).toBe(1);
  }, 60_000);
});
