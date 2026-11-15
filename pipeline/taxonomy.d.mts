export const GROUPS: [string, [string, unknown[], Record<string, string>?][]][];
export interface Placement { group: string; name: string; id: string; tags: Record<string, string> | null; curated: boolean }
export function buildTaxonomy(): {
  resolve(cat: string, sub: string): Placement;
  unused(): string[];
  defaults(id: string): Record<string, string> | null;
  groupOrder: string[];
  catOrder(group: string): string[];
};
