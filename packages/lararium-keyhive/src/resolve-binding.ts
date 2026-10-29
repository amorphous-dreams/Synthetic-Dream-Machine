/**
 * resolve-binding — resolver/minter for the `personal` and `draft` recipe
 * slots, keyed by (PersonaGroup × recipe-fingerprint).
 *
 * Isomorphic + island-side (isomorphic-vessel epic). Lives in @lararium/keyhive
 * — the cap layer both platforms depend on — because the mint sequence needs
 * keyhive (`registerBag` + `delegate`), which lives only in the daemon island
 * after Stage 1. Both platform daemon-island entries call it from their
 * `resolveBinding` callback with the island Repo + daemon composite + booted
 * keyhive. (It also still runs host-inline in `open-node-vessel` until the flip
 * removes the host keyhive.)
 *
 * A binding lands only after its document rests durably in repository storage.
 *
 * Daemon reads/writes go through the daemon-bag CompositeStore (`get` /
 * `put({bag: DAEMON_BAG_ID})`) — host: `daemonVm.composite`; island: `ctx.composite`.
 *
 * Canon: lar:///ha.ka.ba/lararium/api/personal-slot
 */

import {
  type LarDoc,
  type CompositeStore,
  type ChangeOrigin,
  DAEMON_BAG_ID,
  emptyLarDoc,
  mutableLarRecord,
  tiddlerText,
  canonicalJson,
} from "@lararium/mesh";
import type { CapabilityProvider } from "./capability-provider.js";
import type { FaceBagDoor } from "./face-bag-door.js";

/**
 * Minimal Automerge-repo surface the minter needs. Both the
 * node and browser `Repo` satisfy it structurally, so @lararium/keyhive avoids a
 * direct `@automerge/automerge-repo` dependency.
 */
export interface DocMinter {
  create<T = LarDoc>(initialValue: T): { readonly url: string; readonly documentId: string; whenReady?(): Promise<unknown> };
  /** Resolve once the named documents rest durably in this Repo's storage. */
  flush(documents?: string[]): Promise<void>;
}

/**
 * A minter whose `flush` also waits on a SECOND store's acknowledgment. An island's Repo may keep no store for a
 * document it mints (the vessel's Repo saves it), so its own `flush` proves nothing about rest; `rest` asks the
 * store that does save it. `flush` resolves only after both, and rejects when either does.
 */
export function restingMinter(repo: DocMinter, rest: (documentIds: readonly string[]) => Promise<void>): DocMinter {
  const more = repo as unknown as { find?: (url: string) => unknown; delete?: (url: string) => unknown };
  return {
    create: (initialValue) => repo.create(initialValue),
    flush: async (documents) => {
      await repo.flush(documents);
      await rest(documents ?? []);
    },
    // The lift reads and deletes documents through the same repo that mints them.
    ...(typeof more.find === "function" ? { find: (url: string) => more.find!.call(repo, url) } : {}),
    ...(typeof more.delete === "function" ? { delete: (url: string) => more.delete!.call(repo, url) } : {}),
  } as DocMinter;
}

/** The binding kinds — one tiddler `kind` field per slot. */
export type BindingKind = "personal-binding" | "draft-binding";

export interface ResolveBindingArgs {
  /** Tiddler `kind` field value — distinguishes personal / draft / working bindings. */
  readonly kind: BindingKind;
  /** Daemon tiddler-title prefix (PERSONAL_ | DRAFT_BINDINGS_PREFIX). */
  readonly prefix: string;
  /** SHA-256 hex from computeRecipeFingerprint — the per-recipe binding key. */
  readonly fingerprint: string;
  /** Automerge repo that mints the bound doc on absent (host relay or island Repo). */
  readonly repo: DocMinter;
  /**
   * Daemon-bag composite — reads existing bindings + writes new binding tiddlers.
   * Host-side: `daemonVm.composite`; island-side: the worker's `ctx.composite`.
   */
  readonly daemonStore: CompositeStore;
  /** The selected face's provider; absent at the faceless floor, where a binding document carries no Keyhive registration. */
  readonly keyhive?: CapabilityProvider;
  readonly faceDoor?: FaceBagDoor;
  /** Whether the face the vessel pins holds a SEAT the delegating identity can name. Absent → seated. A
   *  joinee admitted by edge alone answers false until a face-join lands its membership events. */
  readonly faceSeated?: () => Promise<boolean>;
  /** Wait for an in-flight seat act before deciding where a fresh mint lands. */
  readonly seatSettled?: () => Promise<void>;
  /**
   * PersonaGroup AGENT Identifier hex (getAgent-resolvable) — the delegation
   * audience. NOT the group's DocumentId (that is the membership-check target).
   *
   * ABSENT AT THE WAKING FLOOR, and that is a posture rather than a fault. A vessel holding no face
   * still holds its own docs: the MINT is what confers authority (`registerBag` generates the
   * document, and its generator is admin by construction), so a faceless binding is not a doc nobody
   * holds — it is a doc the VESSEL holds, the posture the daemon bag itself has always stood in. The
   * face door mints a separate document when a face is seated.
   */
  readonly personaGroupId?: string | undefined;
  /** Vessel Individual hex — the binding tiddler's `minted-by` audit field. */
  readonly mintedByHex: string;
  /** Fingerprint inputs, stored verbatim as the `recipe-trace` audit field (Q5: keep). */
  readonly recipeTrace: { readonly wikiDocId: string; readonly libraryBagDocIds: readonly string[] };
}

export interface ResolveBindingResult {
  /** The bound `personal` / `draft` Automerge doc URL. */
  readonly url: string;
  /** true when this call minted a fresh doc; false on reuse-on-present. */
  readonly minted: boolean;
}

export class BindingRegistrationRefusal extends Error {
  constructor(bindingKey: string, bagUrl: string) {
    super(`BindingRegistrationRefusal: binding ${bindingKey} cannot restore Keyhive registration for ${bagUrl}; perform a fresh start by hand because no compatibility reader can guess its document identity.`);
    this.name = "BindingRegistrationRefusal";
  }
}

/**
 * Resolve the bound doc URL for a (PersonaGroup × recipe-fingerprint) slot, or
 * mint + delegate + record it when absent.
 *
 * Reuse-on-present returns the stored URL without minting. A vessel-only record
 * moves under the face at the seat's landing, by the lift pass (`anon-lift`), and this resolver never re-registers it. A face record's recorded Keyhive document ID restores
 * the process-local mapping on the provider that holds it. Reuse MUST NOT block boot on
 * a doc not yet decryptable on this device (the two-phase Keyhive window): the
 * caller mounts the URL and the island surfaces it when sync delivers the BeeKEM
 * key. See personal-slot#lifecycle "authorized-but-undecryptable window".
 */
export async function resolveOrMintBinding(args: ResolveBindingArgs): Promise<ResolveBindingResult> {
  const key = `${args.prefix}/${args.fingerprint}`;

  // Reuse-on-present — the binding tiddler already replicated to this device.
  const record = await args.daemonStore.get(key);
  const existing = tiddlerText(record);
  if (existing) {
    const fields = record?.tiddler as Record<string, unknown> | undefined;
    // A face binding adopts on the face that created it. A fleet sibling standing no face door reaches the
    // document through its seat in the group, so it adopts nothing.
    if (fields?.["face-reach"] === "face" && args.faceDoor) {
      const docId = fields["keyhive-doc-id"];
      if (typeof docId !== "string" || !docId) throw new BindingRegistrationRefusal(key, existing);
      args.faceDoor.adopt(existing, docId);
    }
    return { url: existing, minted: false };
  }

  // Mint-on-absent waits for a running seat act before choosing its owner.
  await args.seatSettled?.();
  // A binding never names a document before it rests durably.
  const handle = args.repo.create<LarDoc>(emptyLarDoc());

  // The provider mapping is process-local, so the binding carries its document ID for reuse.
  const seated = !!(args.personaGroupId && args.faceDoor && await (args.faceSeated?.() ?? Promise.resolve(true)));
  const keyhiveDocId = seated
    ? (await args.faceDoor!.mint(handle.url, "admin")).docId
    : args.keyhive ? (await args.keyhive.registerBag(handle.url)).docId : undefined;

  // A seat makes the face the creator. At the floor the vessel creates the document alone.
  // Keyhive's admin grant carries the writable slot until an edit grade is available.

  const mintKey = `${args.prefix}-minted/${args.fingerprint}/${handle.documentId}`;
  await args.daemonStore.put(mutableLarRecord(mintKey, {
    text: handle.url,
    kind: "binding-mint",
    "binding-kind": args.kind,
    fingerprint: args.fingerprint,
    "minted-by": args.mintedByHex,
  }, "binding-mints"), originFor(`binding-mint-${args.fingerprint}`), { bag: DAEMON_BAG_ID });
  await handle.whenReady?.();
  await args.repo.flush([handle.documentId]);

  // Record the binding in the daemon doc — replicates to the operator's other
  // devices, where reuse-on-present finds it next boot.
  await args.daemonStore.put(mutableLarRecord(key, {
    text:          handle.url,
    kind:          args.kind,
    fingerprint:   args.fingerprint,
    "recipe-trace": canonicalJson(args.recipeTrace),
    "minted-by":   args.mintedByHex,
    "face-reach":  seated ? "face" : "vessel-only",
    ...(keyhiveDocId !== undefined ? { "keyhive-doc-id": keyhiveDocId } : {}),
  }, "personal-bindings"), originFor(`binding-${args.fingerprint}`), { bag: DAEMON_BAG_ID });

  return { url: handle.url, minted: true };
}

function originFor(fingerprint: string): ChangeOrigin {
  return { kind: "lares-verb", requestId: fingerprint.slice(0, 32) };
}

/** Mints without a matching binding remain visible for operator inspection. */
export async function unboundMints(daemonStore: CompositeStore): Promise<Array<{ kind: BindingKind; fingerprint: string; url: string }>> {
  const entries = await daemonStore.entries();
  const bindings = new Map<string, string>();
  for (const { title, bagId, record } of entries) {
    if (bagId === DAEMON_BAG_ID && !title.includes("-minted/")) {
      const fields = record.tiddler as Record<string, unknown>;
      if (typeof fields.fingerprint === "string" && typeof fields.kind === "string" && fields.kind !== "binding-mint" && typeof fields.text === "string") {
        bindings.set(`${title.slice(0, title.lastIndexOf("/"))}/${fields.fingerprint}`, fields.text);
      }
    }
  }
  const unbound: Array<{ kind: BindingKind; fingerprint: string; url: string }> = [];
  for (const { title, bagId, record } of entries) {
    if (bagId !== DAEMON_BAG_ID || !title.includes("-minted/")) continue;
    const fields = record.tiddler as Record<string, unknown>;
    const kind = fields["binding-kind"];
    const fingerprint = fields.fingerprint;
    const url = fields.text;
    if ((kind === "personal-binding" || kind === "draft-binding") && typeof fingerprint === "string" && typeof url === "string") {
      const bindingPrefix = title.slice(0, title.indexOf("-minted/"));
      if (bindings.get(`${bindingPrefix}/${fingerprint}`) !== url) unbound.push({ kind, fingerprint, url });
    }
  }
  return unbound;
}
