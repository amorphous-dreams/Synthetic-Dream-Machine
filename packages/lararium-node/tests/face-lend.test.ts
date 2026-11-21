import { describe, expect, test, vi } from "vitest";
import { faceLives, type FaceLifeEffects } from "../src/face-lifecycle.js";
import { faceLend, type FaceLendPorts } from "../src/face-lend.js";

const settle = async (): Promise<void> => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

/** A vessel's lend over a scripted custody: the mount h0 (no island entry), siblings lit by hand, every drain answered by hand. */
function vessel(opts: { served?: number[]; open?: Set<number> } = {}) {
  const served = opts.served ?? [0, 1];
  const open = opts.open ?? new Set(served);
  const drains = new Map<number, { resolve: () => void; reject: (e: unknown) => void }>();
  const events: string[] = [];
  let lend!: ReturnType<typeof faceLend>;
  const effects: FaceLifeEffects = {
    light: async (ordinal) => ({ atomKey: `k${ordinal}`, custody: null }),
    drainSaves: (ordinal) => new Promise<void>((resolve, reject) => { events.push(`drain h${ordinal}`); drains.set(ordinal, { resolve, reject }); }),
    dropWorker: async () => {},
    teardownHost: (ordinal) => { events.push(`teardown h${ordinal}`); },
    recompose: async () => {},
    onDark: (ordinal) => { events.push(`dark h${ordinal}`); },
    log: () => {},
  };
  const lives = faceLives(effects, { nonce: "boot" });
  const mountClosed = vi.fn(() => { events.push("mount closed"); });
  const faceClosed = vi.fn(async (fcid: string) => { events.push(`face.closed ${fcid}`); });
  const lightFace = vi.fn(async (ordinal: number) => { await lives.light(ordinal); });
  const ports: FaceLendPorts = {
    faceLife: lives, mount: 0,
    served: async () => served.filter((o) => open.has(o)),
    closingAtSource: () => [],
    custodyIdOf: (ordinal) => `f${ordinal}`,
    custodyOpeningNow: () => null,
    noteCustody: async () => "p:1",
    faceStanding: async (face) => {
      const ordinal = "ordinal" in face ? face.ordinal : Number(face.fcid.slice(1));
      return { ordinal, fcid: `f${ordinal}`, unlocked: open.has(ordinal) };
    },
    faceClosed, lightFace, mountClosed, log: () => {},
  };
  lend = faceLend(ports);
  return { lives, lend, drains, events, open, mountClosed, faceClosed, lightFace };
}

describe("the lend watch and the mount's one life", () => {
  test("the mount reads lit from the composition's own turn: the door gates it and a whole lock's close reaches it at once", async () => {
    const v = vessel();
    expect(v.lives.state(0).kind, "no await stands between the composition and the mount's adoption").toBe("lit");
    expect(v.lives.known(0)).toBe(true);
    const all = v.lives.closeAll("a whole lock closes every face", { hold: true, strict: true });
    expect(v.events).toContain("drain h0");
    v.drains.get(0)!.resolve(); await all;
    expect(v.lives.state(0)).toEqual({ kind: "dark", held: true });
    await settle();
    expect(v.lives.state(0).kind, "the custody read landing late adopts nothing over the close").toBe("dark");
  });

  test("CLAIM 2(a) THE REMOTE MOUNT DRAINS AND STANDS AGAIN: a pūlama's close drains the mount's saves under its session, then the vessel answers face.closed, then the vessel stands again", async () => {
    const v = vessel();
    const closing = v.lend.closing("f0", "p:1");
    await settle();
    expect(v.events, "no face.closed before the drain").toEqual(["drain h0"]);
    v.drains.get(0)!.resolve();
    await closing;
    expect(v.events).toEqual(["drain h0", "teardown h0", "dark h0", "face.closed f0", "mount closed"]);
  });

  test("CLAIM 2(a): a mount whose drain faults answers no face.closed and never stands again over unsealed saves", async () => {
    const v = vessel();
    const closing = v.lend.closing("f0", "p:1");
    await settle();
    v.drains.get(0)!.reject(new Error("seal refused"));
    await expect(closing).rejects.toThrow("seal refused");
    expect(v.faceClosed).not.toHaveBeenCalled();
    expect(v.mountClosed).not.toHaveBeenCalled();
  });

  test("CLAIM 2(d) A FORCED LOCK OF THE MOUNT: the lend no longer serves it, so the next sweep closes it through its actor and the vessel stands again", async () => {
    const v = vessel();
    v.open.delete(0);
    await v.lend.sweep();
    expect(v.events).toEqual(["drain h0"]);
    expect(v.mountClosed).not.toHaveBeenCalled();
    v.drains.get(0)!.resolve(); await settle();
    expect(v.mountClosed).toHaveBeenCalledOnce();
    expect(v.lives.state(0).kind).toBe("dark");
  });

  test("FINDING 1: a lock whose close took the mount dark and then did not lock its key lets it read lit again; a lock that landed leaves it dark", async () => {
    const v = vessel();
    const closed = v.lives.close(0, "the lock door closes it", { hold: true });
    v.drains.get(0)!.resolve(); await closed;
    // The key did not lock (the holder refused): the hold lifts, and the mount, which no lend relights, reads lit again.
    v.lives.release(0);
    await v.lend.release(0);
    expect(v.lives.state(0).kind).toBe("lit");
    // The key locked this time: the mount stays dark (the vessel stands again by the lock's own road).
    const again = v.lives.close(0, "the lock door closes it", { hold: true });
    v.drains.get(0)!.resolve(); await again;
    v.open.delete(0);
    v.lives.release(0);
    await v.lend.release(0);
    expect(v.lives.state(0).kind).toBe("dark");
  });

  test("FINDING 1: a release while the hold still stands, or of a sibling, adopts nothing", async () => {
    const v = vessel();
    const closed = v.lives.close(0, "the lock door closes it", { hold: true });
    v.drains.get(0)!.resolve(); await closed;
    await v.lend.release(0);
    expect(v.lives.state(0)).toEqual({ kind: "dark", held: true });
    await v.lend.release(1);
    expect(v.lives.known(1)).toBe(false);
  });

  test("a served face its pūlama names closing lights not on the dark's replay, by the custody id kept past its dark", async () => {
    const v = vessel({ served: [0, 1] });
    const ports = { closing: ["f1"] };
    const lives = v.lives;
    await lives.light(1);
    const lend = faceLend({
      faceLife: lives, mount: 0, served: async () => [0, 1], closingAtSource: () => ports.closing,
      custodyIdOf: (o) => `f${o}`, custodyOpeningNow: () => null, noteCustody: async () => null,
      faceStanding: async () => null, lightFace: v.lightFace, mountClosed: () => {}, log: () => {},
    });
    const closing = lives.close(1, "the pūlama closes it");
    v.drains.get(1)!.resolve(); await closing; await settle();
    v.lightFace.mockClear();
    await lend.sweep();
    expect(v.lightFace).not.toHaveBeenCalled();
    ports.closing = [];
    await lend.sweep();
    expect(v.lightFace).toHaveBeenCalledWith(1);
  });
});
