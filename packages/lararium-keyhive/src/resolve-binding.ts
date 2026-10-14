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
  return {
    create: (initialValue) => repo.create(initialValue),
    flush: async (documents) => {
      await repo.flush(documents);
      await rest(documents ?? []);
    },
  };
}

/** The binding kinds — one tiddler `kind` field per slot. */
export type BindingKind = "personal-binding" | "draft-binding" | "working-binding";

export interface ResolveBindingArgs {
  /** Tiddler `kind` field value — distinguishes personal / draft / working bindings. */
  readonly kind: BindingKind;
  /** Daemon tiddler-title prefix (PERSONAL_ | DRAFT_ | WORKING_BINDINGS_PREFIX). */
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
  /** Keyhive provider — registers the minted bag + delegates it to the PersonaGroup. */
  readonly keyhive: CapabilityProvider;
  /** The face-delegation road. Under a veil-born founding the vessel never knows the group agent, so
   *  the caller injects the veil road (vessel→veil→group); absent, the direct delegate runs. */
  readonly delegateToFace?: (bagUrl: string, access: "read" | "admin") => Promise<void>;
  /** Whether the face the vessel pins holds a SEAT the delegating identity can name. Absent → seated. A
   *  joinee admitted by edge alone answers false until a face-join lands its membership events. */
  readonly faceSeated?: () => Promise<boolean>;
  /**
   * PersonaGroup AGENT Identifier hex (getAgent-resolvable) — the delegation
   * audience. NOT the group's DocumentId (that is the membership-check target).
   *
   * ABSENT AT THE WAKING FLOOR, and that is a posture rather than a fault. A vessel holding no face
   * still holds its own docs: the MINT is what confers authority (`registerBag` generates the
   * document, and its generator is admin by construction), so a faceless binding is not a doc nobody
   * holds — it is a doc the VESSEL holds, the posture the daemon bag itself has always stood in. The
   * delegation ADDS a persona over that hold; it never creates it.
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
 * may re-grant after the face seats; its recorded Keyhive document ID restores
 * the process-local bag mapping before delegation, and a stand that holds no hand
 * in that document mints a fresh one and records it. Reuse MUST NOT block boot on
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
    await regrantOnSeat(args, key, existing, fields);
    return { url: existing, minted: false };
  }

  // Mint-on-absent: a binding never names a document before it rests durably.
  const handle = args.repo.create<LarDoc>(emptyLarDoc());

  // delegate() throws unless the bag's Keyhive Document already exists, so
  // registerBag mints it first. The provider mapping is process-local, so the
  // binding carries this document ID for the reuse path. The minting device is implicit admin.
  const { docId: keyhiveDocId } = await args.keyhive.registerBag(handle.url);

  // COMPOSE A FACE ONTO THE VESSEL'S HOLD, where one stands. The vessel is already this document's
  // admin by having generated it; this delegation widens the hold to the operator's PersonaGroup so
  // the binding follows them across devices. A vessel at the waking floor delegates to nobody and
  // keeps the doc on its own key — a Herm stands its `@daemon` wiki that way, which is how a
  // lamplighter reaches one.
  //
  // access: "admin" — POLA-correct grain for co-edited view-state is "edit", but the live Keyhive
  // gate exposes only read | admin, so edit-intent rounds UP to admin as documented interim debt
  // (marginal authority ≈ 0; every PersonaGroup device already holds admin on the daemon bag).
  // Adopt "edit" the moment the gate accepts it. Debt: causal-islands.md.
  // A PIN IS STANDING; A SEAT IS CAPABILITY. A vessel admitted by edge alone pins the group's agent id and
  // holds no seat in the group yet — its veil cannot name that agent, and a delegation to it throws. The
  // binding then stays on the vessel's own key, the same posture a faceless vessel holds, and the record
  // says so; a seated face re-grants a vessel-only binding when its resolver reuses it.
  const seated = args.personaGroupId ? await (args.faceSeated?.() ?? Promise.resolve(true)) : false;
  if (args.personaGroupId && seated) {
    if (args.delegateToFace) {
      await args.delegateToFace(handle.url, "admin");
    } else {
      await args.keyhive.delegate({
        bagUrl:   handle.url,
        audience: args.personaGroupId,
        access:   "admin",
      });
    }
  }

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
    "keyhive-doc-id": keyhiveDocId,
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
    if ((kind === "personal-binding" || kind === "draft-binding" || kind === "working-binding") && typeof fingerprint === "string" && typeof url === "string") {
      const bindingPrefix = title.slice(0, title.indexOf("-minted/"));
      if (bindings.get(`${bindingPrefix}/${fingerprint}`) !== url) unbound.push({ kind, fingerprint, url });
    }
  }
  return unbound;
}

/**
 * A SEAT LANDING AFTER THE MINT RE-GRANTS THE BINDING. A record reading `face-reach = "vessel-only"` names
 * a binding minted while the face stood pinned and unseated; once the seat's events reach this vessel the
 * face can be named, and the reuse path is the one moment every later boot passes through. The vessel
 * stands admin of a doc it minted, so the re-delegation needs no founder signature. The record then
 * takes the spelling a seated mint writes — `face` — and the next reuse re-grants nothing.
 */
async function regrantOnSeat(
  args: ResolveBindingArgs,
  key: string,
  url: string,
  fields: Record<string, unknown> | undefined,
): Promise<void> {
  if (fields?.["face-reach"] !== "vessel-only") return;
  if (!args.personaGroupId) return;
  const seated = await (args.faceSeated?.() ?? Promise.resolve(true));
  if (!seated) return;
  let keyhiveDocId = restoreBagRegistration(args, key, url, fields);
  // THE RECORDED DOCUMENT SERVES ONLY A STAND THAT STILL HOLDS ITS HAND IN IT. The stand that minted this binding
  // held the document's key agreement state in its own provider; a vessel at the floor keeps no Archive, so that
  // state left with it, and no later stand can add a member to the document or seal into it. The binding stood
  // vessel-only, so nobody else ever held reach through that document: this stand mints a fresh Keyhive document
  // for the same Automerge document, grants the face on it, and the record names the one that serves.
  if (!(await args.keyhive.holdsHand(url))) {
    keyhiveDocId = (await args.keyhive.remintBag(url)).docId;
  }
  if (args.delegateToFace) {
    await args.delegateToFace(url, "admin");
  } else {
    await args.keyhive.delegate({ bagUrl: url, audience: args.personaGroupId, access: "admin" });
  }
  // Every field the record carried rides through; only the posture moves.
  const carried: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields ?? {})) {
    if (k !== "title" && typeof v === "string") carried[k] = v;
  }
  const origin: ChangeOrigin = { kind: "lares-verb", requestId: `binding-regrant-${args.fingerprint.slice(0, 8)}` };
  await args.daemonStore.put(mutableLarRecord(key, {
    ...carried,
    text:         url,
    "face-reach": "face",
    "keyhive-doc-id": keyhiveDocId,
  }, "personal-bindings"), origin, { bag: DAEMON_BAG_ID });
}

/** A reused binding carries its Keyhive document identity beside its Automerge URL; returns that identity. */
function restoreBagRegistration(
  args: ResolveBindingArgs,
  key: string,
  url: string,
  fields: Record<string, unknown> | undefined,
): string {
  const keyhiveDocId = fields?.["keyhive-doc-id"];
  if (typeof keyhiveDocId !== "string" || keyhiveDocId.length === 0) {
    throw new BindingRegistrationRefusal(key, url);
  }
  args.keyhive.adoptBag(url, keyhiveDocId);
  return keyhiveDocId;
}
