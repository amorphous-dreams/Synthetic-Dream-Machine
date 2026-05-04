Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
//#region src/widgets/toml.ts
function TomlWidget(parseTreeNode, options) {
	this.initialise(parseTreeNode, options);
}
TomlWidget.prototype.render = function(parent, _nextSibling) {
	this.parentDomNode = parent;
	this.computeAttributes();
	this.execute();
	const el = this.document.createElement("script");
	el.setAttribute("type", "application/toml");
	el.setAttribute("data-lar-kind", "toml");
	el.textContent = this.getAttribute("content", "");
	parent.appendChild(el);
	this.domNodes = [el];
};
TomlWidget.prototype.execute = function() {
	this.makeChildWidgets();
};
//#endregion
exports.TomlWidget = TomlWidget;
