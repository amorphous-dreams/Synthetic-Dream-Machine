<<~&#x0001; ? -> lar:///ha.ka.ba/@lararium/tw5/filters/toml-field-tw5 >>
```toml iam
uri-path = "ha.ka.ba/@lararium/tw5/filters/toml-field-tw5"
file-path = "bags/@lararium/tw5/filters/toml-field-tw5.md"
type          = "application/javascript"
module-type   = "filteroperator"
register      = "CS"
confidence    = 0.90
mana          = 0.90
role          = "compiled TW5 filter operator: toml — generated from packages/lararium-tw5/src/tw5-widgets.ts"
cacheable     = true
retain        = true
source-symbol = "registerTomlFieldOperator"
source-file   = "packages/lararium-tw5/src/tw5-widgets.ts"
```

<<~&#x0002;>>

Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
//#region src/filters/toml-field.ts
/** toml:key[val] — field filter using TOML field names directly.
*  toml:register[CS] → tiddlers where the "register" field equals "CS" */
function registerTomlField(tw) {
	tw.filterOperators["toml"] = function(source, operator) {
		const fieldName = operator.suffix ?? "";
		const value = operator.operand ?? "";
		const results = [];
		source(function(tiddler, title) {
			if (!tiddler) return;
			if (String(tiddler.fields?.[fieldName] ?? "") === value) results.push(title);
		});
		return results;
	};
}
//#endregion
exports.registerTomlField = registerTomlField;

<<~&#x0003;>>

<<~ ahu #source >>

## Source

Compiled CJS artifact. Canonical TS source: `packages/lararium-tw5/src/tw5-widgets.ts` (`source-symbol = "registerTomlFieldOperator"`).
Anchor meme: `lar:///ha.ka.ba/@lararium/tw5/filters/toml-field`.

Run `pnpm --filter @lararium/tw5 build:tiddlers` to regenerate.

<<~/ahu >>

<<~&#x0004; -> ? >>
