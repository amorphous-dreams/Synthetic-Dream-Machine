/**
 * wiki-shell-ports — THE SHELL `retire-wiki` REACHES, for the worn face (`lares wiki retire`, cabal-realm#/the-workbench).
 *
 * The tw5 reactor (`makeRetireWikiReactor`) stays keyhive-free: it removes the face's catalog-half rows and asks these ports for
 * the rest. Each port acts for ONE face over the vessel's ledger and that face's own hive:
 *
 *   · `owner`  — every realm the ledger binds the slug under, and the face's own derived cabal of one (`workbenchOwnership`);
 *   · `contents` — how many live records the face's working and draft layers hold (the daemon reads its slot documents);
 *   · `unbind` — the ledger rows binding the slug to the face's cabal leave, and the hive forgets the working slot (`retireWorkbench`);
 *   · `forget` — the hive forgets each shell bag's Document and the face plane's bag ledger drops its record, so the face's next
 *                mint of that bag registers afresh. A canon bag never reaches it.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/cabal-realm#/the-workbench
 */
import { storedDeleted, type LarDoc } from "@lararium/mesh";
import type { WikiShellPorts } from "@lararium/tw5";
import type { BagDocLedger } from "./bag-doc-ledger.js";
import type { KeyhiveProvider } from "./keyhive-provider.js";
import { retireWorkbench, workbenchOwnership, type LedgerDoc } from "./workbench-realm.js";

/** The live records a layer's document holds: every row but a tombstone. */
export function liveRecordCount(doc: LarDoc | undefined | null): number {
  return Object.values(doc?.tiddlers ?? {}).filter((r) => !storedDeleted(r as never)).length;
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
  readonly contents: WikiShellPorts["contents"];
  /** Runs once the shell's bindings left: a holder closes what it composed over them. */
  readonly afterForget?: () => Promise<void>;
}

export function wikiShellPorts(args: WikiShellPortsArgs): WikiShellPorts {
  return {
    owner: async (slug) => workbenchOwnership((await args.ledger()).doc(), slug, args.face),
    contents: args.contents,
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
