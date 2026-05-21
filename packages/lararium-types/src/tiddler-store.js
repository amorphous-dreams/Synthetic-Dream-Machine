/**
 * LarTiddlerStore — TW5-neutral tiddler store contract.
 *
 * Owned by @lararium/mesh. No tiddlywiki runtime import.
 * Implemented by @lararium/tw5 (CrdtTiddlerStore, CanonTiddlerStore, MemoryTiddlerStore).
 *
 * Bags/layers model:
 *   core   — TW5 core / plugin / shadow tiddlers
 *   canon  — hostless lares/ carriers (promoted, long-lived)
 *   wiki   — shared live wiki edits (CRDT-backed)
 *   user   — operator private notes and personal overlays
 *   session — drafts, focus state, $:/temp/*, cursors (personal)
 *
 * Priority order: core < canon < wiki < user < session
 *
 * Hard rules:
 *   - wiki layer may override canon for live view; must not mutate canon.
 *   - session layer must not leak $:/temp/* or "Draft of ..." into shared state.
 *   - canon promotion is disabled until a Keyhive-backed proposal/receipt graph
 *     exists; store.put() never writes to lares/.
 *   - tombstone() marks deletion in live wiki state; no hard delete by default.
 */
// ---------------------------------------------------------------------------
// Canonical record ↔ TW5 input seam
// ---------------------------------------------------------------------------
export function toLarTiddlerRecord(fields, meta) {
    const { created: rawCreated, modified: rawModified, ...rest } = fields;
    const created = rawCreated instanceof Date ? rawCreated.toISOString() : rawCreated;
    const modified = rawModified instanceof Date ? rawModified.toISOString() : rawModified;
    return {
        tiddler: {
            ...rest,
            ...(created !== undefined && { created }),
            ...(modified !== undefined && { modified }),
        },
        ...(meta !== undefined && { meta }),
    };
}
//# sourceMappingURL=tiddler-store.js.map