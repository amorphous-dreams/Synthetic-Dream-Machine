import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { buildReleaseManifest as build, canonicalJson, verifyReleaseManifest, verifyAgainstImage, readImage } from "./release-manifest.mjs";

// Every record names its platforms; the tests name one unless a test says otherwise.
const buildReleaseManifest = (opts) => build({ platforms: ["linux/amd64"], ...opts });

const genesis = new URL("../genesis/", import.meta.url).pathname;
const node = await import(pathToFileURL(new URL("../packages/lararium-node/dist/src/index.js", import.meta.url).pathname).href);
const image = "registry.example.test/lares@sha256:" + "a".repeat(64);

test("CONTROL: the manifest seed address is the hash of the exact published bytes", () => {
  const bytes = readFileSync(new URL("../genesis/seed.json", import.meta.url));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), buildReleaseManifest({ image, genesisDir: genesis }).genesis.seedCid);
});

test("emit reads the repository seed, engine and grammar CIDs", () => {
  const manifest = buildReleaseManifest({ image, genesisDir: genesis, platforms: ["linux/arm64", "linux/amd64"] });
  assert.equal(manifest.genesis.seedCid, node.genesisSeedCid(readFileSync(new URL("../genesis/seed.json", import.meta.url))));
  assert.equal(manifest.engine.cid, node.readGenesisEngineCid(genesis));
  assert.equal(manifest.grammar.cid, node.readGenesisGrammarCid(genesis));
  // The engine CID names the hearth: the same address the genesis seed spells and the vessel reads at founding.
  assert.match(manifest.engine.cid, /^b[a-z2-7]{58}$/);
  assert.ok(readFileSync(new URL("../genesis/seed.json", import.meta.url), "utf8").includes(manifest.engine.cid));
  assert.deepEqual(manifest.image.platforms, ["linux/amd64", "linux/arm64"]);
});

test("canonical output is byte-identical for equal inputs", () => {
  const a = canonicalJson(buildReleaseManifest({ image, genesisDir: genesis }));
  const b = canonicalJson(buildReleaseManifest({ image, genesisDir: genesis }));
  assert.equal(a, b);
  assert.equal(a.endsWith("\n"), true);
});

test("a bare image tag refuses by name", () => {
  assert.throws(() => buildReleaseManifest({ image: "lares:stable", genesisDir: genesis }), /image.*digest/i);
});

test("a genesis directory without a readable seed refuses by name", () => {
  const dir = mkdtempSync(join(tmpdir(), "release-manifest-empty-genesis-"));
  try { assert.throws(() => buildReleaseManifest({ image, genesisDir: dir }), /genesis directory.*readable seed/i); }
  finally { rmSync(dir, { recursive: true, force: true }); }
});

test("each tampered content address fails verification and names its field", () => {
  const original = buildReleaseManifest({ image, genesisDir: genesis });
  for (const field of ["seedCid", "engine", "grammar"]) {
    const manifest = structuredClone(original);
    if (field === "seedCid") manifest.genesis.seedCid = flip(manifest.genesis.seedCid);
    else manifest[field].cid = flip(manifest[field].cid);
    const result = verifyReleaseManifest(manifest, { genesisDir: genesis });
    assert.equal(result.ok, false);
    assert.match(result.differences.join("\n"), new RegExp(field === "seedCid" ? "genesis.seedCid" : `${field}\\.cid`));
  }
});

test("CONTROL: the untouched manifest verifies", () => {
  const manifest = buildReleaseManifest({ image, genesisDir: genesis });
  assert.deepEqual(verifyReleaseManifest(manifest, { genesisDir: genesis }), { ok: true, differences: [] });
});

test("an explicitly supplied image digest is compared", () => {
  const manifest = buildReleaseManifest({ image, genesisDir: genesis });
  const result = verifyReleaseManifest(manifest, { genesisDir: genesis, image: "registry.example.test/lares@sha256:" + "b".repeat(64) });
  assert.equal(result.ok, false);
  assert.match(result.differences.join("\n"), /image\.digest: manifest=sha256:a+ expected=sha256:b+/);
});

test("read-image parses the image CIDs through an injected exec", async () => {
  let argv;
  const expected = { seedCid: "a".repeat(64), engineCid: "b" + "a".repeat(58), grammarCid: "b" + "c".repeat(58) };
  const got = await readImage({ image, exec: async (command, args) => { argv = [command, ...args]; return { status: 0, stdout: JSON.stringify(expected), stderr: "" }; } });
  assert.deepEqual(got, expected);
  assert.ok(argv.includes("docker"));
  assert.ok(argv.includes(image));
  assert.ok(argv.at(-1).includes("/app/packages/lararium-node/dist/src/index.js"));
  assert.ok(argv.at(-1).includes("/app/genesis"));
});

test("an image that answers a malformed address refuses by name", async () => {
  const bad = { seedCid: "a".repeat(64), engineCid: "not-a-cid", grammarCid: "b" + "c".repeat(58) };
  await assert.rejects(readImage({ image, exec: async () => ({ status: 0, stdout: JSON.stringify(bad), stderr: "" }) }), /image engineCid is no content address/);
});

test("a manifest whose address leaves the alphabet fails verification", () => {
  const manifest = buildReleaseManifest({ image, genesisDir: genesis });
  manifest.grammar.cid = manifest.grammar.cid.slice(0, -1) + "!";
  const result = verifyReleaseManifest(manifest, { genesisDir: genesis });
  assert.equal(result.ok, false);
  assert.match(result.differences.join("\n"), /grammar\.cid/);
});

// Move the LAST character within the address alphabet both spellings share, so the form stays valid and the value moves.
function flip(value) { return value.slice(0, -1) + (value.at(-1) === "a" ? "b" : "a"); }

test("a release that names no platform refuses, and a platform that reads as no os/arch pair refuses", () => {
  assert.throws(() => build({ image, genesisDir: genesis, platforms: [] }), /at least one platform/);
  assert.throws(() => build({ image, genesisDir: genesis, platforms: ["amd64"] }), /no os\/arch pair/);
});

test("the record holds exactly its fields: a missing one and an extra one both fail verification", () => {
  const missing = buildReleaseManifest({ image, genesisDir: genesis });
  delete missing.image.platforms;
  assert.match(verifyReleaseManifest(missing, { genesisDir: genesis }).differences.join("\n"), /image: fields=digest expected=digest,platforms/);
  const extra = { ...buildReleaseManifest({ image, genesisDir: genesis }), builtBy: "someone" };
  assert.match(verifyReleaseManifest(extra, { genesisDir: genesis }).differences.join("\n"), /record: fields=builtBy,engine/);
});

test("a genesis CAS blob that does not hash to its address refuses: an address binds bytes only where the bytes stand", () => {
  const dir = mkdtempSync(join(tmpdir(), "release-manifest-cas-"));
  try {
    cpSync(genesis, dir, { recursive: true });
    const blob = join(dir, "cas", readdirSync(join(dir, "cas"))[0]);
    writeFileSync(blob, Buffer.concat([readFileSync(blob), Buffer.from("x")]));
    assert.throws(() => buildReleaseManifest({ image, genesisDir: dir }), /does not hash to its address/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("verifying against the image reads EVERY platform the record names, and a difference names its platform", async () => {
  const manifest = buildReleaseManifest({ image, genesisDir: genesis, platforms: ["linux/amd64", "linux/arm64"] });
  const good = { seedCid: manifest.genesis.seedCid, engineCid: manifest.engine.cid, grammarCid: manifest.grammar.cid };
  const asked = [];
  const exec = (drift) => async (_command, args) => {
    const platform = args[args.indexOf("--platform") + 1];
    asked.push(platform);
    return { status: 0, stdout: JSON.stringify(platform === drift ? { ...good, grammarCid: "b" + "c".repeat(58) } : good), stderr: "" };
  };
  assert.deepEqual(await verifyAgainstImage(manifest, { image, exec: exec(null) }), { ok: true, differences: [] });
  assert.deepEqual(asked, ["linux/amd64", "linux/arm64"]);
  const drifted = await verifyAgainstImage(manifest, { image, exec: exec("linux/arm64") });
  assert.equal(drifted.ok, false);
  assert.match(drifted.differences.join("\n"), /^linux\/arm64: grammar\.cid:/m);
  assert.doesNotMatch(drifted.differences.join("\n"), /linux\/amd64/);
});

test("verifying against an image whose digest differs from the record's fails", async () => {
  const manifest = buildReleaseManifest({ image, genesisDir: genesis });
  const good = { seedCid: manifest.genesis.seedCid, engineCid: manifest.engine.cid, grammarCid: manifest.grammar.cid };
  const other = "registry.example.test/lares@sha256:" + "b".repeat(64);
  const r = await verifyAgainstImage(manifest, { image: other, exec: async () => ({ status: 0, stdout: JSON.stringify(good), stderr: "" }) });
  assert.equal(r.ok, false);
  assert.match(r.differences.join("\n"), /image\.digest/);
});
