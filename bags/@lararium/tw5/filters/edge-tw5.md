<<~&#x0001; ? -> lar:///ha.ka.ba/@lararium/tw5/filters/edge-tw5 >>
```toml iam
uri-path = "ha.ka.ba/@lararium/tw5/filters/edge-tw5"
file-path = "bags/@lararium/tw5/filters/edge-tw5.md"
type          = "application/javascript"
module-type   = "filteroperator"
register      = "CS"
confidence    = 0.90
mana          = 0.90
role          = "compiled TW5 filter operator: edge — generated from packages/lararium-tw5/src/tw5-widgets.ts"
cacheable     = true
retain        = true
source-symbol = "registerEdgeOperator"
source-file   = "packages/lararium-tw5/src/tw5-widgets.ts"
```

<<~&#x0002;>>

Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
//#region src/filters/edge.ts
/** edge:family[role] — filter tiddlers that have an edge-out field for family+role.
*  edge:control[owns] → has field edge-out-control-owns
*  edge:control[]     → has any edge-out-control-* field */
function registerEdge(tw) {
	tw.filterOperators["edge"] = function(source, operator) {
		const family = operator.suffix ?? "";
		const role = operator.operand ?? "";
		const results = [];
		source(function(tiddler, title) {
			if (!tiddler) return;
			if (role) {
				const v = tiddler.fields?.[`edge-out-${family}-${role}`];
				if (v !== void 0 && v !== "") results.push(title);
			} else {
				const prefix = `edge-out-${family}-`;
				if (Object.keys(tiddler.fields ?? {}).some((k) => k.startsWith(prefix))) results.push(title);
			}
		});
		return results;
	};
}
//#endregion
exports.registerEdge = registerEdge;

<<~&#x0003;>>

<<~ ahu #source >>

## Source

Compiled CJS artifact. Canonical TS source: `packages/lararium-tw5/src/tw5-widgets.ts` (`source-symbol = "registerEdgeOperator"`).
Anchor meme: `lar:///ha.ka.ba/@lararium/tw5/filters/edge`.

Run `pnpm --filter @lararium/tw5 build:tiddlers` to regenerate.

<<~/ahu >>

<<~&#x0004; -> ? >>
