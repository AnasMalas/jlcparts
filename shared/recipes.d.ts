export interface RecipeAxis { name: string; unit: string }
export interface RecipeScalar { label: string; unit: string }
export interface RecipeCurve { label: string; x: RecipeAxis; y: RecipeAxis; hint: string }
export interface Recipe { title: string; categories: string[]; scalars: Record<string, RecipeScalar>; curves: Record<string, RecipeCurve> }
export const RECIPES: Record<string, Recipe>;
export function recipeFor(categoryId: string): (Recipe & { key: string }) | null;
export function interp(points: [number, number][], x: number, opts?: { extrapolate?: 'hold' | 'linear' | 'nan' }): number;
export function validateRecord(rec: unknown): string[];
