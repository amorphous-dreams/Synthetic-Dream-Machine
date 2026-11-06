/**
 * browser-ward-tree — A BROWSER FACE'S WARD (seat-harness#/the-ward): the face root rests under a ward key of its own, never under
 * the keystore's tree key, and opens only fresh from the face's human route for one act.
 *
 * ── WHAT RESTS WHERE ─────────────────────────────────────────────────────────────────────────────
 * The keystore keeps, per face `h<N>`, the ward tree at `ward/h<N>/slots` (a keyslot tree over the face's human routes: a
 * passphrase or a paper sheet, never a passkey) and the root at `ward/h<N>/persona-root`, sealed in the ward's own frame. The
 * sealed roster (`persona-root-roster`, under the keystore's tree key) names each held root by index and PUBLIC key, so a
 * possession check reads no seed, and `ward/h<N>/public-key` carries the same public key beside the ward, so a ward act's signer
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
import { openWardedRoot, wardCredentialOf, wardKeyRowOf, wardPinOf, wardRootCarrier, wardRootRowOf, wardTreeRowOf, type WardRoute } from "./ward-core.js";
import { openVesselIdb } from "./browser-vessel-identity.js";

export const PERSONA_ROSTER_ROW = "persona-root-roster";

/** One roster line: a held root's index and its public key. */
export interface PersonaRosterLine { readonly handleIndex: number; readonly verifyingKey: string }

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
export async function readBrowserWardRows(idbName: string, handleIndex: number): Promise<{ readonly tree: Uint8Array; readonly sealedRoot: Uint8Array }> {
  const io = browserKeystoreCustodyIo(idbName);
  const [tree, sealedRoot] = await Promise.all([io.read(wardTreeRowOf(handleIndex)), io.read(wardRootRowOf(handleIndex))]);
  if (tree === null || sealedRoot === null) throw new WardRefused("ward-absent", `face h${handleIndex} holds no warded root in this browser`);
  return { tree, sealedRoot };
}

/** The public key standing beside face `handleIndex`'s ward, or `ward-absent`. Public bytes: it opens nothing. */
export async function readBrowserWardKey(idbName: string, handleIndex: number): Promise<string> {
  const bytes = await browserKeystoreCustodyIo(idbName).read(wardKeyRowOf(handleIndex));
  const key = bytes === null ? "" : new TextDecoder().decode(bytes);
  if (!/^[0-9a-f]{64}$/.test(key)) throw new WardRefused("ward-absent", `face h${handleIndex} holds no warded root in this browser`);
  return key;
}

/** Whether face `handleIndex`'s warded root stands: its tree reads and its row carries the ward's frame. Opens nothing. */
export async function browserWardStands(idbName: string, handleIndex: number): Promise<boolean> {
  const io = browserKeystoreCustodyIo(idbName);
  const [tree, root] = await Promise.all([io.read(wardTreeRowOf(handleIndex)), io.read(wardRootRowOf(handleIndex))]);
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
 * Open face `handleIndex`'s root for ONE act on the page main thread (road row `B1` owes the vessel's own worker), under a fresh unlock of its ward from `route`, then
 * zero the ward key. For an act whose mesh code derives from the seed; a signing act rides the per-act worker instead.
 */
export async function openBrowserWardedRoot(idbName: string, handleIndex: number, route: WardRoute): Promise<{ readonly verifyingKey: string; readonly signingKey: string }> {
  const credential = wardCredentialOf(route);
  const { tree, sealedRoot } = await readBrowserWardRows(idbName, handleIndex);
  const key = await openWardFresh(idbName, treeOf(tree), credential);
  try { return openWardedRoot(key, handleIndex, sealedRoot); } finally { key.fill(0); }
}

/** The roster's lines, ascending; [] where none stands. Reads under the keystore's unlock and names no seed. */
export async function readBrowserPersonaRoster(read: (row: string) => Promise<unknown>): Promise<PersonaRosterLine[]> {
  const raw = await read(PERSONA_ROSTER_ROW) as { roots?: readonly PersonaRosterLine[] } | undefined;
  return [...(raw?.roots ?? [])].sort((a, b) => a.handleIndex - b.handleIndex);
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
 * Land `keypair` as face `handleIndex`'s root under its ward, bound over `route`, and record its roster line, in ONE custody act.
 * Answers the keypair that stands (an earlier torn mint's root is adopted). The keystore must stand sealed and unlocked: the
 * roster rests under its tree. A passkey route, or a route that opens a standing ward tree to nothing, writes nothing.
 */
export async function mintBrowserWardedRoot(idbName: string, handleIndex: number, route: WardRoute, keypair: { readonly verifyingKey: string; readonly signingKey: string }): Promise<{ readonly verifyingKey: string; readonly signingKey: string }> {
  const custody = await readBrowserCustody(idbName);
  if (custody.reading !== "sealed") throw new BrowserCustodyRefused("no-custody-slot", idbName, `persona-root-h${handleIndex}`);
  if (!custody.unlocked) throw new BrowserCustodyRefused("sealed-locked", idbName, `persona-root-h${handleIndex}`);
  const credential = wardCredentialOf(route);
  const pin = pinOf(credential);
  return withCustodyRows(idbName, async (rows) => {
    const roster = await readBrowserPersonaRoster(rows.read);
    const line = roster.find((l) => l.handleIndex === handleIndex);
    const io = browserKeystoreCustodyIo(idbName);
    const treePath = wardTreeRowOf(handleIndex);
    const carrier = wardRootCarrier(handleIndex);
    const standingTree = await io.read(treePath);
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
        await commitWardTree({ io, path: treePath, expected: null, key, tree, carriers: [carrier] });
      } catch (e) { key.fill(0); throw e; }
    }
    try {
      const standingRoot = await io.read(carrier.path);
      const kept = standingRoot !== null ? openWardedRoot(key, handleIndex, standingRoot) : keypair;
      if (standingRoot === null) {
        await writeWardCarrier({ io, key, treePath, carrier, plaintext: new TextEncoder().encode(JSON.stringify({ verifyingKey: keypair.verifyingKey, signingKey: keypair.signingKey })) });
      }
      if (line && line.verifyingKey !== kept.verifyingKey) throw new WardRefused("ward-root-names-another-key", `the roster names another root at h${handleIndex}`);
      await io.write(wardKeyRowOf(handleIndex), new TextEncoder().encode(kept.verifyingKey));
      if (!line) {
        const next = [...roster, { handleIndex, verifyingKey: kept.verifyingKey }].sort((a, b) => a.handleIndex - b.handleIndex);
        await rows.write(PERSONA_ROSTER_ROW, { roots: next });
      }
      return kept;
    } finally { key.fill(0); }
  });
}
