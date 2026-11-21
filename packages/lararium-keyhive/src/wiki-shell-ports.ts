/**
 * wiki-shell-ports — THE SHELL `retire-wiki` REACHES, for the worn face (`lares wiki retire`, cabal-realm#/the-workbench).
 *
 * The tw5 reactor (`makeRetireWikiReactor`) stays keyhive-free: it runs every check, removes the face's catalog-half rows last,
 * and asks these ports for the rest. Each port acts for ONE face over the vessel's ledger and that face's own hive:
 *
 *   · `owner`  — every realm the ledger binds the slug under, and the face's own derived cabal of one (`workbenchOwnership`);
 *   · `shared` — the faces other than this one the ledger seats in the face's workbench, and the share rows naming the slug;
 *   · `contents` / `clear` — the face's working, draft and personal layers (the daemon reads and clears its slot documents); a
 *                read that faults THROWS, never a zero;
 *   · `unbindSlots` — the face's draft and personal slot binding rows for the slug leave the daemon document;
 *   · `unbind` — the ledger rows binding the slug to the face's cabal leave (`retireWorkbench`);
 *   · `forget` — the hive forgets each shell bag's Document and the face plane's bag ledger drops its record, so the face's next
 *                mint of that bag registers afresh. A canon bag never reaches it.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/cabal-realm#/the-workbench
 */
import { storedDeleted, workbenchSeats, type LarDoc } from "@lararium/mesh";
import type { WikiShellCounts, WikiShellPorts } from "@lararium/tw5";
import type { BagDocLedger } from "./bag-doc-ledger.js";
import type { KeyhiveProvider } from "./keyhive-provider.js";
import { retireWorkbench, workbenchOwnership, type LedgerDoc } from "./workbench-realm.js";

/** The live records a layer's document holds: every row but a tombstone. */
export function liveRecordCount(doc: LarDoc | undefined | null): number {
  return Object.values(doc?.tiddlers ?? {}).filter((r) => !storedDeleted(r as never)).length;
}

/** A layer document as the shell ports read and clear it. */
export interface ShellLayerDoc { doc(): LarDoc | undefined; change(fn: (d: LarDoc) => void): void }

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
  readonly layers: (slug: string) => Promise<Readonly<Record<keyof WikiShellCounts, ShellLayerDoc | null>>>;
  readonly unbindSlots: WikiShellPorts["unbindSlots"];
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
      return { working: liveRecordCount(l.working?.doc()), draft: liveRecordCount(l.draft?.doc()), personal: liveRecordCount(l.personal?.doc()) };
    },
    clear: async (slug) => {
      const l = await args.layers(slug);
      for (const layer of [l.working, l.draft, l.personal]) {
        if (layer && Object.keys(layer.doc()?.tiddlers ?? {}).length > 0) layer.change((d) => { for (const title of Object.keys(d.tiddlers)) delete d.tiddlers[title]; });
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
