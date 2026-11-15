// Unit handling shared by the data pipeline (Node) and the web app (browser).
// All numeric parameters are stored in SI base units; this module knows how to
// print them for humans ("4.7 kΩ") and how to read what humans type ("4k7").

const SI_PREFIXES = [
  [1e-15, 'f'], [1e-12, 'p'], [1e-9, 'n'], [1e-6, 'µ'], [1e-3, 'm'],
  [1, ''], [1e3, 'k'], [1e6, 'M'], [1e9, 'G'], [1e12, 'T'],
];

const PREFIX_VALUE = {
  f: 1e-15, p: 1e-12, n: 1e-9, u: 1e-6, 'µ': 1e-6, 'μ': 1e-6, m: 1e-3,
  k: 1e3, K: 1e3, M: 1e6, G: 1e9, T: 1e12, R: 1, r: 1,
};

// mode: 'si'    -> engineering prefixes (m, µ, k, M ...)
//       'plain' -> number followed by the symbol, optional fixed display scale
//       'time'  -> SI prefixes below 1 s, min/h above
//       'bytes' -> binary multiples
export const UNITS = {
  voltage: { sym: 'V', mode: 'si' },
  current: { sym: 'A', mode: 'si' },
  resistance: { sym: 'Ω', mode: 'si' },
  capacitance: { sym: 'F', mode: 'si' },
  inductance: { sym: 'H', mode: 'si' },
  frequency: { sym: 'Hz', mode: 'si' },
  power: { sym: 'W', mode: 'si' },
  charge: { sym: 'C', mode: 'si' },
  energy: { sym: 'J', mode: 'si' },
  time: { sym: 's', mode: 'time' },
  length: { sym: 'mm', mode: 'plain', scale: 1e3 },
  temperature: { sym: '°C', mode: 'plain' },
  kelvin: { sym: 'K', mode: 'plain' },
  percentage: { sym: '%', mode: 'plain', tight: true },
  ppm: { sym: 'ppm', mode: 'plain' },
  decibel: { sym: 'dB', mode: 'plain' },
  decibel_milliwatt: { sym: 'dBm', mode: 'plain' },
  decibel_milliwatt_per_hertz: { sym: 'dBm/Hz', mode: 'plain' },
  count: { sym: '', mode: 'plain' },
  ratio: { sym: '', mode: 'plain' },
  data_size: { sym: 'B', mode: 'bytes' },
  data_rate: { sym: 'bps', mode: 'si' },
  slew_rate: { sym: 'V/µs', mode: 'plain', scale: 1e-6 },
  luminous_intensity: { sym: 'cd', mode: 'si' },
  luminous_flux: { sym: 'lm', mode: 'plain' },
  radiant_intensity: { sym: 'W/sr', mode: 'si' },
  luminance: { sym: 'cd/m²', mode: 'plain' },
  illuminance: { sym: 'lx', mode: 'plain' },
  temperature_coefficient: { sym: 'ppm/°C', mode: 'plain' },
  lsb: { sym: 'LSB', mode: 'plain' },
  melting_i2t: { sym: 'A²s', mode: 'plain' },
  magnetic_flux_density: { sym: 'T', mode: 'si' },
  area_mm2: { sym: 'mm²', mode: 'plain' },
  awg: { sym: 'AWG', mode: 'plain' },
  angle: { sym: '°', mode: 'plain', tight: true },
  force: { sym: 'N', mode: 'si' },
  pressure: { sym: 'Pa', mode: 'si' },
  voltage_noise_density: { sym: 'V/√Hz', mode: 'si' },
  voltage_temperature_drift: { sym: 'V/°C', mode: 'si' },
  current_temperature_drift: { sym: 'A/°C', mode: 'si' },
  power_temperature_drift: { sym: '', mode: 'plain' },
  pressure_temperature_drift: { sym: '', mode: 'plain' },
  percentage_per_temperature: { sym: '%/°C', mode: 'plain' },
  voltage_per_current: { sym: 'V/A', mode: 'si' },
  voltage_per_magnetic_flux_density: { sym: 'V/T', mode: 'si' },
  voltage_per_g: { sym: 'V/g', mode: 'si' },
  current_per_current: { sym: 'A/A', mode: 'si' },
  acceleration: { sym: 'g', mode: 'plain' },
  angular_velocity: { sym: '°/s', mode: 'plain' },
  rotational_speed: { sym: 'rpm', mode: 'plain' },
  air_flow: { sym: 'm³/s', mode: 'si' },
  // Units used only by derived / formula columns.
  thermal_resistance: { sym: '°C/W', mode: 'plain' },
  currency: { sym: '$', mode: 'money' },
};

/** Compact number: up to `sig` significant digits, no trailing zeros, no exponent for sane magnitudes. */
export function num(x, sig = 4) {
  if (x === 0) return '0';
  if (!Number.isFinite(x)) return String(x);
  const a = Math.abs(x);
  if (a >= 1e15 || a < 1e-9) return x.toExponential(Math.max(0, sig - 1)).replace(/\.?0+e/, 'e');
  let s = Number(x.toPrecision(sig));
  // toPrecision can still yield e-notation for small values; expand it.
  let str = String(s);
  if (str.includes('e')) str = s.toFixed(12).replace(/\.?0+$/, '');
  return str;
}

function siFormat(x, sym, sig) {
  if (x === 0) return `0 ${sym}`.trim();
  const a = Math.abs(x);
  let idx = 0;
  for (let i = 0; i < SI_PREFIXES.length; i++) if (a >= SI_PREFIXES[i][0] * 0.9999995) idx = i;
  const [mag, p] = SI_PREFIXES[idx];
  return `${num(x / mag, sig)} ${p}${sym}`;
}

/** Format a value stored in base units. `unit` is a key of UNITS (or undefined). */
export function formatValue(x, unit, sig = 4) {
  if (x === null || x === undefined || Number.isNaN(x)) return '';
  const u = UNITS[unit];
  if (!u) return num(x, sig);
  switch (u.mode) {
    case 'si':
      return siFormat(x, u.sym, sig);
    case 'time': {
      const a = Math.abs(x);
      if (a >= 3600) return `${num(x / 3600, sig)} h`;
      if (a >= 120) return `${num(x / 60, sig)} min`;
      return siFormat(x, 's', sig);
    }
    case 'bytes': {
      const a = Math.abs(x);
      if (a >= 2 ** 30) return `${num(x / 2 ** 30, sig)} GB`;
      if (a >= 2 ** 20) return `${num(x / 2 ** 20, sig)} MB`;
      if (a >= 2 ** 10) return `${num(x / 2 ** 10, sig)} KB`;
      return `${num(x, sig)} B`;
    }
    case 'money':
      return `$${x < 1 ? num(x, 3) : x.toFixed(2)}`;
    default: {
      const v = num(x * (u.scale ?? 1), sig);
      if (!u.sym) return v;
      return u.tight ? `${v}${u.sym}` : `${v} ${u.sym}`;
    }
  }
}

/** Format a lo..hi range. Symmetric ranges print as ±x. */
export function formatRange(lo, hi, unit) {
  const hasLo = lo !== null && lo !== undefined && !Number.isNaN(lo);
  const hasHi = hi !== null && hi !== undefined && !Number.isNaN(hi);
  if (!hasLo && !hasHi) return '';
  if (hasLo && hasHi) {
    if (lo === hi) return formatValue(lo, unit);
    if (lo === -hi) return `±${formatValue(hi, unit)}`;
    return `${formatValue(lo, unit)} ~ ${formatValue(hi, unit)}`;
  }
  return hasLo ? `≥ ${formatValue(lo, unit)}` : `≤ ${formatValue(hi, unit)}`;
}

/**
 * Parse what a person typed into a min/max box into base units.
 * Accepts: "4700", "4.7k", "4k7", "100n", "10m", "2.2uF", "5 mΩ", "1e-6",
 * "3.3V", "2000h", "25%", "10mil" (length), "0603"-style strings are NOT numbers.
 * Returns NaN when the text is not a number.
 */
export function parseValue(text, unit) {
  if (typeof text !== 'string') return NaN;
  let s = text.trim().replace(/,/g, '.').replace(/\s+/g, '');
  if (!s) return NaN;
  const u = UNITS[unit] ?? { sym: '', mode: 'plain' };

  // Infix notation: 4k7, 2R2, 1u5
  let m = /^([+-]?\d+)([fpnuµμmkKMGTRr])(\d+)$/.exec(s);
  if (m && (u.mode === 'si' || u.mode === 'time')) {
    return parseFloat(`${m[1]}.${m[3]}`) * PREFIX_VALUE[m[2]];
  }

  m = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)(.*)$/.exec(s);
  if (!m) return NaN;
  const value = parseFloat(m[1]);
  let rest = m[2];
  if (Number.isNaN(value)) return NaN;

  if (u.mode === 'time') {
    if (/^(h|hr|hrs|hours?)$/i.test(rest)) return value * 3600;
    if (/^(min|mins|minutes?)$/i.test(rest)) return value * 60;
    rest = rest.replace(/s(ec)?$/i, '');
    if (!rest) return value;
    return rest in PREFIX_VALUE ? value * PREFIX_VALUE[rest] : NaN;
  }
  if (u.mode === 'bytes') {
    const r = rest.replace(/i?b(ytes?)?$/i, '').toLowerCase();
    const mult = { '': 1, k: 2 ** 10, m: 2 ** 20, g: 2 ** 30 }[r];
    return mult === undefined ? NaN : value * mult;
  }
  if (u.mode === 'si') {
    // Strip the unit symbol (and common ASCII stand-ins) if present.
    const sym = u.sym.toLowerCase();
    let r = rest;
    const lower = r.toLowerCase();
    const alts = [sym, sym.replace('ω', 'ohm'), sym.replace('ω', 'r'), sym.replace('ω', 'ohms')];
    for (const a of alts) {
      if (a && lower.endsWith(a) && r.length >= a.length) { r = r.slice(0, r.length - a.length); break; }
    }
    if (!r) return value;
    return r in PREFIX_VALUE ? value * PREFIX_VALUE[r] : NaN;
  }
  // plain / money
  const scale = u.scale ?? 1;
  if (unit === 'length') {
    const r = rest.toLowerCase();
    if (r === '' || r === 'mm') return value / 1e3;
    if (r === 'um' || r === 'µm') return value / 1e6;
    if (r === 'cm') return value / 1e2;
    if (r === 'm') return value;
    if (r === 'mil') return value * 25.4e-6;
    if (r === 'in' || r === '"') return value * 25.4e-3;
    return NaN;
  }
  const bare = rest.toLowerCase().replace(/[°%$]/g, '');
  const symBare = u.sym.toLowerCase().replace(/[°%$]/g, '');
  if (bare === '' || bare === symBare || bare === 'c' || bare === 'x') return value / scale;
  if (bare === 'k') return (value * 1e3) / scale;
  if (bare === 'm' && unit === 'count') return (value * 1e6) / scale;
  return NaN;
}

/** A short hint describing how to type values for this unit. */
export function inputHint(unit) {
  const u = UNITS[unit];
  if (!u) return 'number';
  if (u.mode === 'si') return `e.g. 10m, 4k7, 100n (${u.sym})`;
  if (u.mode === 'time') return 'e.g. 10n, 5m, 2000h';
  if (u.mode === 'bytes') return 'e.g. 64k, 1M';
  return u.sym ? `in ${u.sym}` : 'number';
}
