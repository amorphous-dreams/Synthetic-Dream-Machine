/**
 * @deprecated web2-era — DirectRecipeVm dead. See recipe-vm.web2.ts for the original.
 * Rebuild target: meme-recipe-vm.ts — same RecipeVm interface; DirectRecipeVm → MemeRecipeVm.
 */

export interface SerializedRecord {
  title:  string;
  fields: Record<string, string | string[]>;
  text?:  string;
}

export interface RecipeVm {
  loadRecords(records: SerializedRecord[]): Promise<void>;
  setTiddler(fields: Record<string, string | string[]>): void;
  removeTiddler(title: string): void;
  filterTiddlers(expr: string): Promise<string[]>;
  renderCarrier(uri: string): Promise<string | null>;
  dispose(): void;
}
