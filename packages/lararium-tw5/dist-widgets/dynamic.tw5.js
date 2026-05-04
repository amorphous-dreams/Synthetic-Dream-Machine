Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
//#region src/widgets/dynamic.ts
function DynamicWidget(parseTreeNode, options) {
	this.initialise(parseTreeNode, options);
}
DynamicWidget.prototype.render = function(parent, nextSibling) {
	this.parentDomNode = parent;
	this.computeAttributes();
	this.execute();
	const el = this.document.createElement("span");
	el.setAttribute("data-lar-kind", "dynamic");
	el.setAttribute("data-lar-sigil", this.parseTreeNode?.tag ?? "");
	parent.appendChild(el);
	this.domNodes = [el];
	this.renderChildren(el, nextSibling);
};
DynamicWidget.prototype.execute = function() {
	this.makeChildWidgets();
};
//#endregion
exports.DynamicWidget = DynamicWidget;
