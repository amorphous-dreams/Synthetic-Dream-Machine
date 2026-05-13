/*\
title: lar:///ha.ka.ba/@lararium/tw5/filters/edge
type: application/javascript
module-type: library
\*/
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
