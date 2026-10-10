/**
 * e2e/joinee-offering-inspect — `nexus offering inspect` reads through a standing joinee's door and leaves that
 * vessel serving.
 *
 * The inspection runs as a door row (`nexus-offering-inspect`) inside the standing vessel, against the Repo that
 * vessel holds: the Repo its worker islands and its dial to the hearth sync through. A read that shut its Repo down
 * on the way out would take the vessel's whole verb channel with it, so even `host-state` would stop answering.
 *
 * Proven, on a joinee B whose dial asks for A's Crossroads board (the board A published an offering onto):
 *   · CONTROL: B's `host-state` answers through its door before the inspection;
 *   · the inspection answers through B's door — a verified gift, or a refusal B's own row names — and never the
 *     direct holder's refusal, which only a store with no vessel answering could meet;
 *   · RED: B stays live after it — `host-state` answers `via: daemon` three times over, promptly.
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { openStagedJoinee, type LarInstance, type StagedJoinee } from "../harness/instance.js";

/** A door answer slower than this reads as a vessel that stopped serving. */
const PROMPT_MS = 20_000;

let fleet: StagedJoinee;
let B: LarInstance;
let offeringCid = "";
let boardUrl = "";

beforeAll(async () => {
  fleet = await openStagedJoinee({
    tag: "inspect-door",
    daemonEnv: { LAR_SAME_ORIGIN: "true" },
    riteA: async (source) => {
      let i = 1;
      for (const handle of ["Kahu Alpha", "Kahu Beta", "Kahu Gamma"]) {
        const k = await source(["persona", "new", String(i), "--name", `kahu-${i}`, "--handle", handle, "--seat"]);
        if (k.code !== 0) throw new Error(`kahu ${i}: ${k.stderr.slice(-400)}`);
        i += 1;
      }
      const rite = await source(["nexus", "rite", "quorum"]);
      if (rite.code !== 0) throw new Error(`rite: ${rite.stderr.slice(-400)}`);
      await source(["persona", "wear", "0"]);
      const pub = await source(["nexus", "publish", "plugins", "--apply", "--json"]);
      const d = pub.json?.["data"] as { offeringCid?: string; boardUrl?: string } | undefined;
      offeringCid = d?.offeringCid ?? "";
      boardUrl = d?.boardUrl ?? "";
      if (!offeringCid || !boardUrl) throw new Error(`publish: ${pub.stdout} ${pub.stderr}`);
    },
    joinDocUrl: () => boardUrl,
  });
  B = fleet.B ?? (() => { throw new Error(`B never stood: ${fleet.joinGate}`); })();
}, 400_000);

afterAll(async () => { await fleet?.stop(); });

async function hostState(v: LarInstance): Promise<{ via: string | undefined; ms: number }> {
  const t0 = performance.now();
  const r = await v.cli(["host", "--json"]);
  return { via: (r.json?.["data"] as { via?: string } | undefined)?.via, ms: performance.now() - t0 };
}

describe("a joinee's door serves `nexus offering inspect`", () => {
  test("the inspection reads through B's door, and B stays live after it", async () => {
    const before = await hostState(B);
    expect(before.via).toBe("daemon");

    const inspected = await B.cli(["nexus", "offering", "inspect", offeringCid, "--json"]);
    const error = inspected.json?.["error"] as { code?: string; message?: string } | undefined;
    process.stderr.write(`joinee-offering-inspect: code=${inspected.code} ${JSON.stringify(inspected.json).slice(0, 400)}\n`);
    if (inspected.code === 0) {
      expect((inspected.json?.["data"] as { via?: string }).via).toBe("daemon");
    } else {
      expect(error?.code).toBe("not-found");
      expect(error?.message ?? "").not.toMatch(/already has a holder answering/);
    }

    for (let i = 0; i < 3; i++) {
      const after = await hostState(B);
      expect(after.via).toBe("daemon");
      expect(after.ms).toBeLessThan(PROMPT_MS);
    }
    expect(B.bootLog()).not.toMatch(/fatal:/);
  }, 300_000);
});
