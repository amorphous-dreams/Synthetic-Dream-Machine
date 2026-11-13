/**
 * browser-ward-tree — A BROWSER FACE'S WARD (seat-harness#/the-ward): the face root rests under a ward key of its own, never under
 * the keystore's tree key, and opens only fresh from the face's human route for one act.
 *
 * ── WHAT RESTS WHERE ─────────────────────────────────────────────────────────────────────────────
 * The keystore keeps, per face custody tree `<fcid>`, the ward tree at `ward/root/<fcid>/slots` (a keyslot tree over the face's human
 * routes: a passphrase or a paper sheet, never a passkey) and the root at `ward/root/<fcid>/persona-root`, sealed in the ward's own frame. The
 * sealed roster (`persona-root-roster`, under the keystore's tree key) names each held root by its face's tree and PUBLIC key, so a
 * possession check reads no seed, and `ward/root/<fcid>/public-key` carries the same public key beside the ward, so a ward act's signer
 * names its key while the page's custody stands locked (a signature under any other key refuses). No door of `browser-custody` reads, writes, moves or removes a ward row.
 *
 * ── ONE ACT, ONE UNLOCK ──────────────────────────────────────────────────────────────────────────
 * A ward act opens the ward key from the route typed for it, spends one of the page's ward attempts on a miss, opens the root,
 * and zeroes the key; nothing caches a route or a key between acts. A signing act runs in a per-act worker (`browser-ward.ts`).
 * An act whose mesh code derives from the seed (a handle's veiled key, the founding edge) opens it here, on the PAGE MAIN THREAD
 * (`lararium-web/index.html` loads `src/main.ts`, which calls `openBrowserVessel` itself), for that one act. That stands as the gap
 * road row `B1` owes: the browser vessel in its own worker, never the page. Founding also reuses the custody passphrase as the
 * ward route, and that route lives as a page-closure string until its one sign.
 *
 * ── THE FOUNDING ─────────────────────────────────────────────────────────────────────────────────
 * A root mints only under its ward: the mint binds a fresh ward key over the route the person gave for it, proves the route
 * reopens it, lands the tree, then the root, then the roster line. A torn mint resumes: a standing tree opens under the route and
 * a standing root is adopted. A route that opens nothing, or a passkey, writes nothing.
 */
import {
  bindWardSlot, commitWardTree, decodeSlotTree, encodeSlotTree, mintWardKey, nobleKdf, openWardKey, readWardCarrier,
  writeWardCarrier, WardRefused, type Credential, type SlotTree, type WardKey,
} from "@lararium/mesh";
import { browserKeystoreCustodyIo, BrowserCustodyRefused, readBrowserCustody, withCustodyRows } from "./browser-custody.js";
import { openWardedRoot, wardCredentialOf, wardPinOf, wardRootCarrier, wardRootRowsOf, wardRootTreeOf, type WardRoute } from "./ward-core.js";
import { faceOfVessel, openVesselIdb } from "./browser-vessel-identity.js";
import { faceTreeIdLive, faceTreeIdOf } from "./browser-face-custody.js";

/** The opaque tree id of the face this session wears, or null where it wears none or its tree does not stand. */
export async function wornFaceTreeOf(idbName: string): Promise<string | null> {
  const worn = faceOfVessel(idbName);
  return worn ? faceTreeIdOf(idbName, worn) : null;
}

export const PERSONA_ROSTER_ROW = "persona-root-roster";

/**
 * THE FOUNDING SWEEPS A WARD NO FACE CAN EVER ANSWER: a ward filed under a face tree that stands in no index entry and no seat on
 * this thread (a founding torn before its ceremony named the face, read after a reload; a clear torn partway) leaves with its
 * roster line. A ward whose tree stands live never sweeps: its rows may carry signed history, and its face resumes it.
 * The place tree must stand unlocked (the roster rests under it). Answers the face trees swept.
 */
export async function sweepOrphanBrowserWards(idbName: string): Promise<string[]> {
  const io = browserKeystoreCustodyIo(idbName);
  const orphaned: string[] = [];
  for (const r of await io.list()) {
    const tree = wardRootTreeOf(r);
    if (tree === null || orphaned.includes(tree)) continue;
    if (!(await faceTreeIdLive(idbName, tree))) orphaned.push(tree);
  }
  if (orphaned.length === 0) return [];
  await withCustodyRows(idbName, async (rows) => {
    const roster = await readBrowserPersonaRoster(rows.read);
    if (roster.some((l) => orphaned.includes(l.tree))) await rows.write(PERSONA_ROSTER_ROW, { roots: roster.filter((l) => !orphaned.includes(l.tree)) });
    for (const r of await io.list()) { const tree = wardRootTreeOf(r); if (tree !== null && orphaned.includes(tree)) await io.remove(r); }
  });
  return orphaned;
}

/** One roster line: the custody tree of the face a held root belongs to, and the root's public key. */
export interface PersonaRosterLine { readonly tree: string; readonly verifyingKey: string }

/** The ward acts a page may miss before it refuses every one until it reloads: the node holder's own bound, per keystore. */
export const WARD_ATTEMPTS_PER_PAGE = 3;
const spent = new Map<string, number>();

/** Charge one attempt before the route derives; an act that opens earns it back. A throw keeps the charge. */
export async function chargeWardAttempt<T>(idbName: string, act: () => Promise<T>): Promise<T> {
  if ((spent.get(idbName) ?? 0) >= WARD_ATTEMPTS_PER_PAGE) throw new WardRefused("ward-attempts-spent", "this page's ward attempts are spent until it reloads");
  spent.set(idbName, (spent.get(idbName) ?? 0) + 1);
  const out = await act();
  spent.set(idbName, (spent.get(idbName) ?? 1) - 1);
  return out;
}

/** A face's ward rows as raw bytes (they open nothing). A face with no ward tree or no warded root refuses `ward-absent`. */
export async function readBrowserWardRows(idbName: string, faceTree: string): Promise<{ readonly tree: Uint8Array; readonly sealedRoot: Uint8Array }> {
  const io = browserKeystoreCustodyIo(idbName);
  const at = wardRootRowsOf(faceTree);
  const [tree, sealedRoot] = await Promise.all([io.read(at.tree), io.read(at.root)]);
  if (tree === null || sealedRoot === null) throw new WardRefused("ward-absent", "that face holds no warded root in this browser");
  return { tree, sealedRoot };
}

/** The public key standing beside the ward of the face on `faceTree`, or `ward-absent`. Public bytes: it opens nothing. */
export async function readBrowserWardKey(idbName: string, faceTree: string): Promise<string> {
  const bytes = await browserKeystoreCustodyIo(idbName).read(wardRootRowsOf(faceTree).key);
  const key = bytes === null ? "" : new TextDecoder().decode(bytes);
  if (!/^[0-9a-f]{64}$/.test(key)) throw new WardRefused("ward-absent", "that face holds no warded root in this browser");
  return key;
}

/** Whether the warded root of the face on `faceTree` stands: its tree reads and its row carries the ward's frame. Opens nothing. */
export async function browserWardStands(idbName: string, faceTree: string): Promise<boolean> {
  const io = browserKeystoreCustodyIo(idbName);
  const at = wardRootRowsOf(faceTree);
  const [tree, root] = await Promise.all([io.read(at.tree), io.read(at.root)]);
  return decodeSlotTree(tree).reading === "readable" && readWardCarrier(root) === "sealed";
}

function treeOf(bytes: Uint8Array): SlotTree {
  const reading = decodeSlotTree(bytes);
  if (reading.reading !== "readable") throw new WardRefused("ward-tree-unreadable", reading.reading === "unreadable" ? reading.why : "the ward tree holds no bytes");
  return reading.tree;
}

async function openWardFresh(idbName: string, tree: SlotTree, credential: Credential): Promise<WardKey> {
  return chargeWardAttempt(idbName, async () => {
    const opened = await openWardKey(tree, [credential], nobleKdf);
    if (opened.reading !== "opens") throw new WardRefused("ward-no-slot-opens", "the route opens no slot of this face's ward");
    return opened.treeKey;
  });
}

/**
 * Open the root of the face on `faceTree` for ONE act on the page main thread (road row `B1` owes the vessel's own worker), under a fresh unlock of its ward from `route`, then
 * zero the ward key. For an act whose mesh code derives from the seed; a signing act rides the per-act worker instead.
 */
export async function openBrowserWardedRoot(idbName: string, faceTree: string, route: WardRoute): Promise<{ readonly verifyingKey: string; readonly signingKey: string }> {
  const credential = wardCredentialOf(route);
  const { tree, sealedRoot } = await readBrowserWardRows(idbName, faceTree);
  const key = await openWardFresh(idbName, treeOf(tree), credential);
  try { return openWardedRoot(key, faceTree, sealedRoot); } finally { key.fill(0); }
}

/** The roster's lines, ordered by face tree; [] where none stands. Reads under the keystore's unlock and names no seed. */
export async function readBrowserPersonaRoster(read: (row: string) => Promise<unknown>): Promise<PersonaRosterLine[]> {
  const raw = await read(PERSONA_ROSTER_ROW) as { roots?: readonly PersonaRosterLine[] } | undefined;
  return [...(raw?.roots ?? [])].sort((a, b) => (a.tree < b.tree ? -1 : a.tree > b.tree ? 1 : 0));
}

const pinOf = wardPinOf;

/**
 * Land a ward's rows (raw bytes no page key opens) in ONE keystore transaction under the vessel's writer lock, only where none of them
 * stands: answers false and writes nothing where any one already holds bytes. A torn land leaves nothing.
 */
export async function landBrowserWardRows(idbName: string, rows: readonly (readonly [string, Uint8Array])[]): Promise<boolean> {
  return browserKeystoreCustodyIo(idbName).exclusive(async () => {
    const idb = await openVesselIdb(idbName);
    try {
      const tx = idb.transaction("keystore", "readwrite", { durability: "strict" });
      const store = tx.objectStore("keystore");
      const done = new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error ?? new Error("aborted")); });
      done.catch(() => undefined);
      const held = await Promise.all(rows.map(([path]) => new Promise<unknown>((resolve, reject) => { const r = store.get(path); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); })));
      if (held.some((h) => h !== undefined)) { tx.abort(); await done.catch(() => undefined); return false; }
      for (const [path, bytes] of rows) store.put(new Uint8Array(bytes), path);
      await done;
      return true;
    } finally { idb.close(); }
  });
}

/**
 * Land `keypair` as the root of the face on `faceTree` under its ward, bound over `route`, and record its roster line, in ONE
 * custody act. Answers the keypair that stands (an earlier torn mint's root is adopted). The keystore must stand sealed and
 * unlocked: the roster rests under its tree. A passkey route, or a route that opens a standing ward tree to nothing, writes nothing.
 * The rows rest under the face's own tree, so no other face's mint reaches them.
 */
export async function mintBrowserWardedRoot(idbName: string, faceTree: string, route: WardRoute, keypair: { readonly verifyingKey: string; readonly signingKey: string }): Promise<{ readonly verifyingKey: string; readonly signingKey: string }> {
  const custody = await readBrowserCustody(idbName);
  if (custody.reading !== "sealed") throw new BrowserCustodyRefused("no-custody-slot", idbName, "persona-root");
  if (!custody.unlocked) throw new BrowserCustodyRefused("sealed-locked", idbName, "persona-root");
  const credential = wardCredentialOf(route);
  const pin = pinOf(credential);
  const at = wardRootRowsOf(faceTree);
  return withCustodyRows(idbName, async (rows) => {
    const roster = await readBrowserPersonaRoster(rows.read);
    const line = roster.find((l) => l.tree === faceTree);
    const io = browserKeystoreCustodyIo(idbName);
    const carrier = wardRootCarrier(faceTree);
    const standingTree = await io.read(at.tree);
    // A ROSTER LINE WITH NO WARD BESIDE IT names a root this browser cannot open: refuse, and write nothing over it.
    if (standingTree === null && line !== undefined) throw new WardRefused("ward-root-names-another-key", "the roster names a root for this face and no ward stands beside it");
    let key: WardKey;
    if (standingTree !== null) key = await openWardFresh(idbName, treeOf(standingTree), credential);
    else {
      // THE TREE LANDS FIRST, proved to reopen under the route, so a mint torn after it resumes by opening the ward it left.
      key = mintWardKey();
      try {
        const tree = await bindWardSlot(null, key, { t: 1, pins: [pin] }, nobleKdf);
        const back = await openWardKey(treeOf(encodeSlotTree(tree)), [credential], nobleKdf);
        if (back.reading !== "opens") throw new WardRefused("ward-no-slot-opens", "the route does not reopen the ward it just bound; nothing was written");
        back.treeKey.fill(0);
        await commitWardTree({ io, path: at.tree, expected: null, key, tree, carriers: [carrier] });
      } catch (e) { key.fill(0); throw e; }
    }
    try {
      const standingRoot = await io.read(carrier.path);
      const kept = standingRoot !== null ? openWardedRoot(key, faceTree, standingRoot) : keypair;
      if (standingRoot === null) {
        await writeWardCarrier({ io, key, treePath: at.tree, carrier, plaintext: new TextEncoder().encode(JSON.stringify({ verifyingKey: keypair.verifyingKey, signingKey: keypair.signingKey })) });
      }
      if (line && line.verifyingKey !== kept.verifyingKey) throw new WardRefused("ward-root-names-another-key", "the roster names another root for this face");
      await io.write(at.key, new TextEncoder().encode(kept.verifyingKey));
      if (!line) await rows.write(PERSONA_ROSTER_ROW, { roots: [...roster, { tree: faceTree, verifyingKey: kept.verifyingKey }] });
      return kept;
    } finally { key.fill(0); }
  });
}
