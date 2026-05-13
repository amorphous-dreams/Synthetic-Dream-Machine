/*\
title: lar:///ha.ka.ba/@lararium/tw5/modules/deserializer
type: application/javascript
module-type: tiddlerdeserializer
\*/
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
//#region ../lararium-core/dist/meme-stream.js
/**
* meme-stream — streaming parser for the memetic-wikitext carrier protocol.
*
* Carrier framing uses HTML-entity control sigils as stream boundaries:
*
*   <<~[prefix?]&#x0001; ? -> lar:///URI >>   SOH — opens a carrier, declares URI
*   <<~[prefix?]&#x0002;[^>]*>>               STX — header→body boundary
*   <<~[prefix?]&#x0003;[^>]*>>               ETX — closes body (carrier done)
*   <<~[prefix?]&#x0004;[^>]*>>               EOT — carrier exit sigil
*   <<~ -> ? >>                                return-throat — EOT variant
*   <<~ ahu #slot >>...<<~/ahu >>             ahu section — incremental child event
*
* Kapu extended range: &#x0011; = SOH variant, &#x0014; = EOT variant.
*
* MemeStreamParser uses an index-based scan (no buffer slicing mid-frame)
* so fullText in carrier-close is always the complete SOH→ETX span.
*
* Designed for:
*   - Single-carrier streaming: Automerge CRDT patches arriving incrementally
*   - Multi-Realm ingestion: sequence of carriers from a remote Realm's meme stream
*
* This module is isomorphic (no fs/DOM/TW5 dependencies).
*/
var SOH_RE = /<<~(?:[^>]|->)*&#x(?:0001|0011);(?:[^>]|->)*\?\s*->\s*([^\s>]+)\s*>>/;
var STX_RE = /<<~(?:[^>]|->)*&#x0002;(?:[^>]|->)*>>/;
var ETX_RE = /<<~(?:[^>]|->)*&#x0003;(?:[^>]|->)*>>/;
var EOT_RE = /<<~(?:(?:[^>]|->)*&#x(?:0004|0014);(?:[^>]|->)*|\s*->\s*\?)\s*>>/;
var AHU_OPEN_RE$1 = /<<~(?:[^>]|->)*\bahu\s+(#[\w-]+)\s*>>/;
var AHU_CLOSE_RE$1 = /<<~\/ahu\s*>>/;
function find(text, re) {
	const m = re.exec(text);
	if (!m) return null;
	return {
		index: m.index,
		end: m.index + m[0].length,
		cap: m[1]
	};
}
function earliest(...hits) {
	let best = null;
	for (const { tag, h } of hits) {
		if (!h) continue;
		if (!best || h.index < best.index) best = {
			tag,
			index: h.index,
			end: h.end,
			cap: h.cap
		};
	}
	return best;
}
var MemeStreamParser = class {
	_buf = "";
	_pos = 0;
	_state = "idle";
	_uri = "";
	_sohStart = 0;
	_inAhu = false;
	_ahuSlot = "";
	_ahuStart = 0;
	_ahuDepth = 0;
	/** Push a text chunk. Returns all events emitted during this chunk. */
	push(chunk) {
		this._buf += chunk;
		return this._drain();
	}
	/** Signal end of input — flushes any open carrier as a best-effort close. */
	flush() {
		const events = [];
		if (this._state !== "idle" && this._uri) events.push({
			kind: "carrier-close",
			uri: this._uri,
			fullText: this._buf.slice(this._sohStart)
		});
		this._buf = "";
		this._pos = 0;
		this._state = "idle";
		this._uri = "";
		this._inAhu = false;
		return events;
	}
	_drain() {
		const events = [];
		let safety = 0;
		while (safety++ < 1e4) {
			const remaining = this._buf.slice(this._pos);
			if (this._state === "idle") {
				const soh = find(remaining, SOH_RE);
				const eot = find(remaining, EOT_RE);
				if (!soh && !eot) break;
				if (eot && (!soh || eot.index <= soh.index)) {
					this._pos += eot.end;
					if (!this._buf.slice(this._pos).trim()) {
						events.push({ kind: "realm-done" });
						this._gc();
					}
					continue;
				}
				if (soh) {
					this._uri = soh.cap ?? "";
					this._sohStart = this._pos + soh.index;
					this._pos += soh.end;
					this._state = "header";
					events.push({
						kind: "carrier-open",
						uri: this._uri
					});
				}
				continue;
			}
			if (this._state === "header") {
				const stx = find(remaining, STX_RE);
				const eot = find(remaining, EOT_RE);
				if (!stx && !eot) break;
				if (eot && (!stx || eot.index < stx.index)) {
					const fullText = this._buf.slice(this._sohStart, this._pos + eot.end);
					events.push({
						kind: "carrier-close",
						uri: this._uri,
						fullText
					});
					this._pos += eot.end;
					this._state = "idle";
					this._uri = "";
					this._gc();
					continue;
				}
				this._pos += stx.end;
				this._state = "body";
				continue;
			}
			if (this._state === "body") {
				if (!this._inAhu) {
					const hit = earliest({
						tag: "ahu",
						h: find(remaining, AHU_OPEN_RE$1)
					}, {
						tag: "etx",
						h: find(remaining, ETX_RE)
					}, {
						tag: "eot",
						h: find(remaining, EOT_RE)
					});
					if (!hit) break;
					if (hit.tag === "ahu") {
						this._ahuSlot = hit.cap ?? "";
						this._ahuStart = this._pos + hit.end;
						this._ahuDepth = 1;
						this._inAhu = true;
						this._pos += hit.end;
						continue;
					}
					const fullText = this._buf.slice(this._sohStart, this._pos + hit.end);
					events.push({
						kind: "carrier-close",
						uri: this._uri,
						fullText
					});
					this._pos += hit.end;
					this._state = "idle";
					this._uri = "";
					this._gc();
					continue;
				}
				const closeH = find(remaining, AHU_CLOSE_RE$1);
				const openH = find(remaining, AHU_OPEN_RE$1);
				if (openH && (!closeH || openH.index < closeH.index)) {
					this._ahuDepth++;
					this._pos += openH.end;
					continue;
				}
				if (!closeH) break;
				this._ahuDepth--;
				if (this._ahuDepth <= 0) {
					const bodyText = this._buf.slice(this._ahuStart, this._pos + closeH.index);
					events.push({
						kind: "ahu-child",
						uri: this._uri,
						slot: this._ahuSlot,
						bodyText
					});
					this._inAhu = false;
					this._ahuSlot = "";
					this._pos += closeH.end;
					continue;
				}
				this._pos += closeH.end;
				continue;
			}
			break;
		}
		return events;
	}
	/** Trim fully-consumed prefix of _buf to keep memory bounded. */
	_gc() {
		if (this._state === "idle" && this._pos > 4096) {
			this._buf = this._buf.slice(this._pos);
			this._pos = 0;
		}
	}
};
//#endregion
//#region ../lararium-core/dist/meme-ast/ahu-scan.js
/**
* ahu-scan — single source of truth for ahu sigil block recognition.
*
* Three callers consume this module identically:
*   - `@lararium/tw5/src/deserializer.ts` (CLI / sync ingest)
*   - `@lararium/tw5/src/widgets/lar-meme-split.ts` (TW5 UX save)
*   - `@lararium/tw5/src/wikirules/memetic-wikitext-sigil.ts` (render-time
*      parse via TW5 wikifier)
*
* One regex pair, one balanced-bracket scanner, one slot-path composer —
* any drift between callers is a bug, so they share this module.
*
* Schema: lar:///ha.ka.ba/@lares/api/v0.1/lararium/schema/ahu-scan
*/
/**
* Slot identifier — supports nested fragment paths via `/`-separated
* segments per memetic-wikitext spec §nested-ahu and lar-uri.md §5.6.
*
* `<<~ ahu #parent/child/grandchild >>` opens a slot whose URI is
* `parentURI#parent/child/grandchild` — single-hash invariant; the
* fragment-path is the addressable hierarchy.
*/
var AHU_OPEN_RE = /<<~[^>]*\bahu\s+(#[\w-]+(?:\/[\w-]+)*)(?:\s+->\s+\S+)?\s*>>/g;
var AHU_CLOSE_RE = /<<~\/ahu\s*>>/g;
/**
* Ahu slot names that carry structural metadata, not addressable content.
* They dissolve into the parent or are structural-only — not split into
* child tiddlers. Per memetic-wikitext.md §161 (Ahu Control Slots).
*/
var CONTROL_SLOTS = new Set([
	"#iam",
	"#exit",
	"#stream-open",
	"#stream-close",
	"#stream-exit",
	"#body-open",
	"#body-close",
	"#meme-body-open",
	"#meme-body-close"
]);
/**
* Scan top-level ahu blocks. Nested ahu blocks remain inside their parent's
* `[bodyStart, bodyEnd)` span; callers walk recursively when they need
* full-depth flattening.
*
* Balanced-bracket pairing: openers/closers go onto a stack; an unmatched
* closer is dropped silently (caller's error to recover). Ties on position
* resolve by event order — opener emits before closer.
*/
function findTopLevelAhuBlocks(text) {
	AHU_OPEN_RE.lastIndex = 0;
	AHU_CLOSE_RE.lastIndex = 0;
	const events = [];
	let m;
	while ((m = AHU_OPEN_RE.exec(text)) !== null) events.push({
		kind: "open",
		pos: m.index,
		end: AHU_OPEN_RE.lastIndex,
		slot: m[1] ?? "#"
	});
	while ((m = AHU_CLOSE_RE.exec(text)) !== null) events.push({
		kind: "close",
		pos: m.index,
		end: AHU_CLOSE_RE.lastIndex,
		slot: ""
	});
	events.sort((a, b) => a.pos - b.pos);
	const blocks = [];
	const stack = [];
	for (const ev of events) if (ev.kind === "open") stack.push({
		openStart: ev.pos,
		bodyStart: ev.end,
		slot: ev.slot
	});
	else {
		const opener = stack.pop();
		if (!opener) continue;
		if (stack.length === 0) blocks.push({
			openStart: opener.openStart,
			bodyStart: opener.bodyStart,
			bodyEnd: ev.pos,
			closeEnd: ev.end,
			slot: opener.slot
		});
	}
	return blocks;
}
/**
* Compose a fragment-path slot identifier under an enclosing prefix.
*
*   composeSlotPath("",          "#thesis")   → "#thesis"          (root child)
*   composeSlotPath("#parent",   "#child")    → "#parent/child"    (one nested)
*   composeSlotPath("#a/b",      "#c")        → "#a/b/c"           (two nested)
*
* Slot identifiers carrying their own `/`-paths (operator-authored
* pre-flattened) get appended verbatim under the prefix.
*/
function composeSlotPath(prefix, slot) {
	if (!prefix) return slot;
	return `${prefix}/${slot.startsWith("#") ? slot.slice(1) : slot}`;
}
//#endregion
//#region ../lararium-core/dist/lararium-doc.js
/**
* Derive the stable lar: URI identity for a wiki.
* Wikis live in the @lararium sub-namespace — no collision with @-scope doc roots.
* e.g. wikiLarUri("altar-fire") → "lar:///ha.ka.ba/@lararium/wikis/altar-fire"
*
* This URI forms the map key in CatalogDoc.wikis.
* The CatalogRoomEntry.id field retains the short slug for readability.
*/
function wikiLarUri(slug) {
	return `lar:///ha.ka.ba/@lararium/wikis/${slug}`;
}
wikiLarUri("admin");
/**
* Admin Automerge doc URI — direct child of @lararium, sibling to
* @identities / @circles / @sessions in the @-scope namespace.
* Distinct from ADMIN_ROOM_URI: the logical wiki lives at pos-3 under /wikis/;
* the doc itself sits at pos-2 as its own namespaced child.
*/
var ADMIN_BAG_ID = "lar:///ha.ka.ba/@lararium/@admin";
`${ADMIN_BAG_ID}`;
`${ADMIN_BAG_ID}`;
//#endregion
//#region ../../node_modules/.pnpm/smol-toml@1.6.1/node_modules/smol-toml/dist/error.js
/*!
* Copyright (c) Squirrel Chat et al., All rights reserved.
* SPDX-License-Identifier: BSD-3-Clause
*
* Redistribution and use in source and binary forms, with or without
* modification, are permitted provided that the following conditions are met:
*
* 1. Redistributions of source code must retain the above copyright notice, this
*    list of conditions and the following disclaimer.
* 2. Redistributions in binary form must reproduce the above copyright notice,
*    this list of conditions and the following disclaimer in the
*    documentation and/or other materials provided with the distribution.
* 3. Neither the name of the copyright holder nor the names of its contributors
*    may be used to endorse or promote products derived from this software without
*    specific prior written permission.
*
* THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
* ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
* WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
* DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
* FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
* DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
* SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
* CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
* OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
* OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/
function getLineColFromPtr(string, ptr) {
	let lines = string.slice(0, ptr).split(/\r\n|\n|\r/g);
	return [lines.length, lines.pop().length + 1];
}
function makeCodeBlock(string, line, column) {
	let lines = string.split(/\r\n|\n|\r/g);
	let codeblock = "";
	let numberLen = (Math.log10(line + 1) | 0) + 1;
	for (let i = line - 1; i <= line + 1; i++) {
		let l = lines[i - 1];
		if (!l) continue;
		codeblock += i.toString().padEnd(numberLen, " ");
		codeblock += ":  ";
		codeblock += l;
		codeblock += "\n";
		if (i === line) {
			codeblock += " ".repeat(numberLen + column + 2);
			codeblock += "^\n";
		}
	}
	return codeblock;
}
var TomlError = class extends Error {
	line;
	column;
	codeblock;
	constructor(message, options) {
		const [line, column] = getLineColFromPtr(options.toml, options.ptr);
		const codeblock = makeCodeBlock(options.toml, line, column);
		super(`Invalid TOML document: ${message}\n\n${codeblock}`, options);
		this.line = line;
		this.column = column;
		this.codeblock = codeblock;
	}
};
//#endregion
//#region ../../node_modules/.pnpm/smol-toml@1.6.1/node_modules/smol-toml/dist/util.js
/*!
* Copyright (c) Squirrel Chat et al., All rights reserved.
* SPDX-License-Identifier: BSD-3-Clause
*
* Redistribution and use in source and binary forms, with or without
* modification, are permitted provided that the following conditions are met:
*
* 1. Redistributions of source code must retain the above copyright notice, this
*    list of conditions and the following disclaimer.
* 2. Redistributions in binary form must reproduce the above copyright notice,
*    this list of conditions and the following disclaimer in the
*    documentation and/or other materials provided with the distribution.
* 3. Neither the name of the copyright holder nor the names of its contributors
*    may be used to endorse or promote products derived from this software without
*    specific prior written permission.
*
* THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
* ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
* WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
* DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
* FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
* DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
* SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
* CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
* OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
* OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/
function isEscaped(str, ptr) {
	let i = 0;
	while (str[ptr - ++i] === "\\");
	return --i && i % 2;
}
function indexOfNewline(str, start = 0, end = str.length) {
	let idx = str.indexOf("\n", start);
	if (str[idx - 1] === "\r") idx--;
	return idx <= end ? idx : -1;
}
function skipComment(str, ptr) {
	for (let i = ptr; i < str.length; i++) {
		let c = str[i];
		if (c === "\n") return i;
		if (c === "\r" && str[i + 1] === "\n") return i + 1;
		if (c < " " && c !== "	" || c === "") throw new TomlError("control characters are not allowed in comments", {
			toml: str,
			ptr
		});
	}
	return str.length;
}
function skipVoid(str, ptr, banNewLines, banComments) {
	let c;
	while (1) {
		while ((c = str[ptr]) === " " || c === "	" || !banNewLines && (c === "\n" || c === "\r" && str[ptr + 1] === "\n")) ptr++;
		if (banComments || c !== "#") break;
		ptr = skipComment(str, ptr);
	}
	return ptr;
}
function skipUntil(str, ptr, sep, end, banNewLines = false) {
	if (!end) {
		ptr = indexOfNewline(str, ptr);
		return ptr < 0 ? str.length : ptr;
	}
	for (let i = ptr; i < str.length; i++) {
		let c = str[i];
		if (c === "#") i = indexOfNewline(str, i);
		else if (c === sep) return i + 1;
		else if (c === end || banNewLines && (c === "\n" || c === "\r" && str[i + 1] === "\n")) return i;
	}
	throw new TomlError("cannot find end of structure", {
		toml: str,
		ptr
	});
}
function getStringEnd(str, seek) {
	let first = str[seek];
	let target = first === str[seek + 1] && str[seek + 1] === str[seek + 2] ? str.slice(seek, seek + 3) : first;
	seek += target.length - 1;
	do
		seek = str.indexOf(target, ++seek);
	while (seek > -1 && first !== "'" && isEscaped(str, seek));
	if (seek > -1) {
		seek += target.length;
		if (target.length > 1) {
			if (str[seek] === first) seek++;
			if (str[seek] === first) seek++;
		}
	}
	return seek;
}
//#endregion
//#region ../../node_modules/.pnpm/smol-toml@1.6.1/node_modules/smol-toml/dist/date.js
/*!
* Copyright (c) Squirrel Chat et al., All rights reserved.
* SPDX-License-Identifier: BSD-3-Clause
*
* Redistribution and use in source and binary forms, with or without
* modification, are permitted provided that the following conditions are met:
*
* 1. Redistributions of source code must retain the above copyright notice, this
*    list of conditions and the following disclaimer.
* 2. Redistributions in binary form must reproduce the above copyright notice,
*    this list of conditions and the following disclaimer in the
*    documentation and/or other materials provided with the distribution.
* 3. Neither the name of the copyright holder nor the names of its contributors
*    may be used to endorse or promote products derived from this software without
*    specific prior written permission.
*
* THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
* ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
* WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
* DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
* FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
* DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
* SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
* CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
* OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
* OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/
var DATE_TIME_RE = /^(\d{4}-\d{2}-\d{2})?[T ]?(?:(\d{2}):\d{2}(?::\d{2}(?:\.\d+)?)?)?(Z|[-+]\d{2}:\d{2})?$/i;
var TomlDate = class TomlDate extends Date {
	#hasDate = false;
	#hasTime = false;
	#offset = null;
	constructor(date) {
		let hasDate = true;
		let hasTime = true;
		let offset = "Z";
		if (typeof date === "string") {
			let match = date.match(DATE_TIME_RE);
			if (match) {
				if (!match[1]) {
					hasDate = false;
					date = `0000-01-01T${date}`;
				}
				hasTime = !!match[2];
				hasTime && date[10] === " " && (date = date.replace(" ", "T"));
				if (match[2] && +match[2] > 23) date = "";
				else {
					offset = match[3] || null;
					date = date.toUpperCase();
					if (!offset && hasTime) date += "Z";
				}
			} else date = "";
		}
		super(date);
		if (!isNaN(this.getTime())) {
			this.#hasDate = hasDate;
			this.#hasTime = hasTime;
			this.#offset = offset;
		}
	}
	isDateTime() {
		return this.#hasDate && this.#hasTime;
	}
	isLocal() {
		return !this.#hasDate || !this.#hasTime || !this.#offset;
	}
	isDate() {
		return this.#hasDate && !this.#hasTime;
	}
	isTime() {
		return this.#hasTime && !this.#hasDate;
	}
	isValid() {
		return this.#hasDate || this.#hasTime;
	}
	toISOString() {
		let iso = super.toISOString();
		if (this.isDate()) return iso.slice(0, 10);
		if (this.isTime()) return iso.slice(11, 23);
		if (this.#offset === null) return iso.slice(0, -1);
		if (this.#offset === "Z") return iso;
		let offset = +this.#offset.slice(1, 3) * 60 + +this.#offset.slice(4, 6);
		offset = this.#offset[0] === "-" ? offset : -offset;
		return (/* @__PURE__ */ new Date(this.getTime() - offset * 6e4)).toISOString().slice(0, -1) + this.#offset;
	}
	static wrapAsOffsetDateTime(jsDate, offset = "Z") {
		let date = new TomlDate(jsDate);
		date.#offset = offset;
		return date;
	}
	static wrapAsLocalDateTime(jsDate) {
		let date = new TomlDate(jsDate);
		date.#offset = null;
		return date;
	}
	static wrapAsLocalDate(jsDate) {
		let date = new TomlDate(jsDate);
		date.#hasTime = false;
		date.#offset = null;
		return date;
	}
	static wrapAsLocalTime(jsDate) {
		let date = new TomlDate(jsDate);
		date.#hasDate = false;
		date.#offset = null;
		return date;
	}
};
//#endregion
//#region ../../node_modules/.pnpm/smol-toml@1.6.1/node_modules/smol-toml/dist/primitive.js
/*!
* Copyright (c) Squirrel Chat et al., All rights reserved.
* SPDX-License-Identifier: BSD-3-Clause
*
* Redistribution and use in source and binary forms, with or without
* modification, are permitted provided that the following conditions are met:
*
* 1. Redistributions of source code must retain the above copyright notice, this
*    list of conditions and the following disclaimer.
* 2. Redistributions in binary form must reproduce the above copyright notice,
*    this list of conditions and the following disclaimer in the
*    documentation and/or other materials provided with the distribution.
* 3. Neither the name of the copyright holder nor the names of its contributors
*    may be used to endorse or promote products derived from this software without
*    specific prior written permission.
*
* THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
* ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
* WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
* DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
* FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
* DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
* SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
* CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
* OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
* OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/
var INT_REGEX = /^((0x[0-9a-fA-F](_?[0-9a-fA-F])*)|(([+-]|0[ob])?\d(_?\d)*))$/;
var FLOAT_REGEX = /^[+-]?\d(_?\d)*(\.\d(_?\d)*)?([eE][+-]?\d(_?\d)*)?$/;
var LEADING_ZERO = /^[+-]?0[0-9_]/;
var ESCAPE_REGEX = /^[0-9a-f]{2,8}$/i;
var ESC_MAP = {
	b: "\b",
	t: "	",
	n: "\n",
	f: "\f",
	r: "\r",
	e: "\x1B",
	"\"": "\"",
	"\\": "\\"
};
function parseString(str, ptr = 0, endPtr = str.length) {
	let isLiteral = str[ptr] === "'";
	let isMultiline = str[ptr++] === str[ptr] && str[ptr] === str[ptr + 1];
	if (isMultiline) {
		endPtr -= 2;
		if (str[ptr += 2] === "\r") ptr++;
		if (str[ptr] === "\n") ptr++;
	}
	let tmp = 0;
	let isEscape;
	let parsed = "";
	let sliceStart = ptr;
	while (ptr < endPtr - 1) {
		let c = str[ptr++];
		if (c === "\n" || c === "\r" && str[ptr] === "\n") {
			if (!isMultiline) throw new TomlError("newlines are not allowed in strings", {
				toml: str,
				ptr: ptr - 1
			});
		} else if (c < " " && c !== "	" || c === "") throw new TomlError("control characters are not allowed in strings", {
			toml: str,
			ptr: ptr - 1
		});
		if (isEscape) {
			isEscape = false;
			if (c === "x" || c === "u" || c === "U") {
				let code = str.slice(ptr, ptr += c === "x" ? 2 : c === "u" ? 4 : 8);
				if (!ESCAPE_REGEX.test(code)) throw new TomlError("invalid unicode escape", {
					toml: str,
					ptr: tmp
				});
				try {
					parsed += String.fromCodePoint(parseInt(code, 16));
				} catch {
					throw new TomlError("invalid unicode escape", {
						toml: str,
						ptr: tmp
					});
				}
			} else if (isMultiline && (c === "\n" || c === " " || c === "	" || c === "\r")) {
				ptr = skipVoid(str, ptr - 1, true);
				if (str[ptr] !== "\n" && str[ptr] !== "\r") throw new TomlError("invalid escape: only line-ending whitespace may be escaped", {
					toml: str,
					ptr: tmp
				});
				ptr = skipVoid(str, ptr);
			} else if (c in ESC_MAP) parsed += ESC_MAP[c];
			else throw new TomlError("unrecognized escape sequence", {
				toml: str,
				ptr: tmp
			});
			sliceStart = ptr;
		} else if (!isLiteral && c === "\\") {
			tmp = ptr - 1;
			isEscape = true;
			parsed += str.slice(sliceStart, tmp);
		}
	}
	return parsed + str.slice(sliceStart, endPtr - 1);
}
function parseValue(value, toml, ptr, integersAsBigInt) {
	if (value === "true") return true;
	if (value === "false") return false;
	if (value === "-inf") return -Infinity;
	if (value === "inf" || value === "+inf") return Infinity;
	if (value === "nan" || value === "+nan" || value === "-nan") return NaN;
	if (value === "-0") return integersAsBigInt ? 0n : 0;
	let isInt = INT_REGEX.test(value);
	if (isInt || FLOAT_REGEX.test(value)) {
		if (LEADING_ZERO.test(value)) throw new TomlError("leading zeroes are not allowed", {
			toml,
			ptr
		});
		value = value.replace(/_/g, "");
		let numeric = +value;
		if (isNaN(numeric)) throw new TomlError("invalid number", {
			toml,
			ptr
		});
		if (isInt) {
			if ((isInt = !Number.isSafeInteger(numeric)) && !integersAsBigInt) throw new TomlError("integer value cannot be represented losslessly", {
				toml,
				ptr
			});
			if (isInt || integersAsBigInt === true) numeric = BigInt(value);
		}
		return numeric;
	}
	const date = new TomlDate(value);
	if (!date.isValid()) throw new TomlError("invalid value", {
		toml,
		ptr
	});
	return date;
}
//#endregion
//#region ../../node_modules/.pnpm/smol-toml@1.6.1/node_modules/smol-toml/dist/extract.js
/*!
* Copyright (c) Squirrel Chat et al., All rights reserved.
* SPDX-License-Identifier: BSD-3-Clause
*
* Redistribution and use in source and binary forms, with or without
* modification, are permitted provided that the following conditions are met:
*
* 1. Redistributions of source code must retain the above copyright notice, this
*    list of conditions and the following disclaimer.
* 2. Redistributions in binary form must reproduce the above copyright notice,
*    this list of conditions and the following disclaimer in the
*    documentation and/or other materials provided with the distribution.
* 3. Neither the name of the copyright holder nor the names of its contributors
*    may be used to endorse or promote products derived from this software without
*    specific prior written permission.
*
* THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
* ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
* WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
* DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
* FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
* DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
* SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
* CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
* OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
* OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/
function sliceAndTrimEndOf(str, startPtr, endPtr) {
	let value = str.slice(startPtr, endPtr);
	let commentIdx = value.indexOf("#");
	if (commentIdx > -1) {
		skipComment(str, commentIdx);
		value = value.slice(0, commentIdx);
	}
	return [value.trimEnd(), commentIdx];
}
function extractValue(str, ptr, end, depth, integersAsBigInt) {
	if (depth === 0) throw new TomlError("document contains excessively nested structures. aborting.", {
		toml: str,
		ptr
	});
	let c = str[ptr];
	if (c === "[" || c === "{") {
		let [value, endPtr] = c === "[" ? parseArray(str, ptr, depth, integersAsBigInt) : parseInlineTable(str, ptr, depth, integersAsBigInt);
		if (end) {
			endPtr = skipVoid(str, endPtr);
			if (str[endPtr] === ",") endPtr++;
			else if (str[endPtr] !== end) throw new TomlError("expected comma or end of structure", {
				toml: str,
				ptr: endPtr
			});
		}
		return [value, endPtr];
	}
	let endPtr;
	if (c === "\"" || c === "'") {
		endPtr = getStringEnd(str, ptr);
		let parsed = parseString(str, ptr, endPtr);
		if (end) {
			endPtr = skipVoid(str, endPtr);
			if (str[endPtr] && str[endPtr] !== "," && str[endPtr] !== end && str[endPtr] !== "\n" && str[endPtr] !== "\r") throw new TomlError("unexpected character encountered", {
				toml: str,
				ptr: endPtr
			});
			endPtr += +(str[endPtr] === ",");
		}
		return [parsed, endPtr];
	}
	endPtr = skipUntil(str, ptr, ",", end);
	let slice = sliceAndTrimEndOf(str, ptr, endPtr - +(str[endPtr - 1] === ","));
	if (!slice[0]) throw new TomlError("incomplete key-value declaration: no value specified", {
		toml: str,
		ptr
	});
	if (end && slice[1] > -1) {
		endPtr = skipVoid(str, ptr + slice[1]);
		endPtr += +(str[endPtr] === ",");
	}
	return [parseValue(slice[0], str, ptr, integersAsBigInt), endPtr];
}
//#endregion
//#region ../../node_modules/.pnpm/smol-toml@1.6.1/node_modules/smol-toml/dist/struct.js
/*!
* Copyright (c) Squirrel Chat et al., All rights reserved.
* SPDX-License-Identifier: BSD-3-Clause
*
* Redistribution and use in source and binary forms, with or without
* modification, are permitted provided that the following conditions are met:
*
* 1. Redistributions of source code must retain the above copyright notice, this
*    list of conditions and the following disclaimer.
* 2. Redistributions in binary form must reproduce the above copyright notice,
*    this list of conditions and the following disclaimer in the
*    documentation and/or other materials provided with the distribution.
* 3. Neither the name of the copyright holder nor the names of its contributors
*    may be used to endorse or promote products derived from this software without
*    specific prior written permission.
*
* THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
* ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
* WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
* DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
* FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
* DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
* SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
* CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
* OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
* OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/
var KEY_PART_RE = /^[a-zA-Z0-9-_]+[ \t]*$/;
function parseKey(str, ptr, end = "=") {
	let dot = ptr - 1;
	let parsed = [];
	let endPtr = str.indexOf(end, ptr);
	if (endPtr < 0) throw new TomlError("incomplete key-value: cannot find end of key", {
		toml: str,
		ptr
	});
	do {
		let c = str[ptr = ++dot];
		if (c !== " " && c !== "	") if (c === "\"" || c === "'") {
			if (c === str[ptr + 1] && c === str[ptr + 2]) throw new TomlError("multiline strings are not allowed in keys", {
				toml: str,
				ptr
			});
			let eos = getStringEnd(str, ptr);
			if (eos < 0) throw new TomlError("unfinished string encountered", {
				toml: str,
				ptr
			});
			dot = str.indexOf(".", eos);
			let strEnd = str.slice(eos, dot < 0 || dot > endPtr ? endPtr : dot);
			let newLine = indexOfNewline(strEnd);
			if (newLine > -1) throw new TomlError("newlines are not allowed in keys", {
				toml: str,
				ptr: ptr + dot + newLine
			});
			if (strEnd.trimStart()) throw new TomlError("found extra tokens after the string part", {
				toml: str,
				ptr: eos
			});
			if (endPtr < eos) {
				endPtr = str.indexOf(end, eos);
				if (endPtr < 0) throw new TomlError("incomplete key-value: cannot find end of key", {
					toml: str,
					ptr
				});
			}
			parsed.push(parseString(str, ptr, eos));
		} else {
			dot = str.indexOf(".", ptr);
			let part = str.slice(ptr, dot < 0 || dot > endPtr ? endPtr : dot);
			if (!KEY_PART_RE.test(part)) throw new TomlError("only letter, numbers, dashes and underscores are allowed in keys", {
				toml: str,
				ptr
			});
			parsed.push(part.trimEnd());
		}
	} while (dot + 1 && dot < endPtr);
	return [parsed, skipVoid(str, endPtr + 1, true, true)];
}
function parseInlineTable(str, ptr, depth, integersAsBigInt) {
	let res = {};
	let seen = /* @__PURE__ */ new Set();
	let c;
	ptr++;
	while ((c = str[ptr++]) !== "}" && c) if (c === ",") throw new TomlError("expected value, found comma", {
		toml: str,
		ptr: ptr - 1
	});
	else if (c === "#") ptr = skipComment(str, ptr);
	else if (c !== " " && c !== "	" && c !== "\n" && c !== "\r") {
		let k;
		let t = res;
		let hasOwn = false;
		let [key, keyEndPtr] = parseKey(str, ptr - 1);
		for (let i = 0; i < key.length; i++) {
			if (i) t = hasOwn ? t[k] : t[k] = {};
			k = key[i];
			if ((hasOwn = Object.hasOwn(t, k)) && (typeof t[k] !== "object" || seen.has(t[k]))) throw new TomlError("trying to redefine an already defined value", {
				toml: str,
				ptr
			});
			if (!hasOwn && k === "__proto__") Object.defineProperty(t, k, {
				enumerable: true,
				configurable: true,
				writable: true
			});
		}
		if (hasOwn) throw new TomlError("trying to redefine an already defined value", {
			toml: str,
			ptr
		});
		let [value, valueEndPtr] = extractValue(str, keyEndPtr, "}", depth - 1, integersAsBigInt);
		seen.add(value);
		t[k] = value;
		ptr = valueEndPtr;
	}
	if (!c) throw new TomlError("unfinished table encountered", {
		toml: str,
		ptr
	});
	return [res, ptr];
}
function parseArray(str, ptr, depth, integersAsBigInt) {
	let res = [];
	let c;
	ptr++;
	while ((c = str[ptr++]) !== "]" && c) if (c === ",") throw new TomlError("expected value, found comma", {
		toml: str,
		ptr: ptr - 1
	});
	else if (c === "#") ptr = skipComment(str, ptr);
	else if (c !== " " && c !== "	" && c !== "\n" && c !== "\r") {
		let e = extractValue(str, ptr - 1, "]", depth - 1, integersAsBigInt);
		res.push(e[0]);
		ptr = e[1];
	}
	if (!c) throw new TomlError("unfinished array encountered", {
		toml: str,
		ptr
	});
	return [res, ptr];
}
//#endregion
//#region ../../node_modules/.pnpm/smol-toml@1.6.1/node_modules/smol-toml/dist/parse.js
/*!
* Copyright (c) Squirrel Chat et al., All rights reserved.
* SPDX-License-Identifier: BSD-3-Clause
*
* Redistribution and use in source and binary forms, with or without
* modification, are permitted provided that the following conditions are met:
*
* 1. Redistributions of source code must retain the above copyright notice, this
*    list of conditions and the following disclaimer.
* 2. Redistributions in binary form must reproduce the above copyright notice,
*    this list of conditions and the following disclaimer in the
*    documentation and/or other materials provided with the distribution.
* 3. Neither the name of the copyright holder nor the names of its contributors
*    may be used to endorse or promote products derived from this software without
*    specific prior written permission.
*
* THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
* ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
* WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
* DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
* FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
* DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
* SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
* CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
* OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
* OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/
function peekTable(key, table, meta, type) {
	let t = table;
	let m = meta;
	let k;
	let hasOwn = false;
	let state;
	for (let i = 0; i < key.length; i++) {
		if (i) {
			t = hasOwn ? t[k] : t[k] = {};
			m = (state = m[k]).c;
			if (type === 0 && (state.t === 1 || state.t === 2)) return null;
			if (state.t === 2) {
				let l = t.length - 1;
				t = t[l];
				m = m[l].c;
			}
		}
		k = key[i];
		if ((hasOwn = Object.hasOwn(t, k)) && m[k]?.t === 0 && m[k]?.d) return null;
		if (!hasOwn) {
			if (k === "__proto__") {
				Object.defineProperty(t, k, {
					enumerable: true,
					configurable: true,
					writable: true
				});
				Object.defineProperty(m, k, {
					enumerable: true,
					configurable: true,
					writable: true
				});
			}
			m[k] = {
				t: i < key.length - 1 && type === 2 ? 3 : type,
				d: false,
				i: 0,
				c: {}
			};
		}
	}
	state = m[k];
	if (state.t !== type && !(type === 1 && state.t === 3)) return null;
	if (type === 2) {
		if (!state.d) {
			state.d = true;
			t[k] = [];
		}
		t[k].push(t = {});
		state.c[state.i++] = state = {
			t: 1,
			d: false,
			i: 0,
			c: {}
		};
	}
	if (state.d) return null;
	state.d = true;
	if (type === 1) t = hasOwn ? t[k] : t[k] = {};
	else if (type === 0 && hasOwn) return null;
	return [
		k,
		t,
		state.c
	];
}
function parse(toml, { maxDepth = 1e3, integersAsBigInt } = {}) {
	let res = {};
	let meta = {};
	let tbl = res;
	let m = meta;
	for (let ptr = skipVoid(toml, 0); ptr < toml.length;) {
		if (toml[ptr] === "[") {
			let isTableArray = toml[++ptr] === "[";
			let k = parseKey(toml, ptr += +isTableArray, "]");
			if (isTableArray) {
				if (toml[k[1] - 1] !== "]") throw new TomlError("expected end of table declaration", {
					toml,
					ptr: k[1] - 1
				});
				k[1]++;
			}
			let p = peekTable(k[0], res, meta, isTableArray ? 2 : 1);
			if (!p) throw new TomlError("trying to redefine an already defined table or value", {
				toml,
				ptr
			});
			m = p[2];
			tbl = p[1];
			ptr = k[1];
		} else {
			let k = parseKey(toml, ptr);
			let p = peekTable(k[0], tbl, m, 0);
			if (!p) throw new TomlError("trying to redefine an already defined table or value", {
				toml,
				ptr
			});
			let v = extractValue(toml, k[1], void 0, maxDepth, integersAsBigInt);
			p[1][p[0]] = v[0];
			ptr = v[1];
		}
		ptr = skipVoid(toml, ptr, true);
		if (toml[ptr] && toml[ptr] !== "\n" && toml[ptr] !== "\r") throw new TomlError("each key-value declaration must be followed by an end-of-line", {
			toml,
			ptr
		});
		ptr = skipVoid(toml, ptr);
	}
	return res;
}
//#endregion
//#region src/toml-ast.ts
/**
* toml-ast — two-layer TOML engine for lossless carrier round-trips.
*
* Read  (#iam → fields, child fences): smol-toml — sync, spec-compliant, ~26 kB,
*        handles inline comments and TOML tables without a WASM init step.
*
* Write (patch key, normalize):        @taplo/lib — WASM, lazy-loaded on first
*        write call. Comment-preserving format via Taplo CST. Falls back
*        gracefully to raw string if WASM is unavailable (offline, old browser,
*        unit tests). Never included in the main bundle chunk.
*
* Isomorphic: identical code runs in Node.js and the browser. smol-toml is
* pure JS; Taplo WASM loads via dynamic import() — resolved from disk on
* Node, fetched as a code-split chunk on the browser.
*/
function flattenTomlValue(obj, prefix = "", out = {}) {
	for (const [k, v] of Object.entries(obj)) {
		const key = prefix ? `${prefix}-${k}` : k;
		if (Array.isArray(v)) out[key] = v.map(String);
		else if (v !== null && typeof v === "object") flattenTomlValue(v, key, out);
		else out[key] = String(v ?? "");
	}
	return out;
}
function parseTaploFields(toml, warnings = [], context = "#iam") {
	try {
		return flattenTomlValue(parse(toml));
	} catch (e) {
		warnings.push(`${context} TOML parse error: ${e}`);
		return {};
	}
}
//#endregion
//#region src/deserializer.ts
/**
* deserializer — TW5 causal-island boundary module for text/x-memetic-wikitext.
*
* Heleuma ba: this TS source compiles to an CJS plugin tiddler at
* lar:///ha.ka.ba/@lares/api/v0.1/lararium/modules/deserializer
* (module-type: tiddlerdeserializer, key: text/x-memetic-wikitext).
*
* Parsing MUST happen inside the TW5 VM on live clients (FFZ invariant).
* This file is the causal-island boundary: text/x-memetic-wikitext enters,
* TiddlerFields[] (parent + ahu-slot children) leave.
*
* Uses parseMemeText() from @lararium/core/meme-ast — isomorphic, no TW5 dep.
* Does NOT depend on carrier-split.ts (deprecated web2-era code).
*
* Incoming (disk → wiki):
*   memeticWikitextDeserializer — TW5 tiddlerdeserializer contract.
*   Multi-meme: MemeStreamParser batches carrier-close events.
*   Parent text model: ahu definition blocks → kahea references (children authoritative).
*
* Outgoing (wiki → disk):
*   expandMemeRefs — registered on $tw.lararium; called by sync-adaptor.
*   Inverts the incoming transform: reads child bodies, reconstructs definition form.
*/
function memeticWikitextDeserializer(text, fields) {
	const baseUri = String(fields?.["title"] ?? "");
	const result = [];
	const parser = new MemeStreamParser();
	const closes = [...parser.push(text), ...parser.flush()].filter((e) => e.kind === "carrier-close");
	const sohIdx = text.search(/<<~(?:\s*⊙)?\s*&#x000[1-9a-fA-F]+;/);
	const prologue = closes.length > 0 && sohIdx > 0 ? text.slice(0, sohIdx) : "";
	const etxOpenRe = /<<~(?:\s*⊙)?\s*&#x000[34];/g;
	let lastEtxEnd = -1;
	let etxMatch;
	while ((etxMatch = etxOpenRe.exec(text)) !== null) {
		const closeIdx = text.indexOf(">>", etxMatch.index + etxMatch[0].length);
		if (closeIdx >= 0) lastEtxEnd = closeIdx + 2;
	}
	const postamble = closes.length > 0 && lastEtxEnd >= 0 && lastEtxEnd < text.length ? text.slice(lastEtxEnd) : "";
	for (const ev of closes) {
		const uri = ev.uri || baseUri;
		let memeText = ev.fullText;
		if (postamble.length > 0 && ev === closes[closes.length - 1] && memeText.endsWith(postamble)) memeText = memeText.slice(0, memeText.length - postamble.length);
		const tiddlers = splitMemeToTiddlers(uri, memeText, asStringFields(fields));
		if (prologue.length > 0 && tiddlers.length > 0 && ev === closes[0]) for (const t of tiddlers) t["prologue"] = prologue;
		const namespace = /^<<~([^&\n]*)&#x(?:0001|0011)/.exec(ev.fullText)?.[1]?.trim() ?? "";
		if (namespace.length > 0 && tiddlers.length > 0) for (const t of tiddlers) t["namespace"] = namespace;
		if (postamble.trim().length > 0 && tiddlers.length > 0 && ev === closes[closes.length - 1]) tiddlers[0]["postamble"] = postamble;
		result.push(...tiddlers);
	}
	if (result.length === 0 && text.trim()) result.push(...splitMemeToTiddlers(baseUri, text, asStringFields(fields)));
	return result;
}
var SOH_LINE_RE = /^<<~(?:[^>]|->)*&#x(?:0001|0011);(?:[^>]|->)*>>\n?/;
var STX_LINE_RE = /<<~(?:[^>]|->)*&#x0002;(?:[^>]|->)*>>\n?/;
var ETX_TAIL_RE = /\n?<<~(?:[^>]|->)*&#x0003;(?:[^>]|->)*>>[\s\S]*$/;
function splitMemeToTiddlers(uri, text, baseFields) {
	const warnings = [];
	const sourceFile = typeof baseFields["source-file"] === "string" ? baseFields["source-file"] : "";
	const stripped = text.replace(SOH_LINE_RE, "").replace(ETX_TAIL_RE, "");
	const stxM = STX_LINE_RE.exec(stripped);
	const headerRegion = stxM ? stripped.slice(0, stxM.index) : stripped;
	const bodyRegion = (stxM ? stripped.slice(stxM.index + stxM[0].length) : "").replace(/^\n/, "");
	const iamPos = extractRootTomlWithPos(headerRegion);
	const rootToml = iamPos?.content ?? null;
	const { __arrayKeys: _, ...rootFields } = rootToml ? fieldifyToml(rootToml, warnings, uri) : {};
	const preIamContent = iamPos ? headerRegion.slice(0, iamPos.start) : headerRegion;
	const { children: headerChildren, rewrittenText: headerRewritten } = splitRecursive(uri, "", iamPos ? headerRegion.slice(iamPos.end).replace(/^\n/, "") : "", warnings, sourceFile);
	const { children: bodyChildren, rewrittenText: bodyRewritten } = splitRecursive(uri, "", bodyRegion, warnings, sourceFile);
	const allChildren = [...headerChildren, ...bodyChildren];
	const result = [{
		...baseFields,
		...rootFields,
		title: uri,
		type: "text/x-memetic-wikitext",
		text: bodyRewritten,
		...preIamContent.trim() ? { preamble: preIamContent } : {},
		...headerRewritten.trim() ? { "header-text": headerRewritten } : {}
	}, ...allChildren];
	if (warnings.length > 0) {
		const safeSlug = uri.replace(/[^a-zA-Z0-9._-]/g, "_");
		result.push({
			title: `$:/lararium/parse-warning/${safeSlug}`,
			tags: "$:/lararium/parse-warnings",
			"meme-uri": uri,
			"warning-count": String(warnings.length),
			text: warnings.join("\n")
		});
	}
	return result;
}
function splitRecursive(rootUri, fragmentPrefix, text, warnings, parentSourceFile = "") {
	const allChildren = [];
	const enclosingUri = rootUri + fragmentPrefix;
	const blocks = findTopLevelAhuBlocks(text);
	let cursor = 0;
	let rewritten = "";
	for (const block of blocks) {
		rewritten += text.slice(cursor, block.openStart);
		if (CONTROL_SLOTS.has(block.slot)) {
			rewritten += text.slice(block.openStart, block.closeEnd);
			cursor = block.closeEnd;
			continue;
		}
		const childSlotPath = composeSlotPath(fragmentPrefix, block.slot);
		const childUri = rootUri + childSlotPath;
		const inner = splitRecursive(rootUri, childSlotPath, text.slice(block.bodyStart, block.bodyEnd), warnings, parentSourceFile);
		const childStructure = extractSlotStructure(inner.rewrittenText, warnings, childUri);
		const childUriPath = childUri.startsWith("lar:///") ? childUri.slice(7) : childUri;
		const childFilePath = parentSourceFile ? parentSourceFile.replace(/\.md$/, "") + "/" + block.slot.replace(/^#/, "") + ".md" : void 0;
		allChildren.push({
			...childStructure.fields,
			title: childUri,
			type: "text/x-memetic-wikitext",
			text: childStructure.text,
			"uri-path": childUriPath,
			"fragment-parent": enclosingUri,
			slot: block.slot,
			...childFilePath ? { "file-path": childFilePath } : {},
			...childStructure.preamble ? { preamble: childStructure.preamble } : {},
			...childStructure.postamble ? { postamble: childStructure.postamble } : {}
		});
		allChildren.push(...inner.children);
		rewritten += `<<~ kahea ahu ${block.slot} >>`;
		cursor = block.closeEnd;
	}
	rewritten += text.slice(cursor);
	return {
		children: allChildren,
		rewrittenText: rewritten
	};
}
function extractRootTomlWithPos(text) {
	const m = /```toml[ \t]+iam[ \t]*\n([\s\S]*?)```\n?/.exec(text);
	if (!m) return null;
	return {
		content: m[1] ?? "",
		start: m.index,
		end: m.index + m[0].length
	};
}
var IAM_MARKER = "<<~ iam >>";
function extractSlotStructure(bodyText, warnings, context) {
	const iamM = /```toml[ \t]+iam[ \t]*\n([\s\S]*?)```\n?/.exec(bodyText) ?? /```toml[ \t]*\n([\s\S]*?)```\n?/.exec(bodyText);
	let preamble = "";
	let fields = {};
	let remainder = bodyText;
	if (iamM) {
		preamble = bodyText.slice(0, iamM.index);
		const { __arrayKeys: _, ...parsed } = fieldifyToml(iamM[1] ?? "", warnings, context);
		fields = parsed;
		remainder = bodyText.slice(iamM.index + iamM[0].length);
	}
	const refRe = /<<~\s*kahea\s+ahu\s+#[\w-]+\s*>>/g;
	let lastEnd = -1;
	let m;
	while ((m = refRe.exec(remainder)) !== null) lastEnd = m.index + m[0].length;
	let text = remainder;
	let postamble = "";
	if (lastEnd >= 0 && lastEnd < remainder.length) {
		text = remainder.slice(0, lastEnd);
		postamble = remainder.slice(lastEnd);
	}
	if (!iamM && lastEnd < 0) {
		text = bodyText;
		preamble = "";
	}
	return {
		preamble,
		fields,
		text,
		postamble
	};
}
function fieldifyToml(toml, warnings, context) {
	const parsed = parseTaploFields(toml);
	const out = {};
	const arrayKeys = [];
	for (const [k, v] of Object.entries(parsed)) {
		if (k === "title") {
			warnings.push(`${context}: "title" in TOML ignored (derived from URI)`);
			continue;
		}
		if (k === "text") {
			warnings.push(`${context}: "text" in TOML ignored (derived from body)`);
			continue;
		}
		if (Array.isArray(v)) {
			out[k] = v.map(String);
			arrayKeys.push(k);
		} else out[k] = String(v);
	}
	if (arrayKeys.length > 0) out.__arrayKeys = arrayKeys;
	return out;
}
function asStringFields(fields) {
	const out = {};
	for (const [k, v] of Object.entries(fields)) {
		if (v === null || v === void 0) continue;
		if (Array.isArray(v)) out[k] = v.map(String);
		else out[k] = String(v);
	}
	return out;
}
function splitBodyTiddler(uri, bodyText, baseFields) {
	if (!bodyText.includes("<<~ ahu")) return {
		parent: {
			...baseFields,
			title: uri,
			text: bodyText
		},
		children: []
	};
	const warnings = [];
	const { children, rewrittenText } = splitRecursive(uri, "", bodyText, warnings, typeof baseFields["source-file"] === "string" ? baseFields["source-file"] : "");
	const parent = {
		...baseFields,
		title: uri,
		text: rewrittenText
	};
	if (warnings.length > 0) {
		const safeSlug = uri.replace(/[^a-zA-Z0-9._-]/g, "_");
		children.push({
			title: `$:/lararium/parse-warning/${safeSlug}`,
			tags: "$:/lararium/parse-warnings",
			"meme-uri": uri,
			"warning-count": String(warnings.length),
			text: warnings.join("\n")
		});
	}
	return {
		parent,
		children
	};
}
//#endregion
exports.IAM_MARKER = IAM_MARKER;
exports.memeticWikitextDeserializer = memeticWikitextDeserializer;
exports["text/x-memetic-wikitext"] = memeticWikitextDeserializer;
exports.splitBodyTiddler = splitBodyTiddler;
exports["text/x-memetic-wikitext"] = exports.memeticWikitextDeserializer;
