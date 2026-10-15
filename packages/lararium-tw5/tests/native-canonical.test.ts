/**
 * native-canonical — RED-FIRST evidence for the projecting leg's native congruence
 * (`canonicalizeNativeCarrierText`), the `disk-projector.ts` gap the operator named:
 * `canonicalizeFn` gated on `file.ext === MEME_EXT` alone, so a native carrier's
 * `diskCanonicalHash` was ALWAYS null — the `≈` clause never fired for any native
 * filetype and a trivially-equivalent both-move (reordered JSON keys) read `conflict`
 * exactly like a genuine divergence.
 *
 * This function mirrors `action-handler.ts`'s `nativeRender` (the ingest leg's
 * PROVEN native congruence) onto the projecting shore: deserialize disk bytes, merge
 * the `.meta` sidecar over the result, render back through the SAME
 * `Tw5Deserializer` the ingest leg closes over.
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/native-canonical
 */

import { describe, test, expect } from "vitest";
import { canonicalizeNativeCarrierText } from "../src/native-canonical.js";
import type { Tw5Deserializer } from "../src/action-handler.js";

/**
 * A fake `Tw5Deserializer` whose `renderCarrier` renders a JSON-typed record to
 * CANONICAL (sorted-key, 2-space) JSON — a minimal but faithful stand-in for TW5's
 * OWN `application/json` file-info cascade, which always re-serializes to ONE
 * canonical form regardless of how the disk bytes were formatted (key order,
 * whitespace). `.tid` renders a field-block + text body, mirroring `makeTw5FileInfo`.
 */
function fakeDeserializer(): Tw5Deserializer {
  return {
    deserialize: (ext, text) => {
      if (ext === ".json" || ext === "application/json") {
        const parsed = JSON.parse(text) as Record<string, unknown>;
        return [parsed];
      }
      // `.tid`: a field block, blank line, then the text body.
      const lines = text.split("\n");
      const fields: Record<string, unknown> = {};
      let i = 0;
      for (; i < lines.length; i++) {
        if (lines[i] === "") break;
        const m = /^([^:\s]+):\s*(.*)$/.exec(lines[i]!);
        if (m) fields[m[1]!] = m[2];
      }
      fields["text"] = lines.slice(i + 1).join("\n");
      return [fields];
    },
    parseFields: (metaText) => {
      const fields: Record<string, unknown> = {};
      for (const line of metaText.split("\n")) {
        const m = /^([^:\s]+):\s*(.*)$/.exec(line);
        if (m) fields[m[1]!] = m[2];
      }
      return fields;
    },
    renderCarrier: (_uri, fields) => {
      if (fields["type"] === "application/json") {
        const { ...rest } = fields;
        // CANONICAL form: sorted keys, 2-space indent — exactly what a real
        // JSON.stringify(obj, Object.keys(obj).sort(), 2)-style cascade would settle to.
        const sorted: Record<string, unknown> = {};
        for (const k of Object.keys(rest).sort()) sorted[k] = rest[k];
        return { body: JSON.stringify(sorted, null, 2) };
      }
      const text = typeof fields["text"] === "string" ? (fields["text"] as string) : "";
      const rest = Object.keys(fields).filter((k) => k !== "text" && k !== "title").sort();
      const block = [`title: ${fields["title"] as string}`, ...rest.map((k) => `${k}: ${fields[k] as string}`)].join("\n");
      return { body: `${block}\n\n${text}` };
    },
    serializeBundle: () => { throw new Error("not used by this fake"); },
    contentTypeFromExt: () => undefined,
  };
}

describe("canonicalizeNativeCarrierText — the projecting leg's native `≈`", () => {
  const URI = "lar:///ha.ka.ba/lares/parity/note";

  test("★ RED-turned-GREEN: reformatted JSON (reordered keys, different whitespace) reads as the SAME canonical text ★", () => {
    const d = fakeDeserializer();
    const a = canonicalizeNativeCarrierText(d, URI, ".json", `{\n  "title": "${URI}",\n  "type": "application/json",\n  "b": "2",\n  "a": "1"\n}`, undefined);
    const b = canonicalizeNativeCarrierText(d, URI, ".json", `{"a":"1","type":"application/json","b":"2","title":"${URI}"}`, undefined);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a!.body).toBe(b!.body);
  });

  test("a genuinely DIFFERENT native carrier canonicalizes to a DIFFERENT text (no false equivalence)", () => {
    const d = fakeDeserializer();
    const a = canonicalizeNativeCarrierText(d, URI, ".json", `{"title":"${URI}","type":"application/json","a":"1"}`, undefined);
    const b = canonicalizeNativeCarrierText(d, URI, ".json", `{"title":"${URI}","type":"application/json","a":"2"}`, undefined);
    expect(a!.body).not.toBe(b!.body);
  });

  test("a `.tid` carrier with a reordered field block canonicalizes the same way", () => {
    const d = fakeDeserializer();
    const a = canonicalizeNativeCarrierText(d, URI, ".tid", `title: ${URI}\ntags: x y\ntype: text/vnd.tiddlywiki\n\nhello\n`, undefined);
    const b = canonicalizeNativeCarrierText(d, URI, ".tid", `type: text/vnd.tiddlywiki\ntitle: ${URI}\ntags: x y\n\nhello\n`, undefined);
    expect(a!.body).toBe(b!.body);
  });

  test("the `.meta` sidecar merges OVER the deserialized fields, exactly as LOAD's nativeRender does", () => {
    const d = fakeDeserializer();
    const withMeta = canonicalizeNativeCarrierText(d, URI, ".tid", `title: ${URI}\n\nbody text\n`, `title: ${URI}\ntags: from-meta\n`);
    expect(withMeta!.body).toContain("tags: from-meta");
  });

  test("a BUNDLE (more than one deserialized member) fails CLOSED — null, never a guess", () => {
    const d: Tw5Deserializer = {
      ...fakeDeserializer(),
      deserialize: () => [{ title: "member-a" }, { title: "member-b" }],
    };
    expect(canonicalizeNativeCarrierText(d, URI, ".multids", "member-a: x\nmember-b: y\n", undefined)).toBeNull();
  });

  test("a single member whose OWN title differs from the carrier URI fails CLOSED (a pack member, not a single carrier)", () => {
    const d: Tw5Deserializer = { ...fakeDeserializer(), deserialize: () => [{ title: "some-other-title" }] };
    expect(canonicalizeNativeCarrierText(d, URI, ".json", "{}", undefined)).toBeNull();
  });

  test("a throwing deserializer (malformed disk bytes) fails CLOSED — null, never a guess", () => {
    const d: Tw5Deserializer = { ...fakeDeserializer(), deserialize: () => { throw new Error("bad json"); } };
    expect(canonicalizeNativeCarrierText(d, URI, ".json", "{not json", undefined)).toBeNull();
  });
});
