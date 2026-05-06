<<~&#x0001; ? -> lar:///ha.ka.ba/@lararium/tw5/modules/deserializer-tw5 >>
```toml iam
uri-path = "ha.ka.ba/@lararium/tw5/modules/deserializer-tw5"
file-path = "packages/lararium-tw5/memes/modules/deserializer-tw5.md"
type          = "application/javascript"
module-type   = "tiddlerdeserializer"
register      = "CS"
confidence    = 0.90
mana          = 0.90
role          = "compiled TW5 tiddlerdeserializer module: text/x-memetic-wikitext — generated from packages/lararium-tw5/src/deserializer.ts"
cacheable     = true
retain        = true
source-symbol = "memeticWikitextDeserializer"
source-file   = "packages/lararium-tw5/src/deserializer.ts"
body-sha256   = ""
```

<<~&#x0002;>>

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
var AHU_OPEN_RE = /<<~(?:[^>]|->)*\bahu\s+(#[\w-]+)\s*>>/;
var AHU_CLOSE_RE = /<<~\/ahu\s*>>/;
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
						h: find(remaining, AHU_OPEN_RE)
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
				const closeH = find(remaining, AHU_CLOSE_RE);
				const openH = find(remaining, AHU_OPEN_RE);
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
//#region ../lararium-core/dist/meme-ast/scanner.js
/**
* meme-ast/scanner.ts — regex scan patterns + collectEvents().
*
* Local-first, isomorphic: no fs/path/DOM imports.
* Runs in Node, Deno, browser, and TW5-era JS environments.
*
* A SigilScan is one regex pass over the source text. collectEvents() runs all
* scans, deduplicates by position, and returns a position-sorted ParseEvent[].
* The caller (builder.ts) feeds these into the push/pop scope stack.
*
* Heleuma ka: sync-heleuma tracks this file.
* Bundle entry: packages/lararium-tw5/src/meme-ast-entry.ts
*/
var BOOTSTRAP_SCANS = [
	{
		sigilName: "control-soh",
		regex: /<<~(?:[^>]|->)*&#x0001;(?:[^>]|->)*\?\s*->\s*([^\s>]+)\s*>>/g,
		eventType: "pragma"
	},
	{
		sigilName: "control-stx",
		regex: /<<~(?:[^>]|->)*&#x0002;(?:[^>]|->)*>>/g,
		eventType: "pragma"
	},
	{
		sigilName: "control-etx",
		regex: /<<~(?:[^>]|->)*&#x0003;(?:[^>]|->)*>>/g,
		eventType: "pragma"
	},
	{
		sigilName: "control-eot",
		regex: /<<~(?:[^>]|->)*&#x0004;(?:[^>]|->)*>>/g,
		eventType: "pragma"
	},
	{
		sigilName: "control-soh",
		regex: /<<~(?:[^>]|->)*&#x0011;(?:[^>]|->)*\?\s*->\s*([^\s>]+)\s*>>/g,
		eventType: "pragma"
	},
	{
		sigilName: "control-eot",
		regex: /<<~(?:[^>]|->)*&#x0014;(?:[^>]|->)*>>/g,
		eventType: "pragma"
	},
	{
		sigilName: "ahu",
		regex: /<<~(?:[^>]|->)*\bahu\s+(#[\w-]+)(?:\s+->\s+(\S+))?\s*>>/g,
		eventType: "open"
	},
	{
		sigilName: "ahu",
		regex: /<<~\/ahu\s*>>/g,
		eventType: "close"
	},
	{
		sigilName: "pranala",
		regex: /<<~\s*pranala\s+(#[\w-]+\s+)?(\S+)\s*->\s*(\S+)(?:\s+family:([\w-]+))?(?:\s+role:([\w-]+))?\s*>>([\s\S]*?)<<~\/pranala\s*>>/gs,
		eventType: "leaf"
	},
	{
		sigilName: "pranala",
		regex: /<<~\s*pranala\s+(#[\w-]+\s+)?(\S+)\s*->\s*(\S+)(?:\s+family:([\w-]+))?(?:\s+role:([\w-]+))?\s*>>/g,
		eventType: "leaf"
	},
	{
		sigilName: "loulou",
		regex: /<<~\s*loulou\s+(\S+)\s*>>/g,
		eventType: "leaf"
	},
	{
		sigilName: "aka",
		regex: /<<~\s*aka\s+([a-z][\w-]*)\s+(#[\w-]+)\s*>>/g,
		eventType: "leaf"
	},
	{
		sigilName: "aka",
		regex: /<<~\s*aka\s+(\S+)\s*>>/g,
		eventType: "leaf"
	},
	{
		sigilName: "kahea-invoke",
		regex: /<<~\s*kahea\s+([a-z][\w-]*)\s+([^>\n]+?)\s*>>/g,
		eventType: "leaf"
	},
	{
		sigilName: "kahea-invoke",
		regex: /<<~\s*kahea\s+([a-z][\w-]*)(?:\s+([^>]*?))?\s*>>/g,
		eventType: "open"
	},
	{
		sigilName: "kahea-invoke",
		regex: /<<~\/kahea\s*>>/g,
		eventType: "close"
	},
	{
		sigilName: "kahea",
		regex: /<<~\s*kahea\s+(lar:[^\s>]+|[^\s>(]+\/[^\s>]*|[^\s>(]+#[^\s>]*)\s*>>/g,
		eventType: "leaf"
	},
	{
		sigilName: "pono",
		regex: /<<~\s*pono\s+(#[\w-]+\s+)?(\S+)\s*->\s*(\S+)(?:\s+role:([\w-]+))?\s*>>/g,
		eventType: "leaf"
	},
	{
		sigilName: "\\constraint",
		canonicalName: "pono",
		regex: /<<~\s*\\constraint\s+(#[\w-]+\s+)?(\S+)\s*->\s*(\S+)(?:\s+role:([\w-]+))?\s*>>/g,
		eventType: "leaf"
	},
	{
		sigilName: "lele",
		regex: /<<~\s*lele\s+(\S+)\s*>>/g,
		eventType: "leaf"
	},
	{
		sigilName: "papalohe",
		regex: /<<~\s*papalohe\s+(#[\w-]+\s+)?(\S+)\s*->\s*(\S+)(?:\s+listenable:([\w.-]+))?(?:\s+subscribable:([\w.-]+))?\s*>>/g,
		eventType: "leaf"
	},
	{
		sigilName: "toml",
		regex: /```toml(?:[ \t]+([A-Za-z0-9_-]+))?[ \t]*\n([\s\S]*?)```/g,
		eventType: "leaf"
	},
	{
		sigilName: "toml",
		regex: /<<~\s*toml\s*>>([\s\S]*?)<<~\/toml\s*>>/g,
		eventType: "leaf"
	},
	{
		sigilName: "waiho",
		regex: /<<~!\s*waiho\s+([\w-]+)\s*=\s*([^\n>]+?)\s*>>/g,
		eventType: "pragma"
	},
	{
		sigilName: "waiho",
		regex: /<<~\s*waiho\s+([\w-]+)\s*=\s*([^\n>]+?)\s*>>/g,
		eventType: "open"
	},
	{
		sigilName: "waiho",
		regex: /<<~\/waiho\s*>>/g,
		eventType: "close"
	},
	{
		sigilName: "kau",
		regex: /<<~\s*kau\s+([\w][\w.-]*)\(([^)]*)\)\s*>>/g,
		eventType: "leaf"
	},
	{
		sigilName: "kau",
		regex: /<<~\s*kau\s+(#[\w-]+\s+)?([\w][\w.-]*)(?:\s+([^>]*))?\s*>>/g,
		eventType: "leaf"
	},
	{
		sigilName: "wai",
		regex: /<<~\s*wai\s+([^\n>]+?)\s*>>/g,
		eventType: "open"
	},
	{
		sigilName: "wai",
		regex: /<<~\/wai\s*>>/g,
		eventType: "close"
	},
	{
		sigilName: "mukuwai",
		regex: /<<~\s*mukuwai\s*>>/g,
		eventType: "leaf"
	},
	{
		sigilName: "kahawai",
		regex: /<<~\s*kahawai\s+([^\n>]+?)\s*>>/g,
		eventType: "leaf"
	},
	{
		sigilName: "huli",
		regex: /<<~\s*huli\s+([^\n>]+?)\s+as\s+([\w-]+)\s*>>/g,
		eventType: "open"
	},
	{
		sigilName: "huli",
		regex: /<<~\/huli\s*>>/g,
		eventType: "close"
	},
	{
		sigilName: "\\if",
		canonicalName: "wai",
		regex: /<<~\s*\\if\s+([^\n>]+?)\s*>>/g,
		eventType: "open"
	},
	{
		sigilName: "\\if",
		canonicalName: "wai",
		regex: /<<~\/\\if\s*>>/g,
		eventType: "close"
	},
	{
		sigilName: "\\else",
		canonicalName: "mukuwai",
		regex: /<<~\s*\\else\s*>>/g,
		eventType: "leaf"
	},
	{
		sigilName: "\\elif",
		canonicalName: "kahawai",
		regex: /<<~\s*\\elif\s+([^\n>]+?)\s*>>/g,
		eventType: "leaf"
	},
	{
		sigilName: "\\const",
		canonicalName: "waiho",
		regex: /<<~!\s*\\const\s+([\w-]+)\s*=\s*([^\n>]+?)\s*>>/g,
		eventType: "pragma"
	},
	{
		sigilName: "\\let",
		canonicalName: "waiho",
		regex: /<<~\s*\\let\s+([\w-]+)\s*=\s*([^\n>]+?)\s*>>/g,
		eventType: "open"
	},
	{
		sigilName: "\\let",
		canonicalName: "waiho",
		regex: /<<~\/\\let\s*>>/g,
		eventType: "close"
	},
	{
		sigilName: "\\var",
		canonicalName: "waiho",
		regex: /<<~\s*\\var\s+([\w-]+)\s*=\s*([^\n>]+?)\s*>>/g,
		eventType: "open"
	},
	{
		sigilName: "\\var",
		canonicalName: "waiho",
		regex: /<<~\/\\var\s*>>/g,
		eventType: "close"
	},
	{
		sigilName: "kumu",
		regex: /<<~\s*kumu\s+([\w-]+)(?:\(([^)]*)\))?\s*>>/g,
		eventType: "open"
	},
	{
		sigilName: "kumu",
		regex: /<<~\/kumu\s*>>/g,
		eventType: "close"
	},
	{
		sigilName: "\\widget",
		canonicalName: "kumu",
		regex: /<<~!\s*\\widget\s+([\w-]+)(?:\(([^)]*)\))?\s*>>/g,
		eventType: "open"
	},
	{
		sigilName: "\\widget",
		canonicalName: "kumu",
		regex: /<<~\/\\widget\s*>>/g,
		eventType: "close"
	},
	{
		sigilName: "\\task",
		canonicalName: "hana",
		regex: /<<~\s*\\task\s+([^\n>]+?)\s*>>/g,
		eventType: "open"
	},
	{
		sigilName: "\\task",
		canonicalName: "hana",
		regex: /<<~\/\\task\s*>>/g,
		eventType: "close"
	},
	{
		sigilName: "kukali",
		regex: /<<~\s*kukali(?:\s+trigger:([\w.-]+))?\s*>>/g,
		eventType: "leaf"
	},
	{
		sigilName: "\\suspends",
		canonicalName: "kukali",
		regex: /<<~\s*\\suspends(?:\s+trigger:([\w.-]+))?\s*>>/g,
		eventType: "leaf"
	}
];
function safeRegex(src, flags) {
	try {
		return new RegExp(src, flags);
	} catch {
		return null;
	}
}
function buildScansFromGrammar(sigils) {
	const scans = [];
	for (const s of sigils) {
		const extra = s.aliasFor ? { canonicalName: s.aliasFor } : {};
		if (s.openPattern) {
			const rx = safeRegex(s.openPattern, "g");
			if (rx) scans.push({
				sigilName: s.name,
				...extra,
				regex: rx,
				eventType: "open"
			});
		}
		if (s.closePattern) {
			const rx = safeRegex(s.closePattern, "g");
			if (rx) scans.push({
				sigilName: s.name,
				...extra,
				regex: rx,
				eventType: "close"
			});
		}
		if (s.pragmaPattern) {
			const rx = safeRegex(s.pragmaPattern, "g");
			if (rx) scans.push({
				sigilName: s.name,
				...extra,
				regex: rx,
				eventType: "pragma"
			});
		}
		if (s.blockPattern) {
			const rx = safeRegex(s.blockPattern, "gs");
			if (rx) scans.push({
				sigilName: s.name,
				...extra,
				regex: rx,
				eventType: "leaf"
			});
		}
		if (s.inlinePattern) {
			const rx = safeRegex(s.inlinePattern, "g");
			if (rx) scans.push({
				sigilName: s.name,
				...extra,
				regex: rx,
				eventType: "leaf"
			});
		}
		if (s.pattern && !s.openPattern && !s.blockPattern && !s.inlinePattern) {
			const flags = s.name === "pranala" ? "gs" : "g";
			const rx = safeRegex(s.pattern, flags);
			if (rx) scans.push({
				sigilName: s.name,
				...extra,
				regex: rx,
				eventType: "leaf"
			});
		}
	}
	return scans.sort((a, b) => (a.sigilName.startsWith("control-") ? 0 : 1) - (b.sigilName.startsWith("control-") ? 0 : 1));
}
function collectEvents(text, grammar) {
	const scans = grammar ? buildScansFromGrammar(grammar.sigils) : BOOTSTRAP_SCANS;
	const blockSpans = [];
	for (const m of text.matchAll(/<<~\s*pranala\s+(#[\w-]+\s+)?(\S+)\s*->\s*(\S+)\s*>>([\s\S]*?)<<~\/pranala\s*>>/gs)) blockSpans.push([m.index, m.index + m[0].length]);
	const inBlock = (pos) => blockSpans.some(([s, e]) => pos >= s && pos < e);
	const seen = /* @__PURE__ */ new Set();
	const events = [];
	for (const scan of scans) {
		const rx = new RegExp(scan.regex.source, scan.regex.flags.includes("s") ? "gs" : "g");
		const emitName = scan.canonicalName ?? scan.sigilName;
		for (const m of text.matchAll(rx)) {
			const pos = m.index;
			if (seen.has(pos)) continue;
			if (scan.eventType !== "open" && scan.eventType !== "close" && inBlock(pos)) continue;
			seen.add(pos);
			events.push({
				pos,
				end: pos + m[0].length,
				raw: m[0],
				sigilName: emitName,
				eventType: scan.eventType,
				groups: [...m]
			});
		}
	}
	return events.sort((a, b) => a.pos - b.pos || a.end - b.end);
}
//#endregion
//#region ../lararium-core/dist/meme-ast/builder.js
/**
* meme-ast/builder.ts — buildMemeAst(): ParseEvent[] → MemeAstNode[].
*
* Local-first, isomorphic: no fs/path/DOM imports.
* Runs in Node, Deno, browser, and TW5-era JS environments.
*
* The push/pop scope stack converts the flat sorted ParseEvent stream into a
* properly nested MemeAstNode tree. This is the structural heart of the parser.
*
* Heleuma ka: sync-heleuma tracks this file.
* Bundle entry: packages/lararium-tw5/src/meme-ast-entry.ts
*/
var CANONICAL_SIGILS = new Set([
	"ahu",
	"kahea-invoke",
	"pranala",
	"loulou",
	"aka",
	"kahea",
	"pono",
	"lele",
	"papalohe",
	"wai",
	"mukuwai",
	"kahawai",
	"huli",
	"kumu",
	"kau",
	"waiho",
	"kukali",
	"toml",
	"control-soh",
	"control-stx",
	"control-etx",
	"control-eot",
	"hana",
	"meme",
	"wehe",
	"helu",
	"kapu",
	"hui",
	"heihei",
	"puka",
	"ui"
]);
function attrsFromGroups(name, groups, scope = "block") {
	const g = (i) => (groups[i] ?? "").trim();
	switch (name) {
		case "wai": return { filter: g(1) };
		case "kahawai": return { filter: g(1) };
		case "huli": return {
			filter: g(1),
			binding: g(2)
		};
		case "hana": return { grammarKey: g(1) };
		case "meme": return { targetUri: g(1) };
		case "wehe":
		case "kumu": return {
			name: g(1),
			params: g(2)
		};
		case "helu": return {
			name: g(1),
			params: g(2),
			expression: g(3)
		};
		case "waiho": return {
			name: g(1),
			value: g(2),
			scope
		};
		case "kau": return {
			name: g(1),
			value: g(2),
			scope
		};
		case "kapu": return {
			qualifier: g(1),
			inline: scope === "carrier" ? "true" : "false"
		};
		case "ui": return { filter: g(1) };
		case "kukali": return g(1) ? { trigger: g(1) } : {};
		case "toml": return {
			profile: g(1),
			content: g(2)
		};
		default: return {};
	}
}
function kaheaInvokeNode(type, args, base, memeUri, children) {
	if (type === "ahu") {
		const slot = args.trim();
		return {
			kind: "Ahu",
			...base,
			slot,
			uri: memeUri + slot,
			delegate: null,
			body: children,
			invocation: true
		};
	}
	return {
		kind: "Sigil",
		...base,
		sigilName: type,
		attrs: {
			summon: "true",
			args
		},
		body: children
	};
}
function closeFrame(frame, memeUri, grammar) {
	const { sigilName, pos, raw, groups, children } = frame;
	const base = {
		pos,
		raw
	};
	const g = (i) => (groups[i] ?? "").trim();
	if (sigilName === "ahu") return {
		kind: "Ahu",
		...base,
		slot: g(1),
		uri: memeUri + g(1),
		delegate: g(2) || null,
		body: children
	};
	if (sigilName === "kahea-invoke") return kaheaInvokeNode(g(1), g(2), base, memeUri, children);
	if (sigilName === "pranala") {
		const body = groups[4] ?? "";
		const family = body.match(/\bfamily\s*=\s*"([\w-]+)"/)?.[1] ?? "relation";
		const role = body.match(/\brole\s*=\s*"([\w-]+)"/)?.[1] ?? null;
		return {
			kind: "Pranala",
			...base,
			slot: g(1) || null,
			fromRaw: g(2),
			toRaw: g(3),
			family,
			role,
			body: children
		};
	}
	if (CANONICAL_SIGILS.has(sigilName)) return {
		kind: "Sigil",
		...base,
		sigilName,
		attrs: attrsFromGroups(sigilName, groups, "block"),
		body: children
	};
	const sigilKind = grammar?.sigils.find((s) => s.name === sigilName)?.kind ?? "unknown";
	return {
		kind: "Dynamic",
		...base,
		sigilName,
		sigilKind,
		eventType: "open-close",
		body: children
	};
}
function makeLeaf(sigilName, eventType, pos, raw, groups, memeUri, ahuStack, grammar) {
	const base = {
		pos,
		raw
	};
	const g = (i) => (groups[i] ?? "").trim();
	switch (sigilName) {
		case "pranala": return {
			kind: "Pranala",
			...base,
			slot: g(1) || null,
			fromRaw: g(2),
			toRaw: g(3),
			family: g(4) || "relation",
			role: g(5) || null,
			body: []
		};
		case "loulou": return {
			kind: "PranalaSugar",
			...base,
			sigil: "loulou",
			slot: null,
			fromRaw: null,
			toRaw: g(1),
			family: "relation",
			role: null,
			listenable: null,
			subscribable: null
		};
		case "aka": {
			const akaSlot = g(2);
			if (akaSlot) return {
				kind: "Ahu",
				...base,
				slot: akaSlot,
				uri: memeUri + akaSlot,
				delegate: null,
				body: [],
				projection: true
			};
			return {
				kind: "PranalaSugar",
				...base,
				sigil: "aka",
				slot: null,
				fromRaw: null,
				toRaw: g(1),
				family: "observe",
				role: null,
				listenable: null,
				subscribable: null
			};
		}
		case "kahea-invoke": return kaheaInvokeNode(g(1), g(2), base, memeUri, []);
		case "kahea": return {
			kind: "PranalaSugar",
			...base,
			sigil: "kahea",
			slot: null,
			fromRaw: null,
			toRaw: g(1),
			family: "dataflow",
			role: null,
			listenable: null,
			subscribable: null
		};
		case "kau": {
			const scope = eventType === "pragma" ? "carrier" : "block";
			if (raw.match(/<<~!?\s*kau\s+[\w-]+\s*=/)) return {
				kind: "Sigil",
				...base,
				sigilName: "kau",
				attrs: {
					name: g(1),
					value: g(2),
					scope
				},
				body: []
			};
			if (g(3) === "" && g(1) !== "" && !g(1).startsWith("#") && raw.includes("(")) return {
				kind: "Sigil",
				...base,
				sigilName: "kau",
				attrs: {
					name: g(1),
					args: g(2)
				},
				body: []
			};
			if (!g(1) && g(2) && g(3) === "") return {
				kind: "Sigil",
				...base,
				sigilName: "kau",
				attrs: {
					name: g(2),
					args: ""
				},
				body: []
			};
			const fragment = g(1).replace(/^#/, "").trim() || null;
			return {
				kind: "Sigil",
				...base,
				sigilName: "kau",
				attrs: {
					fragment: fragment ?? "",
					name: g(2),
					propsRaw: g(3)
				},
				body: []
			};
		}
		case "pono": return {
			kind: "PranalaSugar",
			...base,
			sigil: "pono",
			slot: g(1) || null,
			fromRaw: g(2),
			toRaw: g(3),
			family: "constraint",
			role: g(4) || null,
			listenable: null,
			subscribable: null
		};
		case "papalohe": return {
			kind: "PranalaSugar",
			...base,
			sigil: "papalohe",
			slot: g(1) || null,
			fromRaw: g(2),
			toRaw: g(3),
			family: "reaction",
			role: null,
			listenable: g(4) || null,
			subscribable: g(5) || null
		};
		case "lele": return {
			kind: "Lele",
			...base,
			targetRaw: g(1),
			family: "message"
		};
		case "toml": return {
			kind: "Sigil",
			...base,
			sigilName: "toml",
			attrs: {
				profile: groups[2] !== void 0 ? groups[1] ?? "" : "",
				content: groups[2] ?? groups[1] ?? ""
			},
			body: []
		};
		case "control-soh": return {
			kind: "Pae",
			...base,
			phase: "soh",
			toUri: g(1) || void 0
		};
		case "control-stx": return {
			kind: "Pae",
			...base,
			phase: "stx"
		};
		case "control-etx": return {
			kind: "Pae",
			...base,
			phase: "etx"
		};
		case "control-eot": return {
			kind: "Pae",
			...base,
			phase: "eot"
		};
		default: {
			if (CANONICAL_SIGILS.has(sigilName)) {
				const scope = eventType === "pragma" ? "carrier" : "block";
				return {
					kind: "Sigil",
					...base,
					sigilName,
					attrs: attrsFromGroups(sigilName, groups, scope),
					body: []
				};
			}
			const sigilKind = grammar?.sigils.find((s) => s.name === sigilName)?.kind ?? "unknown";
			return {
				kind: "Dynamic",
				...base,
				sigilName,
				sigilKind,
				eventType: eventType === "pragma" ? "pragma" : "leaf",
				body: []
			};
		}
	}
}
function buildMemeAst(events, memeUri, grammar, sourceText) {
	const root = [];
	const stack = [];
	const ahuStack = [];
	let cursor = 0;
	const top = () => stack.length > 0 ? stack[stack.length - 1].children : root;
	const emitTextGap = (upTo) => {
		if (!sourceText || upTo <= cursor) return;
		const span = sourceText.slice(cursor, upTo);
		if (span.trim()) top().push({
			kind: "Text",
			pos: cursor,
			raw: span,
			content: span
		});
	};
	for (const evt of events) {
		const { sigilName, eventType, pos, end, raw, groups } = evt;
		emitTextGap(pos);
		if (eventType === "open") {
			stack.push({
				sigilName,
				pos,
				raw,
				groups,
				children: []
			});
			if (sigilName === "ahu") ahuStack.push(memeUri + (groups[1] ?? "").trim());
			cursor = end;
			continue;
		}
		if (eventType === "close") {
			let i = stack.length - 1;
			while (i >= 0 && stack[i].sigilName !== sigilName) i--;
			if (i < 0) {
				cursor = end;
				continue;
			}
			while (stack.length - 1 > i) top().push(closeFrame(stack.pop(), memeUri, grammar));
			const frame = stack.pop();
			if (sigilName === "ahu") ahuStack.pop();
			top().push(closeFrame(frame, memeUri, grammar));
			cursor = end;
			continue;
		}
		top().push(makeLeaf(sigilName, eventType, pos, raw, groups, memeUri, ahuStack, grammar));
		cursor = end;
	}
	if (sourceText && cursor < sourceText.length) {
		const span = sourceText.slice(cursor);
		if (span.trim()) top().push({
			kind: "Text",
			pos: cursor,
			raw: span,
			content: span
		});
	}
	while (stack.length > 0) {
		const frame = stack.pop();
		if (frame.sigilName === "ahu") ahuStack.pop();
		root.push(closeFrame(frame, memeUri, grammar));
	}
	return root;
}
//#endregion
//#region ../lararium-core/dist/meme-ast/edges.js
/**
* meme-ast/edges.ts — edgesFromMemeAst(): MemeAstNode[] → PranalaEdge[].
*
* Local-first, isomorphic: no fs/path/DOM imports.
* Runs in Node, Deno, browser, and TW5-era JS environments.
*
* Projects edge declarations (Pranala, PranalaSugar, Lele, Pae/soh) out of
* a parsed meme AST into the flat PranalaEdge record format consumed by the
* meme graph, MCP export, and TW5 edge-field codec.
*
* Heleuma ka: sync-heleuma tracks this file.
* Bundle entry: packages/lararium-tw5/src/meme-ast-entry.ts
*/
function edgesFromMemeAst(ast, memeUri) {
	const edges = [];
	walkForEdges(ast, memeUri, [memeUri], edges);
	return edges;
}
function walkForEdges(nodes, memeUri, ahuStack, edges) {
	for (const node of nodes) switch (node.kind) {
		case "Ahu":
			ahuStack.push(node.uri);
			walkForEdges(node.body, memeUri, ahuStack, edges);
			ahuStack.pop();
			break;
		case "Pranala":
			edges.push(projectEdge(node, memeUri, ahuStack));
			if (node.body.length) walkForEdges(node.body, memeUri, ahuStack, edges);
			break;
		case "PranalaSugar":
			edges.push(projectSugar(node, memeUri, ahuStack));
			break;
		case "Lele":
			edges.push(projectDispatch(node, memeUri, ahuStack));
			break;
		case "Pae":
			if (node.phase === "soh" && node.toUri) edges.push(mk(memeUri, memeUri, null, node.toUri, node.toUri, "control", "soh"));
			break;
		case "Text": break;
		case "Sigil":
		case "Dynamic":
			if (node.body.length) walkForEdges(node.body, memeUri, ahuStack, edges);
			break;
	}
}
function tok(token, memeUri, ahuStack) {
	if (token === "?") return [memeUri, ahuStack[ahuStack.length - 1] ?? memeUri];
	if (token.startsWith("#")) return [memeUri, memeUri + token];
	if (token.startsWith("lar:///") && token.includes("#")) {
		const idx = token.indexOf("#");
		const uri = token.slice(0, idx);
		return [uri, uri + token.slice(idx)];
	}
	if (token.startsWith("lar:///")) return [token, token];
	return [memeUri, memeUri];
}
function mk(fromUri, fromSocket, fromSlot, toUri, toSocket, family, role, payload = {}) {
	return {
		fromUri,
		fromSocket,
		fromSlot,
		toUri,
		toSocket,
		family,
		role,
		lifecycle: "instance",
		traversal: "source-to-target",
		propagation: "none",
		label: "",
		cardinality: null,
		polarity: null,
		status: "declared",
		confidence: null,
		renderMode: null,
		payload
	};
}
function projectEdge(node, mu, ahuStack) {
	const fromSlot = node.slot ? mu + node.slot : null;
	const [fromUri, fromSocket] = tok(node.fromRaw, mu, ahuStack);
	const [toUri, toSocket] = tok(node.toRaw, mu, ahuStack);
	return mk(fromUri, fromSocket, fromSlot, toUri, toSocket, node.family, node.role);
}
function projectSugar(node, mu, ahuStack) {
	const fromSlot = node.slot ? mu + node.slot : null;
	const fromSocket = ahuStack[ahuStack.length - 1] ?? mu;
	if (node.fromRaw !== null) {
		const [fromUri, fSock] = tok(node.fromRaw, mu, ahuStack);
		const [toUri, toSocket] = tok(node.toRaw, mu, ahuStack);
		const payload = {};
		if (node.listenable) payload["listenable"] = node.listenable;
		if (node.subscribable) payload["subscribable"] = node.subscribable;
		const renderMode = node.sigil === "papalohe" ? "papalohe" : null;
		const edge = mk(fromUri, fSock, fromSlot, toUri, toSocket, node.family, node.role, payload);
		return renderMode ? {
			...edge,
			renderMode
		} : edge;
	}
	const toRaw = node.toRaw;
	let toUri, toSocket;
	if (toRaw.startsWith("#")) {
		toUri = mu;
		toSocket = mu + toRaw;
	} else if (toRaw.startsWith("lar:///") && toRaw.includes("#")) {
		const idx = toRaw.indexOf("#");
		toUri = toRaw.slice(0, idx);
		toSocket = toUri + toRaw.slice(idx);
	} else {
		toUri = toRaw;
		toSocket = "";
	}
	const propagation = node.sigil === "kahea" ? "push-forward" : "none";
	return mk(mu, fromSocket, null, toUri, toSocket, node.family, node.role, { propagation });
}
function projectDispatch(node, mu, ahuStack) {
	const fromSocket = ahuStack[ahuStack.length - 1] ?? mu;
	const toRaw = node.targetRaw;
	let toUri, toSocket;
	if (toRaw.startsWith("#")) {
		toUri = mu;
		toSocket = mu + toRaw;
	} else if (toRaw.startsWith("lar:///") && toRaw.includes("#")) {
		const idx = toRaw.indexOf("#");
		toUri = toRaw.slice(0, idx);
		toSocket = toUri + toRaw.slice(idx);
	} else {
		toUri = toRaw;
		toSocket = "";
	}
	return mk(mu, fromSocket, null, toUri, toSocket, "message", null);
}
//#endregion
//#region ../lararium-core/dist/meme-ast/parse.js
/**
* meme-ast/parse.ts — parseMemeText(): top-level public entry point.
*
* Local-first, isomorphic: no fs/path/DOM imports.
* Runs in Node, Deno, browser, and TW5-era JS environments.
*
* Three tiers of result:
*   nodes  — MemeAstNode[] (full parse tree)
*   edges  — PranalaEdge[]   (projected edge records for the meme graph)
*   meme   — MemeNode      (rooted document with uri + body)
*
* In a live client, parsing MUST happen inside the TW5 VM so that the grammar
* meme (sigil vocabulary) is available and the deserializer can split ahu slots.
* This module enables the same parsing in Node, Deno, VS Code grammar plugins,
* syntax highlighters, and other tooling without a TW5 runtime.
*
* Heleuma ka: sync-heleuma tracks this file.
* Bundle entry: packages/lararium-tw5/src/meme-ast-entry.ts
*/
function parseMemeText(uri, text, grammar) {
	const nodes = buildMemeAst(collectEvents(text, grammar), uri, grammar, text);
	const edges = edgesFromMemeAst(nodes, uri);
	return {
		meme: {
			kind: "Meme",
			uri,
			body: nodes
		},
		nodes,
		edges
	};
}
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
function memeticWikitextDeserializer(text, fields) {
	const baseUri = String(fields?.["title"] ?? "");
	const result = [];
	const parser = new MemeStreamParser();
	const closes = [...parser.push(text), ...parser.flush()].filter((e) => e.kind === "carrier-close");
	for (const ev of closes) {
		const tiddlers = splitMemeToTiddlers(ev.uri || baseUri, ev.fullText, asStringFields(fields));
		result.push(...tiddlers);
	}
	if (result.length === 0 && text.trim()) result.push(...splitMemeToTiddlers(baseUri, text, asStringFields(fields)));
	return result;
}
function splitMemeToTiddlers(uri, text, baseFields) {
	const { nodes } = parseMemeText(uri, text);
	const warnings = [];
	const children = [];
	for (const node of nodes) {
		if (node.kind !== "Ahu" || !node.slot || CONTROL_SLOTS.has(node.slot)) continue;
		const ahuNode = node;
		const childTitle = uri + ahuNode.slot;
		const bodyText = rawBodyText(text, ahuNode);
		const childFields = extractAhuFields(bodyText, warnings, `${uri}${ahuNode.slot}`);
		children.push({
			...childFields,
			title: childTitle,
			text: bodyText
		});
	}
	const rootToml = extractRootToml(text);
	const rootFields = rootToml ? fieldifyToml(rootToml, warnings, uri) : {};
	const parentText = transformParentText(text);
	const result = [{
		...baseFields,
		...rootFields,
		title: uri,
		type: "text/x-memetic-wikitext",
		text: parentText
	}, ...children];
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
function rawBodyText(fullText, node) {
	if (!node.body.length) return "";
	const first = node.body[0];
	const last = node.body[node.body.length - 1];
	return fullText.slice(first.pos, last.pos + last.raw.length);
}
function extractRootToml(text) {
	const firstAhu = text.search(/<<~[^>]*\bahu\s+#[\w-]+\s*>>/);
	const firstStx = text.search(/<<~[^>]*&#x0002;/);
	let limit = text.length;
	if (firstAhu >= 0) limit = Math.min(limit, firstAhu);
	if (firstStx >= 0) limit = Math.min(limit, firstStx);
	const m = /```toml[ \t]+iam[ \t]*\n([\s\S]*?)```/.exec(text.slice(0, limit));
	return m ? m[1] ?? null : null;
}
function extractAhuFields(bodyText, warnings, context) {
	const iamM = /^[ \t\n]*```toml[ \t]+iam[ \t]*\n([\s\S]*?)```/.exec(bodyText);
	const plainM = /^[ \t\n]*```toml[ \t]*\n([\s\S]*?)```/.exec(bodyText);
	const toml = iamM?.[1] ?? plainM?.[1] ?? null;
	if (!toml) return {};
	return fieldifyToml(toml, warnings, context);
}
function fieldifyToml(toml, warnings, context) {
	const parsed = parseTaploFields(toml);
	const out = {};
	for (const [k, v] of Object.entries(parsed)) {
		if (k === "title") {
			warnings.push(`${context}: "title" in TOML ignored (derived from URI)`);
			continue;
		}
		if (k === "text") {
			warnings.push(`${context}: "text" in TOML ignored (derived from body)`);
			continue;
		}
		if (Array.isArray(v)) out[k] = v.map(String);
		else out[k] = String(v);
	}
	return out;
}
function transformParentText(text) {
	return text.replace(/<<~[^>]*\bahu\s+(#[\w-]+)\s*>>[\s\S]*?<<~\/ahu\s*>>/g, (_, slot) => `<<~ kahea ahu ${slot} >>`);
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
//#endregion
exports.memeticWikitextDeserializer = memeticWikitextDeserializer;
exports["text/x-memetic-wikitext"] = exports.memeticWikitextDeserializer;

<<~&#x0003;>>

<<~ ahu #source >>

## Source

Compiled CJS artifact. Canonical TS source: `packages/lararium-tw5/src/deserializer.ts` (`source-symbol = "memeticWikitextDeserializer"`).
Anchor meme: `lar:///ha.ka.ba/@lararium/tw5/modules/deserializer`.

Run `pnpm --filter @lararium/tw5 build:tiddlers` to regenerate.

<<~/ahu >>

<<~&#x0004; -> ? >>
