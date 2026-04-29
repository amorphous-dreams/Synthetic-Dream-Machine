/**
 * cascade — retired. Cascade evaluation now lives in LarariumTW5.
 *
 * All filter evaluation goes through tw5.resolveCascadeTemplate() and
 * tw5.filterClosure() — TW5 is the engine; no external FilterEngineFn injection.
 * Results flow: wiki filterTiddlers → TW5 render → VDomNode[] → canvas.
 *
 * This file is kept as a tombstone to preserve the import path for any
 * lingering references. Remove it once all callers are migrated.
 */
