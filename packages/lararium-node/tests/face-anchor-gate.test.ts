import { afterEach, describe, expect, it } from "vitest";
import { operatorDaemonOptions } from "@lararium/keyhive/operator-daemon-behavior";
import { PERSONA_GROUP_ID_TIDDLER, PERSONA_KEL_PREFIX_TIDDLER, raiseFaceFrontier, type LarDoc } from "@lararium/mesh";
import { standFoundedIsland } from "./stand-founded-island.js";

const teardown: Array<() => void> = [];
afterEach(() => { while (teardown.length) teardown.pop()!(); });

async function boot(ctx: unknown, daemonAuth: unknown): Promise<void> {
  const provider = await operatorDaemonOptions({ daemonAuth } as never, { dyadReading: () => "clear" }).verifierFactory!(ctx as never);
  await (provider as { dispose?: () => Promise<void> }).dispose?.();
}

describe("the sealed face anchor gates daemon boot", () => {
  it("RED: a forged daemon selector and coherent foreign pins cannot switch the held face", async () => {
    const own = await standFoundedIsland(teardown);
    const foreign = await standFoundedIsland(teardown);
    own.daemonHandle.change((doc: LarDoc) => {
      doc.tiddlers[PERSONA_GROUP_ID_TIDDLER] = { tiddler: { title: PERSONA_GROUP_ID_TIDDLER, text: foreign.daemonAuth.personaGroupId } } as never;
      doc.tiddlers[PERSONA_KEL_PREFIX_TIDDLER] = { tiddler: { title: PERSONA_KEL_PREFIX_TIDDLER, text: foreign.daemonAuth.personaKel.prefix } } as never;
    });
    await expect(boot(own.ctx, {
      ...own.daemonAuth,
      personaGroupId: foreign.daemonAuth.personaGroupId,
      signerDid: foreign.daemonAuth.signerDid,
      personaKel: foreign.daemonAuth.personaKel,
      deviceEdge: foreign.daemonAuth.deviceEdge,
      atom: foreign.daemonAuth.atom,
    })).rejects.toThrow(/Face anchor: group/);
  });

  it("RED: a faced boot missing its custody anchor refuses by name", async () => {
    const own = await standFoundedIsland(teardown);
    await expect(boot(own.ctx, { ...own.daemonAuth, faceAnchor: null })).rejects.toThrow(/Face anchor: anchor-missing.*re-found/);
  });

  it("RED: a stale lease observation never lowers the sealed frontier", async () => {
    const own = await standFoundedIsland(teardown);
    const raised = raiseFaceFrontier(own.daemonAuth.faceAnchor, { leaseEpoch: 2 });
    await expect(boot(own.ctx, { ...own.daemonAuth, faceAnchor: raised })).rejects.toThrow(/Binding Gate/);
    expect(raised.frontier.leaseEpoch).toBe(2);
    expect(raiseFaceFrontier(raised, { leaseEpoch: 0 })).toBe(raised);
  });

  it("CONTROL: the honest founded face boots with its anchor", async () => {
    const own = await standFoundedIsland(teardown);
    await expect(boot(own.ctx, own.daemonAuth)).resolves.toBeUndefined();
  });
});
