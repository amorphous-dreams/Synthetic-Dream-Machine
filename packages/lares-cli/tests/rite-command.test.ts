/**
 * rite-command — `lares rite kukulu | begin | land | receipts` (road L45d).
 *
 * `kukulu` (kūkulu: a vessel raised again around its hearth) runs on the host: it begins the rite in the vessel (the lei's
 * return and the guest half of the tessera), and only then calls the host shim to rebuild the image and raise the vessel; the
 * vessel that stands after lands the host half. Every port here answers from a FAKE: no shim runs, no container, no git.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { repoRoot } from "@lararium/mesh/node";
import { LARES_MEMETIC_WIKITEXT_PLUGIN_URI, foundingRecordDigests, type GenesisDigests, type GenesisRecordLike } from "@lararium/mesh";
import { genesisSeedCid } from "@lararium/node";
import { hostSeedOfferPort } from "../src/seed-offered.js";
import { parseArgs } from "../src/parse-args.js";
import { RiteUsage, hostRowLine, ritePlan } from "../src/commands/rite.js";
import { kukuluSeedLine, riteKukulu, type RitePorts, type RiteVerbAnswer } from "../src/rite-kukulu.js";
import { decideRoute } from "../src/host-bridge.js";
import { COMMAND_NAMES } from "../src/bin/lares.js";

const HEAD = "a".repeat(40), TESSERA = "c".repeat(64);
const plan = (...line: string[]) => ritePlan(parseArgs(["rite", ...line]));

/** Ports that record every call in order and answer from a script. */
function fakes(over: { begin?: RiteVerbAnswer; land?: RiteVerbAnswer; shim?: Partial<Record<"build" | "down" | "up", number>> } = {}) {
  const calls: string[] = [], said: string[] = [];
  const ports: RitePorts = {
    checkout: async () => { calls.push("checkout"); return { head: HEAD, branch: "main" }; },
    row: async (verb, args) => {
      calls.push(`${verb} ${JSON.stringify(args)}`);
      if (verb === "rite-begin") return over.begin ?? { ok: true, output: { rite: "kukulu", faces: [{ face: "h0", ordinal: 0, tessera: TESSERA, lei: "d".repeat(64), n: 1, begun: "e".repeat(64) }], waits: [] } };
      return over.land ?? { ok: true, output: { tessera: TESSERA, rite: "kukulu", begun: "e".repeat(64), landed: "f".repeat(64), par: true } };
    },
    shim: async (verb) => { calls.push(`shim ${verb}`); return over.shim?.[verb] ?? 0; },
    say: (line) => { said.push(line); },
  };
  return { ports, calls, said };
}

describe("rite-begun-before-down", () => {
  it("RED: the rite begins in the vessel before any shim verb runs, and the vessel goes down only after the build; CONTROL: the landing follows the raise and reads par", async () => {
    const f = fakes();
    const out = await riteKukulu(f.ports, {});
    expect(f.calls).toEqual([
      "checkout",
      `rite-begin ${JSON.stringify({ rite: "kukulu", branch: "main", head: HEAD })}`,
      "shim build", "shim down", "shim up",
      `rite-land ${JSON.stringify({ tessera: TESSERA, head: HEAD, face: 0 })}`,
    ]);
    expect(out).toEqual({ code: 0, data: { rite: "kukulu", branch: "main", head: HEAD, tesserae: [{ face: "h0", tessera: TESSERA }], begun: true, landed: true, par: true } });
  });

  it("RED: a build that fails leaves the vessel standing: no down, no up, no landing, and the answer names the begun half that now waits", async () => {
    const f = fakes({ shim: { build: 3 } });
    const out = await riteKukulu(f.ports, {});
    expect(f.calls.filter((c) => c.startsWith("shim"))).toEqual(["shim build"]);
    expect(f.calls.some((c) => c.startsWith("rite-land"))).toBe(false);
    expect(out).toMatchObject({ code: 1, data: { tesserae: [{ face: "h0", tessera: TESSERA }], begun: true, landed: false, stopped: "build" } });
    expect(f.said.join("\n")).toMatch(/the lei's return stays spent/);
  });

  it("RED: a `--face` rides the begin and the offer as the face their session acts as, beside every lent face they gather; CONTROL: naming none, the rows name none", async () => {
    const IMAGE = "sha256:" + "ab".repeat(32);
    const f = fakes({});
    f.ports.image = async () => IMAGE;
    await riteKukulu(f.ports, { face: 0 });
    expect(f.calls[1]).toBe(`rite-begin ${JSON.stringify({ rite: "kukulu", branch: "main", head: HEAD, face: 0 })}`);
    expect(f.calls.find((c) => c.startsWith("rite-offer"))).toBe(`rite-offer ${JSON.stringify({ branch: "main", head: HEAD, image: IMAGE, face: 0 })}`);
    const bare = fakes({});
    await riteKukulu(bare.ports, {});
    expect(bare.calls[1]).toBe(`rite-begin ${JSON.stringify({ rite: "kukulu", branch: "main", head: HEAD })}`);
  });

  it("RED: a raise that fails ends the rite with the vessel down and names it; CONTROL: a `--branch` names the line where the checkout's own differs", async () => {
    const f = fakes({ shim: { up: 9 } });
    const out = await riteKukulu(f.ports, { branch: "feature/x" });
    expect(f.calls[1]).toBe(`rite-begin ${JSON.stringify({ rite: "kukulu", branch: "feature/x", head: HEAD })}`);
    expect(f.calls.filter((c) => c.startsWith("shim"))).toEqual(["shim build", "shim down", "shim up"]);
    expect(out).toMatchObject({ code: 1, data: { landed: false, stopped: "up" } });
  });
});

describe("rite-refuses-without-lei", () => {
  it("RED: a begin the vessel refuses runs no shim verb at all, and the refusal rides the answer under its own code; CONTROL: the same ports with a lei standing reach the shim", async () => {
    const f = fakes({ begin: { ok: false, code: "swarm-lei-absent", message: "swarm-lei-absent: the kukulu lei for \"main\" does not stand (absent)" } });
    const out = await riteKukulu(f.ports, {});
    expect(f.calls).toEqual(["checkout", `rite-begin ${JSON.stringify({ rite: "kukulu", branch: "main", head: HEAD })}`]);
    expect(out).toEqual({ code: 1, data: { rite: "kukulu", branch: "main", head: HEAD, begun: false, refusal: "swarm-lei-absent" } });
    expect((await riteKukulu(fakes().ports, {})).code).toBe(0);
  });
});

describe("the vessel that stands locked lands later", () => {
  it("RED: a landing the locked vessel refuses ends the rite clean, names the unlock and the landing still owed, and reads no par", async () => {
    const f = fakes({ land: { ok: false, code: "vessel-locked", message: "this vessel's key rests unopened" } });
    const out = await riteKukulu(f.ports, {});
    expect(out).toEqual({ code: 0, data: { rite: "kukulu", branch: "main", head: HEAD, tesserae: [{ face: "h0", tessera: TESSERA }], begun: true, landed: false, awaits: "unlock" } });
    expect(f.said.join("\n")).toMatch(new RegExp(`lares vault unlock[\\s\\S]*lares rite land --tessera ${TESSERA} --head ${HEAD} --face 0`));
  });

  it("RED: any other landing refusal ends the rite red under its own code", async () => {
    const out = await riteKukulu(fakes({ land: { ok: false, code: "rite-begun-absent", message: "rite-begun-absent: none" } }).ports, {});
    expect(out).toMatchObject({ code: 1, data: { landed: false, refusal: "rite-begun-absent" } });
  });
});

describe("lares rite plans one store row per vessel sub-verb", () => {
  it("begin names its rite, branch and head and no tree; land names its tessera and head; receipts names nothing", () => {
    expect(plan("begin", "--rite", "kukulu", "--branch", "main", "--head", HEAD)).toEqual({ verb: "rite-begin", args: { rite: "kukulu", branch: "main", head: HEAD } });
    expect(plan("land", "--tessera", TESSERA, "--head", HEAD, "--face", "1")).toEqual({ verb: "rite-land", args: { tessera: TESSERA, head: HEAD, face: 1 } });
    expect(plan("receipts")).toEqual({ verb: "rite-receipts", args: {} });
    expect(plan("begin", "--rite", "keep", "--branch", "backup", "--head", "c".repeat(64), "--staging", ".house.keep-0a")).toEqual({ verb: "rite-begin", args: { rite: "keep", branch: "backup", head: "c".repeat(64), staged: ".house.keep-0a" } });
  });

  it("RED: the burned `receipt` sub-verb plans no row and refuses by usage; CONTROL: `receipts` still plans its row", () => {
    expect(() => plan("receipt", "--tree", "b".repeat(40))).toThrow(RiteUsage);
    expect(plan("receipts")).toEqual({ verb: "rite-receipts", args: {} });
  });

  it("RED: an unknown sub-verb and a line that lacks a name refuse by usage; `kukulu` plans no single row", () => {
    for (const line of [[], ["restart"], ["begin", "--rite", "kukulu", "--branch", "main"], ["begin", "--branch", "main", "--head", HEAD], ["land", "--head", HEAD], ["land", "--tessera", TESSERA], ["kukulu"]]) {
      expect(() => plan(...line), line.join(" ")).toThrow(RiteUsage);
    }
  });
});

describe("the rite runs on the host, and its rows in the vessel", () => {
  const route = (argv: string[]) => decideRoute({
    argv, env: { HOME: "/home/op" }, commands: COMMAND_NAMES, shim: "/clone/tools/lares-container.sh", tty: false,
    fsProbe: { exists: () => true },
  });

  it("RED: `rite kukulu` (and its spelling `kūkulu`) stays on this machine, where the shim stands; CONTROL: begin, land and receipts forward into the vessel", () => {
    expect(route(["rite", "kukulu"])).toBe("local");
    expect(route(["rite", "kūkulu", "--branch", "main"])).toBe("local");
    for (const sub of ["begin", "land", "receipts", "offer"]) expect(route(["rite", sub, "--json"]), sub).toBe("forward");
  });

  it("RED: `rite keep` (the keep's host half: git in the operator's workspace clone) stays on this machine; CONTROL: its vessel half `rite keep-cut` forwards", () => {
    expect(route(["rite", "keep", "--workspace", "backup"])).toBe("local");
    expect(route(["rite", "keep-cut", "--workspace", "backup", "--json"])).toBe("forward");
  });
});

describe("kukulu-offer-reaches-the-new-vessel (the host's step)", () => {
  const IMAGE = "sha256:" + "ab".repeat(32);

  it("RED: where the host names the image it built, the standing vessel writes the offer AFTER the build and BEFORE the lowering; CONTROL: with no image port the order stands as before", async () => {
    const f = fakes();
    f.ports.image = async () => { f.calls.push("image"); return IMAGE; };
    const out = await riteKukulu(f.ports, {});
    expect(f.calls).toEqual([
      "checkout",
      `rite-begin ${JSON.stringify({ rite: "kukulu", branch: "main", head: HEAD })}`,
      "shim build", "image",
      `rite-offer ${JSON.stringify({ branch: "main", head: HEAD, image: IMAGE })}`,
      "shim down", "shim up",
      `rite-land ${JSON.stringify({ tessera: TESSERA, head: HEAD, face: 0 })}`,
    ]);
    expect(out.code).toBe(0);
    expect(f.said.join("\n")).toMatch(/the offer rests for the next vessel/);
    const bare = fakes();
    await riteKukulu(bare.ports, {});
    expect(bare.calls.some((c) => c.startsWith("rite-offer") || c === "image")).toBe(false);
  });

  it("RED: a standing vessel that writes no offer stays standing: no lowering, no raise, and the answer names the offer; a host that names no digest goes on and says so", async () => {
    const f = fakes();
    f.ports.image = async () => IMAGE;
    const row = f.ports.row;
    f.ports.row = async (verb, args) => verb === "rite-offer" ? { ok: false, code: "swarm-lei-absent", message: "no kukulu lei rests" } : row(verb, args);
    const out = await riteKukulu(f.ports, {});
    expect(f.calls.filter((c) => c.startsWith("shim"))).toEqual(["shim build"]);
    expect(out).toMatchObject({ code: 1, data: { begun: true, landed: false, stopped: "offer", refusal: "swarm-lei-absent" } });
    const none = fakes();
    none.ports.image = async () => null;
    const went = await riteKukulu(none.ports, {});
    expect(went.code).toBe(0);
    expect(none.calls.filter((c) => c.startsWith("shim"))).toEqual(["shim build", "shim down", "shim up"]);
    expect(none.said.join("\n")).toMatch(/no offer rests for a pūlama/);
  });

  it("RED: the begin and the offer gather every lent face in the vessel, so the host names no face on them; each landing names the face its tessera began under", () => {
    expect(hostRowLine("rite-offer", { branch: "main", head: HEAD, image: IMAGE })).toEqual(["rite", "offer", "--branch", "main", "--head", HEAD, "--image", IMAGE]);
    expect(hostRowLine("rite-begin", { rite: "kukulu", branch: "main", head: HEAD })).toEqual(["rite", "begin", "--rite", "kukulu", "--branch", "main", "--head", HEAD]);
    expect(hostRowLine("rite-land", { tessera: TESSERA, head: HEAD, face: 2 })).toEqual(["rite", "land", "--tessera", TESSERA, "--head", HEAD, "--face", "2"]);
  });

  it("RED: a begin over several lent faces lands each face's tessera under that face, names each face that waits for its lei, and reads par only where every pair reads par", async () => {
    const T2 = "2".repeat(64);
    const f = fakes({ begin: { ok: true, output: { rite: "kukulu", faces: [{ face: "h0", ordinal: 0, tessera: TESSERA }, { face: "h2", ordinal: 2, tessera: T2 }], waits: ["h1"] } } });
    const out = await riteKukulu(f.ports, {});
    expect(f.calls.filter((c) => c.startsWith("rite-land"))).toEqual([
      `rite-land ${JSON.stringify({ tessera: TESSERA, head: HEAD, face: 0 })}`,
      `rite-land ${JSON.stringify({ tessera: T2, head: HEAD, face: 2 })}`,
    ]);
    expect(out).toEqual({ code: 0, data: { rite: "kukulu", branch: "main", head: HEAD, tesserae: [{ face: "h0", tessera: TESSERA }, { face: "h2", tessera: T2 }], waits: ["h1"], begun: true, landed: true, par: true } });
    expect(f.said.join("\n")).toMatch(/h1 carries no kukulu lei on this line and waits/);
    // One face's pair reading red reads the whole landing red.
    const red = fakes({ begin: { ok: true, output: { rite: "kukulu", faces: [{ face: "h0", ordinal: 0, tessera: TESSERA }, { face: "h2", ordinal: 2, tessera: T2 }], waits: [] } } });
    const row = red.ports.row;
    red.ports.row = async (verb, args) => verb === "rite-land" && args["face"] === 2 ? { ok: true, output: { par: false } } : row(verb, args);
    expect(await riteKukulu(red.ports, {})).toMatchObject({ code: 1, data: { landed: true, par: false } });
  });

  it("RED: the host names each face the offer vouches for, and each face whose line carries no lei waits by name", async () => {
    const f = fakes();
    f.ports.image = async () => IMAGE;
    const row = f.ports.row;
    f.ports.row = async (verb, args) => verb === "rite-offer" ? { ok: true, output: { lei: 2, faces: ["h0", "h1", "h2"], waits: ["h2"] } } : row(verb, args);
    await riteKukulu(f.ports, {});
    const said = f.said.join("\n");
    expect(said).toMatch(/2 lei, a vouch for each of h0, h1, h2/);
    expect(said).toMatch(/h2 carries no lei on this line and waits/);
  });

  it("the offer sub-verb plans its store row", () => {
    expect(plan("offer", "--branch", "main", "--head", HEAD, "--image", IMAGE)).toEqual({ verb: "rite-offer", args: { branch: "main", head: HEAD, image: IMAGE } });
    expect(() => plan("offer", "--branch", "main", "--head", HEAD)).toThrow(RiteUsage);
  });
});

describe("the kūkulu names the seed the image offers beside the founding record (D1)", () => {
  const record = { engine: "e1", grammar: "g1", plugins: "p1", floor: "f1" };
  const seed = { cid: "5".repeat(64), digests: { engine: "e1", grammar: "g2", plugins: "p1", floor: "f1" } };

  it("RED: before the build, the host says the seed (offered) at the head beside the founding record, ratchet by ratchet; the rows and the shim order stay as they were", async () => {
    const f = fakes();
    const ports: RitePorts = { ...f.ports, seedOffer: async (head) => { f.calls.push(`seed-offer ${head}`); return { record, seed }; } };
    const out = await riteKukulu(ports, {});
    expect(f.calls.filter((c) => !c.startsWith("seed-offer"))).toEqual([
      "checkout",
      `rite-begin ${JSON.stringify({ rite: "kukulu", branch: "main", head: HEAD })}`,
      "shim build", "shim down", "shim up",
      `rite-land ${JSON.stringify({ tessera: TESSERA, head: HEAD, face: 0 })}`,
    ]);
    expect(f.calls.indexOf(`seed-offer ${HEAD}`)).toBeLessThan(f.calls.indexOf("shim build"));
    const line = kukuluSeedLine(HEAD, { record, seed });
    expect(line).toBe(`kūkulu: the image at ${HEAD} offers seed ${"5".repeat(64)} beside the founding record: a newer seed waits: engine same · grammar moved · plugins same · floor same; the founding record keeps serving, and the kūkulu moves no ratchet`);
    expect(f.said).toContain(line);
    expect(out).toMatchObject({ code: 0, data: { seed: { cid: "5".repeat(64), ratchets: "engine same · grammar moved · plugins same · floor same" } } });
  });

  it("CONTROL: a seed the same on every ratchet says so; a host that reads no founding record names that and the rite goes on", async () => {
    expect(kukuluSeedLine(HEAD, { record, seed: { cid: seed.cid, digests: record } }))
      .toBe(`kūkulu: the image at ${HEAD} offers seed ${seed.cid}: same on every ratchet as the founding record`);
    const f = fakes();
    const out = await riteKukulu({ ...f.ports, seedOffer: async () => null }, {});
    expect(f.said).toContain("kūkulu: the host reads no founding record beside the seed this image offers; the rite goes on, and moves no ratchet");
    expect(out.code).toBe(0);
    expect(out.data["seed"]).toBeUndefined();
  });
});

describe("the kūkulu's seed port reads the genesis dir the image carries (the host seed read)", () => {
  const SHIPPED = join(repoRoot, "genesis");
  const shippedBytes = (): Buffer => readFileSync(join(SHIPPED, "seed.json"));
  const record = (): GenesisDigests => foundingRecordDigests(JSON.parse(shippedBytes().toString("utf8")) as GenesisRecordLike);
  const scratch: string[] = [];
  afterEach(() => { for (const d of scratch.splice(0)) rmSync(d, { recursive: true, force: true }); });
  const genesisDirWith = (bytes: string | Buffer): string => {
    const root = mkdtempSync("/tmp/lares-kukulu-seed-"); scratch.push(root);
    mkdirSync(join(root, "genesis")); writeFileSync(join(root, "genesis", "seed.json"), bytes);
    return join(root, "genesis");
  };

  it("RED: the wired port says the seed the genesis dir offers, by its CID, beside the founding record the house answers", async () => {
    const dir = genesisDirWith(shippedBytes());
    const cid = genesisSeedCid(new Uint8Array(shippedBytes()));
    const f = fakes();
    const out = await riteKukulu({ ...f.ports, seedOffer: hostSeedOfferPort({ genesisDir: dir, record: async () => ({ record: record() }) }) }, {});
    expect(f.said).toContain(`kūkulu: the image at ${HEAD} offers seed ${cid}: same on every ratchet as the founding record`);
    expect(out.data["seed"]).toEqual({ cid, ratchets: "engine same · grammar same · plugins same · floor same" });
  });

  it("CONTROL: a newer seed names what waits; a house that answers no founding record leaves the port null, and the rite goes on", async () => {
    const seed = JSON.parse(shippedBytes().toString("utf8")) as { blobs: Record<string, Record<string, unknown>> };
    const moved = JSON.stringify({ ...seed, blobs: { ...seed.blobs, [LARES_MEMETIC_WIKITEXT_PLUGIN_URI]: { ...seed.blobs[LARES_MEMETIC_WIKITEXT_PLUGIN_URI], sha256: "f".repeat(64) } } });
    const f = fakes();
    await riteKukulu({ ...f.ports, seedOffer: hostSeedOfferPort({ genesisDir: genesisDirWith(moved), record: async () => ({ record: record() }) }) }, {});
    expect(f.said.join("\n")).toContain("a newer seed waits: engine same · grammar moved · plugins same · floor same; the founding record keeps serving, and the kūkulu moves no ratchet");
    const g = fakes();
    const out = await riteKukulu({ ...g.ports, seedOffer: hostSeedOfferPort({ genesisDir: genesisDirWith(shippedBytes()), record: async () => ({ unread: "no vessel answers" }) }) }, {});
    expect(g.said).toContain("kūkulu: the host reads no founding record beside the seed this image offers; the rite goes on, and moves no ratchet");
    expect(out.code).toBe(0);
  });
});
