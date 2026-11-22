/**
 * wiki-shell-ports — THE SHELL `retire-wiki` REACHES, for the worn face (`lares wiki retire`, cabal-realm#/the-workbench).
 *
 * The tw5 reactor (`makeRetireWikiReactor`) stays keyhive-free: it runs every check, removes the face's catalog-half rows last,
 * and asks these ports for the rest. Each port acts for ONE face over the vessel's ledger and that face's own hive:
 *
 *   · `owner`  — every realm the ledger binds the slug under, and the face's own derived cabal of one (`workbenchOwnership`);
 *   · `shared` — the faces other than this one the ledger seats in the face's workbench, and the share rows naming the slug;
 *   · `contents` / `clear` — the face's working, draft and personal layers (the daemon reads and clears its slot documents),
 *                the house's effect records counted apart from authored ones; a read that faults THROWS, never a zero;
 *   · `effects` / `carry` / `carryHome` — the record of leaving: the shell's effect records, verbatim, carried into one
 *                retirement record per slug (`retiredShellUri`) in the face's daemon wiki working layer and read back, before
 *                `clear` erases them; a home that holds no durable document, or a carry that does not read back whole, THROWS;
 *   · `unbindSlots` — the face's draft and personal slot binding rows for the slug leave the daemon document;
 *   · `unbind` — the ledger rows binding the slug to the face's cabal leave (`retireWorkbench`);
 *   · `forget` — the hive forgets each shell bag's Document and the face plane's bag ledger drops its record, so the face's next
 *                mint of that bag registers afresh. A canon bag never reaches it.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/cabal-realm#/the-workbench
 */
import {
  buildRetiredShellRecord, carriedFields, holdsEvery, isHouseEffectRecordOf, parseRetiredShellRecord, plainRecord, retiredShellUri, RetiredShellCarryRefusal,
  storedDeleted, unionRetiredShell, wikiBagUri, wikiSlotUri, workbenchSeats, DAEMON_WIKI_SLUG, type CarriedEffectRecord, type ChangeOrigin, type LarDoc, type LarTiddlerRecord, type StoredLarRecord,
} from "@lararium/mesh";
import type { WikiShellPorts } from "@lararium/tw5";
import type { BagDocLedger } from "./bag-doc-ledger.js";
import type { KeyhiveProvider } from "./keyhive-provider.js";
import { retireWorkbench, workbenchOwnership, type LedgerDoc } from "./workbench-realm.js";

/** The live records a layer's document holds: every row but a tombstone. */
export function liveRecordCount(doc: LarDoc | undefined | null): number {
  return Object.values(doc?.tiddlers ?? {}).filter((r) => !storedDeleted(r as never)).length;
}

/**
 * THE HOUSE'S OWN EFFECT RECORD IN ONE LAYER (`isHouseEffectRecordOf`): the row reads back exactly as the effect recorder
 * writes it for one bag that layer's ledger may hold (its own slot bag, or the wiki's canon bag): its title under
 * `effectLedgerPrefix(<that bag>)` at its own event id, its `bag` field naming that very bag, no text, and no field beside the
 * effect-record schema. The shape alone proves nothing (every field is
 * writable), so the second wall stands on the write side: no hand's door writes a residency ledger
 * (`refuseEffectLedgerWrite`: the tiddler door, the meme door, the engine's cascade). A row that fails any reading, or that
 * no stored-record reading parses, counts as authored.
 */
export function isHouseEffectRecord(bags: readonly string[], title: string, record: unknown): boolean {
  try {
    const fields = plainRecord(record as StoredLarRecord).tiddler as Record<string, unknown>;
    return bags.some((bag) => isHouseEffectRecordOf(bag, title, fields));
  } catch { return false; }
}

/**
 * The bags whose ledger a layer of `slug` may hold: the layer's own slot bag, and the wiki's canon bag (a gated ingest into
 * canon lands its residency row beside the layer's records, `bags/<slug>/ledger/residency/*`, as the referee walk met it).
 */
const ledgerBagsOf = (slug: string, kind: "working" | "draft" | "personal"): readonly string[] => [wikiSlotUri(slug, kind), wikiBagUri(slug)];

/** A layer's live records, split: the authored ones and the house's effect records for that layer's slot bag. */
export function liveRecordSplit(doc: LarDoc | undefined | null, bags: readonly string[]): { readonly authored: number; readonly effects: number } {
  let authored = 0, effects = 0;
  for (const [title, r] of Object.entries(doc?.tiddlers ?? {})) {
    if (storedDeleted(r as never)) continue;
    if (isHouseEffectRecord(bags, title, r)) effects++; else authored++;
  }
  return { authored, effects };
}

/** The binding rows a face's draft or personal slot reads (the daemon document's store), as the shell ports scan them. */
export interface BindingRows {
  listVisible(): Promise<readonly string[]>;
  get(title: string): Promise<{ readonly tiddler: { readonly text?: unknown } } | null | undefined>;
}

/**
 * THE FACE'S OWN SLOT, NEVER THE FLOOR'S: the url a slot resolves to (`slotDoc` with no mint), kept only where a binding row
 * under the face's own group (`slotBindingKey(prefix, fingerprint, group)`) names it, with the titles of those rows. A slot
 * the resolver answered off the faceless floor's row (the face holds none of its own) reads null: a retire neither counts
 * nor clears content the face never owned.
 */
export async function faceOwnSlot(rows: BindingRows | null, prefix: string, group: string, url: string | null): Promise<{ readonly url: string; readonly titles: readonly string[] } | null> {
  if (url === null || rows === null) return null;
  const under = `${prefix}/${encodeURIComponent(group)}/`;
  const titles: string[] = [];
  for (const title of await rows.listVisible()) {
    if (!title.startsWith(under)) continue;
    const text = (await rows.get(title))?.tiddler?.text;
    if (text === url) titles.push(title);
  }
  return titles.length > 0 ? { url, titles: titles.sort() } : null;
}

/** A layer document as the shell ports read and clear it. */
export interface ShellLayerDoc { doc(): LarDoc | undefined; change(fn: (d: LarDoc) => void): void }

/**
 * THE FACE'S DURABLE HOME for the record of a retired shell's leaving: its daemon wiki working layer, read and written as one
 * store. Supplied only where that layer rests in a document (never a layer held in memory alone).
 */
export interface RetiredShellHome {
  readonly bag: string;
  get(title: string): Promise<LarTiddlerRecord | null>;
  put(record: LarTiddlerRecord): Promise<void>;
}

/** What `daemonRetiredHome` reads of the daemon's composition and its control document. */
export interface DaemonRetiredHomeIo {
  /** The slug of the wiki this composition runs (the home stands only in the daemon wiki's). */
  readonly wikiSlug: string;
  readonly hasBag: (bag: string) => boolean;
  readonly store: (bag: string) => { get(title: string): Promise<LarTiddlerRecord | null>; put(record: LarTiddlerRecord, origin: ChangeOrigin): Promise<void> } | null;
  /** The url of the document the composition holds for `bag`, or undefined where none rests (a layer held in memory alone). */
  readonly handleUrl: (bag: string) => string | undefined;
  /** The url the vessel's control document names for the worn face's working slot (`daemonSlotTitle("working", group)`), or null. */
  readonly controlUrl: () => Promise<string | null>;
}

/**
 * THE FACE'S OWN DAEMON WORKING SLOT, as the home of the record of leaving: the daemon wiki's working layer, only where it rests
 * in a document AND that document is the one the control document names for the worn face (`daemon-slot/working/<group>`).
 * A layer held in memory alone (a floor that cannot seal), a slot the control names for no face, a control read that faults, or
 * a handle on another document (the floor's slot, under a face pinned and not yet seated) answers null, and the carry refuses.
 */
export async function daemonRetiredHome(io: DaemonRetiredHomeIo): Promise<RetiredShellHome | null> {
  const bag = wikiSlotUri(DAEMON_WIKI_SLUG, "working");
  if (io.wikiSlug !== DAEMON_WIKI_SLUG || !io.hasBag(bag)) return null;
  const held = io.handleUrl(bag);
  if (!held) return null;
  let named: string | null;
  try { named = await io.controlUrl(); } catch { return null; }
  if (named === null || named !== held) return null;
  const store = io.store(bag);
  if (!store) return null;
  return { bag, get: (title) => store.get(title), put: (record) => store.put(record, { kind: "lares-verb", requestId: "retire-wiki" }) };
}

export interface WikiShellPortsArgs {
  /** The worn face's hive; null where none stands (nothing to forget). */
  readonly provider: () => KeyhiveProvider | null;
  /** The worn face's PersonaGroup. */
  readonly face: string;
  /** The vessel's workbench ledger. */
  readonly ledger: () => Promise<LedgerDoc>;
  /** The face plane's bag-to-Document ledger, where one stands. */
  readonly faceLedger?: () => BagDocLedger | null;
  /** The share rows naming the slug (any kind), by their slug: the control document's `config/share` rows. */
  readonly shares: (slug: string) => Promise<readonly string[]>;
  /** The face's documents for each layer of the slug, null where none stands. A fault throws. */
  readonly layers: (slug: string) => Promise<Readonly<Record<"working" | "draft" | "personal", ShellLayerDoc | null>>>;
  readonly unbindSlots: WikiShellPorts["unbindSlots"];
  /** The face's durable home for retirement records (its daemon wiki working layer, `daemonRetiredHome`), or null where none
   *  rests: a retire that would carry effect records then refuses, erasing nothing. */
  readonly retiredHome: () => Promise<RetiredShellHome | null>;
  /** Runs once the shell's bindings left: a holder closes what it composed over them. */
  readonly afterForget?: () => Promise<void>;
}

export function wikiShellPorts(args: WikiShellPortsArgs): WikiShellPorts {
  return {
    owner: async (slug) => workbenchOwnership((await args.ledger()).doc(), slug, args.face),
    shared: async (slug) => {
      const { own } = workbenchOwnership((await args.ledger()).doc(), slug, args.face);
      const seats = [...workbenchSeats((await args.ledger()).doc(), own, slug).keys()].filter((face) => face !== args.face).sort();
      return { seats, shares: [...(await args.shares(slug))] };
    },
    contents: async (slug) => {
      const l = await args.layers(slug);
      const w = liveRecordSplit(l.working?.doc(), ledgerBagsOf(slug, "working")), d = liveRecordSplit(l.draft?.doc(), ledgerBagsOf(slug, "draft")), p = liveRecordSplit(l.personal?.doc(), ledgerBagsOf(slug, "personal"));
      return { working: w.authored, draft: d.authored, personal: p.authored, effects: w.effects + d.effects + p.effects };
    },
    effects: async (slug) => {
      const l = await args.layers(slug);
      const out: CarriedEffectRecord[] = [];
      for (const [kind, layer] of [["working", l.working], ["draft", l.draft], ["personal", l.personal]] as const) {
        for (const [title, r] of Object.entries(layer?.doc()?.tiddlers ?? {})) {
          if (storedDeleted(r as never) || !isHouseEffectRecord(ledgerBagsOf(slug, kind), title, r)) continue;
          out.push({ layer: kind, title, fields: carriedFields(plainRecord(r as StoredLarRecord).tiddler as Record<string, unknown>) });
        }
      }
      return out;
    },
    carryHome: async (slug) => {
      const home = await args.retiredHome();
      return home ? { title: retiredShellUri(slug), bag: home.bag } : null;
    },
    carry: async (slug, records, outcome) => {
      const home = await args.retiredHome();
      if (!home) throw new RetiredShellCarryRefusal("retire-carry-unlanded", "the face's own daemon wiki working slot rests in no document here (a floor that cannot seal holds it in memory alone, or the composition holds a document the control names for no face)");
      const title = retiredShellUri(slug);
      const standing = await home.get(title);
      // A copy the house re-ingested off disk carries no writer's stamp; its body, read whole, stays in the union and takes the
      // stamp as the carry writes. A row whose body does not parse whole refuses: the carry never writes over what it cannot read.
      const before = parseRetiredShellRecord(slug, standing) ?? parseRetiredShellRecord(slug, standing, { unstamped: true });
      if (standing && !before) throw new RetiredShellCarryRefusal("retire-carry-unlanded", `"${title}" stands and does not read as a retirement record of "${slug}"`);
      const next = unionRetiredShell(slug, before, records, { face: args.face, ...outcome });
      await home.put(buildRetiredShellRecord(next));
      // THE READ-BACK: the carry stands only where every record reads back under the very fields carried.
      const landed = parseRetiredShellRecord(slug, await home.get(title));
      if (!holdsEvery(landed, records) || (landed?.retires.length ?? 0) !== next.retires.length) {
        throw new RetiredShellCarryRefusal("retire-carry-unlanded", `"${title}" did not read back holding every carried record`);
      }
      return { title, bag: home.bag, records: records.length, added: next.records.length - (before?.records.length ?? 0) };
    },
    clear: async (slug, what) => {
      const l = await args.layers(slug);
      const carried = new Set(what.effects);
      for (const [kind, layer] of [["working", l.working], ["draft", l.draft], ["personal", l.personal]] as const) {
        const bags = ledgerBagsOf(slug, kind);
        const doomed = Object.entries(layer?.doc()?.tiddlers ?? {})
          .filter(([title, r]) => (isHouseEffectRecord(bags, title, r) ? carried.has(title) : what.authored))
          .map(([title]) => title);
        if (layer && doomed.length > 0) layer.change((d) => { for (const title of doomed) delete d.tiddlers[title]; });
      }
    },
    unbindSlots: args.unbindSlots,
    unbind: async (slug) => {
      const r = retireWorkbench(await args.ledger(), slug, args.face);
      return { realmId: r.realmId, ledgerRows: r.dropped };
    },
    forget: async (bags) => {
      const provider = args.provider();
      const ledger = args.faceLedger?.() ?? null;
      const forgot: string[] = [];
      for (const bag of bags) {
        const mapped = provider ? await provider.forgetBag(bag) : null;
        const recorded = ledger?.drop ? await ledger.drop(bag) : false;
        if (mapped !== null || recorded) forgot.push(bag);
      }
      await args.afterForget?.();
      return forgot;
    },
  };
}
