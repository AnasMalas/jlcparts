// Parameter (attribute) normalisation rules.
//
// Upstream attribute names are mostly consistent, but the same quantity shows
// up under several spellings, and merged categories inherit all of them. This
// file maps the variants onto one canonical name, and holds the per-category
// "enrichers" that derive cleaner parameters (e.g. FET Type for MOSFETs).

// Applied everywhere.
export const GLOBAL_ALIASES = {
  'Quiescent Current': 'Quiescent Current (Iq)',
  'Quiescent Current(Iq)': 'Quiescent Current (Iq)',
  'Quiescent Supply Current': 'Quiescent Current (Iq)',
  'Wire Gauge - Sqmm': 'Wire Gauge (mm²)',
  'Wire Gauge - MM2': 'Wire Gauge (mm²)',
  'Wire Gauge - Awg': 'Wire Gauge (AWG)',
  'Frequency - Switching': 'Switching Frequency',
  'Rated Voltage (Max)': 'Rated Voltage',
  'Noise Density(E N)': 'Input Voltage Noise Density',
  'Current - DC Forward(If)': 'Forward Current (If)',
  'Forward Current(If)': 'Forward Current (If)',
  'Forward Current': 'Forward Current (If)',
  'Forward Voltage (Vf @ If)': 'Forward Voltage (Vf)',
  'Forward Voltage': 'Forward Voltage (Vf)',
  'Reverse Voltage': 'Reverse Voltage (Vr)',
  'Output Current (Max)': 'Output Current',
  'Output Current (Maximum Value)': 'Output Current',
  'Current Output (Maximum Value)': 'Output Current',
  'Interface Type': 'Interface',
  'Conversion Efficiency': 'Efficiency',
  'Energy Efficiency': 'Efficiency',
  'Voltage - Isolation': 'Isolation Voltage (Vrms)',
  'Isolation Voltage': 'Isolation Voltage (Vrms)',
  'Isolation Voltage(VRMS)': 'Isolation Voltage (Vrms)',
  'Output Power (Max)': 'Output Power',
  'Total Power Dissipation(Pd)': 'Power Dissipation (Pd)',
  'Power Dissipation': 'Power Dissipation (Pd)',
  'The Chip Type': 'Chip Type',
  'Operating Junction Temperature Range': 'Operating Temperature',
  'Resolution (Bits)': 'Resolution (bits)',
  'Resolution(Bits)': 'Resolution (bits)',
  'Common Mode Rejection Ratio(CMRR)': 'Common Mode Rejection Ratio (CMRR)',
  'Diameter(Φd)': 'Diameter',
  'Diameter (Φd)': 'Diameter',
  'Write Cycle Time(Tw)': 'Write Cycle Time',
  'Write Cycle Time(T Wc)': 'Write Cycle Time',
  'Write Cycle Time (T Wc)': 'Write Cycle Time',
  'Hold Current(Ih)': 'Hold Current',
  'Insulation Resistance(Ir)': 'Insulation Resistance',
  'Response Time (Tr)': 'Response Time',
  'Rise Time(Tr)': 'Rise Time',
  'Propagation Delay (TPD)': 'Propagation Delay',
  'Standby Current(Isb)': 'Standby Current',
  'Standby Current (Max)': 'Standby Current',
  'Data Rate (Max)': 'Data Rate',
  'Load Current (Max)': 'Load Current',
  'Duty Cycle (Max)': 'Duty Cycle',
  'Switching Current (Max)': 'Switching Current',
  'Switching Voltage (Max)': 'Switching Voltage',
  'Switching Power (Max)': 'Switching Power',
  'Insertion Loss (dB Max)': 'Insertion Loss',
  'Number of Positions or Pins': 'Number of Pins',
  'Gate Threshold Voltage (Vgs(th) @ Id)': 'Gate Threshold Voltage (Vgs(th))',
  'Total Gate Charge (Qg @ Vgs)': 'Total Gate Charge (Qg)',
  'Input Capacitance (Ciss @ Vds)': 'Input Capacitance (Ciss)',
  'CISS-Input Capacitance': 'Input Capacitance (Ciss)',
  'Output Capacitance (Coss @ Vds)': 'Output Capacitance (Coss)',
  'Reverse Transfer Capacitance (Crss @ Vds)': 'Reverse Transfer Capacitance (Crss)',
  'Drain to Source Voltage': 'Drain-Source Voltage (Vdss)',
  'Drain-Source On Resistance (RDS(on))': 'Rds(on)',
  'VGS': 'Gate-Source Voltage (Vgs max)',
  'Basic/Extended': 'Library Class',
};

// Applied only inside one group ("Group") or one category ("Group / Category").
export const SCOPED_ALIASES = {
  'Resistors': {
    'Supply Voltage (Max)': 'Rated Voltage',
  },
  'Transistors & Thyristors / MOSFETs': {
    'Input Capacitance': 'Input Capacitance (Ciss)',
  },
};

// Parameters that should lead the filter panel for a category, in this order.
// Everything else follows by how many parts carry the parameter.
export const KEY_PARAMS = {
  'Transistors & Thyristors / MOSFETs': [
    'FET Type', 'Technology', 'Drain-Source Voltage (Vdss)', 'Continuous Drain Current (Id)', 'Rds(on)',
    'Gate Threshold Voltage (Vgs(th))', 'Gate-Source Voltage (Vgs max)', 'Total Gate Charge (Qg)',
    'Power Dissipation (Pd)', 'Number of FETs',
  ],
  'Resistors / Chip Resistors (SMD)': ['Resistance', 'Tolerance', 'Power', 'Temperature Coefficient', 'Type'],
  'Capacitors / Ceramic Capacitors (MLCC) - SMD': ['Capacitance', 'Rated Voltage', 'Temperature Coefficient', 'Tolerance'],
};

const NULLISH = new Set(['', '-', '--', '/', 'nan', 'n/a', 'na', 'none', 'null', 'unspecified', 'unknown', 'other', 'others']);
export const isNullish = (s) => NULLISH.has(String(s).trim().toLowerCase());

const CN_TOKENS = [
  ['弯插', 'THT Right-Angle'], ['直插', 'THT'], ['插件', 'THT'], ['立贴', 'SMD Vertical'], ['卧贴', 'SMD Right-Angle'],
  ['贴片', 'SMD'], ['交错脚', 'Staggered Pins'], ['螺栓安装', 'Bolt Mount'], ['螺栓', 'Bolt'], ['内置', 'Built-in'],
  ['铜合金', 'Copper Alloy'], ['磷青铜', 'Phosphor Bronze'], ['铍青铜', 'Beryllium Bronze'], ['铍铜', 'Beryllium Copper'],
  ['不锈钢', 'Stainless Steel'], ['铁氧体磁芯', 'Ferrite Core'], ['铁氧体', 'Ferrite'], ['象牙色', 'Ivory'], ['青色', 'Cyan'],
  ['聚丙烯膜', 'Polypropylene Film'], ['模压电感', 'Molded Inductor'], ['金属压粉', 'Metal Powder'], ['封闭式', 'Enclosed'],
  ['玻纤增强', 'Glass-Fibre Reinforced '], ['卡检测功能', 'Card Detect'], ['双指向型', 'Bidirectional'],
  ['槽型对接', 'Slot Mating'], ['针孔对接', 'Pin-Hole Mating'], ['刀片对接', 'Blade Mating'], ['钛铜', 'Titanium Copper'],
  ['板端', 'Board Side'], ['不自复位', 'Non-Resetting'], ['误差校正', 'Error Correction'],
  ['无线', 'Wireless'], ['自动', 'Automatic'], ['保护', 'Protection'], ['接口', 'Interface'], ['兼容', 'Compatible'],
];
/** Replace the handful of Chinese tokens that leak into otherwise-English values. */
export function translate(s) {
  if (!/[一-鿿]/.test(s)) return s;
  for (const [cn, en] of CN_TOKENS) s = s.split(cn).join(en);
  return s;
}

const mk = (name, value, unit = 'identifier') => ({ primary: name, values: { [name]: [value, unit] } });
const numOf = (entry, key) => {
  const v = entry?.values?.[key];
  return v && typeof v[0] === 'number' && !Number.isNaN(v[0]) ? v[0] : null;
};

/**
 * Per-category hooks. `attrs` is a Map(canonicalName -> upstream entry) for one
 * part; the hook may add, replace or delete entries.
 */
export const ENRICHERS = {
  'Transistors & Thyristors / MOSFETs'(attrs) {
    // Upstream splits polarity over "Type" (string) and "Number" (n/p counts).
    const num = attrs.get('Number');
    const type = attrs.get('Type');
    let n = numOf(num, 'n-channel transistors') ?? 0;
    let p = numOf(num, 'p-channel transistors') ?? 0;
    const t = String(type?.values?.['type 1']?.[0] ?? '').toLowerCase();
    const tN = /n-?channel/.test(t), tP = /p-?channel/.test(t);
    if (!n && !p) { if (tN) n = 1; if (tP) p = 1; }
    let fet = null;
    if (n && p) fet = 'N + P Channel';
    else if (n) fet = 'N-Channel';
    else if (p) fet = 'P-Channel';
    else if (tN && tP) fet = 'N + P Channel';
    if (fet) attrs.set('FET Type', mk('FET Type', fet));
    if (n + p > 0) attrs.set('Number of FETs', mk('Number of FETs', n + p, 'count'));
    attrs.delete('Number');
    attrs.delete('Type');
    // Upstream's own "Technology" on FETs means the channel mode, not the material.
    const tech = attrs.get('Technology');
    const tv = String(tech?.values?.[tech.primary]?.[0] ?? Object.values(tech?.values ?? {})[0]?.[0] ?? '');
    if (!['Si', 'SiC', 'GaN'].includes(tv)) {
      if (tv) attrs.set('Channel Mode', mk('Channel Mode', tv));
      attrs.set('Technology', mk('Technology', 'Si'));
    }
  },
};

/** Columns that keep their raw (condition, value) points for the formula engine. */
export const POINT_PARAMS = {
  'Transistors & Thyristors / MOSFETs': { 'Rds(on)': { x: 'Vgs', pick: 'min' } },
};
