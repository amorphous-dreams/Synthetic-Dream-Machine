Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
//#region src/widgets/kumu.ts
function KumuWidget(parseTreeNode, options) {
	this.initialise(parseTreeNode, options);
}
KumuWidget.prototype.render = function(parent, _nextSibling) {
	this.parentDomNode = parent;
	this.computeAttributes();
	this.execute();
	const name = this.getAttribute("name", "");
	const args = this.getAttribute("props", "");
	const defUri = (this.wiki?.filterTiddlers?.(`[all[tiddlers]tag[$:/tags/LarariumKumu]field:kumu-name[${name}]]`) ?? [])[0] ?? "";
	const el = this.document.createElement("div");
	el.setAttribute("data-lar-kind", "kumu");
	el.setAttribute("data-lar-name", name);
	el.setAttribute("data-lar-resolved", defUri ? "true" : "false");
	parent.appendChild(el);
	this.domNodes = [el];
	if (defUri) {
		const propRe = /([\w-]+):(\S+)/g;
		let m;
		while ((m = propRe.exec(args)) !== null) this.setVariable(m[1], m[2]);
		const transclude = this.wiki?.makeTranscludeWidget(defUri, {
			document: this.document,
			parentWidget: this
		});
		if (transclude) {
			transclude.render(el, null);
			this.children = [transclude];
		}
	} else {
		const hole = this.document.createElement("span");
		hole.setAttribute("data-lar-kind", "hole");
		hole.textContent = `? ${name}`;
		el.appendChild(hole);
	}
};
KumuWidget.prototype.execute = function() {};
KumuWidget.prototype.refresh = function(changedTiddlers) {
	let changed = false;
	for (const child of this.children ?? []) if (child.refresh(changedTiddlers)) changed = true;
	return changed;
};
//#endregion
exports.KumuWidget = KumuWidget;
