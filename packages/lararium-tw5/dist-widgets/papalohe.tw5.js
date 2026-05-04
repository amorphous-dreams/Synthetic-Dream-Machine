Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
//#region src/widgets/papalohe.ts
function PapaloheWidget(parseTreeNode, options) {
	this.initialise(parseTreeNode, options);
}
PapaloheWidget.prototype.render = function(parent, _nextSibling) {
	this.parentDomNode = parent;
	this.computeAttributes();
	this.execute();
	const el = this.document.createElement("meta");
	el.setAttribute("data-lar-kind", "papalohe");
	el.setAttribute("data-lar-from", this.getAttribute("from", ""));
	el.setAttribute("data-lar-to", this.getAttribute("to", ""));
	el.setAttribute("data-lar-trigger", this.getAttribute("trigger", ""));
	el.setAttribute("data-lar-fn", this.getAttribute("fn", ""));
	el.setAttribute("data-lar-slot", this.getAttribute("slot", ""));
	parent.appendChild(el);
	this.domNodes = [el];
};
PapaloheWidget.prototype.execute = function() {
	this.makeChildWidgets();
};
//#endregion
exports.PapaloheWidget = PapaloheWidget;
