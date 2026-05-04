Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
//#region src/widgets/kukali.ts
function KukaliWidget(parseTreeNode, options) {
	this.initialise(parseTreeNode, options);
}
KukaliWidget.prototype.render = function(parent, _nextSibling) {
	this.parentDomNode = parent;
	this.computeAttributes();
	this.execute();
	const listenable = this.getAttribute("listenable", "");
	const uri = this.getAttribute("uri", "") || (this.getVariable?.("currentTiddler") ?? "");
	const el = this.document.createElement("span");
	el.setAttribute("data-lar-kind", "kukali");
	el.setAttribute("data-lar-listenable", listenable);
	el.setAttribute("data-lar-uri", uri);
	parent.appendChild(el);
	this.domNodes = [el];
	if (uri && listenable && this.wiki?.dispatchEvent) this.wiki.dispatchEvent("tm-lararium-event", {
		uri,
		listenable
	});
};
KukaliWidget.prototype.execute = function() {
	this.makeChildWidgets();
};
//#endregion
exports.KukaliWidget = KukaliWidget;
