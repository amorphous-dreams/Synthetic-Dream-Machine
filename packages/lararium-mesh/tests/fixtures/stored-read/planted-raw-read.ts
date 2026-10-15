// PLANTED FAULT (census control): a reader takes a record's field straight off a document. The stored
// type exposes no field, so each line below must refuse to compile.
import type { LarDoc } from "../../../src/base-doc.js";

export function rawText(doc: LarDoc, title: string): unknown {
  return doc.tiddlers[title]?.tiddler.text;
}

export function rawDeleted(doc: LarDoc, title: string): unknown {
  return doc.tiddlers[title]?.meta?.deleted;
}
