<<~&#x0001; ? -> lar:///ha.ka.ba/@lararium/tw5/modules/meme-ast-tw5 >>
```toml iam
uri-path = "ha.ka.ba/@lararium/tw5/modules/meme-ast-tw5"
file-path = "packages/lararium-tw5/memes/modules/meme-ast-tw5.md"
type          = "application/javascript"
module-type   = "library"
register      = "CS"
confidence    = 0.90
mana          = 0.90
role          = "compiled TW5 meme-ast library module — generated from packages/lararium-tw5/src/meme-ast-entry.ts"
cacheable     = true
retain        = true
source-symbol = "parseMemeText"
source-file   = "packages/lararium-tw5/src/meme-ast-entry.ts"
body-sha256   = ""
```

<<~&#x0002;>>

Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
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
function parseMemeNodes(uri, text, grammar) {
	return buildMemeAst(collectEvents(text, grammar), uri, grammar, text);
}
function parseMemeEdges(uri, text, grammar) {
	return edgesFromMemeAst(buildMemeAst(collectEvents(text, grammar), uri, grammar, text), uri);
}
//#endregion
exports.BOOTSTRAP_SCANS = BOOTSTRAP_SCANS;
exports.buildMemeAst = buildMemeAst;
exports.collectEvents = collectEvents;
exports.edgesFromMemeAst = edgesFromMemeAst;
exports.parseMemeEdges = parseMemeEdges;
exports.parseMemeNodes = parseMemeNodes;
exports.parseMemeText = parseMemeText;

<<~&#x0003;>>

<<~ ahu #source >>

## Source

Compiled CJS artifact. Canonical TS source: `packages/lararium-tw5/src/meme-ast-entry.ts` (`source-symbol = "parseMemeText"`).
Anchor meme: `lar:///ha.ka.ba/@lararium/tw5/modules/meme-ast`.

Run `pnpm --filter @lararium/tw5 build:tiddlers` to regenerate.

<<~/ahu >>

<<~&#x0004; -> ? >>
