/**
 * herm-outward-silence.test.ts — THE OUTWARD-SILENCE WITNESS, teeth first (herm-caps#/the-rungs: "outward, nothing moves").
 *
 * A herm's public listener answers a stranger who brings a name (a bulb CID, a Nexus AID, a CID a public book names) and
 * draws one closed door for every other ask. A cap lit beside the wayfarer stack (`extraCaps`) must move none of it. The
 * witness (`herm-silence-witness.ts`) reads a composition as a transcript over a fixed probe set plus a census of what it
 * claimed, and holds a lit composition equal to an unlit one.
 *
 * TEETH FIRST: before any rung lights a wiki, the witness proves it fails. A probe cap that claims one extra route, one
 * that claims a route no probe names, one that listens beside the dispatcher, and one whose closed door carries one more
 * header each break it by name.
 *
 * Proves `lar:///herm.door.never-describes` and `lar:///herm.title.never-answers`; no refusal carries a name outward.
 */
import { afterEach, describe, expect, test } from "vitest";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { type CapModule } from "@lararium/mesh/cap-compose";
import { CLOSED_DOOR } from "../src/bulb-routes.js";
import { CAP } from "../src/node-caps.js";
import {
  PROBE_METHODS, WRITE_METHODS, ask, holdOutwardSilence, outwardSilence, probePaths, standSilentHerm,
  type Answer, type HermListenerDeps, type SilentHerm,
} from "./herm-silence-witness.js";

const stood: SilentHerm[] = [];
afterEach(async () => { for (const h of stood.splice(0)) await h.dispose(); });

/** Stand one composition on a listener of its own. */
async function stand(extraCaps?: (deps: HermListenerDeps) => readonly CapModule[]): Promise<SilentHerm> {
  const server: Server = createServer();
  const herm = await standSilentHerm(server, extraCaps ? { extraCaps } : {});
  stood.push(herm);
  return herm;
}

const pathOf = (req: IncomingMessage): string => new URL(req.url ?? "/", "http://localhost").pathname;
const answer = (res: ServerResponse, status: number, headers: Record<string, string>, body: string): void => { res.writeHead(status, headers); res.end(body); };

/** A probe cap: it claims one exact path through the vessel's dispatcher and answers it as told. */
const claimingCap = (path: string, respond: (res: ServerResponse) => void) => (deps: HermListenerDeps): readonly CapModule[] => [{
  id: "probe-claims-a-route", requires: [CAP.substrate],
  build: () => deps.dispatcher.register({ name: "probe", routeKeys: [`probe:${path}`], owns: (req) => pathOf(req) === path, handle: (_req, res) => respond(res) }),
  dispose: (off) => (off as () => void)(),
}];

/** A lit cap that mounts nothing outward: what every later rung's cap must read as. */
const silentCap = (): readonly CapModule[] => [{ id: "lit-and-silent", requires: [CAP.substrate], build: () => ({ lit: true }) }];

const TITLE_PATH = `/wiki/${encodeURIComponent("lar:///ha.ka.ba/lares/api/noosphere-boot")}`;

describe("TEETH — the witness fails where a lit cap moves the outward face", () => {
  test("a probe cap that claims one extra route makes the transcripts differ, and the witness fails naming the probe", async () => {
    const unlit = await (await stand()).read();
    const lit = await (await stand(claimingCap(TITLE_PATH, (res) => answer(res, 200, { "content-type": "text/plain" }, "the boot seed rests here")))).read();
    const verdict = outwardSilence(unlit, lit);
    expect(verdict.silent).toBe(false);
    expect(verdict.silent ? [] : verdict.differs).toEqual(expect.arrayContaining(["transcript: GET title:wiki"]));
    expect(() => holdOutwardSilence(unlit, lit)).toThrow(/outward silence broke/);
  }, 60_000);

  test("a cap that claims a route no probe names leaves every probed byte in place, and the census still fails the witness", async () => {
    const unlit = await (await stand()).read();
    const lit = await (await stand(claimingCap("/a-route-no-probe-names", (res) => answer(res, 200, {}, "found")))).read();
    expect(lit.lines).toEqual(unlit.lines);
    const verdict = outwardSilence(unlit, lit);
    expect(verdict.silent).toBe(false);
    expect(verdict.silent ? [] : verdict.differs.join("\n")).toMatch(/census: .*probe:\/a-route-no-probe-names/);
    expect(() => holdOutwardSilence(unlit, lit)).toThrow(/census/);
  }, 60_000);

  test("a cap that listens beside the dispatcher fails the witness by the listener it added", async () => {
    const beside = (deps: HermListenerDeps): readonly CapModule[] => [{
      id: "probe-listens-beside", requires: [CAP.substrate],
      build: () => {
        const onRequest = (req: IncomingMessage, res: ServerResponse): void => { if (pathOf(req) === "/a-route-no-probe-names") answer(res, 200, {}, "found"); };
        deps.httpServer.on("request", onRequest);
        return onRequest;
      },
      dispose: (onRequest) => { deps.httpServer.off("request", onRequest as (req: IncomingMessage, res: ServerResponse) => void); },
    }];
    const unlit = await (await stand()).read();
    const lit = await (await stand(beside)).read();
    expect(lit.census.requestListeners).toBe(unlit.census.requestListeners + 1);
    expect(() => holdOutwardSilence(unlit, lit)).toThrow(/census/);
  }, 60_000);

  test("a door that looks closed and carries one more header fails the witness on that probe alone", async () => {
    const almost = claimingCap(TITLE_PATH, (res) => answer(res, CLOSED_DOOR.status, { ...CLOSED_DOOR.headers, "x-rests-here": "1" }, CLOSED_DOOR.body));
    const unlit = await (await stand()).read();
    const lit = await (await stand(almost)).read();
    const verdict = outwardSilence(unlit, lit);
    const moved = verdict.silent ? [] : verdict.differs.filter((d) => d.startsWith("transcript: "));
    expect(moved).toEqual(PROBE_METHODS.map((m) => `transcript: ${m} title:wiki`));
  }, 60_000);
});

describe("CONTROL — silence holds where nothing outward moved", () => {
  test("two unlit compositions read byte-identical", async () => {
    const a = await (await stand()).read();
    const b = await (await stand()).read();
    expect(a.lines.length).toBe(b.lines.length);
    expect(outwardSilence(a, b)).toEqual({ silent: true });
    expect(() => holdOutwardSilence(a, b)).not.toThrow();
  }, 60_000);

  test("a cap lit in extraCaps that mounts nothing outward reads identical to the unlit herm", async () => {
    const unlit = await stand();
    const lit = await stand(silentCap);
    expect(lit.vessel.order).toContain("lit-and-silent");
    expect(unlit.vessel.order).not.toContain("lit-and-silent");
    holdOutwardSilence(await unlit.read(), await lit.read());
  }, 60_000);

  test("the composition answers a stranger who brings a name: the coal by its CID, a public blob by its CID, the porch by its AID", async () => {
    const h = await stand();
    for (const path of [`/bulb/${h.names.bulbCid}.bin`, `/cas/${h.names.publicCid}`, `/floor/${h.names.ownNexus}`]) {
      expect((await ask(h.origin, path)).status, path).toBe(200);
    }
  }, 60_000);
});

describe("the closed door, byte for byte", () => {
  /** The reference per method: a path no face claims, answered by the dispatcher itself. */
  async function doors(origin: string): Promise<Map<string, Answer>> {
    const out = new Map<string, Answer>();
    for (const method of PROBE_METHODS) out.set(method, await ask(origin, "/no-face-claims-this", method));
    return out;
  }

  test("a title-shaped ask and a listing ask draw the closed door by every method", async () => {
    const h = await stand();
    const door = await doors(h.origin);
    expect(door.get("GET")!.status).toBe(CLOSED_DOOR.status);
    expect(Buffer.from(door.get("GET")!.body, "base64").toString("utf8")).toBe(CLOSED_DOOR.body);
    const guesses = probePaths(h.names).filter(([label]) => label.startsWith("title:") || label.startsWith("list:"));
    expect(guesses.length).toBeGreaterThanOrEqual(12);
    for (const [label, path] of guesses) {
      for (const method of PROBE_METHODS) expect(await ask(h.origin, path, method), `${method} ${label}`).toEqual(door.get(method));
    }
  }, 60_000);

  test("a write method on every route draws the closed door, the routes that answer a GET among them", async () => {
    const h = await stand();
    const door = await doors(h.origin);
    for (const [label, path] of probePaths(h.names)) {
      for (const method of [...WRITE_METHODS, "OPTIONS"]) expect(await ask(h.origin, path, method), `${method} ${label}`).toEqual(door.get(method));
    }
  }, 60_000);

  test("a name the herm withholds, never held, or answers for nobody reads as a path no face claims", async () => {
    const h = await stand();
    const door = await doors(h.origin);
    const withheld = probePaths(h.names).filter(([label]) => !["bulb:known", "cas:public", "floor:own"].includes(label));
    for (const [label, path] of withheld) {
      for (const method of ["GET", "HEAD"]) expect(await ask(h.origin, path, method), `${method} ${label}`).toEqual(door.get(method));
    }
  }, 60_000);
});
