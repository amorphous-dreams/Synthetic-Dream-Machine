#!/usr/bin/env node
// release-manifest — the record a release carries beside its image index: one image digest bound to the genesis
// seed CID, the engine CID and the grammar CID (lar:///ha.ka.ba/lararium/mesh/harbor#/the-release-manifest).
//
//   emit       --image <sha256:… | name@sha256:…> [--genesis <dir>] [--platform <os/arch>]... [--out <file>]
//   verify     --manifest <file> [--genesis <dir>] [--image <ref>] | --manifest <file> --from-image <ref>
//   read-image --image <ref>      the three CIDs an image carries, read by running that image
//
// The record holds content addresses alone: no time, no host, no version, no builder. Two emitters over the same
// inputs print identical bytes. The operator builds and pushes the multi-arch index as a separate release act;
// this tool emits and verifies the record and publishes nothing. The CIDs follow the genesis directory it reads,
// so a release cut after the engine fold names the folded CIDs with no change here.
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const node = await import(pathToFileURL(resolve(ROOT, "packages/lararium-node/dist/src/index.js")).href);
// Each address rides the record in the spelling the house itself reads: the seed CID as the sha256 hex of the
// published seed bytes (`genesisSeedCid`), the engine and grammar CIDs as the genesis CAS manifest spells them
// (CIDv1, base32).
const SEED_CID = /^[0-9a-f]{64}$/;
const REGION_CID = /^b[a-z2-7]{58}$/;
const SHAPE = { seedCid: SEED_CID, engineCid: REGION_CID, grammarCid: REGION_CID };

function assertCids(cids, where) {
  for (const [field, shape] of Object.entries(SHAPE)) {
    if (typeof cids?.[field] !== "string" || !shape.test(cids[field])) {
      throw new Error(`[release-manifest] ${where} ${field} is no content address of the expected form: ${String(cids?.[field])}`);
    }
  }
}
const IMAGE_DIGEST = /^sha256:[0-9a-f]{64}$/;

function digestOfImage(reference) {
  const ref = String(reference ?? "").trim();
  const at = ref.lastIndexOf("@");
  const digest = at >= 0 ? ref.slice(at + 1) : ref;
  if (!IMAGE_DIGEST.test(digest)) throw new Error(`[release-manifest] image reference must name a sha256 digest: ${ref || "(empty)"}`);
  return digest;
}

function readGenesisCids(genesisDir) {
  let bytes;
  try { bytes = readFileSync(resolve(genesisDir, "seed.json")); }
  catch { throw new Error(`[release-manifest] genesis directory has no readable seed: ${genesisDir}`); }
  if (!node.readGenesisCasManifest(genesisDir)) {
    throw new Error(`[release-manifest] genesis directory has no readable seed or CAS manifest: ${genesisDir}`);
  }
  const cids = {
    seedCid: node.genesisSeedCid(bytes),
    engineCid: node.readGenesisEngineCid(genesisDir),
    grammarCid: node.readGenesisGrammarCid(genesisDir),
  };
  assertCids(cids, "genesis");
  return cids;
}

/** Build the content-address-only release record. */
export function buildReleaseManifest({ image, genesisDir = resolve(ROOT, "genesis"), platforms = [] }) {
  const digest = digestOfImage(image);
  const cids = readGenesisCids(genesisDir);
  return {
    format: "lararium-release-manifest/v1",
    image: { digest, platforms: [...new Set(platforms)].sort() },
    genesis: { seedCid: cids.seedCid },
    engine: { cid: cids.engineCid },
    grammar: { cid: cids.grammarCid },
  };
}

/** Serialize objects with recursively sorted keys, two-space indentation, and one final newline. */
export function canonicalJson(value) {
  const sort = (item) => {
    if (Array.isArray(item)) return item.map(sort);
    if (item && typeof item === "object") return Object.fromEntries(Object.keys(item).sort().map((key) => [key, sort(item[key])]));
    return item;
  };
  return `${JSON.stringify(sort(value), null, 2)}\n`;
}

/** Compare a manifest with local genesis CIDs or CIDs read from an image. */
export function verifyReleaseManifest(manifest, { genesisDir = resolve(ROOT, "genesis"), image, imageCids } = {}) {
  const expected = imageCids ?? readGenesisCids(genesisDir);
  const differences = [];
  const compare = (field, actual, wanted) => {
    if (actual !== wanted) differences.push(`${field}: manifest=${String(actual)} expected=${String(wanted)}`);
  };
  compare("format", manifest?.format, "lararium-release-manifest/v1");
  compare("genesis.seedCid", manifest?.genesis?.seedCid, expected.seedCid);
  compare("engine.cid", manifest?.engine?.cid, expected.engineCid);
  compare("grammar.cid", manifest?.grammar?.cid, expected.grammarCid);
  if (typeof manifest?.image?.digest !== "string" || !IMAGE_DIGEST.test(manifest.image.digest)) {
    differences.push(`image.digest: manifest=${String(manifest?.image?.digest)} expected=sha256:<64 lowercase hex>`);
  }
  if (image !== undefined) {
    let digest;
    try { digest = digestOfImage(image); }
    catch (error) { differences.push(`image.digest: manifest=${String(manifest?.image?.digest)} expected=${error.message}`); }
    if (digest !== undefined && manifest?.image?.digest !== digest && !differences.some((d) => d.startsWith("image.digest:"))) {
      compare("image.digest", manifest?.image?.digest, digest);
    }
  }
  return { ok: differences.length === 0, differences };
}

const imageReadScript = `import('/app/packages/lararium-node/dist/src/index.js').then(async n => { const {readFileSync}=await import('node:fs'); const dir='/app/genesis'; const bytes=readFileSync(dir+'/seed.json'); if (!n.readGenesisCasManifest(dir)) throw new Error('image genesis seed or CAS manifest unreadable'); console.log(JSON.stringify({ seedCid:n.genesisSeedCid(bytes), engineCid:n.readGenesisEngineCid(dir), grammarCid:n.readGenesisGrammarCid(dir) })); }).catch(e => { console.error(e.message); process.exitCode=1; });`;

/** Read the three genesis CIDs carried by an image. `exec` receives argv and returns {status,stdout,stderr}. */
export async function readImage({ image, exec = defaultExec }) {
  digestOfImage(image);
  const result = await exec("docker", ["run", "--rm", "--entrypoint", "node", image, "-e", imageReadScript]);
  if (result.status !== 0) throw new Error(`[release-manifest] image read failed: ${result.stderr || result.stdout}`);
  let cids;
  try { cids = JSON.parse(result.stdout); } catch { throw new Error("[release-manifest] image did not return a JSON CID record"); }
  assertCids(cids, "image");
  return cids;
}

function defaultExec(command, args) {
  const r = spawnSync(command, args, { encoding: "utf8" });
  return { status: r.status ?? 1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === "--platform") (options.platforms ??= []).push(rest[++i]);
    else if (arg.startsWith("--")) options[arg.slice(2)] = rest[++i];
    else throw new Error(`[release-manifest] unexpected argument: ${arg}`);
    if (options["out"] === "undefined" || options["genesis"] === "undefined") throw new Error(`[release-manifest] ${arg} requires a value`);
  }
  return { command, options };
}

async function main(argv) {
  const { command, options } = parseArgs(argv);
  if (command === "emit") {
    const manifest = buildReleaseManifest({ image: options.image, genesisDir: options.genesis ?? resolve(ROOT, "genesis"), platforms: options.platforms ?? [] });
    const json = canonicalJson(manifest);
    if (options.out) writeFileSync(resolve(options.out), json, "utf8");
    process.stdout.write(json);
    return;
  }
  if (command === "read-image") {
    process.stdout.write(`${JSON.stringify(await readImage({ image: options.image }))}\n`);
    return;
  }
  if (command === "verify") {
    if (!options.manifest) throw new Error("[release-manifest] verify requires --manifest <file>");
    const manifest = JSON.parse(readFileSync(resolve(options.manifest), "utf8"));
    let result;
    if (options["from-image"]) {
      const imageCids = await readImage({ image: options["from-image"] });
      result = verifyReleaseManifest(manifest, { image: options["from-image"], imageCids });
    } else {
      result = verifyReleaseManifest(manifest, { genesisDir: options.genesis ?? resolve(ROOT, "genesis"), image: options.image });
    }
    if (!result.ok) {
      for (const difference of result.differences) console.error(difference);
      process.exitCode = 1;
    } else process.stdout.write("release manifest verified\n");
    return;
  }
  throw new Error("usage: release-manifest.mjs emit --image <digest-ref> [--genesis <dir>] [--platform <os/arch>]... [--out <file>] | verify --manifest <file> [--genesis <dir>] [--image <ref>] [--from-image <ref>] | read-image --image <ref>");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
