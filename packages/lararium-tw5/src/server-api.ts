/**
 * @deprecated web2-era — all functions dead. See server-api.web2.ts for the original.
 * Rebuild target: swap DirectRecipeVm → MemeRecipeVm from ./meme-recipe-vm.js.
 * VmPool API (bootRecipeVm, attachRecipeVm, releaseRecipeVm, filterRecipe, renderCarrier)
 * and the factory seam pattern are FFZ-aligned — keep contracts, swap implementation.
 */

import type { RecipeVm } from "./recipe-vm.js";

// VmDebugSurface kept — it functions as the admin debug contract, invariant across rebuild.
export interface VmDebugSurface {
  list(): string[];
  filter(recipeId: string, expr: string): Promise<string[]>;
  filterFirst(expr: string): Promise<string[]>;
  setTiddler(recipeId: string, fields: Record<string, string | string[]>): Promise<void>;
  getVm(recipeId: string): Promise<RecipeVm>;
}
