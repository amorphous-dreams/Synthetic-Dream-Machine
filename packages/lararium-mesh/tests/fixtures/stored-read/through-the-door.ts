// CONTROL'S CONTROL: the same reads through the one door compile clean, and so does a write.
import { tiddlerText, type LarDoc } from "../../../src/base-doc.js";
import { plainRecord, storedDeleted } from "../../../src/stored-value.js";
import { storedRecord } from "../../../src/stored-record.js";

export function text(doc: LarDoc, title: string): string | null {
  return tiddlerText(doc.tiddlers[title]);
}

export function deleted(doc: LarDoc, title: string): boolean {
  return storedDeleted(doc.tiddlers[title]);
}

export function title(doc: LarDoc, key: string): string | undefined {
  const raw = doc.tiddlers[key];
  return raw ? plainRecord(raw).tiddler.title : undefined;
}

export function write(doc: LarDoc, key: string): void {
  doc.tiddlers[key] = storedRecord({ tiddler: { title: key, text: "body" } });
}
