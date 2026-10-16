/**
 * reach-face-watch — the boot notice, the once-per-boot mismatch line, and the forged-header law.
 *
 * Law: lar:///ha.ka.ba/lararium/mesh/secure-context (#/behind-the-terminator).
 *
 * Proven:
 *   · NO SETTING EARNS A LOUD NOTICE: an absent or blank setting yields one line that names the setting and the
 *     loopback address printed in its place; a setting that names a loopback host, and one that names no http
 *     origin, each yield a line of their own; CONTROL: a sound setting yields none;
 *   · A MISMATCH LOGS ONCE: the first request under another host yields one line naming both hosts, and no
 *     later request yields another, whatever host it names; CONTROL: a request under the declared host, in any
 *     letter case and with or without its default port, yields none and spends nothing;
 *   · a loopback host stays silent and spends nothing: the vessel's own published face reads as no mismatch;
 *   · where no setting stands the watch stays silent: the boot notice already spoke;
 *   · seated on a live server, the watch hands the log one line for the first forged request and for no
 *     other, answers nothing itself, and leaves when unseated;
 *   · NOTHING A REQUEST SAYS NAMES THE VESSEL: a forged `Host`, `X-Forwarded-Host`, `X-Forwarded-Proto` and
 *     `Forwarded` change no byte of any answer the public faces give (the arrival page, the descriptor, the
 *     readiness answer, the closed door), and change no URL the vessel derives about itself (the reach faces,
 *     the relay address, the crossing banner, the address an admit carries);
 *   · no node source file reads a host header, a forwarded header or the raw header list by any of the spellings
 *     the weld knows (a property read, a destructured read, the header's own name), each with a planted positive.
 *     A read assembled from parts passes it; a review reads those.
 */
import { createHash } from "node:crypto";
import { createServer, request as httpRequest, type Server } from "node:http";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { declaredAuthority, makeReachFaceWatch, mountReachFaceWatch, reachFaceBootNotice, REACH_FACE_SETTING } from "../src/reach-face-watch.js";
import { crossingBannerLines, deriveReachFaces, originCompositionForFace, wsUrlForOrigin } from "../src/lan-address.js";
import { deviceAdmitSyncUrl } from "../src/commands/device-admit.js";
import { mountHttpFaceDispatcher } from "../src/http-face-dispatcher.js";
import { createReadinessState, mountReadinessFace } from "../src/readiness-face.js";
import { composePronaosFromEnv } from "../src/pronaos-composition.js";

const DECLARED = "https://hearth.house.example";
const FORGED = {
  host: "stranger.example",
  "x-forwarded-host": "stranger.example",
  "x-forwarded-proto": "http",
  "x-forwarded-port": "81",
  forwarded: "for=203.0.113.9;host=stranger.example;proto=http",
} as const;

describe("the boot notice", () => {
  test("★ no setting earns one loud line that names the setting and the loopback address printed in its place ★", () => {
    for (const absent of [undefined, null, "", "   "]) {
      const line = reachFaceBootNotice(absent, "http://localhost:4321");
      expect(line, String(absent)).toContain(REACH_FACE_SETTING);
      expect(line, String(absent)).toContain("http://localhost:4321");
      expect(line!.split("\n")).toHaveLength(1);
    }
    // CONTROL: a sound setting stays quiet.
    expect(reachFaceBootNotice(DECLARED, "http://localhost:4321")).toBeNull();
    expect(reachFaceBootNotice("http://192.168.1.20:4321/", "http://localhost:4321")).toBeNull();
  });

  test("a setting that names a loopback host earns a line of its own: the same gap, a setting's wording", () => {
    for (const loopback of ["http://localhost:4321", "http://127.0.0.1:4321/", "http://[::1]:4321", "https://vessel.localhost"]) {
      const line = reachFaceBootNotice(loopback, "http://localhost:4321");
      expect(line, loopback).toContain("NAMES LOOPBACK");
      expect(line, loopback).toContain(REACH_FACE_SETTING);
      expect(line!.split("\n")).toHaveLength(1);
    }
    expect(reachFaceBootNotice("http://192.168.1.20:4321", "http://localhost:4321")).toBeNull();   // CONTROL: a LAN name stays quiet
    expect(reachFaceBootNotice("https://localhost.house.example", "http://localhost:4321")).toBeNull();
  });

  test("a setting that names no http origin earns a line of its own, and never the absent-setting line", () => {
    for (const unsound of ["hearth.house.example", "ftp://hearth.house.example", "not a url",
      "https://hearth.house.example/path", "https://hearth.house.example/?q=1", "https://hearth.house.example/#x", "https://name:word@hearth.house.example"]) {
      const line = reachFaceBootNotice(unsound, "http://localhost:4321");
      expect(line, unsound).toContain(JSON.stringify(unsound));
      expect(line, unsound).not.toContain("http://localhost:4321");
      expect(declaredAuthority(unsound), unsound).toBeNull();
    }
    expect(declaredAuthority(DECLARED)).toBe("hearth.house.example");
    expect(declaredAuthority("HTTP://Hearth.House.Example:80/")).toBe("hearth.house.example");
    expect(declaredAuthority("http://hearth.house.example:4321")).toBe("hearth.house.example:4321");
  });
});

describe("the mismatch line", () => {
  test("★ the first request under another host logs once, and no later request logs again ★", () => {
    const watch = makeReachFaceWatch(DECLARED);
    expect(watch.observe({ host: "hearth.house.example" })).toBeNull();
    const line = watch.observe({ host: "Stranger.Example" });
    expect(line).toContain(JSON.stringify("stranger.example"));
    expect(line).toContain(JSON.stringify("hearth.house.example"));
    expect(line).toContain(REACH_FACE_SETTING);
    expect(watch.observe({ host: "stranger.example" })).toBeNull();
    expect(watch.observe({ host: "another.example" })).toBeNull();
    expect(watch.observe({ host: "hearth.house.example" })).toBeNull();
  });

  test("CONTROL: the declared host matches in any letter case, with its default port or none, and spends nothing", () => {
    const watch = makeReachFaceWatch(DECLARED);
    for (const host of ["hearth.house.example", "HEARTH.house.Example", "hearth.house.example:443", "hearth.house.example."]) {
      expect(watch.observe({ host }), host).toBeNull();
    }
    // The line still stands unspent: a later mismatch speaks.
    expect(watch.observe({ host: "hearth.house.example:8443" })).not.toBeNull();
    // A port the setting names counts as part of the name.
    const ported = makeReachFaceWatch("http://192.168.1.20:4321");
    expect(ported.observe({ host: "192.168.1.20:4321" })).toBeNull();
    expect(ported.observe({ host: "192.168.1.20" })).not.toBeNull();
  });

  test("a loopback host, and a request with no host, stay silent and spend nothing", () => {
    const watch = makeReachFaceWatch(DECLARED);
    for (const host of ["localhost", "localhost:4321", "127.0.0.1:4321", "[::1]:4321", "vessel.localhost:4321", undefined, ""]) {
      expect(watch.observe({ host }), String(host)).toBeNull();
    }
    expect(watch.observe({ host: "192.168.1.20:4321" })).not.toBeNull();   // CONTROL: a LAN address under a named setting speaks
    // A name that only BEGINS like a loopback address names another machine, and speaks.
    expect(makeReachFaceWatch(DECLARED).observe({ host: "127.stranger.example" })).toContain(JSON.stringify("127.stranger.example"));
    expect(makeReachFaceWatch(DECLARED).observe({ host: "localhost.stranger.example" })).not.toBeNull();
    expect(makeReachFaceWatch(DECLARED).observe({ host: "127.999.999.999" })).not.toBeNull();
    expect(makeReachFaceWatch(DECLARED).observe({ host: "127.255.0.1:4321" })).toBeNull();
    expect(reachFaceBootNotice("https://127.stranger.example", "http://localhost:4321")).toBeNull();
  });

  test("a Host that carries more than a bare authority reads as written, never down to the declared name", () => {
    for (const host of ["stranger@hearth.house.example", "hearth.house.example/..", "hearth.house.example#x", "hearth.house.example?x", "stranger.example\\@hearth.house.example", "hearth.house.example:port"]) {
      expect(makeReachFaceWatch(DECLARED).observe({ host }), host).not.toBeNull();
    }
    // One line, whatever a request sends: no second line, no control character, a bounded length.
    const hostile = makeReachFaceWatch(DECLARED).observe({ host: `stranger.example\r\n[lararium] forged line \u001b[2J${"x".repeat(5000)}` })!;
    expect(hostile.split("\n")).toHaveLength(1);
    expect(hostile).not.toMatch(/[\r\u001b]/);
    expect(hostile.length).toBeLessThan(900);
    // An array-valued header reads by its first value; IPv6 and its default port read as one name.
    expect(makeReachFaceWatch(DECLARED).observe({ host: ["hearth.house.example", "stranger.example"] })).toBeNull();
    const six = makeReachFaceWatch("http://[2001:db8::1]:4321");
    expect(six.observe({ host: "[2001:DB8::1]:4321" })).toBeNull();
    expect(six.observe({ host: "[2001:db8::2]:4321" })).not.toBeNull();
  });

  test("a forwarded header never stands in for the host: the watch reads the request's own Host alone", () => {
    const watch = makeReachFaceWatch(DECLARED);
    expect(watch.observe({ host: "hearth.house.example", "x-forwarded-host": "stranger.example", forwarded: "host=stranger.example" })).toBeNull();
    const line = watch.observe({ host: "stranger.example", "x-forwarded-host": "hearth.house.example" });
    expect(line).toContain(JSON.stringify("stranger.example"));
  });

  test("where no setting stands, or it names no http origin, the watch stays silent", () => {
    for (const declared of [undefined, null, "", "hearth.house.example"]) {
      const watch = makeReachFaceWatch(declared);
      expect(watch.observe({ host: "stranger.example" }), String(declared)).toBeNull();
    }
  });
});

// ── NOTHING A REQUEST SAYS NAMES THE VESSEL ─────────────────────────────────────────────────────

const roots: string[] = [];
const servers: Server[] = [];
afterEach(async () => {
  for (const server of servers.splice(0)) {
    if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

/** A prepared arrival artifact and a genesis dir: what a lararium's public faces read. */
function arrival(): { env: Record<string, unknown>; genesis: string; cid: string } {
  const root = mkdtempSync(join(tmpdir(), "lararium-reach-face-")); roots.push(root);
  const web = join(root, "web"), genesis = join(root, "genesis");
  mkdirSync(join(web, "assets"), { recursive: true }); mkdirSync(join(genesis, "cas"), { recursive: true });
  const cas = Buffer.from("reach-face-cas");
  const cid = createHash("sha256").update(cas).digest("hex");
  writeFileSync(join(web, "index.html"), '<link rel="manifest" href="/manifest.webmanifest"><script type="module" src="/assets/wiki.worker-def.js"></script>');
  writeFileSync(join(web, "manifest.webmanifest"), '{"name":"Pronaos"}');
  writeFileSync(join(web, "assets/wiki.worker-def.js"), "self.postMessage('worker')");
  writeFileSync(join(genesis, "seed.json"), JSON.stringify({
    format: "lararium-genesis-seed/v1", actorSeed: "reach-face-actor",
    blobs: { fixture: { id: "fixture", version: "1", sha256: cid, mimeType: "application/octet-stream" } },
    tiddlers: {
      "lar:///ha.ka.ba/bags/oracle/genesis-cid-engine": { tiddler: { cid: "engine-region" } },
      "lar:///ha.ka.ba/bags/oracle/genesis-cid-grammar": { tiddler: { cid: "grammar-region" } },
      "lar:///ha.ka.ba/bags/oracle/genesis-cid-plugins": { tiddler: { cid: "plugins-region" } },
    },
  }));
  writeFileSync(join(genesis, "cas", cid), cas);
  const record = join(root, "artifact-record.json");
  writeFileSync(record, JSON.stringify({
    schema: "lararium-pronaos-artifact/v1",
    routes: ([
      ["/", "index.html", "text/html; charset=utf-8", "no-store"],
      ["/manifest.webmanifest", "manifest.webmanifest", "application/manifest+json", "no-store"],
      ["/assets/wiki.worker-def.js", "assets/wiki.worker-def.js", "application/javascript", "immutable"],
    ] as const).map(([path, file, contentType, cache]) => ({ path, file, contentType, cache,
      sha256: createHash("sha256").update(readFileSync(join(web, file))).digest("hex") })),
  }));
  const mirrors = join(root, "mirrors.json");
  writeFileSync(mirrors, JSON.stringify([{ cid, origin: "https://cas-one.mirror.example" }]));
  return { env: { LAR_PRONAOS_WEB_ROOT: web, LAR_PRONAOS_ARTIFACT_RECORD: record, LAR_PRONAOS_MIRRORS: mirrors }, genesis, cid };
}

/** One request with exactly the headers named: status, the headers that could carry a name, and the body. */
function ask(port: number, path: string, headers: Record<string, string>): Promise<{ status: number; named: Record<string, unknown>; body: string }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: "127.0.0.1", port, path, method: "GET", headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => resolve({
        status: res.statusCode ?? 0,
        named: { location: res.headers.location, link: res.headers.link, "content-location": res.headers["content-location"], "access-control-allow-origin": res.headers["access-control-allow-origin"] },
        body: Buffer.concat(chunks).toString("hex"),
      }));
    });
    req.on("error", reject);
    req.end();
  });
}

describe("nothing a request says names the vessel", () => {
  test("★ a forged Host and forged forwarded headers change no byte of any public answer ★", async () => {
    const a = arrival();
    const server = createServer(); servers.push(server);
    const dispatcher = mountHttpFaceDispatcher(server);
    const readiness = createReadinessState();
    mountReadinessFace({ httpServer: server, state: readiness, standing: "lararium", dispatcher });
    const pronaos = composePronaosFromEnv({ httpServer: server, genesisDir: a.genesis, dispatcher, standing: "lararium", env: a.env, houseOrigins: [DECLARED] });
    expect(pronaos).not.toBeNull();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("the fixture server did not bind");

    const logged: string[] = [];
    const unseat = mountReachFaceWatch({ httpServer: server, declaredUrl: DECLARED, log: (line) => logged.push(line) });
    const honest = { host: "hearth.house.example" };
    const paths = ["/", "/manifest.webmanifest", "/genesis/seed.json", `/genesis/cas/${a.cid}`, "/.well-known/lar", "/api/health", "/no-such-path"];
    let answered = 0;
    for (const path of paths) {
      const plain = await ask(address.port, path, honest);
      const forged = await ask(address.port, path, FORGED);
      expect(forged, path).toEqual(plain);
      // No answer echoes a name a request supplied.
      const text = Buffer.from(forged.body, "hex").toString("utf8") + JSON.stringify(forged.named);
      expect(text, path).not.toContain("stranger.example");
      if (plain.status === 200) answered += 1;
    }
    expect(answered).toBeGreaterThanOrEqual(5);   // CONTROL: the faces answered; the comparison read real bodies
    // The watch sat on that same server the whole time: seven forged requests, one line, and no answer of its own.
    expect(logged).toHaveLength(1);
    expect(logged[0]).toContain(JSON.stringify("stranger.example"));
    expect(server.listenerCount("request")).toBe(2);
    unseat();
    expect(server.listenerCount("request")).toBe(1);
    expect(server.listenerCount("upgrade")).toBe(1);
    pronaos?.dispose();
  });

  test("seated on a live server, a request under the declared host and a loopback probe log nothing; an upgrade under another host logs", async () => {
    const server = createServer((_req, res) => { res.writeHead(204); res.end(); }); servers.push(server);
    const upgrades: string[] = [];
    server.on("upgrade", (req, socket) => { upgrades.push(String(req.headers.host)); socket.destroy(); });
    const logged: string[] = [];
    mountReachFaceWatch({ httpServer: server, declaredUrl: DECLARED, log: (line) => logged.push(line) });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("the fixture server did not bind");
    expect((await ask(address.port, "/", { host: "hearth.house.example" })).status).toBe(204);
    expect((await ask(address.port, "/", { host: `127.0.0.1:${address.port}` })).status).toBe(204);
    expect(logged).toEqual([]);
    // A socket upgrade carries a Host too, and the watch reads it before the socket face answers.
    await new Promise<void>((resolve) => {
      const req = httpRequest({ host: "127.0.0.1", port: address.port, path: "/ws", headers: { host: "stranger.example", connection: "Upgrade", upgrade: "websocket" } });
      req.on("error", () => resolve());
      req.on("close", () => resolve());
      req.end();
    });
    expect(upgrades).toEqual(["stranger.example"]);
    expect(logged).toHaveLength(1);
  });

  test("a log that throws ends inside the observer: the request still draws its answer", async () => {
    const server = createServer((_req, res) => { res.writeHead(204); res.end(); }); servers.push(server);
    let asked = 0;
    mountReachFaceWatch({ httpServer: server, declaredUrl: DECLARED, log: () => { asked += 1; throw new Error("a synthetic log fault"); } });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("the fixture server did not bind");
    expect((await ask(address.port, "/", { host: "stranger.example" })).status).toBe(204);
    expect(asked).toBe(1);                                                    // CONTROL: the log got asked, and threw
    expect((await ask(address.port, "/", { host: "stranger.example" })).status).toBe(204);
  });

  test("★ every URL the vessel derives about itself reads the setting and its own interface table alone ★", () => {
    const interfaces = { eth0: [{ address: "192.168.1.20", family: "IPv4", internal: false }] };
    const derive = (declaredUrl: string | null) => {
      const faces = deriveReachFaces({ port: 4321, declaredUrl, interfaces });
      const entries = faces.map((face) => ({ face, composition: originCompositionForFace(face, { sameOrigin: true }, "lararium") }));
      return { faces, relays: faces.map((f) => wsUrlForOrigin(f.origin)), banner: crossingBannerLines("lararium", entries, null) };
    };
    const declared = derive(DECLARED);
    // The scheme travels with the setting: an https name carries wss, and no derivation takes a request.
    expect(declared.faces[0]).toEqual({ kind: "declared", host: "hearth.house.example", origin: DECLARED });
    expect(declared.relays[0]).toBe("wss://hearth.house.example/ws");
    expect(declared.banner.join("\n")).toContain("https://hearth.house.example");
    expect(declared.banner.join("\n")).not.toContain("stranger.example");
    // CONTROL: the setting does move them.
    expect(derive("https://other.house.example").relays[0]).toBe("wss://other.house.example/ws");
    expect(derive(null).faces[0]!.kind).toBe("loopback");

    // The address an admit carries reads the setting alone.
    const prior = process.env[REACH_FACE_SETTING];
    try {
      process.env[REACH_FACE_SETTING] = DECLARED;
      expect(deviceAdmitSyncUrl()).toBe("wss://hearth.house.example/ws");
      delete process.env[REACH_FACE_SETTING];
      expect(deviceAdmitSyncUrl()).toBeNull();
    } finally {
      if (prior === undefined) delete process.env[REACH_FACE_SETTING]; else process.env[REACH_FACE_SETTING] = prior;
    }
  });

  test("no node source reads a host header or a forwarded header, outside the watch", () => {
    const READS = new RegExp([
      String.raw`headers\s*(?:\.\s*host\b|\[\s*["'\x60](?:host|x-forwarded-[a-z]+|forwarded)["'\x60]\s*\])`,   // a property read
      String.raw`\{[^{}]*\bhost\b[^{}]*\}\s*=\s*[\w.]*headers\b`,                                              // a destructured read
      String.raw`\brawHeaders\b`,                                                                                // the raw list
      String.raw`\bx-forwarded-(?:host|proto|port|for)\b`,                                                       // the name itself, however reached
    ].join("|"), "i");
    const strip = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'\x60\\])\/\/[^\n]*/g, "$1");
    const src = new URL("../src/", import.meta.url).pathname;
    const files: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (name.endsWith(".ts")) files.push(path);
      }
    };
    walk(src);
    expect(files.length).toBeGreaterThan(150);
    const readers = files.filter((file) => READS.test(strip(readFileSync(file, "utf8")))).map((file) => file.slice(src.length));
    expect(readers).toEqual(["reach-face-watch.ts"]);
    // KNOWN POSITIVE: the scan reads each spelling, and a docblock that names one reads as none.
    for (const spelled of ["req.headers.host", "req.headers[\"host\"]", "req.headers['x-forwarded-proto']", "const h = \"X-Forwarded-Host\";", "request.headers[`forwarded`]",
      "const { host } = req.headers;", "const { accept, host: asked } = request.headers;", "for (const h of req.rawHeaders) use(h);"]) {
      expect(READS.test(strip(spelled)), spelled).toBe(true);
    }
    expect(READS.test(strip("/* req.headers.host */ const accept = req.headers.accept;"))).toBe(false);
    expect(READS.test(strip("const { accept } = req.headers; const host = url.host;"))).toBe(false);
  });
});
