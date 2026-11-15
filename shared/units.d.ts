export interface UnitDef { sym: string; mode: 'si' | 'plain' | 'time' | 'bytes' | 'money'; scale?: number; tight?: boolean }
export const UNITS: Record<string, UnitDef>;
export function num(x: number, sig?: number): string;
export function formatValue(x: number | null | undefined, unit?: string, sig?: number): string;
export function formatRange(lo: number | null | undefined, hi: number | null | undefined, unit?: string): string;
export function parseValue(text: string, unit?: string): number;
export function inputHint(unit?: string): string;
