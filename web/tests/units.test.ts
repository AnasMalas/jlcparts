import { describe, expect, it } from 'vitest';
import { formatRange, formatValue, parseValue } from '@shared/units.js';

describe('formatValue', () => {
  it('uses engineering prefixes', () => {
    expect(formatValue(4700, 'resistance')).toBe('4.7 kΩ');
    expect(formatValue(0.005, 'resistance')).toBe('5 mΩ');
    expect(formatValue(1e-7, 'capacitance')).toBe('100 nF');
    expect(formatValue(1.0000000000000001e-7, 'capacitance')).toBe('100 nF');
    expect(formatValue(0, 'voltage')).toBe('0 V');
    expect(formatValue(2.5e6, 'frequency')).toBe('2.5 MHz');
    // values that must not be rounded
    expect(formatValue(32768, 'frequency')).toBe('32.768 kHz');
    expect(formatValue(11059200, 'frequency')).toBe('11.0592 MHz');
    expect(formatValue(0.35000000000000003, 'power')).toBe('350 mW');
    expect(formatValue(4.9999999999999996e-5, 'current')).toBe('50 µA');
  });
  it('handles lengths, time, bytes and plain units', () => {
    expect(formatValue(0.00254, 'length')).toBe('2.54 mm');
    expect(formatValue(7200000, 'time')).toBe('2000 h');
    expect(formatValue(5e-8, 'time')).toBe('50 ns');
    expect(formatValue(8192, 'data_size')).toBe('8 KB');
    expect(formatValue(1, 'percentage')).toBe('1%');
    expect(formatValue(125, 'temperature')).toBe('125 °C');
  });
  it('prints nothing for missing values', () => {
    expect(formatValue(NaN, 'voltage')).toBe('');
    expect(formatValue(null, 'voltage')).toBe('');
  });
  it('formats ranges', () => {
    expect(formatRange(-40, 85, 'temperature')).toBe('-40 °C ~ 85 °C');
    expect(formatRange(-1, 1, 'percentage')).toBe('±1%');
    expect(formatRange(5, 5, 'voltage')).toBe('5 V');
  });
});

describe('parseValue', () => {
  it('reads what engineers type', () => {
    expect(parseValue('4k7', 'resistance')).toBeCloseTo(4700);
    expect(parseValue('4.7k', 'resistance')).toBeCloseTo(4700);
    expect(parseValue('10m', 'resistance')).toBeCloseTo(0.01);
    expect(parseValue('10 mΩ', 'resistance')).toBeCloseTo(0.01);
    expect(parseValue('10mohm', 'resistance')).toBeCloseTo(0.01);
    expect(parseValue('2R2', 'resistance')).toBeCloseTo(2.2);
    expect(parseValue('100n', 'capacitance')).toBeCloseTo(1e-7);
    expect(parseValue('2.2uF', 'capacitance')).toBeCloseTo(2.2e-6);
    expect(parseValue('2,2µF', 'capacitance')).toBeCloseTo(2.2e-6);
    expect(parseValue('30', 'voltage')).toBe(30);
    expect(parseValue('3.3V', 'voltage')).toBe(3.3);
    expect(parseValue('-40', 'temperature')).toBe(-40);
    expect(parseValue('85C', 'temperature')).toBe(85);
    expect(parseValue('1e-6', 'capacitance')).toBe(1e-6);
    expect(parseValue('16M', 'frequency')).toBe(16e6);
  });
  it('reads lengths in mm by default', () => {
    expect(parseValue('2.54', 'length')).toBeCloseTo(0.00254);
    expect(parseValue('100mil', 'length')).toBeCloseTo(0.00254);
  });
  it('reads hours and binary sizes', () => {
    expect(parseValue('2000h', 'time')).toBe(7200000);
    expect(parseValue('64k', 'data_size')).toBe(65536);
  });
  it('rejects text that is not a number', () => {
    expect(parseValue('abc', 'voltage')).toBeNaN();
    expect(parseValue('', 'voltage')).toBeNaN();
    expect(parseValue('10x', 'resistance')).toBeNaN();
  });
  it('round-trips formatted values', () => {
    for (const [v, u] of [[0.0185, 'resistance'], [4.7e-6, 'capacitance'], [32768, 'frequency'], [0.00254, 'length']] as const) {
      expect(parseValue(formatValue(v, u), u)).toBeCloseTo(v, 10);
    }
  });
});
