/**
 * lar-file-picker — a page-native file offer: the page reads the file a person picked or dropped, validates its
 * size against the bound, and offers it to the island whole (page-controls#/the-control-set).
 *
 *   `<lar-file-picker data-control-id="…" data-accept="…" data-max-bytes="…"><label>… <input type="file"></label></lar-file-picker>`
 *
 * The native child is the `<input type="file">` a `$browse` widget renders, so the island lands the offer through
 * TiddlyWiki's own `$:/Import` road. A file whose text parses as `text/vnd.tiddler` JSON (an array of fields, each
 * with a title) crosses as that text when it fits the whole-value bound; any other file crosses as bounded bytes
 * beside its name and type. A file past `data-max-bytes` (never past `LAR_WHOLE_BYTES_MAX`) never crosses.
 *
 * The element keeps the chosen file's status on itself (`data-lar-status`: `reading`, `offered`, `applied`,
 * `refused`) until the island's answer lands.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/page-controls#/the-control-set
 */
import { LAR_WHOLE_BYTES_MAX, LAR_WHOLE_VALUE_MAX_CHARS, type LarWholeValue } from "@lararium/mesh/lar-camera";

/** What a read file offers: its whole value (and the file it came from, for bytes), or the bound it exceeded. */
export type FileOffer =
  | { readonly wholeValue: LarWholeValue; readonly file?: { readonly name: string; readonly type: string } }
  | { readonly refused: "input-too-long"; readonly maxBytes: number };

/** The bytes bound a picker declares, held within the wire's own. */
export function maxBytesOf(picker: Element | null): number {
  const declared = Number(picker?.getAttribute("data-max-bytes"));
  return Number.isSafeInteger(declared) && declared > 0 ? Math.min(declared, LAR_WHOLE_BYTES_MAX) : LAR_WHOLE_BYTES_MAX;
}

/** Whether a text reads as `text/vnd.tiddler` JSON: an array of fields (or one), each naming a title. */
export function readsAsTiddlers(text: string): boolean {
  let data: unknown;
  try { data = JSON.parse(text); } catch { return false; }
  const list = Array.isArray(data) ? data : [data];
  return list.length > 0 && list.every((t) => t !== null && typeof t === "object" && typeof (t as Record<string, unknown>)["title"] === "string");
}

const JSONISH = (file: File): boolean => file.type === "application/json" || file.type === "text/vnd.tiddler" || /\.json$/i.test(file.name);

/** Read one file into its offer: parsed tiddler JSON where it reads so and fits, else bounded bytes. */
export async function readFileOffer(file: File, maxBytes: number): Promise<FileOffer> {
  if (file.size > maxBytes) return { refused: "input-too-long", maxBytes };
  if (JSONISH(file)) {
    const text = await file.text();
    if (text.length <= LAR_WHOLE_VALUE_MAX_CHARS && readsAsTiddlers(text)) return { wholeValue: text };
  }
  return { wholeValue: new Uint8Array(await file.arrayBuffer()), file: { name: file.name, type: file.type } };
}

/** The words a person reads beside a file the bound refused. */
export const bytesRefusalWords = (maxBytes: number): string =>
  `This file exceeds ${maxBytes.toLocaleString("en-US")} bytes. Choose a smaller file; nothing has been imported.`;

export class LarFilePicker extends HTMLElement {
  static readonly observedAttributes = ["data-accept"];
  connectedCallback(): void { this.applyAccept(); }
  attributeChangedCallback(): void { this.applyAccept(); }
  /** The native file input this picker names. */
  input(): HTMLInputElement | null { return this.querySelector('input[type="file"]'); }
  /** The status the page holds for the chosen file until the island answers. */
  setStatus(status: "reading" | "offered" | "applied" | "refused"): void { this.setAttribute("data-lar-status", status); }
  private applyAccept(): void {
    const accept = this.getAttribute("data-accept");
    const input = this.input();
    if (input && accept !== null && input.accept !== accept) input.accept = accept;
  }
}

/** Register the element once per page. */
export function defineLarFilePicker(): void {
  if (!customElements.get("lar-file-picker")) customElements.define("lar-file-picker", LarFilePicker);
}
