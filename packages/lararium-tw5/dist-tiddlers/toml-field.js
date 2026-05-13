/*\
title: lar:///ha.ka.ba/@lararium/tw5/filters/toml-field
type: application/javascript
module-type: library
\*/
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
