Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
//#region src/widgets/lele.ts
function LeleWidget(parseTreeNode, options) {
	this.initialise(parseTreeNode, options);
}
LeleWidget.prototype.render = function(parent, _nextSibling) {
	this.parentDomNode = parent;
	this.computeAttributes();
	this.execute();
	const el = this.document.createElement("meta");
	el.setAttribute("data-lar-kind", "lele");
	el.setAttribute("data-lar-target", this.getAttribute("target", ""));
	parent.appendChild(el);
	this.domNodes = [el];
};
LeleWidget.prototype.execute = function() {
	this.makeChildWidgets();
};
//#endregion
exports.LeleWidget = LeleWidget;
