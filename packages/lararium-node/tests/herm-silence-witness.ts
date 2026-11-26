/**
 * herm-silence-witness — THE OUTWARD-SILENCE WITNESS: one transcript reader over a composed herm's public listener, and the
 * comparison that holds two compositions equal.
 *
 * THE TRANSCRIPT. A fixed probe set (every route shape the herm's faces answer, every method on each, a known and an
 * unknown CID, an own and a foreign Nexus AID, the well-known name, listing guesses, title guesses) draws each answer into
 * canonical bytes: status, every header but the date, and the body. A probe rides under a LABEL, never its literal path, so
 * two compositions on two ports read one transcript.
 *
 * THE CENSUS. A fixed probe set sees only the paths it names, so the witness also counts what a composition CLAIMED: each
 * route key a face registered, each upgrade path, and the server's own request and upgrade listeners. A cap that claims a
 * route no probe names moves the census though every probed byte stays put.
 *
 * THE WITNESS. `outwardSilence(a, b)` answers silent only where both the transcripts and the censuses read identical; a
 * later rung lights a cap in `extraCaps` and holds its composition against an unlit one through this one reader.
 *
 * Test support. No source file imports it. The suite stands the server (`createServer`) and hands it in, so the heavy
 * roster's reader finds the listener in the suite's own text.
 *
 * Plan: lar:///ha.ka.ba/kahua/memory/plan/herm-rungs
 */
import { request, type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Repo } from "@automerge/automerge-repo";
import { composeVessel, type CapModule, type ComposedVessel } from "@lararium/mesh/cap-compose";
import { buildGenesisDoc, type GenesisInputs } from "@lararium/mesh/genesis-doc";
import { sha256HexBytesSync, utf8Bytes } from "@lararium/mesh/crypto";
import { LARES_MEMETIC_WIKITEXT_PLUGIN_URI } from "@lararium/mesh/lar-uris";
import { FLOW_SOCKET_ROUTE } from "@lararium/mesh/flow-read-client";
import { type CasReferenceEntry } from "@lararium/mesh/cas";
import { publicCasShore } from "../src/bulb-read-face.js";
import { type BulbArtifact } from "../src/bulb.js";
import { mountFloorPorch } from "../src/floor-porch.js";
import { genesisSeedCid, genesisSeedFileBytes } from "../src/genesis-artifact.js";
import { mountHttpFaceDispatcher, type HttpFace, type HttpFaceDispatcher, type HttpUpgradeFace } from "../src/http-face-dispatcher.js";
import { CAP, bulbCap } from "../src/node-caps.js";
import { writeCasEntriesFs } from "../src/node-cas.js";
import { createReadinessState, mountReadinessFace } from "../src/readiness-face.js";

// ── the probes ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** The names a stranger might bring, and the ones it could only guess. */
export interface ProbeNames {
  /** The bulb CID this herm hands over. */
  readonly bulbCid: string;
  /** A blob a PUBLIC board names, a blob the herm holds under a private bag, and a CID it never held. */
  readonly publicCid: string;
  readonly withheldCid: string;
  readonly unknownCid: string;
  /** The Nexus this herm answers for, and one it does not. */
  readonly ownNexus: string;
  readonly foreignNexus: string;
}

export const PROBE_METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const;
/** The methods that would move something: a herm answers none of them on any route. */
export const WRITE_METHODS: readonly string[] = ["POST", "PUT", "PATCH", "DELETE"];

const TITLE = encodeURIComponent("lar:///ha.ka.ba/lares/api/noosphere-boot");

/** Every path the witness asks, each under the label its transcript line carries. */
export function probePaths(n: ProbeNames): ReadonlyArray<readonly [label: string, path: string]> {
  return [
    // every route shape a herm's faces answer, by a name the stranger brings
    ["bulb:known", `/bulb/${n.bulbCid}.bin`],
    ["bulb:unknown", `/bulb/${n.unknownCid}.bin`],
    ["bulb:malformed", "/bulb/not-a-cid.bin"],
    ["cas:public", `/cas/${n.publicCid}`],
    ["cas:withheld", `/cas/${n.withheldCid}`],
    ["cas:unknown", `/cas/${n.unknownCid}`],
    ["cas:bulb", `/cas/${n.bulbCid}`],
    ["floor:own", `/floor/${n.ownNexus}`],
    ["floor:foreign", `/floor/${n.foreignNexus}`],
    ["floor:malformed", "/floor/nexus-short"],
    // the well-known name, the flow's paths, the readiness path a lararium alone binds
    ["well-known", "/.well-known/lar"],
    ["flow:pointer", "/flow/pointer"],
    ["flow:snapshot", `/flow/${n.unknownCid}.bin`],
    ["flow:socket", FLOW_SOCKET_ROUTE],
    ["health", "/api/health"],
    // listing guesses: a stranger without a name asks what rests
    ["list:root", "/"],
    ["list:bulb", "/bulb/"],
    ["list:cas", "/cas/"],
    ["list:floor", "/floor/"],
    ["list:manifest", "/bulb/manifest"],
    ["list:tiddlers", "/recipes/default/tiddlers.json"],
    ["list:status", "/status"],
    // title guesses: a per-title answer would build an existence oracle
    ["title:recipe", `/recipes/default/tiddlers/${TITLE}`],
    ["title:bag", `/bags/lares/tiddlers/${TITLE}`],
    ["title:wiki", `/wiki/${TITLE}`],
    ["title:query", `/cas/${n.unknownCid}?title=${TITLE}`],
    ["title:floor", `/floor/${n.ownNexus}/${TITLE}`],
    ["title:meme", `/memes/${TITLE}`],
  ];
}

/** One answer as a stranger sees it: status, every header but the date, and the body's bytes. */
export interface Answer { readonly status: number; readonly headers: readonly string[]; readonly body: string }

/** Ask one path by one method. The body rides as base64, so a binary blob and a text refusal compare by bytes alike. */
export function ask(origin: string, path: string, method = "GET"): Promise<Answer> {
  return new Promise((resolve, reject) => {
    const req = request(`${origin}${path}`, { method, headers: { connection: "close" } }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => {
        const headers: string[] = [];
        for (let i = 0; i < res.rawHeaders.length; i += 2) {
          if (res.rawHeaders[i]!.toLowerCase() === "date") continue;
          headers.push(`${res.rawHeaders[i]!.toLowerCase()}: ${res.rawHeaders[i + 1]}`);
        }
        resolve({ status: res.statusCode ?? 0, headers, body: Buffer.concat(chunks).toString("base64") });
      });
    });
    req.on("error", reject);
    req.end();
  });
}

/** The transcript's lines: every probe by every method, in the probe set's own order. */
export async function transcriptLines(origin: string, names: ProbeNames): Promise<string[]> {
  const lines: string[] = [];
  for (const [label, path] of probePaths(names)) {
    for (const method of PROBE_METHODS) {
      const a = await ask(origin, path, method);
      lines.push(JSON.stringify([`${method} ${label}`, a.status, a.headers, a.body]));
    }
  }
  return lines;
}

// ── the census ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** What a composition claimed on its listener. */
export interface ClaimCensus {
  /** Each route key a face registered, sorted. */
  readonly routeKeys: readonly string[];
  /** How many upgrade paths stand (a gate's knock path differs per boot, so the count compares). */
  readonly upgrades: number;
  /** The server's own listeners: one request and one upgrade listener belong to the dispatcher. */
  readonly requestListeners: number;
  readonly upgradeListeners: number;
}

/** A dispatcher that remembers every claim made through it. */
export function censusDispatcher(server: Server): { readonly dispatcher: HttpFaceDispatcher; readonly census: () => ClaimCensus } {
  const inner = mountHttpFaceDispatcher(server, { onUnclaimedUpgrade: () => {} });
  const routeKeys = new Set<string>();
  const upgrades = new Set<string>();
  const dispatcher: HttpFaceDispatcher = {
    register: (face: HttpFace) => {
      const off = inner.register(face);
      for (const key of face.routeKeys) routeKeys.add(key);
      return () => { off(); for (const key of face.routeKeys) routeKeys.delete(key); };
    },
    registerUpgrade: (face: HttpUpgradeFace) => {
      const off = inner.registerUpgrade(face);
      upgrades.add(face.path);
      return () => { off(); upgrades.delete(face.path); };
    },
    dispose: () => inner.dispose(),
  };
  return {
    dispatcher,
    census: () => ({
      routeKeys: [...routeKeys].sort(), upgrades: upgrades.size,
      requestListeners: server.listenerCount("request"), upgradeListeners: server.listenerCount("upgrade"),
    }),
  };
}

// ── the witness ────────────────────────────────────────────────────────────────────────────────────────────────────

/** A composition as the witness reads it. */
export interface OutwardFace { readonly lines: readonly string[]; readonly census: ClaimCensus }

export type SilenceVerdict = { readonly silent: true } | { readonly silent: false; readonly differs: readonly string[] };

/** Hold two compositions equal: every transcript line byte for byte, and every claim. Each difference names its probe. */
export function outwardSilence(a: OutwardFace, b: OutwardFace): SilenceVerdict {
  const differs: string[] = [];
  const probeOf = (line: string | undefined): string => (line === undefined ? "(no line)" : String((JSON.parse(line) as unknown[])[0]));
  for (let i = 0; i < Math.max(a.lines.length, b.lines.length); i++) {
    if (a.lines[i] !== b.lines[i]) differs.push(`transcript: ${probeOf(a.lines[i] ?? b.lines[i])}`);
  }
  const ca = JSON.stringify(a.census), cb = JSON.stringify(b.census);
  if (ca !== cb) differs.push(`census: ${ca} against ${cb}`);
  return differs.length === 0 ? { silent: true } : { silent: false, differs };
}

/** The witness as an assertion: it throws, naming every probe and claim that moved. */
export function holdOutwardSilence(a: OutwardFace, b: OutwardFace): void {
  const verdict = outwardSilence(a, b);
  if (!verdict.silent) throw new Error(`outward silence broke on ${verdict.differs.length} reading(s):\n  ${verdict.differs.join("\n  ")}`);
}

// ── the composition ────────────────────────────────────────────────────────────────────────────────────────────────

function fixtureBulb(): BulbArtifact {
  const coreBlob   = utf8Bytes("fake-tw5-core-for-bulb");
  const pluginBlob = utf8Bytes("fake-lares-memetic-wikitext-plugin");
  const inputs: GenesisInputs = {
    actorSeed: "abc123", coreBlob, coreVersion: "5.0.0-test",
    plugins: [{ id: LARES_MEMETIC_WIKITEXT_PLUGIN_URI, version: "0.1.0", sha256: sha256HexBytesSync(pluginBlob), mimeType: "application/json", blob: pluginBlob }],
  };
  const a = buildGenesisDoc(inputs);
  return { seedBytes: genesisSeedFileBytes(a.seed), casEntries: a.casEntries };
}

const PUBLIC_BAG  = "lar:///ha.ka.ba/bags/crossroads";
const PRIVATE_BAG = "lar:///ha.ka.ba/bags/lares";
const pointer = (bagId: string, title: string, cid: string): CasReferenceEntry =>
  ({ title, bagId, record: { tiddler: { title, _is_skinny: "yes", textCid: cid } } });

/** The Nexus every witness composition answers for, and one it never does. Fixed, so two compositions read one transcript. */
export const WITNESS_NEXUS = `nexus-${"ab".repeat(32)}`;
export const FOREIGN_NEXUS = `nexus-${"cd".repeat(32)}`;

/** What a cap in `extraCaps` may reach: the herm's own listener and its one dispatcher. */
export interface HermListenerDeps { readonly httpServer: Server; readonly dispatcher: HttpFaceDispatcher }

export interface SilentHerm {
  readonly origin: string;
  readonly names: ProbeNames;
  readonly vessel: ComposedVessel;
  /** Read the composition whole: its transcript over the fixed probes, and its claims. */
  readonly read: () => Promise<OutwardFace>;
  readonly dispose: () => Promise<void>;
}

/**
 * Compose a herm's public listener on `server` and listen: the vessel's one dispatcher, the bulb cap through the real
 * composer with `extraCaps` beside it (the channel `composeHerm` opens), the porch for one Nexus, and the readiness face
 * standing as a herm. The public shore holds one blob a public board names and one a private bag names.
 */
export async function standSilentHerm(server: Server, opts: { readonly extraCaps?: (deps: HermListenerDeps) => readonly CapModule[] } = {}): Promise<SilentHerm> {
  const bulb = fixtureBulb();
  const storageDir = mkdtempSync(join(tmpdir(), "lr-herm-silence-"));
  const casDir = join(storageDir, "cas");
  const shared = utf8Bytes("a public blob a board names");
  const kept = utf8Bytes("a blob a private bag names");
  const publicCid = sha256HexBytesSync(shared), withheldCid = sha256HexBytesSync(kept);
  writeCasEntriesFs([...bulb.casEntries, { cid: publicCid, bytes: shared }, { cid: withheldCid, bytes: kept }], casDir);

  const { dispatcher, census } = censusDispatcher(server);
  const repo = new Repo({ network: [] });
  const vessel = await composeVessel([
    // A stand-in keel: the bulb cap reads a founding record off it where one stands, and this one carries none.
    { id: CAP.substrate, build: () => ({}) },
    bulbCap({
      httpServer: server, bulb, dispatcher,
      publicCas: publicCasShore({
        casDir,
        references: () => [pointer(PUBLIC_BAG, "lar:///t.w.b/shared", publicCid), pointer(PRIVATE_BAG, "lar:///t.w.b/kept", withheldCid)],
        bagTier: (bagUrl) => (bagUrl === PUBLIC_BAG ? "public" : bagUrl === PRIVATE_BAG ? "veil" : null),
      }),
    }),
    ...(opts.extraCaps?.({ httpServer: server, dispatcher }) ?? []),
  ]);
  const porch = mountFloorPorch({ httpServer: server, dispatcher, repo, nexusPubkey: WITNESS_NEXUS, casDir, serveCas: false });
  const readiness = mountReadinessFace({ httpServer: server, state: createReadinessState(), standing: "herm", dispatcher });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const names: ProbeNames = {
    bulbCid: genesisSeedCid(bulb.seedBytes), publicCid, withheldCid,
    unknownCid: sha256HexBytesSync(utf8Bytes("a cid this herm never held")), ownNexus: WITNESS_NEXUS, foreignNexus: FOREIGN_NEXUS,
  };
  return {
    origin, names, vessel,
    read: async () => ({ lines: await transcriptLines(origin, names), census: census() }),
    dispose: async () => {
      readiness.dispose();
      porch.dispose();
      await vessel.dispose();
      dispatcher.dispose();
      await new Promise<void>((r) => server.close(() => r()));
      await repo.shutdown();
      rmSync(storageDir, { recursive: true, force: true });
    },
  };
}
