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
import { createHash } from "node:crypto";
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

const PLATFORM = /^[a-z0-9]+\/[a-z0-9_]+(?:\/[a-z0-9]+)?$/;
function assertPlatforms(platforms) {
  if (!Array.isArray(platforms) || platforms.length === 0) throw new Error("[release-manifest] a release names at least one platform (--platform <os/arch>)");
  for (const p of platforms) if (typeof p !== "string" || !PLATFORM.test(p)) throw new Error(`[release-manifest] platform reads as no os/arch pair: ${String(p)}`);
}

/** The record holds exactly its declared fields: a missing one or an extra one names a different record. */
function shapeDifferences(manifest) {
  const out = [];
  const keys = (value, wanted, where) => {
    const got = value && typeof value === "object" && !Array.isArray(value) ? Object.keys(value).sort().join(",") : "(no object)";
    if (got !== wanted) out.push(`${where}: fields=${got} expected=${wanted}`);
  };
  keys(manifest, "engine,format,genesis,grammar,image", "record");
  keys(manifest?.image, "digest,platforms", "image");
  keys(manifest?.genesis, "seedCid", "genesis");
  keys(manifest?.engine, "cid", "engine");
  keys(manifest?.grammar, "cid", "grammar");
  try { assertPlatforms(manifest?.image?.platforms); } catch (error) { out.push(`image.platforms: ${error.message}`); }
  return out;
}

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
  // An address binds bytes only where the bytes stand: every blob the seed names hashes to the name it rests under.
  for (const [id, blob] of Object.entries(JSON.parse(bytes.toString("utf8")).blobs ?? {})) {
    let held;
    try { held = readFileSync(resolve(genesisDir, "cas", String(blob.sha256))); }
    catch { throw new Error(`[release-manifest] genesis CAS holds no blob for ${id} (${blob.sha256})`); }
    if (createHash("sha256").update(held).digest("hex") !== blob.sha256) throw new Error(`[release-manifest] genesis CAS blob ${id} does not hash to its address ${blob.sha256}`);
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
  const named = [...new Set(platforms)].sort();
  assertPlatforms(named);
  const cids = readGenesisCids(genesisDir);
  return {
    format: "lararium-release-manifest/v1",
    image: { digest, platforms: named },
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
  const differences = shapeDifferences(manifest);
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

// Runs INSIDE the image: reads the three CIDs and proves every CAS blob the seed names hashes to its address.
const imageReadScript = `import('/app/packages/lararium-node/dist/src/index.js').then(async n => { const {readFileSync}=await import('node:fs'); const {createHash}=await import('node:crypto'); const dir='/app/genesis'; const bytes=readFileSync(dir+'/seed.json'); if (!n.readGenesisCasManifest(dir)) throw new Error('image genesis seed or CAS manifest unreadable'); for (const [id,b] of Object.entries(JSON.parse(bytes.toString('utf8')).blobs||{})) { if (createHash('sha256').update(readFileSync(dir+'/cas/'+b.sha256)).digest('hex')!==b.sha256) throw new Error('image CAS blob '+id+' does not hash to its address'); } console.log(JSON.stringify({ seedCid:n.genesisSeedCid(bytes), engineCid:n.readGenesisEngineCid(dir), grammarCid:n.readGenesisGrammarCid(dir) })); }).catch(e => { console.error(e.message); process.exitCode=1; });`;

/** Read the three genesis CIDs carried by an image. `exec` receives argv and returns {status,stdout,stderr}. */
export async function readImage({ image, platform, exec = defaultExec }) {
  digestOfImage(image);
  if (platform !== undefined) assertPlatforms([platform]);
  const result = await exec("docker", ["run", "--rm", ...(platform ? ["--platform", platform] : []), "--entrypoint", "node", image, "-e", imageReadScript]);
  if (result.status !== 0) throw new Error(`[release-manifest] image read failed: ${result.stderr || result.stdout}`);
  let cids;
  try { cids = JSON.parse(result.stdout); } catch { throw new Error("[release-manifest] image did not return a JSON CID record"); }
  assertCids(cids, "image");
  return cids;
}

/**
 * Check a record against the image itself. A multi-arch index holds one image per platform and each carries its
 * own genesis bytes; the record binds them all, so every platform the record names gets read, and a difference
 * names its platform.
 */
export async function verifyAgainstImage(manifest, { image, exec = defaultExec }) {
  const differences = shapeDifferences(manifest);
  if (differences.length > 0) return { ok: false, differences };
  for (const platform of manifest.image.platforms) {
    let imageCids;
    try { imageCids = await readImage({ image, platform, exec }); }
    catch (error) { differences.push(`${platform}: ${error.message}`); continue; }
    for (const d of verifyReleaseManifest(manifest, { image, imageCids }).differences) differences.push(`${platform}: ${d}`);
  }
  return { ok: differences.length === 0, differences };
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
    if (!arg.startsWith("--")) throw new Error(`[release-manifest] unexpected argument: ${arg}`);
    const value = rest[++i];
    if (value === undefined || value.startsWith("--")) throw new Error(`[release-manifest] ${arg} requires a value`);
    if (arg === "--platform") (options.platforms ??= []).push(value);
    else options[arg.slice(2)] = value;
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
    let checked;
    if (options["from-image"]) {
      result = await verifyAgainstImage(manifest, { image: options["from-image"] });
      checked = `the image carries the record's genesis, engine and grammar on ${manifest?.image?.platforms?.join(", ")}`;
    } else {
      result = verifyReleaseManifest(manifest, { genesisDir: options.genesis ?? resolve(ROOT, "genesis"), image: options.image });
      checked = options.image ? "the record matches the genesis directory and the image digest given" : "the record matches the genesis directory; NO image got read (pass --from-image <ref> to check the image itself)";
    }
    if (!result.ok) {
      for (const difference of result.differences) console.error(difference);
      process.exitCode = 1;
    } else process.stdout.write(`release manifest verified: ${checked}\n`);
    return;
  }
  throw new Error("usage: release-manifest.mjs emit --image <digest-ref> [--genesis <dir>] [--platform <os/arch>]... [--out <file>] | verify --manifest <file> [--genesis <dir>] [--image <ref>] [--from-image <ref>] | read-image --image <ref>");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
