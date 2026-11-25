import { askerRefusal } from "@lararium/mesh/hand-refusal";
import type { AutomergeUrl } from "@lararium/mesh";
import type { ChangeOrigin, LarTiddlerRecord } from "@lararium/mesh";
import { catalogViewOf, houseCanonUrl, isFacePrivateSlug, ownEntry, refuseTw5DocsReserved, resolveHouseCanon, tiddlerText } from "@lararium/mesh";
import { ACTIVE_WIKI_URI, buildActiveWikiRecord, readActiveWikiSlug } from "./active-wiki.js";
import {
  DAEMON_BAG_ID,
  emptyLarDoc,
  storedLarRecord,
  mkDaemonWikiAlert,
  recipeRecordFields,
  recipeUri,
  SYSTEM_BAGS,
  wikiBagUri,
  wikiSlotUri,
  wikiUri,
} from "@lararium/mesh";
import { effectiveRecipeOf } from "./recipe-planes.js";
import type { VerbReactor } from "./verb-dispatcher.js";
import { makeRequestId, stringArg } from "./handler-args.js";
import type { RetiredShellCarry, WikiHandlerOptions, WikiMintHandlerOptions, WikiRetireOptions, WikiShellCounts } from "./wiki-handler-options.js";

// makeListWikisReactor RELOCATED to @lararium/tw5 (worker-data-verbs) — list-wikis now
// runs in every vessel's daemon worker (sovereign-worker, verify-then-delegate gated).

export function makeInitWikiReactor(opts: WikiMintHandlerOptions): VerbReactor {
  return async (args) => {
    const slug = stringArg(args, "slug");
    if (!slug) throw new Error("args.slug is required (the wiki name)");
    refuseTw5DocsReserved(slug, "init-wiki");
    if (slug.includes("/") || slug.includes(" ")) {
      throw new Error(`invalid slug: "${slug}" (no slashes or spaces)`);
    }

    // ONE NAME, ONE URI: the nameless stack carries the wiki's name (`wikis/{slug}`), and the canon bag (`bags/{slug}`) stands as one
    // capability in it. The catalog row and the cap rest on the canon bag; the answer names the stack and the canon bag apart.
    const canonBag = wikiBagUri(slug);
    const stackUri = wikiUri(slug);
    // A system wiki's live canon doc rests in the Kahu realm (the vessel's `systemCanonUrl`); its default recipe stands in the oracle.
    if (SYSTEM_BAGS.has(canonBag)) {
      const wikiDocUrl = houseCanonUrl(await resolveHouseCanon<string>(canonBag, { realm: opts.systemCanonUrl, row: () => opts.catalog.urlOf(canonBag) }));
      const defaultRec = opts.oracle ? await opts.oracle.recordOf(recipeUri("oracle", slug)).catch(() => null) : null;
      const effective = wikiDocUrl && defaultRec && defaultRec.meta?.deleted !== true
        ? await effectiveRecipeOf(slug, { catalog: opts.catalog, oracle: opts.oracle })
        : null;
      if (!wikiDocUrl || !effective) {
        throw new Error(`system-bag: "${slug}" names a system bag, and no wiki stands on it`);
      }
      return {
        slug,
        status: "already-exists",
        system: true,
        wikiUri: stackUri,
        canonBag,
        wikiDocUrl,
        recipeUri: effective.title,
        recipePlane: effective.plane,
      };
    }
    const draftBagId = wikiSlotUri(slug, "draft");
    const workingBagId = wikiSlotUri(slug, "working");
    // The user's wiki recipe is REGISTRY data (the user's composition choice) —
    // it lives in the user's catalog registry, NOT the lararium bag (protocol substrate). Read
    // it through the accessor (access≠load), like the wiki oracle. The record spells the SAME
    // cascade the mount lays (`recipeRecordFields` ⇆ `recipeFromRecord`): the floor carries
    // lares and lararium read-only through oracle-floor under every recipe; a user wiki names its
    // own canon and chosen libraries, and `writable-bag` names working.
    const recipeTitle = recipeUri("catalog", slug);

    const existingWikiUrl = await opts.catalog.urlOf(canonBag);
    const existingRecipeRec = await opts.catalog.recordOf(recipeTitle);
    // WHERE A STANDING CANON ROW RESTS: the face's own catalog half, or the floor's beneath it (a veil mint, or a partial init
    // the vessel left before any face stood). A catalog with no face half laid over it reads its rows as its own.
    const half = existingWikiUrl ? catalogViewOf(await opts.catalog.handle())?.faceHandle() ?? null : null;
    const canonReused: "own" | "floor" | null = !existingWikiUrl ? null
      : half && !Object.hasOwn(half.doc()?.tiddlers ?? {}, canonBag) ? "floor" : "own";

    const wikiHandle = existingWikiUrl
      ? await opts.repo.find(existingWikiUrl as AutomergeUrl)
      : opts.repo.create(emptyLarDoc());
    // AT THE VEIL FLOOR the canon document files as the vessel's own before its first byte rests (sealed under the vessel's key).
    if (!existingWikiUrl && opts.veilFloor) await opts.veilFloor.nameCanon(slug, wikiHandle.documentId, wikiHandle.url);
    if (!existingWikiUrl) await wikiHandle.whenReady();

    if (!existingWikiUrl || !existingRecipeRec) {
      // The oracle AND the user recipe land in catalog (registry) — one write.
      const catalogHandle = await opts.catalog.handle();
      const updatedAt = new Date().toISOString();
      catalogHandle.change((doc) => {
        const tiddlers = doc.tiddlers;
        tiddlers[canonBag] = storedLarRecord(canonBag, {
          text: wikiHandle.url,
          kind: "oracle",
          "path-filter": "lar-bag-path[wiki-shadow]",
          // The veil's mark: the vessel itself minted this wiki with no face, so the row rests on the floor's half.
          ...(opts.veilFloor && !existingWikiUrl ? { "face-reach": "vessel-only", "minted-by": opts.veilFloor.mintedBy } : {}),
        }, "lares-cli:wiki-init");
        if (!existingRecipeRec) {
          tiddlers[recipeTitle] = storedLarRecord(recipeTitle, {
            ...recipeRecordFields({ wikiSlug: slug }),
            "updated-at": updatedAt,
          }, "lares-cli:wiki-init");
        }
      });
    }

    // The draft doc resolves through THE ONE resolver — a face binding when the vessel holds a seat,
    // the device floor when not — the same doc the mounts and `meme put --recipe` reach.
    const draft = await opts.resolveDraftDoc(slug);

    // Born-with-its-cap: register each freshly-minted wiki bag's Keyhive Document
    // + delegate admin in the same act as the mint, so the new wiki's canon, working and
    // draft bags hold their cap immediately — no cap-denied window (the elyncia-bag
    // friction's sibling for wiki init). Key on the lar: bag URLs — the strings the
    // cap-gate verifies against; an automerge handle.url names a CONTENT doc, a different object.
    //
    // IDEMPOTENT BY INTENT: an init over rows a partial init left (another face's, or the floor's) registers each bag this
    // face's hive does not hold yet, and only those, so the same init run twice registers nothing the second time. Where no
    // reader of the hive stands, only a fresh mint registers (each bag is new then).
    // A RE-INIT FAILS SOFT: a registration that refuses over a wiki that already stood (a face not yet lit, a hive not yet
    // booted) lands in the answer (`bagsRefused`) and the init still answers; a fresh mint's registration still throws, since
    // a new wiki is born with its cap or not at all.
    const bags = [canonBag, workingBagId, draftBagId];
    const bagsRegistered: string[] = [];
    const bagsRefused: Array<{ bag: string; why: string }> = [];
    for (const bag of bags) {
      const held = opts.bagRegistered ? await opts.bagRegistered(bag) : null;
      const missing = held === null ? !existingWikiUrl : !held;
      if (!missing || !opts.registerBag) continue;
      if (!existingWikiUrl) { await opts.registerBag(bag); bagsRegistered.push(bag); continue; }
      try { await opts.registerBag(bag); bagsRegistered.push(bag); }
      catch (err) { bagsRefused.push({ bag, why: err instanceof Error ? err.message : String(err) }); }
    }

    // THE WORKBENCH STANDS IN THE SAME ACT (where the daemon supplies the port): the realm that seats this face's hive, else its
    // own private cabal of one, founded once. A workbench another face's realm holds names its refusal here; the rows and the
    // bags this init laid still stand, and the answer says what did not.
    let workbench: { realmId: string | null; founded: boolean } | { refused: string } | undefined;
    if (opts.workbench && !isFacePrivateSlug(slug)) {
      try { workbench = await opts.workbench(slug); }
      catch (err) { workbench = { refused: err instanceof Error ? err.message : String(err) }; }
    }

    const completed = !existingWikiUrl ? false
      : !existingRecipeRec || bagsRegistered.length > 0 || (workbench !== undefined && "founded" in workbench && workbench.founded);
    return {
      slug,
      status: !existingWikiUrl ? "minted" : completed ? "completed" : "already-exists",
      ...(canonReused ? { canonReused } : {}),
      ...(existingWikiUrl && !existingRecipeRec ? { recipeWritten: true } : {}),
      bagsRegistered,
      ...(bagsRefused.length > 0 ? { bagsRefused } : {}),
      ...(workbench ? { workbench } : {}),
      wikiUri: stackUri,
      canonBag,
      wikiDocUrl: wikiHandle.url,
      writableBag: workingBagId,
      draftBagId,
      draftDocUrl: draft.url,
      draftReach: draft.reach,
      recipeUri: recipeTitle,
    };
  };
}

/** The codes a `retire-wiki` refusal names: the code leads the message (`<code>: <detail>`), as every verb refusal reads. */
export type WikiRetireCode =
  | "retire-needs-hand" | "no-face" | "system-bag" | "wiki-face-private" | "no-such-wiki" | "not-the-owner" | "wiki-shared"
  | "wiki-not-empty" | "retire-count-missing" | "retire-count-moved" | "retire-carry-unlanded";

/** A `retire-wiki` refusal, by name. */
export class WikiRetireRefusal extends Error {
  override readonly name = "WikiRetireRefusal";
  constructor(readonly code: WikiRetireCode, detail: string) {
    super(`${code}: ${detail}`);
  }
}

const totalOf = (c: WikiShellCounts): number => c.working + c.draft + c.personal;
const sameCounts = (a: WikiShellCounts, b: WikiShellCounts): boolean => a.working === b.working && a.draft === b.draft && a.personal === b.personal && a.effects === b.effects;

/**
 * RETIRE A WIKI SHELL (`lares wiki retire <slug>`, the owner face's hand, never the AI seat): unmint what one face's
 * `init-wiki` laid over a slug, so the slug mints again cleanly under the face that should hold it.
 *
 * A HAND ACT ON THE CLI SURFACE. Only an ask the operator's terminal placed (the vessel's door booked the asker `cli`, a
 * reading the peer binding turns to `seat` on a harness's branch) runs it; a seat, a tab, a watcher and an ask no door read
 * (a synced summons) refuse `retire-needs-hand`.
 *
 * THE OWNER RETIRES. The worn face owns the shell where every realm the vessel's ledger binds the slug's workbench under reads
 * as that face's own cabal of one (none, or that one), and the face's catalog half or that ledger names the shell. A realm of
 * another face refuses `not-the-owner` (the same reading `retireWorkbench` keeps). A shell another face reaches (a seat the
 * ledger notes for a face other than the worn one, or a share row naming the slug) refuses `wiki-shared`: the shares leave first.
 *
 * NOTHING AUTHORED LEAVES BY DEFAULT. The counts name AUTHORED records apart from the house's EFFECT records (a gated ingest's
 * residency row): two walls hold that line, the write side (no hand's door, the tiddler door, the meme door or the engine's
 * cascade, writes a residency ledger: `effect-ledger-house-only`) and the reading (`isHouseEffectRecordOf`: the row reads
 * back exactly as the recorder writes it for that layer's bag). A shell holding effect records alone retires unforced.
 *
 * THE RECORD OF LEAVING STAYS (residency-model#/effect-record-surface: the artifact may leave; the record of its prior presence
 * here, and of its leaving, never does). Before any write erases a shell's effect records, the retire CARRIES them, verbatim,
 * into one retirement record per slug (`retiredShellUri`) in the worn face's daemon wiki working layer, with this retire's
 * outcome appended: the face owns that layer, it mirrors under `projections/` (a re-found clears only the hearth), and the keep
 * carries it with the face's daemon working rows. The carry reads its row back; a home that holds no durable document, a write
 * that faults, a read-back missing any record, or a carried title standing under other fields refuses `retire-carry-unlanded`
 * with nothing erased. Only the records the carry landed leave the layers; after the erase the layers read once more, and an
 * effect record that landed between the carry and the erase stays where it rests and the answer names it (`leftBehind`), so
 * nothing orphans silently. Every retire that carries appends its own outcome; a re-run carries no record twice. The answer
 * names where they went (`carried`), and `dry-run` names where they would go (`carryTo`).
 *
 * A working, draft or personal layer holding a live authored record refuses `wiki-not-empty`
 * (naming no count: `dry-run` reads the counts, and the refusal never carries the forcing line). `force` with no `count`
 * refuses `retire-count-missing`; a `count` other than the total refuses `retire-count-moved`; the very total retires and
 * clears those layers' documents, so a later mint at the same deterministic address opens empty. The counts read twice, the
 * second right before the first write: a total that moved between refuses `retire-count-moved` with nothing written.
 *
 * EVERY CHECK RUNS BEFORE ANY WRITE, and the writes run in the order that leaves a retry able to finish: the carry of the
 * effect records, the layers' content (the carried effect records, and the authored ones where forced), the Keyhive and slot bindings, the ledger rows, and the catalog rows LAST, so a fault midway leaves the rows
 * that name the face as the owner and the same retire runs again to the end.
 *
 * WHAT STAYS: the canon bag's document and every file of it, the face's binding of the canon bag, every other face's rows.
 */
export function makeRetireWikiReactor(opts: WikiRetireOptions): VerbReactor {
  return async (args, ctx) => {
    const slug = stringArg(args, "slug");
    if (!slug) throw new Error("args.slug is required (the wiki name)");
    if (askerRefusal(ctx?.asker, { terminal: true }) !== null) {
      throw new WikiRetireRefusal("retire-needs-hand", `retiring "${slug}" runs on a person's hand alone; this ask came from ${ctx?.asker ?? "no hand a door read"}`);
    }
    const canonBag = wikiBagUri(slug);
    if (SYSTEM_BAGS.has(canonBag)) throw new WikiRetireRefusal("system-bag", `"${slug}" names a system bag; no face minted it, and none retires it`);
    if (isFacePrivateSlug(slug)) throw new WikiRetireRefusal("wiki-face-private", `"${slug}" holds one face's memory (the daemon wiki); it never retires`);
    const recipeTitle = recipeUri("catalog", slug);

    // THE FACE'S OWN HALF, never the floor's: a catalog with no face half laid over it refuses.
    const handle = await opts.catalog.handle();
    const half = catalogViewOf(handle)?.faceHandle() ?? null;
    if (!half) throw new WikiRetireRefusal("no-face", "no face's catalog half stands here: wear the face that minted the wiki");
    const own = (title: string): boolean => Object.hasOwn(half.doc()?.tiddlers ?? {}, title);
    const rows = [canonBag, recipeTitle].filter(own);

    const { bound, own: ownRealm } = await opts.shell.owner(slug);
    if (bound.some((realmId) => realmId !== ownRealm)) {
      throw new WikiRetireRefusal("not-the-owner", `the workbench of "${slug}" stands under another face's realm on this vessel; wear that face to retire it`);
    }
    if (bound.length === 0 && rows.length === 0) {
      if (ownEntry(handle.doc()?.tiddlers, canonBag)) throw new WikiRetireRefusal("not-the-owner", `"${slug}" rests on another half of the catalog (the floor's), not this face's; this face minted no shell of it`);
      // The face's own realm id rides the refusal, so a CLI that died after this face's retire finishes only its own local half.
      throw new WikiRetireRefusal("no-such-wiki", `this face holds no shell of "${slug}": no catalog row and no workbench (own realm ${ownRealm})`);
    }
    const { seats, shares } = await opts.shell.shared(slug);
    if (seats.length > 0 || shares.length > 0) {
      throw new WikiRetireRefusal("wiki-shared", `"${slug}" is reached by ${seats.length} other face seat${seats.length === 1 ? "" : "s"} and ${shares.length} share row${shares.length === 1 ? "" : "s"}; nothing retired. Remove the shares first (\`lares wiki share ${slug} --remove\`, which revokes each seat), then retire`);
    }

    const counts = await opts.shell.contents(slug);
    const total = totalOf(counts);
    const force = args["force"] === true;
    if (args["dry-run"] === true) {
      const carryTo = counts.effects > 0 ? await opts.shell.carryHome(slug) : null;
      return { slug, status: "would-retire", catalogRows: rows, realmId: bound.includes(ownRealm) ? ownRealm : null, records: counts, total, carryTo, kept: { canonBag } };
    }
    if (total > 0 && !force) {
      throw new WikiRetireRefusal("wiki-not-empty", `"${slug}" holds records in its working, draft or personal layer; nothing retired. Carry them out first`);
    }
    if (total > 0 && args["count"] === undefined) {
      throw new WikiRetireRefusal("retire-count-missing", `a forced retire of "${slug}" names the record count it destroys (\`--count\`); nothing retired`);
    }
    if (total > 0 && Number(args["count"]) !== total) {
      throw new WikiRetireRefusal("retire-count-moved", `the confirmation named ${String(args["count"])} records and "${slug}" holds another count; nothing retired`);
    }
    // THE SECOND READING, right before the first write: a write that landed since the first moves the count, and nothing retires.
    if (!sameCounts(counts, await opts.shell.contents(slug))) {
      throw new WikiRetireRefusal("retire-count-moved", `"${slug}" took or lost records while the retire read it; nothing retired`);
    }

    // THE CARRY, before any erase: the effect records leave the shell only once their copy reads back whole in the face's home.
    const effects = counts.effects > 0 ? await opts.shell.effects(slug) : [];
    if (effects.length !== counts.effects) {
      throw new WikiRetireRefusal("retire-count-moved", `"${slug}" took or lost effect records while the retire read it; nothing retired`);
    }
    let carried: RetiredShellCarry | null = null;
    if (effects.length > 0) {
      const outcome = { realmId: bound.includes(ownRealm) ? ownRealm : null, forced: total > 0, authored: total, carried: effects.map((e) => e.title) };
      try { carried = await opts.shell.carry(slug, effects, outcome); }
      catch (cause) {
        const detail = (cause instanceof Error ? cause.message : String(cause)).replace(/^retire-carry-unlanded:\s*/, "");
        throw new WikiRetireRefusal("retire-carry-unlanded", `the ${effects.length} effect record${effects.length === 1 ? "" : "s"} of "${slug}" found no durable home (${detail}); nothing retired`);
      }
    }

    const canonDoc = tiddlerText(ownEntry(handle.doc()?.tiddlers, canonBag)) ?? null;
    if (total > 0 || effects.length > 0) await opts.shell.clear(slug, { authored: total > 0, effects: effects.map((e) => e.title) });
    // THE LAST READING: an effect record no carry named stays in its layer; the answer names it, never a silent orphan.
    const leftBehind = (await opts.shell.effects(slug)).map((e) => e.title).sort();
    const keyhiveBindings = await opts.shell.forget([wikiSlotUri(slug, "working"), wikiSlotUri(slug, "draft"), wikiSlotUri(slug, "personal")]);
    const slotBindings = await opts.shell.unbindSlots(slug);
    const { realmId, ledgerRows } = await opts.shell.unbind(slug);
    if (rows.length > 0) half.change((doc) => { for (const title of rows) delete doc.tiddlers[title]; });

    return { slug, status: "retired", catalogRows: rows, ledgerRows, realmId, keyhiveBindings, slotBindings, records: counts, forced: total > 0, carried, leftBehind, kept: { canonBag, canonDoc } };
  };
}

export function makeOpenWikiReactor(opts: WikiHandlerOptions): VerbReactor {
  return async (args) => {
    const slug = stringArg(args, "slug");
    if (!slug) throw new Error("args.slug is required");

    const canonBag = wikiBagUri(slug);
    // Wiki oracle lives in the catalog registry — read via the accessor, not the composite.
    const wikiUrl = await opts.catalog.urlOf(canonBag);
    if (!wikiUrl) {
      throw new Error(`no-such-bag: ${canonBag}`);
    }

    const marker = await opts.composite.get(ACTIVE_WIKI_URI);
    const currentSlug = readActiveWikiSlug(marker);
    if (currentSlug === slug) {
      return { slug, status: "already-active", liveApplied: true };
    }

    const origin: ChangeOrigin = { kind: "lares-verb", requestId: makeRequestId("wiki") };
    const record: LarTiddlerRecord = buildActiveWikiRecord(slug, "lares-cli:wiki-open");
    await opts.composite.put(record, origin, { bag: DAEMON_BAG_ID });

    // Reboot-pending: the active-wiki marker lives in the daemon bag (the running wiki doesn't
    // load it) — the switch only takes effect on next boot. Alert the wiki being
    // switched AWAY from (the one currently live), if any.
    if (currentSlug) {
      opts.post(mkDaemonWikiAlert({ wikiSlug: currentSlug, message: `Active wiki will switch to "${slug}" — reboot to load it.`, cause: "open-wiki" }));
    }

    return {
      slug,
      status: "selected-for-next-boot",
      liveApplied: false,
      rebootRequired: true,
      note: "active wiki marker updated; the current wiki keeps mounted until the next `lares vessel stand --foreground` boot (alert seeded)",
    };
  };
}
