/**
 * sealed-store.worker — a dedicated worker's thread standing in for the island thread the vessel worker spawns. It stands the
 * browser's rest for the sealed store over IndexedDB, seats a content-key holder over it, and runs the document store's sealed
 * rest over Automerge's own IndexedDB adapter, so the suite reads every byte that reached rest from the page's side.
 *
 * The key shore models the measured substrate (as `@lararium/mesh` `tests/content-key-fixture.ts` does): a wrap seats this
 * vessel alone, and its documents live in this thread's memory, so a restart inside one worker's life finds them again.
 */
import * as A from "@automerge/automerge";
import { Repo, type AutomergeUrl } from "@automerge/automerge-repo";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
import { ContentKeyHolder, SealedDocumentStore, SealedStore, type LockboxWrapShore, type RecordSigner } from "@lararium/mesh";
import { utf8Bytes } from "@lararium/mesh/crypto";
import { faceProofSubjectRef, sessionSignatureImage } from "@lararium/mesh/face-proof-subjects";
import { idbSealedStoreShore } from "../../src/browser-sealed-store.js";
import { chain, signHex } from "../../../lararium-mesh/tests/face-proof-fixture.js";

const scope = globalThis as unknown as {
  addEventListener(type: "message", callback: (event: MessageEvent) => void): void;
  postMessage(message: unknown): void;
};

const docs = new Map<string, Uint8Array>();
const SELF = "ab".repeat(32);
const shore: LockboxWrapShore = {
  async wrap({ ref, payload }) {
    const id = Array.from(ref, (b) => b.toString(16).padStart(2, "0")).join("");
    docs.set(id, Uint8Array.from(payload));
    return { box: utf8Bytes(id), served: [], unreached: [] };
  },
  async unwrap(box) { const got = docs.get(new TextDecoder().decode(box)); return got ? Uint8Array.from(got) : null; },
  async opsFor() { return []; },
  async ingest() { /* one vessel: nothing travels */ },
  async self() { return [SELF]; },
};

const BAG = "lar:///ha.ka.ba/@test/bags/browser-notes";

async function signer(): Promise<{ signer: RecordSigner; face: string }> {
  const c = await chain("browser", "nexus-test-one");
  return {
    face: faceProofSubjectRef(c.scope),
    signer: {
      certificate: c.sessionCertificate,
      sign: async (purpose, payload) => ({ signature: await signHex(sessionSignatureImage(purpose, c.scope, c.sessionCertificate.sessionKey, payload), c.session) }),
    },
  };
}

function holderOver(dbName: string): ContentKeyHolder {
  const sealed = idbSealedStoreShore(dbName);
  return new ContentKeyHolder({
    store: new SealedStore(sealed.rest), shore,
    readersOf: async () => [], standing: { holdsWrite: () => true },
    evidenceOf: async () => ({ raiseCounts: () => false, admissionVerifies: () => false }),
    ownEdgeShadowed: async () => false, ownSeat: async () => SELF,
    values: sealed.values,
  });
}

scope.addEventListener("message", (event) => {
  const msg = event.data as { op: string; dbName: string; docDb: string; secret: string };
  void (async () => {
    const { signer: s, face } = await signer();
    if (msg.op === "seal-and-reopen") {
      const sealed = await holderOver(msg.dbName).sealBlob({ bagId: BAG, plaintext: utf8Bytes(msg.secret), signer: s });
      if ("refusal" in sealed) throw new Error(`seal refused ${sealed.refusal}`);
      // A restart: a fresh holder over a fresh shore of the same database.
      const opened = await holderOver(msg.dbName).openBlob({ bagId: BAG, ref: sealed.body.ref });
      scope.postMessage({ op: msg.op, thread: typeof (globalThis as Record<string, unknown>)["window"], text: "plaintext" in opened ? new TextDecoder().decode(opened.plaintext) : `REFUSED:${opened.refusal}` });
    } else if (msg.op === "document") {
      const holder = holderOver(msg.dbName);
      let control = "";
      const store = () => new SealedDocumentStore({
        inner: new IndexedDBStorageAdapter(msg.docDb),
        bagOf: (documentId) => (documentId === control ? null : { bagId: BAG, face }),
        sessionFace: () => face,
        seal: (args) => holder.sealValues({ ...args, signer: s }),
        open: (args) => holder.openValue(args),
      });
      const repo = new Repo({ storage: store(), network: [] });
      const sealedDoc = repo.create<{ note?: string }>();
      const clearDoc = repo.create<{ note?: string }>();
      control = clearDoc.documentId;
      sealedDoc.change((d) => { d.note = msg.secret; });
      clearDoc.change((d) => { d.note = `${msg.secret}-in-the-clear`; });
      await repo.flush();
      await repo.shutdown();
      const again = new Repo({ storage: store(), network: [] });
      const found = await again.find<{ note?: string }>(sealedDoc.documentId as unknown as AutomergeUrl);
      const note = found.doc().note ?? null;
      await again.shutdown();
      scope.postMessage({ op: msg.op, sealedDoc: sealedDoc.documentId, clearDoc: clearDoc.documentId, note, engine: typeof A.load });
    }
  })().catch((e: unknown) => scope.postMessage({ op: msg.op, error: e instanceof Error ? e.message : String(e) }));
});

scope.postMessage({ type: "ready" });
