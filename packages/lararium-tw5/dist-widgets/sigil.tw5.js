Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
//#region src/widgets/sigil.ts
function SigilWidget(parseTreeNode, options) {
	this.initialise(parseTreeNode, options);
}
SigilWidget.prototype.render = function(parent, nextSibling) {
	this.parentDomNode = parent;
	this.computeAttributes();
	this.execute();
	const el = this.document.createElement("span");
	el.setAttribute("data-lar-kind", "sigil");
	el.setAttribute("data-lar-sigil", this.parseTreeNode?.tag ?? "");
	parent.appendChild(el);
	this.domNodes = [el];
	this.renderChildren(el, nextSibling);
};
SigilWidget.prototype.execute = function() {
	this.makeChildWidgets();
};
//#endregion
exports.SigilWidget = SigilWidget;
