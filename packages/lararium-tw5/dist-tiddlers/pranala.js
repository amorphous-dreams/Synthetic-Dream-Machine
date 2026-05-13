/*\
title: lar:///ha.ka.ba/@lararium/tw5/widgets/pranala
type: application/javascript
module-type: widget
\*/
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
//#region src/widgets/_cascade-sigil-base.ts
var Widget = require("$:/core/modules/widgets/widget.js").widget;
function makeCascadeSigilWidget(config) {
	const cascadeFilter = `[all[shadows+tiddlers]tag[${config.cascadeTag}]!is[draft]] :map:flat[subfilter{!!text}] +[first[]]`;
	function SigilWidget(parseTreeNode, options) {
		this.initialise(parseTreeNode, options);
	}
	SigilWidget.prototype = Object.create(Widget.prototype);
	SigilWidget.prototype.render = function(parent, nextSibling) {
		this.parentDomNode = parent;
		this.computeAttributes();
		this.execute();
		const template = (this.wiki?.filterTiddlers?.(cascadeFilter, this) ?? [])[0] || config.fallbackTemplate;
		const bindings = config.buildBindings(this);
		const targetUri = config.setCurrentTiddler ? config.setCurrentTiddler(this) : "";
		let inner = {
			type: "transclude",
			attributes: { $tiddler: {
				type: "string",
				value: template
			} },
			children: []
		};
		if (config.setCurrentTiddler && targetUri) inner = {
			type: "tiddler",
			attributes: { tiddler: {
				type: "string",
				value: targetUri
			} },
			children: [inner]
		};
		const entries = Object.entries(bindings);
		for (let i = entries.length - 1; i >= 0; i--) {
			const [name, value] = entries[i];
			inner = {
				type: "set",
				attributes: {
					name: {
						type: "string",
						value: name
					},
					value: {
						type: "string",
						value
					}
				},
				children: [inner]
			};
		}
		const childWidget = this.makeChildWidget?.(inner, void 0);
		if (childWidget) {
			childWidget.render(parent, nextSibling);
			this.children = [childWidget];
			return;
		}
		const placeholderText = config.placeholder ? config.placeholder(this) : `? ${config.cascadeTag}`;
		const placeholder = this.document.createTextNode(placeholderText);
		parent.insertBefore(placeholder, nextSibling);
		this.domNodes = [placeholder];
	};
	SigilWidget.prototype.execute = function() {};
	SigilWidget.prototype.refresh = function(changedTiddlers) {
		const targetUri = config.refreshUri ? config.refreshUri(this) : "";
		if (targetUri && changedTiddlers[targetUri]) {
			this.refreshSelf();
			return true;
		}
		const tagPrefix = `lar:///config/Lar/${config.cascadeTag.replace("$:/tags/Lar/", "")}`;
		for (const t of Object.keys(changedTiddlers)) if (t.startsWith(tagPrefix)) {
			this.refreshSelf();
			return true;
		}
		let changed = false;
		for (const child of this.children ?? []) if (child.refresh(changedTiddlers)) changed = true;
		return changed;
	};
	return SigilWidget;
}
//#endregion
//#region src/widgets/pranala.ts
/**
* PranalaWidget — explicit edge sigil. Two surface forms share the widget:
*   Inline:  `<<~ pranala #name? <from> -> <to> [family:f] [role:r] >>`
*   Block:   `<<~ pranala #name? <from> -> <to> >>body<<~/pranala >>`
*
* Templates branch on `<<pranala-body>>` non-emptiness to distinguish
* block from inline at render time.
*/
var PranalaWidget = makeCascadeSigilWidget({
	cascadeTag: "$:/tags/Lar/PranalaTemplate",
	fallbackTemplate: "lar:///ha.ka.ba/@lararium/templates/pranala/html",
	buildBindings: (w) => ({
		"pranala-slot": w.getAttribute("slot", ""),
		"pranala-from": w.getAttribute("from", ""),
		"pranala-to": w.getAttribute("to", ""),
		"pranala-body": w.getAttribute("body", ""),
		"pranala-family": w.getAttribute("family", ""),
		"pranala-role": w.getAttribute("role", "")
	}),
	placeholder: (w) => `pranala ${w.getAttribute("from", "")} -> ${w.getAttribute("to", "")}`
});
//#endregion
exports.pranala = PranalaWidget;
