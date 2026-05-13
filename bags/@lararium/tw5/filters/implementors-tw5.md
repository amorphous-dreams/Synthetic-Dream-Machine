<<~&#x0001; ? -> lar:///ha.ka.ba/@lararium/tw5/filters/implementors-tw5 >>
```toml iam
uri-path = "ha.ka.ba/@lararium/tw5/filters/implementors-tw5"
file-path = "bags/@lararium/tw5/filters/implementors-tw5.md"
type          = "application/javascript"
module-type   = "filteroperator"
register      = "CS"
confidence    = 0.90
mana          = 0.90
role          = "compiled TW5 filter operator: implementors — generated from packages/lararium-tw5/src/tw5-widgets.ts"
cacheable     = true
retain        = true
source-symbol = "registerImplementorsOperator"
source-file   = "packages/lararium-tw5/src/tw5-widgets.ts"
```

<<~&#x0002;>>

Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
//#region src/filters/implementors.ts
/** Exact-token match on space-separated `implements` field.
*  TW5's built-in field: operator does substring matching, which breaks when one
*  URI is a prefix of another. This uses parseStringArray for exact token matching. */
function registerImplementors(tw) {
	tw.filterOperators["implementors"] = function(source, operator) {
		const target = operator.operand ?? "";
		const results = [];
		source(function(tiddler, title) {
			if (!tiddler) return;
			const raw = String(tiddler.fields?.["implements"] ?? "");
			if ((tw.utils.parseStringArray(raw) ?? []).includes(target)) results.push(title);
		});
		return results;
	};
}
//#endregion
exports.registerImplementors = registerImplementors;

<<~&#x0003;>>

<<~ ahu #source >>

## Source

Compiled CJS artifact. Canonical TS source: `packages/lararium-tw5/src/tw5-widgets.ts` (`source-symbol = "registerImplementorsOperator"`).
Anchor meme: `lar:///ha.ka.ba/@lararium/tw5/filters/implementors`.

Run `pnpm --filter @lararium/tw5 build:tiddlers` to regenerate.

<<~/ahu >>

<<~&#x0004; -> ? >>
