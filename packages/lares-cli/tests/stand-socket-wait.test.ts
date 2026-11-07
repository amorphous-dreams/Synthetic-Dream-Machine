/**
 * stand-socket-wait — `vessel stand` waits for the verb socket on the node's own events.
 *
 * The socket answers (connect), the node attests `fatal:` or `uds error:` (its log), or the child exits: each
 * ends the wait at once. A node that keeps naming LATER boot milestones keeps the wait open past any fixed
 * deadline; a repeated or earlier milestone, or any other line, renews nothing, so a node looping in its log
 * reaches the named LIVENESS bound.
 */
import { describe, test, expect } from "vitest";
import { awaitBootPhase, awaitVerbSocket, bootStage, BOOT_MILESTONES } from "../src/stand-socket-wait.js";

/** A node log naming the milestones in order, one `[lararium] phase → <name>` line each. */
const phases = (...names: string[]): string => names.map((n) => `[lararium] phase → ${n}\n`).join("");

function rig(over: { alive?: () => boolean; log?: () => string; exited?: () => boolean } = {}) {
  let t = 0;
  const sleeps: number[] = [];
  return {
    sleeps,
    now: () => t,
    sleep: async (ms: number) => { sleeps.push(ms); t += ms; },
    alive: async () => (over.alive ?? (() => false))(),
    readAttestation: over.log ?? (() => ""),
    childExited: over.exited ?? (() => false),
  };
}

describe("awaitVerbSocket", () => {
  test("RED: the child exits -> the wait ends at once as `exited`, with no deadline spent", async () => {
    const r = rig({ exited: () => true });
    expect(await awaitVerbSocket({ ...r, silenceMs: 120_000 })).toEqual({ outcome: "exited", refusal: null });
    expect(r.sleeps.length).toBe(0);
  });

  test("CONTROL: a node advancing through the socket-stage milestones holds the wait open past 180 s until the socket answers", async () => {
    const r = rig();
    const after = ["tw5-booted", "live", "daemon-ea", "verb-seat"];
    const out = await awaitVerbSocket({
      ...r, silenceMs: 120_000,
      // one later milestone every 100 s, the socket answering 100 s after the last: 500 s, no 120 s gap unrenewed
      alive: async () => r.now() >= 500_000,
      readAttestation: () => phases("vessel-ready", ...after.slice(0, Math.floor(r.now() / 100_000))),
    });
    expect(out.outcome).toBe("up");
    expect(r.now()).toBeGreaterThan(180_000);
  });

  test("a late fatal ends the wait as `fault`; a uds error names its refusal", async () => {
    expect((await awaitVerbSocket({ ...rig({ log: () => "fatal: boom" }), silenceMs: 1000 })).outcome).toBe("fault");
    expect(await awaitVerbSocket({ ...rig({ log: () => "uds error: EINVAL path" }), silenceMs: 1000 })).toEqual({ outcome: "refused", refusal: "EINVAL path" });
  });

  test("CONTROL: a node silent for the whole LIVENESS span ends as `silent`", async () => {
    const out = await awaitVerbSocket({ ...rig(), silenceMs: 5_000 });
    expect(out.outcome).toBe("silent");
  });

  test("RED: repeated log lines do not renew socket progress", async () => {
    const r = rig();
    const out = await awaitVerbSocket({ ...r, silenceMs: 5_000,
      alive: async () => r.now() >= 10_000,
      readAttestation: () => "replaying\n".repeat(1 + Math.floor(r.now() / 500)),
    });
    expect(out.outcome).toBe("silent");
    expect(r.now()).toBeLessThan(10_000);
  });

  test("RED: changing retry counters do not renew socket progress", async () => {
    const r = rig();
    const out = await awaitVerbSocket({ ...r, silenceMs: 5_000,
      alive: async () => r.now() >= 10_000,
      readAttestation: () => Array.from({ length: 1 + Math.floor(r.now() / 500) }, (_, i) => `retry ${i}\n`).join(""),
    });
    expect(out.outcome).toBe("silent");
    expect(r.now()).toBeLessThan(10_000);
  });
});

describe("awaitBootPhase", () => {
  const boot = (over: { log?: () => string; exited?: () => boolean } = {}) => {
    const r = rig(over);
    return { ...r, sleeps: r.sleeps, wait: (silenceMs = 30_000) => awaitBootPhase({ now: r.now, sleep: r.sleep, readAttestation: r.readAttestation, childExited: r.childExited, silenceMs }) };
  };
  test("RED: a child that exits early resolves at once as `exited` (the 180 s cap is gone)", async () => {
    const b = boot({ exited: () => true });
    expect(await b.wait()).toBe("exited");
    expect(b.sleeps.length).toBe(0);
  });
  test("CONTROL: a ready line resolves `ready`; a fatal line resolves `fault`", async () => {
    expect(await boot({ log: () => "boot\nvessel-ready" }).wait()).toBe("ready");
    expect(await boot({ log: () => "fatal: nope" }).wait()).toBe("fault");
  });
  test("CONTROL: a boot advancing through its milestones holds the wait past 180 s until ready", async () => {
    const r = rig();
    const order = ["boot", "repo-open", "catalog-ready", "island-ready", "corpus-ready", "wiki-ready", "vessel-ready"];
    const out = await awaitBootPhase({ now: r.now, sleep: r.sleep, childExited: r.childExited, silenceMs: 40_000,
      // one later milestone every 35 s, each line beside a changing counter that renews nothing: vessel-ready at 210 s
      readAttestation: () => order.slice(0, 1 + Math.floor(r.now() / 35_000))
        .map((n, i) => `[lararium] replay ${i * 97}\n[lararium] phase → ${n}\n`).join(""),
    });
    expect(out).toBe("ready");
    expect(r.now()).toBeGreaterThan(180_000);
  });
  test("CONTROL: a herm skipping the wiki half still advances (boot → catalog-ready → vessel-ready past 60 s)", async () => {
    const r = rig();
    const out = await awaitBootPhase({ ...r, silenceMs: 25_000,
      readAttestation: () => r.now() >= 60_000 ? phases("boot", "repo-open", "catalog-ready", "vessel-ready")
        : r.now() >= 40_000 ? phases("boot", "repo-open", "catalog-ready")
        : r.now() >= 20_000 ? phases("boot", "repo-open") : phases("boot"),
    });
    expect(out).toBe("ready");
  });
  test("RED: a repeated milestone renews nothing", async () => {
    const r = rig();
    const out = await awaitBootPhase({ ...r, silenceMs: 5_000,
      readAttestation: () => r.now() >= 10_000 ? "vessel-ready" : phases(...Array.from({ length: 1 + Math.floor(r.now() / 200) }, () => "catalog-ready")),
    });
    expect(out).toBe("silent");
    expect(r.now()).toBeLessThan(10_000);
  });
  test("RED: an earlier milestone after a later one renews nothing (a regress)", async () => {
    const r = rig();
    const back = ["boot", "repo-open"];
    const out = await awaitBootPhase({ ...r, silenceMs: 5_000,
      readAttestation: () => r.now() >= 10_000 ? "vessel-ready"
        : phases("corpus-ready", ...Array.from({ length: Math.floor(r.now() / 200) }, (_, i) => back[i % 2]!)),
    });
    expect(out).toBe("silent");
    expect(r.now()).toBeLessThan(10_000);
  });
  test("RED: a phase name outside the milestone order renews nothing", async () => {
    const r = rig();
    const out = await awaitBootPhase({ ...r, silenceMs: 5_000,
      readAttestation: () => r.now() >= 10_000 ? "vessel-ready"
        : phases("boot", ...Array.from({ length: Math.floor(r.now() / 200) }, (_, i) => `retry-${i}`)),
    });
    expect(out).toBe("silent");
  });
  test("CONTROL: a silent, living boot ends as `silent` after the LIVENESS span", async () => {
    expect(await boot().wait(5_000)).toBe("silent");
  });
  test("RED: repeated log lines do not renew boot progress", async () => {
    const r = rig();
    const out = await awaitBootPhase({ ...r, silenceMs: 5_000,
      readAttestation: () => r.now() >= 10_000 ? "vessel-ready" : "replaying\n".repeat(1 + Math.floor(r.now() / 200)),
    });
    expect(out).toBe("silent");
    expect(r.now()).toBeLessThan(10_000);
  });
  test("RED: changing retry counters do not renew boot progress", async () => {
    const r = rig();
    const out = await awaitBootPhase({ ...r, silenceMs: 5_000,
      readAttestation: () => r.now() >= 10_000 ? "vessel-ready" :
        Array.from({ length: 1 + Math.floor(r.now() / 200) }, (_, i) => `retry ${i}\n`).join(""),
    });
    expect(out).toBe("silent");
    expect(r.now()).toBeLessThan(10_000);
  });
});

describe("bootStage", () => {
  test("reads the furthest milestone in emission order, from either composer's prefix", () => {
    expect(bootStage("")).toBe(-1);
    expect(bootStage("[herm] phase → catalog-ready\n[herm] phase → boot\n")).toBe(BOOT_MILESTONES.indexOf("catalog-ready"));
    // the emission places corpus-ready before wiki-ready (open-phases), whatever the type declares
    expect(bootStage(phases("corpus-ready"))).toBeLessThan(bootStage(phases("wiki-ready")));
    expect(bootStage("[lararium] phase → retry-3\nretry 41\n")).toBe(-1);
    // every milestone name reads, the digit in tw5-booted too
    for (const [i, name] of BOOT_MILESTONES.entries()) expect(bootStage(phases(name))).toBe(i);
  });
});
