/**
 * browser-vessel — a REAL browser vessel in the mesh, standing at the floor with a veiled persona.
 *
 * ── WHY A REAL ENGINE, AND WHY localhost ────────────────────────────────────────────────────────
 * A browser vessel mints its identity through `crypto.subtle`, which a browser withholds off a
 * SECURE CONTEXT. Node never grants one: it defines no `isSecureContext`, so a Node probe reads
 * `undefined` and the gate refuses — the localhost exemption is a browser behaviour, and only a
 * browser has it. Measured: Chromium at `http://localhost` reads `isSecureContext=true`, holds
 * `crypto.subtle`, and mints Ed25519.
 *
 * So this probe serves the web surface from 127.0.0.1 and drives Chromium at it. In the mesh the container
 * shares its operator's network namespace, which is what makes `localhost` name the operator's own
 * vessel — no certificate, and no stub standing where the wall is.
 *
 * ── THE ISLAND SPEAKS THE LAWS ──────────────────────────────────────────────────────────────────
 * The floor reading proves the ORIGIN can mint. It proves nothing about the vessel that boots on it,
 * and the meme laws live inside that vessel — `$tw.lares.meme`, the in-VM face — in a TW5 that runs
 * off the main thread. The page holds no handle to it: `openBrowserVessel` returns into a closure and
 * publishes nothing on `window`, and the islands are module Web Workers reached over a MessagePort the
 * page never exposes. `page.evaluate` therefore cannot reach the face.
 *
 * The door is the worker's OWN global scope. The host bridge leaves the sovereign `$tw` on
 * `globalThis` inside the island (`tw5-host-bridge`: "startup modules read `$tw.wiki` via
 * globalThis.$tw"), and Playwright hands every dedicated worker a `Worker.evaluate` that runs in
 * exactly that scope. So the second reading walks `page.workers()`, finds the island whose `$tw`
 * publishes the face, and calls the laws THERE — place · read · check · project — in Chromium's
 * worker, over the vessel's live wiki. Nothing is stubbed: the meme lands in a real island's records.
 *
 * ── WHAT STAYS UNWALKED, NAMED ──────────────────────────────────────────────────────────────────
 * The localhost exemption is not TLS. A household reaching a vessel from another device crosses a
 * real origin and needs a real certificate — the DNS-01 path. This probe proves the browser half of
 * the ceremony; it proves nothing about a browser that is not co-located.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/founding-runbook
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { chromium, type Browser, type Page, type Worker } from "playwright";

const WEB_DIR   = process.env["LAR_WEB_DIR"]  ?? resolve("packages/lararium-web/dist");
const WEB_PORT  = Number.parseInt(process.env["LAR_WEB_PORT"] ?? "5173", 10);
/** The operator's vessel this browser belongs to — reached over the shared namespace. */
const VESSEL_WS = process.env["LAR_VESSEL_WS"] ?? "ws://localhost:8080/ws";
const LABEL     = process.env["LAR_BROWSER_LABEL"] ?? "browser";
/** How long the island may take to boot and publish the face — genesis fetch + TW5 boot, in a cold container. */
const FACE_BOOT_MS = Number.parseInt(process.env["LAR_FACE_BOOT_MS"] ?? "180000", 10);

/** The witness meme the island places — the same carrier the two-vessel witness carries between hearths. */
const WITNESS_PATH = "t.witness.browser/inventory";
const WITNESS_URI  = `lar:///${WITNESS_PATH}`;
const WITNESS_BAG  = "backpack: rope, lantern";
const WITNESS_MEME =
  `<<^ code="&#x0001;" from=? -> to=${WITNESS_URI}>>\n\`\`\`toml meta\nuri-path = "${WITNESS_PATH}"\nbag = "${WITNESS_BAG}"\n\`\`\`\n\n` +
  `<<^ code="&#x0002;">>\n\n<<~ ahu #/a>>\n\n! a\n\n<<~/ahu>>\n\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to=?>>\n`;

const MIME: Record<string, string> = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm",
  ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon",
};

/** Serve the built web surface on the loopback — the ORIGIN is the whole point, so it never binds outward. */
function serveWeb(): Promise<() => void> {
  const handler = (q: IncomingMessage, s: ServerResponse): void => {
    const rel = (q.url ?? "/").split("?")[0]!;
    const file = rel === "/" || rel === "" ? "index.html" : rel.replace(/^\//, "");
    const path = join(WEB_DIR, file);
    // A single-page web surface answers its own routes; anything unfound falls back to the shell.
    const served = existsSync(path) && !path.endsWith("/") ? path : join(WEB_DIR, "index.html");
    try {
      s.writeHead(200, { "content-type": MIME[extname(served)] ?? "application/octet-stream" });
      s.end(readFileSync(served));
    } catch {
      s.writeHead(404); s.end("not found");
    }
  };
  const srv = createServer(handler);
  // Close the OPEN connections too: the island keeps the page's keep-alive sockets warm, and `close()`
  // alone waits on them — a probe that had already printed its verdict then never exited.
  return new Promise((ok) => srv.listen(WEB_PORT, "127.0.0.1", () => ok(() => { srv.closeAllConnections(); srv.close(); })));
}

interface Reading {
  readonly secureContext: boolean;
  readonly subtle: boolean;
  readonly ed25519: string;
  /**
   * The minted vessel's PUBLIC verifying key, hex — the value a `device-admit` needs.
   *
   * A browser vessel that mints and cannot say WHAT it minted leaves the admit unwalkable: the
   * operator's node has nothing to name. Public material by construction, and the private half never
   * leaves the page.
   */
  readonly verifyingKey: string;
  readonly origin: string;
}

/** What the page reports about its own ability to hold a key. The gate reads exactly these. */
async function readContext(page: Page): Promise<Reading> {
  return await page.evaluate(async () => {
    let ed25519 = "absent";
    let verifyingKey = "";
    try {
      const k = await crypto.subtle.generateKey({ name: "Ed25519" } as EcKeyGenParams, true, ["sign", "verify"]);
      ed25519 = ((await crypto.subtle.exportKey("jwk", k.publicKey)) as JsonWebKey).crv ?? "unnamed";
      // THE RAW PUBLIC HALF, so the operator's node can name this vessel in an admit. `raw` is the
      // 32 Ed25519 bytes; the private half stays in the page and is never exported.
      const raw = new Uint8Array(await crypto.subtle.exportKey("raw", k.publicKey));
      verifyingKey = Array.from(raw, (b) => b.toString(16).padStart(2, "0")).join("");
    } catch (e) { ed25519 = `refused: ${(e as Error).message}`; }
    return {
      secureContext: globalThis.isSecureContext === true,
      subtle: typeof globalThis.crypto?.subtle === "object",
      ed25519,
      verifyingKey,
      origin: location.origin,
    };
  });
}

/** What one island answered when the laws were called inside it. Every field is the face's own word. */
interface FaceReading {
  /** The worker script that held the face — names WHICH island answered (daemon or wiki). */
  readonly worker: string;
  readonly placeDecision: string;
  readonly placeHash: string;
  readonly landed: number;
  readonly readHash: string;
  /** Whether `read` hands the author's `bag` line back byte-whole. */
  readonly bagWhole: boolean;
  readonly checkVerdict: string;
  readonly projectTo: string;
  readonly projectContentType: string;
  /** Whether the md projection rendered a pair — non-empty text AND its `.md.meta` sidecar. */
  readonly projected: boolean;
  /** The opening of the rendered md, printed as evidence. */
  readonly projectHead: string;
  readonly error?: string;
}

/** Whether this worker's global scope publishes the face. A worker still booting answers false. */
async function holdsFace(w: Worker): Promise<boolean> {
  try {
    return await w.evaluate(() => {
      const tw = (globalThis as { $tw?: { lares?: { meme?: { place?: unknown } } } }).$tw;
      return typeof tw?.lares?.meme?.place === "function";
    });
  } catch { return false; }
}

/** Wait for an island to publish the face, then call the laws inside it. Null when none stood in budget. */
async function readFace(page: Page): Promise<FaceReading | null> {
  const deadline = Date.now() + FACE_BOOT_MS;
  let island: Worker | undefined;
  while (!island && Date.now() < deadline) {
    for (const w of page.workers()) { if (await holdsFace(w)) { island = w; break; } }
    if (!island) await new Promise((r) => setTimeout(r, 1000));
  }
  if (!island) return null;
  const worker = island.url().split("/").pop() ?? island.url();
  try {
    const r = await island.evaluate(async ({ uri, text, bagValue }) => {
      type Face = {
        place(uri: string, text: string, base?: string | null): Promise<{ decision: string; canonicalHash?: string; landed: readonly string[]; reason?: string; diagnostics: readonly { message?: string }[] }>;
        read(uri: string): Promise<{ text: string; canonicalHash: string } | null>;
        check(text: string): { check: { verdict?: string } | string | boolean };
        project(uri: string, to: string): { to: string; text: string; contentType: string; meta?: string };
      };
      const face = (globalThis as unknown as { $tw: { lares: { meme: Face } } }).$tw.lares.meme;
      const placed = await face.place(uri, text);
      const read   = await face.read(uri);
      const check  = face.check(read?.text ?? text).check;
      const proj   = face.project(uri, "md");
      return {
        placeDecision: placed.decision + (placed.reason ? ` (${placed.reason})` : ""),
        placeHash: placed.canonicalHash ?? "",
        landed: placed.landed.length,
        readHash: read?.canonicalHash ?? "",
        // The canonical render ALIGNS the key column (`bag      = "…"`); the VALUE is what reads back whole.
        bagWhole: new RegExp(`^bag\\s+= "${bagValue}"$`, "m").test(read?.text ?? ""),
        checkVerdict: typeof check === "object" && check !== null ? JSON.stringify(check) : String(check),
        projectTo: proj.to,
        projectContentType: proj.contentType,
        projected: proj.text.trim().length > 0 && typeof proj.meta === "string",
        projectHead: proj.text.replace(/\s+/g, " ").slice(0, 100),
      };
    }, { uri: WITNESS_URI, text: WITNESS_MEME, bagValue: WITNESS_BAG });
    return { worker, ...r };
  } catch (e) {
    return {
      worker, placeDecision: "", placeHash: "", landed: 0, readHash: "", bagWhole: false,
      checkVerdict: "", projectTo: "", projectContentType: "", projected: false, projectHead: "",
      error: (e as Error).message,
    };
  }
}

async function main(): Promise<number> {
  if (!existsSync(join(WEB_DIR, "index.html"))) {
    console.error(`[browser-vessel] no web artifact at ${WEB_DIR} — run \`pnpm --filter @lararium/web build\``);
    return 2;
  }
  const stop = await serveWeb();
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({ args: ["--no-sandbox"] });   // container: no user namespace
    const page = await browser.newPage();
    page.on("pageerror", (e) => console.error(`[browser-vessel] page: ${e.message}`));
    await page.goto(`http://localhost:${WEB_PORT}/`, { waitUntil: "domcontentloaded" });

    const r = await readContext(page);
    console.log(`[browser-vessel:${LABEL}] origin ${r.origin}`);
    console.log(`[browser-vessel:${LABEL}] secure-context=${r.secureContext} subtle=${r.subtle} ed25519=${r.ed25519}`);
    console.log(`[browser-vessel:${LABEL}] operator vessel: ${VESSEL_WS}`);

    // THE FLOOR IS THE POINT. A browser vessel that cannot mint holds no veiled persona and can never
    // be admitted into anyone's PersonaGroup, so this refuses here rather than failing later wearing
    // some other name.
    if (!r.secureContext || !r.subtle || !r.ed25519.startsWith("Ed25519")) {
      console.error(`[browser-vessel:${LABEL}] REFUSED at the floor — this origin cannot mint an identity.`);
      return 1;
    }
    // THE KEY THE ADMIT NAMES. Printed on its own line so a harness can lift it without parsing prose.
    console.log(`[browser-vessel:${LABEL}] verifying-key ${r.verifyingKey}`);
    console.log(`[browser-vessel:${LABEL}] stands at the floor, veiled — ready for a PersonaGroup admit.`);

    // THE SECOND READING: the island that booted on this origin speaks the meme laws, in its own worker.
    // Each field is printed as the face answered it, so a harness reads the verdict AND its evidence.
    const f = await readFace(page);
    if (!f) {
      console.error(`[browser-vessel:${LABEL}] meme-face REFUSED — no island published $tw.lares.meme within ${FACE_BOOT_MS}ms (workers: ${page.workers().map((w) => w.url().split("/").pop()).join(",") || "none"})`);
      return 3;
    }
    if (f.error) {
      console.error(`[browser-vessel:${LABEL}] meme-face REFUSED in ${f.worker} — ${f.error}`);
      return 3;
    }
    console.log(`[browser-vessel:${LABEL}] meme-face worker=${f.worker} place=${f.placeDecision} landed=${f.landed} hash=${f.placeHash}`);
    console.log(`[browser-vessel:${LABEL}] meme-face read=${f.readHash} bag-whole=${f.bagWhole} check=${f.checkVerdict}`);
    console.log(`[browser-vessel:${LABEL}] meme-face project=${f.projectTo}/${f.projectContentType} pair=${f.projected} head=${JSON.stringify(f.projectHead)}`);
    const spoke = f.placeDecision.startsWith("ingest") && f.landed > 0 && f.placeHash.length > 0
      && f.readHash === f.placeHash && f.bagWhole && f.projectTo === "md" && f.projected;
    if (!spoke) {
      console.error(`[browser-vessel:${LABEL}] meme-face REFUSED — the island answered, and the laws did not hold (see the lines above).`);
      return 3;
    }
    console.log(`[browser-vessel:${LABEL}] the island speaks the laws — place · read · check · project, inside Chromium's worker.`);
    return 0;
  } finally {
    // A live island holds a WASM worker and a repo; closing the engine under it can outlast the verdict
    // already printed. The verdict is what a harness reads, so the close is BUDGETED, never awaited open.
    await Promise.race([browser?.close(), new Promise((r) => setTimeout(r, 15_000))]);
    stop();
  }
}

main().then((c) => process.exit(c)).catch((e) => { console.error(e); process.exit(1); });
