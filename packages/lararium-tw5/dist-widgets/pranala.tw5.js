Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
//#region src/widgets/pranala.ts
function PranalaWidget(parseTreeNode, options) {
	this.initialise(parseTreeNode, options);
}
PranalaWidget.prototype.render = function(parent, _nextSibling) {
	this.parentDomNode = parent;
	this.computeAttributes();
	this.execute();
	const el = this.document.createElement("meta");
	el.setAttribute("data-lar-kind", "pranala");
	el.setAttribute("data-lar-from", this.getAttribute("from", ""));
	el.setAttribute("data-lar-to", this.getAttribute("to", ""));
	el.setAttribute("data-lar-family", this.getAttribute("family", ""));
	el.setAttribute("data-lar-role", this.getAttribute("role", ""));
	parent.appendChild(el);
	this.domNodes = [el];
};
PranalaWidget.prototype.execute = function() {
	this.makeChildWidgets();
};
//#endregion
exports.PranalaWidget = PranalaWidget;
