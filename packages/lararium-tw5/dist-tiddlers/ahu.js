/*\
title: lar:///ha.ka.ba/@lararium/tw5/widgets/ahu
type: application/javascript
module-type: widget
\*/
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
//#region src/widgets/ahu.ts
var Widget = require("$:/core/modules/widgets/widget.js").widget;
var CASCADE_FILTER = "[all[shadows+tiddlers]tag[$:/tags/Lar/AhuTemplate]!is[draft]] :map:flat[subfilter{!!text}] +[first[]]";
var FALLBACK_TEMPLATE = "lar:///ha.ka.ba/@lararium/templates/ahu/html";
function AhuWidget(parseTreeNode, options) {
	this.initialise(parseTreeNode, options);
}
AhuWidget.prototype = Object.create(Widget.prototype);
AhuWidget.prototype.render = function(parent, nextSibling) {
	this.parentDomNode = parent;
	this.computeAttributes();
	this.execute();
	const slot = this.getAttribute("slot", "");
	const explicit = this.getAttribute("uri", "");
	const parentUri = this.getVariable?.("currentTiddler") ?? "";
	const isUnknownPlaceholder = explicit.startsWith("lar:///unknown");
	const childUri = explicit && !isUnknownPlaceholder ? explicit : slot.startsWith("lar:") ? slot : parentUri + slot;
	const template = (this.wiki?.filterTiddlers?.(CASCADE_FILTER, this) ?? [])[0] || FALLBACK_TEMPLATE;
	const subtree = {
		type: "tiddler",
		attributes: { tiddler: {
			type: "string",
			value: childUri
		} },
		children: [{
			type: "transclude",
			attributes: { $tiddler: {
				type: "string",
				value: template
			} },
			children: []
		}]
	};
	const childWidget = this.makeChildWidget?.(subtree, void 0);
	if (childWidget) {
		childWidget.render(parent, nextSibling);
		this.children = [childWidget];
		return;
	}
	const placeholder = this.document.createTextNode(`? ahu ${slot}`);
	parent.insertBefore(placeholder, nextSibling);
	this.domNodes = [placeholder];
};
AhuWidget.prototype.execute = function() {};
AhuWidget.prototype.refresh = function(changedTiddlers) {
	const slot = this.getAttribute("slot", "");
	const explicit = this.getAttribute("uri", "");
	const parentUri = this.getVariable?.("currentTiddler") ?? "";
	if (changedTiddlers[explicit || parentUri + slot]) {
		this.refreshSelf();
		return true;
	}
	for (const t of Object.keys(changedTiddlers)) if (t.startsWith("$:/config/Lar/AhuTemplate")) {
		this.refreshSelf();
		return true;
	}
	let changed = false;
	for (const child of this.children ?? []) if (child.refresh(changedTiddlers)) changed = true;
	return changed;
};
//#endregion
exports.ahu = AhuWidget;
