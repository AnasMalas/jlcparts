// Curated category taxonomy.
//
// The upstream catalogue has ~690 (category, subcategory) pairs, many of which
// are duplicates of each other under slightly different names ("MOSFET" vs
// "MOSFETs", "Fuseholders" vs "Fuse Holders", "Logic" vs "Logic ICs", ...).
// This file folds them into a smaller, Digi-Key-like tree.
//
// Format:  GROUPS = [ [groupName, [ [categoryName, [source, source, ...], defaults?], ... ]], ... ]
// where a source is either the string "Upstream Category/Upstream Subcategory"
// or [thatString, { Attribute: 'Value', ... }] to tag every part coming from
// that source with extra attributes (e.g. Technology: 'SiC'). `defaults` gives
// the value of those attributes for parts from the untagged sources.
//
// Anything upstream adds later that is not listed here is NOT dropped: it is
// placed automatically (see placeUnmapped below) and reported by the build so
// it can be curated.

const G = [];
const group = (name, cats) => G.push([name, cats]);

group('Resistors', [
  ['Chip Resistors (SMD)', ['Resistors/Chip Resistor - Surface Mount']],
  ['Through-Hole Resistors', ['Resistors/Through Hole Resistors']],
  ['Current Sense / Shunt Resistors', [
    'Resistors/Current Sense / Shunt Resistors',
    'Resistors/Low Resistors and Current Sense Resistors - Surface Mount',
  ]],
  ['Resistor Networks & Arrays', ['Resistors/Resistor Networks and Arrays', 'Resistors/Resistor Networks, Arrays']],
  ['Potentiometers & Variable Resistors', [
    'Resistors/Potentiometers, Variable Resistors',
    'Resistors/Variable Resistors / Potentiometers',
  ]],
  ['Power Resistors (Aluminium Case / Ceramic Tube)', ['Resistors/Aluminum Case / Porcelain Tube Resistance']],
  ['NTC Thermistors', ['Resistors/NTC Thermistors', 'Sensors/NTC Thermistors']],
  ['PTC Thermistors', ['Sensors/PTC Thermistors']],
  ['Photoresistors (LDR)', ['Sensors/Photoresistors']],
]);

group('Capacitors', [
  ['Ceramic Capacitors (MLCC) - SMD', ['Capacitors/Multilayer Ceramic Capacitors MLCC - SMD/SMT']],
  ['Ceramic Capacitors - Through Hole', [
    'Capacitors/Multilayer Ceramic Capacitors MLCC - Leaded',
    'Capacitors/Through Hole Ceramic Capacitors',
    'Capacitors/Ceramic Disc Capacitors',
  ]],
  ['Aluminum Electrolytic - SMD', ['Capacitors/Aluminum Electrolytic Capacitors - SMD']],
  ['Aluminum Electrolytic - Through Hole', [
    'Capacitors/Aluminum Electrolytic Capacitors - Leaded',
    'Capacitors/Aluminum Electrolytic Capacitors (Can - Screw Terminals)',
    'Capacitors/Horn-Type Electrolytic Capacitor',
    'Capacitors/Horn-Type Electrolytic Capacitors',
  ]],
  ['Polymer / Hybrid / Solid Aluminum', [
    'Capacitors/Polymer Aluminum Capacitors',
    'Capacitors/Hybrid Aluminum Electrolytic Capacitors',
    'Capacitors/Solid Capacitors',
  ]],
  ['Tantalum & Niobium Capacitors', ['Capacitors/Tantalum Capacitors', 'Capacitors/Niobium Oxide Capacitors']],
  ['Film Capacitors', [
    'Capacitors/Film Capacitors',
    'Capacitors/Polypropylene Film Capacitors (CBB)',
    'Capacitors/Paper Dielectric Capacitors',
  ]],
  ['Safety & Suppression Capacitors (X/Y)', ['Capacitors/Safety Capacitors', 'Capacitors/Suppression Capacitors']],
  ['Capacitor Networks & Arrays', ['Capacitors/Capacitor Networks, Arrays']],
  ['Trimmer & Variable Capacitors', ['Capacitors/Trimmers, Variable Capacitors']],
  ['Feed-Through Capacitors', ['Filters and EMI Optimization/Feed Through Capacitors']],
  ['High Voltage Capacitors', ['Industrial Control Electrical/Ultra-High Voltage Capacitors']],
]);

group('Inductors, Coils & Transformers', [
  ['Power Inductors', ['Inductors, Coils and Transformers/Power Inductors']],
  ['Inductors (SMD)', ['Inductors, Coils and Transformers/Inductors (SMD)']],
  ['Through-Hole Inductors', [
    'Inductors, Coils and Transformers/Color Ring Inductors / Through Hole Inductors',
    'Inductors, Coils and Transformers/Adjustable Inductors',
  ]],
  ['Power Transformers', [
    'Inductors, Coils and Transformers/Power Transformer',
    'Inductors, Coils and Transformers/Power Transformers',
  ]],
  ['Pulse & LAN Transformers', [
    'Inductors, Coils and Transformers/Pulse Transformers',
    'Inductors, Coils and Transformers/Pulse Transformers (LAN)',
    'Inductors, Coils and Transformers/RJ45 Transformer',
  ]],
  ['Current Sense Transformers', ['Inductors, Coils and Transformers/Current Sense Transformers']],
  ['Audio Transformers', ['Inductors, Coils and Transformers/Audio Transformers']],
  ['Wireless Charging Coils', ['Inductors, Coils and Transformers/Wireless Charging Coils']],
  ['Inductor / Transformer Accessories & Cores', [
    'Inductors, Coils and Transformers/Accessories - Inductors / Transformers',
    'Hardware Fasteners/Inductor Core',
    'Inductors, Coils and Transformers/Pre-ordered RLCs',
  ]],
]);

group('Filters & EMI', [
  ['Ferrite Beads', ['Filters and EMI Optimization/Ferrite Beads', 'Hardware Fasteners/Tape Magnetic Beads']],
  ['Common Mode Chokes / Filters', ['Filters and EMI Optimization/Common Mode Filters']],
  ['EMI / RFI Filters (LC, RC Networks)', [
    'Filters and EMI Optimization/EMI / RFI Filters (LC, RC Networks)',
    'Filters and EMI Optimization/EMI Filters (LC, RC Networks)',
    'Filters and EMI Optimization/EMC Filters',
    'Filters and EMI Optimization/Noise Suppressors',
  ]],
  ['Clamp-On Ferrite Cores', ['Filters and EMI Optimization/Clamp Filters (Ferrite Core with Case)']],
  ['Ceramic & Crystal Filters', ['Filters and EMI Optimization/Ceramic Filters', 'Filters and EMI Optimization/Crystal Filters']],
  ['Active & Switched-Capacitor Filters', [
    'Filters and EMI Optimization/Active Filters',
    'Filters and EMI Optimization/Switched Capacitor Filters',
  ]],
]);

group('Diodes', [
  ['Schottky Diodes', [
    'Diodes/Schottky Diodes',
    'Diodes/Schottky Barrier Diodes (Sbd)',
    ['Silicon Carbide (Si C) Devices/Si C Diodes', { Technology: 'SiC' }],
  ], { Technology: 'Si' }],
  ['Zener Diodes', ['Diodes/Zener Diodes']],
  ['Switching Diodes', ['Diodes/Switching Diode', 'Diodes/Switching Diodes']],
  ['Rectifier Diodes (General Purpose)', ['Diodes/Diodes - General Purpose', 'Diodes/Avalanche Diodes']],
  ['Fast Recovery / High Efficiency Diodes', [
    'Diodes/Fast Recovery / High Efficiency Diode',
    'Diodes/Fast Recovery / High Efficiency Diodes',
    'Diodes/Diodes - Fast Recovery Rectifiers',
    'Diodes/Diodes Rectifiers Fast Recovery',
    'Diodes/Diodes - Rectifiers - Hyperfast',
  ]],
  ['Super Barrier Rectifiers (SBR)', ['Diodes/Super Barrier Rectifier(SBR)', 'Diodes/Super Barrier Rectifiers (SBR)']],
  ['Bridge Rectifiers', ['Diodes/Bridge Rectifiers']],
  ['Varactor (Variable Capacitance) Diodes', ['Diodes/Diodes - Variable Capacitance']],
  ['Trigger Diodes (DIAC)', ['Diodes/Trigger Diodes']],
]);

group('Transistors & Thyristors', [
  ['MOSFETs', [
    'Transistors and Thyristors/MOSFETs',
    ['Silicon Carbide (Si C) Devices/Silicon Carbide Field Effect Transistor (MOSFET)', { Technology: 'SiC' }],
    ['Gallium Nitride (GaN) Devices/GaN Transistors (GaN HEMT)', { Technology: 'GaN' }],
  ], { Technology: 'Si' }],
  ['Bipolar Transistors (BJT)', [
    'Transistors and Thyristors/Bipolar Transistors - BJT',
    'Transistors and Thyristors/Transistors (Npn / Pnp)',
  ]],
  ['Digital (Pre-Biased) Transistors', ['Transistors and Thyristors/Digital Transistors']],
  ['Darlington Transistors & Arrays', [
    'Transistors and Thyristors/Darlington Transistors',
    'Transistors and Thyristors/Darlington Transistor Arrays',
    'Driver ICs/Darlington Transistor Array Driver',
  ]],
  ['IGBTs & IGBT Modules', ['Transistors and Thyristors/IGBT Transistors / Modules', 'Driver ICs/IGBT']],
  ['Intelligent Power Modules (IPM)', ['Transistors and Thyristors/Intelligent Power Modules (Ipm)']],
  ['JFETs', ['Transistors and Thyristors/Jfets', 'Transistors and Thyristors/Junction Field-Effect Transistor,JFET']],
  ['Thyristors (SCR) & Triacs', [
    'Transistors and Thyristors/Thyristors (SCR) / Modules',
    'Transistors and Thyristors/Triacs',
  ]],
  ['Pre-ordered Transistors', ['Transistors and Thyristors/Pre-ordered Transistors']],
]);

group('Circuit Protection', [
  ['TVS / ESD Protection', [
    'Circuit Protection/Electrostatic and Surge Protection (TVS/ESD)',
    'Circuit Protection/ESD Protection Devices',
    'Circuit Protection/TVS',
    'Circuit Protection/LED Protection',
    'Diodes/Diodes - ESD',
    'Diodes/ESD Protection Devices',
    'Diodes/TVS',
  ]],
  ['Fuses', [
    'Circuit Protection/Disposable Fuses',
    'Circuit Protection/Fuses',
    'Circuit Protection/Automotive Fuses',
    'Fuses/Cartridge Fuses',
    'Fuses/Fuses with Leads (Through Hole)',
    'Fuses/Surface Mount Fuses',
    'Industrial Control Electrical/Fuse',
  ]],
  ['Resettable Fuses (PTC)', ['Circuit Protection/Resettable Fuses', 'Fuses/PTC Resettable Fuses']],
  ['Fuse Holders', ['Circuit Protection/Fuse Holders', 'Circuit Protection/Fuseholders']],
  ['Thermal Fuses / Cutoffs (TCO)', ['Circuit Protection/Thermal Cutoffs (TCO)', 'Circuit Protection/Thermal Fuses (TCO)']],
  ['Varistors (MOV)', ['Circuit Protection/Varistors', 'Resistors/Varistors']],
  ['Gas Discharge Tubes (GDT)', [
    'Circuit Protection/Gas Discharge Tubes (GDT)',
    'Circuit Protection/Glass Discharge Tubes',
    'Diodes/Discharge Tubes (GDT / TSS)',
  ]],
  ['Thyristor Surge Suppressors (TSS)', [
    'Circuit Protection/Semiconductor Discharge Tubes (TSS)',
    'Circuit Protection/Thyristor Surge Suppressors (TSS)',
  ]],
  ['Surge Protection Devices', [
    'Circuit Protection/Surge Protection Devices (SPDs)',
    'Circuit Protection/Surge Suppressors',
    'Industrial Control Electrical/Surge Protectors,Lightning Arrester',
  ]],
]);

group('Power Management', [
  ['Linear Regulators (LDO)', [
    'Power Management/Voltage Regulators - Linear, Low Drop Out (LDO) Regulators',
    'Power Management/Linear Voltage Regulators (LDO)',
    'Power Management/Linear Voltage Regulators',
  ]],
  ['DC-DC Converters & Controllers', [
    'Power Management/DC-DC Converters',
    'Power Management/DC-DC Controllers',
    'Power Management/Switching Controllers',
  ]],
  ['Charge Pumps', ['Power Management/Charge Pumps']],
  ['AC-DC Controllers & Regulators', ['Power Management/AC-DC Controllers and Regulators', 'Power Management/Pfc Controllers']],
  ['Synchronous Rectifier Controllers', ['Power Management/Synchronous Rectifier Controllers']],
  ['Voltage References', ['Power Management/Voltage References']],
  ['Supervisors & Reset ICs', [
    'Power Management/Supervisor and Reset ICs',
    'Power Management/Monitors and Reset Circuits',
    'Embedded Peripheral ICs/Microprocessor and Microcontroller Supervisors',
  ]],
  ['Battery Management ICs', ['Power Management/Battery Management ICs', 'Power Management/PMIC - Battery Management']],
  ['Power Distribution / Load Switches', [
    'Power Management/Power Distribution Switches',
    'Power Management/PMIC - Power Distribution Switches',
    'Power Management/Oring Controllers',
  ]],
  ['Specialized PMICs', ['Power Management/Power Management - Specialized PMIC', 'Power Management/Leakage Protection ICs']],
  ['Current Sources', ['Power Management/Current Source / Constant Current Source']],
  ['Power over Ethernet (PoE) Controllers', [
    'Power Management/Power Over Ethernet (Po E) Controllers',
    'Power Management/Power Over Ethernet Controllers',
  ]],
  ['USB Power Delivery ICs', ['Power Management/USB Pd']],
  ['Wireless Charging ICs', ['Power Management/Wireless Charge-Discharge ICs']],
  ['Transformer Drivers', ['Power Management/Transformer Drivers']],
]);

group('Power Modules & Supplies', [
  ['Isolated Power Modules', ['Power Modules/Isolated Power Modules', 'Power Management/Isolated DC / DC Converters']],
  ['DC-DC Power Modules', ['Power Modules/DC-DC Power Modules', 'Power Management/Power Modules']],
  ['AC-DC Power Modules', ['Power Modules/AC-DC Power Modules']],
  ['Power Supplies', [
    'Industrial Control Electrical/Power Module / Power Supply',
    'Industrial Control Electrical/Power Supply Module',
    'Industrial Control Electrical/Power Supply Module,Power Supplies',
    'Industrial Control Electrical/Switching Power Supply',
  ]],
]);

group('Motor & Gate Drivers', [
  ['Gate Drivers', [
    'Motor Driver ICs/Gate Drivers',
    'Power Management/Gate Drive ICs',
  ]],
  ['Isolated Gate Drivers', ['Power Management/Isolators - Gate Drivers']],
  ['Brushed DC Motor Drivers', ['Motor Driver ICs/Brushed DC Motor Drivers']],
  ['Brushless DC (BLDC) Motor Drivers', ['Motor Driver ICs/Brushless DC (Bldc) Motor Driver']],
  ['Stepper Motor Drivers', ['Motor Driver ICs/Stepper Motor Driver']],
  ['Motor Drivers (Other)', ['Power Management/Motor Driver ICs', 'Driver ICs/Motor Drivers']],
  ['Relay / Solenoid / Coil Drivers', ['Motor Driver ICs/Relay / Coil Drivers']],
]);

group('Amplifiers & Comparators', [
  ['Operational Amplifiers', [
    'Amplifiers and Comparators/Operational Amplifiers',
    ['Amplifiers and Comparators/General Purpose Amplifiers', { 'Amplifier Class': 'General Purpose' }],
    ['Amplifiers and Comparators/FET Input Amplifiers', { 'Amplifier Class': 'FET Input' }],
    ['Amplifiers and Comparators/Low Noise Op Amps', { 'Amplifier Class': 'Low Noise' }],
    ['Amplifiers and Comparators/Precision Op Amps', { 'Amplifier Class': 'Precision' }],
  ], { 'Amplifier Class': 'Standard' }],
  ['Comparators', ['Amplifiers and Comparators/Analog Comparators', 'Amplifiers and Comparators/Comparators']],
  ['Audio Amplifiers', ['Amplifiers and Comparators/Audio Amplifiers', 'Amplifiers and Comparators/Audio Power Op Amps']],
  ['Current Sense Amplifiers', ['Amplifiers and Comparators/Current Sense Amplifiers']],
  ['Differential Amplifiers', ['Amplifiers and Comparators/Differential Amplifiers', 'Amplifiers and Comparators/Differential Op Amps']],
  ['Instrumentation Amplifiers', [
    'Amplifiers and Comparators/Instrumentation Amplifiers',
    'Amplifiers and Comparators/Instrumentation Op Amps',
  ]],
  ['Programmable / Variable Gain Amplifiers', ['Amplifiers and Comparators/Programmable / Variable Gain Amplifiers (PGA/VGA)']],
  ['Video Amplifiers', ['Amplifiers and Comparators/Video Amplifiers']],
  ['Sample-and-Hold Amplifiers', ['Amplifiers and Comparators/Sample-and-Hold Amplifiers']],
  ['Analog Multipliers / Dividers', ['Amplifiers and Comparators/Linear - Analog Multipliers, Dividers']],
  ['Special Purpose Amplifiers', ['Amplifiers and Comparators/Special Purpose Amplifiers']],
]);

group('Data Converters', [
  ['Analog to Digital Converters (ADC)', ['Data Converters/Analog to Digital Converters (ADCs)']],
  ['Digital to Analog Converters (DAC)', ['Data Converters/Digital to Analog Converters (DACs)']],
  ['ADC / DAC - Special Purpose', ['Data Converters/ADC / DAC - Specialized', 'Data Converters/Adcs / Dacs - Special Purpose']],
  ['Analog Front Ends (AFE)', ['Data Converters/Analog Front End (AFEs)']],
  ['Digital Potentiometers', ['Data Converters/Digital Potentiometers']],
  ['Direct Digital Synthesis (DDS)', [
    'Data Converters/Direct Digital Synthesis (DDS)',
    'Interface ICs/Interface - Direct Digital Synthesis (DDS)',
  ]],
  ['Energy Metering ICs', ['Data Converters/Energy Metering', 'Data Converters/Energy Metering ICs']],
  ['RMS-to-DC Converters', ['Data Converters/RMS-to-DC Converters']],
  ['Voltage / Frequency Converters', [
    'Data Converters/V / F and F / V Converters',
    'Data Converters/Voltage-to-Frequency / Frequency-to-Voltage Converters',
  ]],
  ['Touch Screen Controllers', ['Data Converters/Touch Screen Controllers']],
]);

group('Interface ICs', [
  ['Analog Switches & Multiplexers', [
    'Interface ICs/Analog Switches / Multiplexers',
    'Interface ICs/Analog Switches, Multiplexers',
    'Interface ICs/Analog Switches - Special Purpose',
  ]],
  ['CAN Transceivers & Controllers', [
    'Interface ICs/CAN Transceivers',
    'Interface ICs/CAN Controllers',
    'Interface ICs/CAN ICs',
  ]],
  ['LIN Transceivers', ['Interface ICs/LIN Transceivers']],
  ['RS-485 / RS-422 ICs', ['Interface ICs/RS-485 / RS-422 ICs', 'Interface ICs/RS-485 and RS-422']],
  ['RS-232 ICs', ['Interface ICs/RS232 ICs']],
  ['UART ICs', ['Interface ICs/UART']],
  ['USB ICs', ['Interface ICs/USB ICs', 'Interface ICs/USB Converters', 'Interface ICs/USB Hub Controllers']],
  ['Ethernet ICs', [
    'Interface ICs/Ethernet ICs',
    'Interface ICs/Ethernet Controllers',
    'Interface ICs/Ethernet Switches',
    'Interface ICs/Ethernet Transceivers',
  ]],
  ['LVDS ICs', ['Interface ICs/LVDS ICs']],
  ['Serializers / Deserializers', ['Interface ICs/Serializers / Deserializers', 'Interface ICs/Serializers, Deserializers']],
  ['I/O Expanders', ['Interface ICs/I/O Expanders', 'Embedded Peripheral ICs/I / O Expansion']],
  ['Signal Buffers, Repeaters, Splitters', ['Interface ICs/Signal Buffers, Repeaters, Splitters']],
  ['Audio Interface ICs (Codecs)', ['Interface ICs/Audio Interface ICs']],
  ['Video Interface ICs', ['Interface ICs/Video Interface ICs']],
  ['Telecom Interface ICs', ['Interface ICs/Telecom Interface ICs', 'Interface ICs/Telecommunication Interface ICs']],
  ['PCI / PCIe Interface ICs', ['Interface ICs/Interface - PCIs / PCIes']],
  ['Security / Authentication ICs', ['Interface ICs/Security Verification / Encryption ICs']],
  ['Specialized Interface ICs', ['Interface ICs/Interface - Specialized', 'Interface ICs/Pre-ordered Chips']],
]);

group('Isolators & Optocouplers', [
  ['Digital Isolators', [
    'Signal Isolation Devices/Digital Isolators',
    ['Signal Isolation Devices/Digital Isolators (with Power)', { 'Integrated Isolated Power': 'Yes' }],
    'Interface ICs/Digital Isolators',
    'Signal Isolation Devices/Di / Do Isolators',
    'Signal Isolation Devices/SPI Isolators',
    'Signal Isolation Devices/Optocoupler Emulator (Optocoupler Replacement)',
  ], { 'Integrated Isolated Power': 'No' }],
  ['I2C Isolators', [
    'Signal Isolation Devices/I2c Isolators',
    ['Signal Isolation Devices/Isolated I2c (with Power)', { 'Integrated Isolated Power': 'Yes' }],
  ], { 'Integrated Isolated Power': 'No' }],
  ['Isolated CAN Transceivers', [
    'Signal Isolation Devices/Isolated CAN Transceivers',
    ['Signal Isolation Devices/Isolated CAN Transceivers (with Power)', { 'Integrated Isolated Power': 'Yes' }],
  ], { 'Integrated Isolated Power': 'No' }],
  ['Isolated RS-485 / RS-422 Transceivers', [
    'Signal Isolation Devices/Isolated RS-485 / 422 Transceivers',
    ['Signal Isolation Devices/Isolated RS-485 / 422 Transceivers with Power', { 'Integrated Isolated Power': 'Yes' }],
  ], { 'Integrated Isolated Power': 'No' }],
  ['Isolated RS-232 Transceivers', [
    'Signal Isolation Devices/Isolated RS-232 Transceivers',
    ['Signal Isolation Devices/Isolated RS-232 Transceivers (with Power)', { 'Integrated Isolated Power': 'Yes' }],
  ], { 'Integrated Isolated Power': 'No' }],
  ['Isolated USB ICs', [
    'Signal Isolation Devices/Isolated USB ICs',
    ['Signal Isolation Devices/Isolated USB ICs with Power', { 'Integrated Isolated Power': 'Yes' }],
  ], { 'Integrated Isolated Power': 'No' }],
  ['Isolated ADCs', [
    'Signal Isolation Devices/Isolated Adcs',
    ['Signal Isolation Devices/Isolated Adcs with Power', { 'Integrated Isolated Power': 'Yes' }],
  ], { 'Integrated Isolated Power': 'No' }],
  ['Isolation Amplifiers & Comparators', [
    'Signal Isolation Devices/Isolation Amplifiers',
    ['Signal Isolation Devices/Isolation Amplifiers with Power', { 'Integrated Isolated Power': 'Yes' }],
    'Amplifiers and Comparators/Isolation Amplifiers',
    'Signal Isolation Devices/Isolated Comparators',
    'Signal Isolation Devices/Isolated LVDS Buffers',
  ], { 'Integrated Isolated Power': 'No' }],
  ['Optocouplers - Transistor / Photovoltaic Output', [
    'Optoelectronics/Transistor, Photovoltaic Output Optoisolators',
    'Optoelectronics/Optocouplers - Phototransistor Output',
    'Optoelectronics/Transistor Output Optocoupler',
    'Optocouplers / Photocouplers/Transistor Output Optocoupler',
    'Optoelectronics/Optocouplers',
  ]],
  ['Optocouplers - Logic Output', [
    'Optoelectronics/Logic Output Optoisolators',
    'Optoelectronics/Optocouplers - Logic Output',
    'Optocouplers / Photocouplers/Logic Output Optocoupler',
  ]],
  ['Optocouplers - Triac / SCR Output', [
    'Optoelectronics/Triac, SCR Output Optoisolators',
    'Optoelectronics/Optocouplers - Thyristor Signal Output',
  ]],
  ['Optocouplers - Gate Drive', ['Optoelectronics/Gate Drive Optocoupler']],
  ['Solid State Relays', [
    'Optoelectronics/Solid State Relays (MOS Output)',
    'Optoelectronics/Solid State Relays - MOS Output (Photo MOS)',
    ['Optoelectronics/Solid State Relays (Triac Output)', { 'Output Type': 'Triac' }],
    ['Optoelectronics/Photoelectric Thyristor (Solid State Relays)', { 'Output Type': 'Triac' }],
    'Signal Isolation Devices/Isolation-Solid State Relays',
  ]],
]);

group('Logic', [
  ['Logic Gates & Inverters', [
    'Logic/Logic Gates',
    'Logic/Inverters',
    'Logic ICs/Gates',
    'Logic ICs/Gates and Inverters',
    'Logic ICs/Inverters',
  ]],
  ['Buffers, Drivers, Receivers, Transceivers', [
    'Logic/Buffers, Drivers, Receivers, Transceivers',
    'Logic ICs/Buffer / Driver / Transceiver',
    'Logic ICs/Logic-Buffers, Drivers, Receivers, Transceivers',
  ]],
  ['Flip-Flops', ['Logic/Flip Flops', 'Logic ICs/Flip Flops']],
  ['Latches', ['Logic/Latches', 'Logic ICs/Latches']],
  ['Shift Registers', ['Logic/Shift Registers', 'Logic ICs/Shifting Register']],
  ['Counters & Dividers', ['Logic/Counters, Dividers', 'Logic ICs/Counters / Dividers']],
  ['Multiplexers, Decoders, Signal Switches', [
    'Logic/Signal Switches, Multiplexers, Decoders',
    'Logic/Signal Switches / Encoders and Decoders / Multiplexers',
    'Logic ICs/Signal Switches / Encoders and Decoders / Multiplexers',
  ]],
  ['Level Shifters / Translators', [
    'Logic/Translators, Level Shifters',
    'Logic ICs/Level Translators, Shifters',
    'Logic ICs/Translators / Level Shifters',
  ]],
  ['Monostable Multivibrators', ['Logic/Monostable Multivibrators', 'Logic ICs/Monostable Multivibrators']],
  ['Digital Comparators', ['Logic/Digital Comparators']],
  ['Parity Generators & Checkers', ['Logic/Parity Generators and Checkers']],
  ['FIFO Memory', ['Logic/Fifos Memory']],
  ['Specialty Logic', ['Logic/Specialty Logic', 'Logic ICs/Special Logic ICs', 'Logic ICs/74 Series']],
]);

group('Clock & Timing', [
  ['Real-Time Clocks (RTC)', ['Clock and Timing/Real-Time Clocks (RTC)', 'Clock and Timing/Real-Time Clocks(RTC)']],
  ['Clock Generators / PLL / Synthesizers', [
    'Clock and Timing/Clock Generators / Frequency Synthesizers / PLL',
    'Embedded Peripheral ICs/Clock Generators / Frequency Synthesizers / PLL',
  ]],
  ['Clock Buffers, Drivers, Distribution', [
    'Clock and Timing/Clock Buffers, Drivers',
    'Clock and Timing/Clock Buffers / Drivers / Distributions',
    'Clock and Timing/Clock Buffers, Drivers, Distributors',
  ]],
  ['Timers & Counters (incl. 555)', [
    'Clock and Timing/Timers / Counters',
    'Clock and Timing/555 Timers / Counters',
    'Clock and Timing/Timers',
    'Clock and Timing/Timers / Clock Oscillators',
    'Logic ICs/Timer',
  ]],
  ['Jitter Attenuators / Cleaners', [
    'Clock and Timing/Jitter Attenuators',
    'Clock and Timing/Clock Jitter Cleaners and Synchronizers',
    'Clock and Timing/Clock and Data Recovery / Retiming',
  ]],
  ['Delay Lines / Time Delays', ['Clock and Timing/Delay Lines', 'Clock and Timing/Time Delays']],
  ['Application Specific Clock / Timing', [
    'Clock and Timing/Application Specific Clock / Timing',
    'Clock and Timing/Clock / Timing - Application Specific',
  ]],
]);

group('Crystals, Oscillators & Resonators', [
  ['Crystals', [
    'Crystals, Oscillators and Resonators/Crystals',
    'Crystals, Oscillators and Resonators/SMD Crystal Resonators',
    'Crystals, Oscillators and Resonators/Temperature Sensing Resonators',
  ]],
  ['Oscillators (XO)', [
    'Crystals, Oscillators and Resonators/Crystal Oscillators',
    'Crystals, Oscillators and Resonators/Oscillators',
    'Crystals, Oscillators and Resonators/SMD Oscillators(Xo)',
    'Crystals, Oscillators and Resonators/SAW Oscillators',
    ['Crystals, Oscillators and Resonators/Spread Spectrum Oscillators (SSOs)', { 'Oscillator Type': 'Spread Spectrum' }],
  ]],
  ['Programmable Oscillators', [
    'Crystals, Oscillators and Resonators/Programmable Oscillators',
    'Crystals, Oscillators and Resonators/Pre-programmed Oscillators',
    'Crystals, Oscillators and Resonators/Digitally Controlled Oscillators(Dcos)',
  ]],
  ['TCXO / OCXO', [
    'Crystals, Oscillators and Resonators/Temperature Compensated Crystal Oscillators (TCXO)',
    'Crystals, Oscillators and Resonators/Temperature Compensated Crystal Oscillators (TCXOs)',
    ['Crystals, Oscillators and Resonators/Oven Controlled Crystal Oscillators (OCXOs)', { 'Oscillator Type': 'OCXO' }],
  ]],
  ['Voltage Controlled Oscillators (VCO / VCXO)', [
    'Crystals, Oscillators and Resonators/Voltage-Controlled Crystal Oscillators (VCXOs)',
    'Crystals, Oscillators and Resonators/Voltage Controlled Oscillators (VCOs)',
    'RF and Wireless/Voltage Controlled Oscillators (VCO)',
  ]],
  ['Ceramic & SAW Resonators', [
    'Crystals, Oscillators and Resonators/Ceramic Resonators',
    'Crystals, Oscillators and Resonators/SAW Resonators',
  ]],
]);

group('Memory', [
  ['EEPROM', ['Memory/Eeprom']],
  ['NOR Flash', ['Memory/Nor Flash', 'Memory/Flash']],
  ['NAND Flash & eMMC', ['Memory/Nand Flash', 'Memory/Emmc']],
  ['SRAM', ['Memory/Sram', 'Memory/Random Access Memory (Ram)']],
  ['DRAM / SDRAM / DDR', ['Memory/Sdram', 'Memory/DDR Sdram', 'Memory/Dram']],
  ['FRAM', ['Memory/Fram']],
  ['ROM / Font Chips / Configuration PROMs', [
    'Memory/Non-Volatile Memory (Rom)',
    'Memory/Font Chips',
    'Memory/Memory - Configuration Proms for FPGAs',
    'Memory/Ibutton Memory',
  ]],
  ['Multi-Chip Packages & Memory Controllers', [
    'Memory/Memory - Serial Mcp (Multi Chip Package)',
    'Memory/Memory Controllers',
  ]],
]);

group('Microcontrollers & Processors', [
  ['Microcontrollers (MCU / MPU / SoC)', [
    'Embedded Processors and Controllers/Microcontroller Units (MCUs/MPUs/SOCs)',
    'Embedded Processors and Controllers/Nuvoton',
    'Embedded Processors and Controllers/St Microelectronics',
    'Embedded Processors and Controllers/Ti MCU',
    'Embedded Processors and Controllers/Pre-ordered MCUs',
  ]],
  ['FPGA / CPLD', [
    'Embedded Processors and Controllers/Programmable Logic Devices (CPLDs/FPGAs)',
    'Embedded Processors and Controllers/CPLD / FPGA',
    'Logic ICs/CPLD and FPGA',
  ]],
  ['Digital Signal Processors (DSP / DSC)', [
    'Embedded Processors and Controllers/Digital Signal Processors (DSP/DSC)',
    'Embedded Processors and Controllers/Digital Signal Processors / Controllers (DSPs/DSCs)',
  ]],
]);

group('LED & Display Drivers', [
  ['LED Drivers', [
    'Displays and LED Drivers/LED Drivers',
    'Displays and LED Drivers/LED Drivers(Automotive)',
    'Displays and LED Drivers/LED Drivers(RGB)',
    'Driver ICs/LED Drivers',
    'Displays and LED Drivers/Lighting Drivers and Controllers',
    'Displays and LED Drivers/Other Lighting Drivers',
  ]],
  ['LED Display / Digit Drivers', ['Displays and LED Drivers/Digital Tube Drivers', 'Displays and LED Drivers/LED Display Drivers']],
  ['LCD & OLED Drivers', ['Displays and LED Drivers/LCD Drivers', 'Displays and LED Drivers/OLED Drivers']],
  ['Laser Drivers', ['Displays and LED Drivers/Laser Drivers']],
]);

group('Optoelectronics', [
  ['LEDs - Indication', ['Optoelectronics/LED Indication - Discrete', 'Optoelectronics/Light Emitting Diodes (LED)']],
  ['RGB LEDs', [
    'Optoelectronics/RGB LEDs',
    ['Optoelectronics/RGB LEDs(Built-in IC)', { 'Built-in Driver IC': 'Yes' }],
  ], { 'Built-in Driver IC': 'No' }],
  ['Infrared LEDs', ['Optoelectronics/Infrared (IR) LEDs', 'Optoelectronics/Infrared LED Emitters']],
  ['Ultraviolet LEDs', ['Optoelectronics/Ultraviolet LEDs (Uvled)']],
  ['COB Light Sources', ['Optoelectronics/Chip on Board (Cob) Light Sources']],
  ['Laser Diodes', ['Optoelectronics/Laser Diodes']],
  ['LED Segment Displays', ['Displays and LED Drivers/LED Segment Display', 'Displays and LED Drivers/LED Segment Displays']],
  ['LED Dot Matrix', ['Displays and LED Drivers/LED Dot Matrix and Cluster']],
  ['LCD & OLED Displays', ['Displays and LED Drivers/LCD Screen', 'Displays and LED Drivers/OLED Display']],
  ['Photodiodes', ['Optoelectronics/Photodiodes']],
  ['Phototransistors', ['Optoelectronics/Phototransistors']],
  ['Infrared Receivers & IrDA', ['Optoelectronics/Infrared Remote Receiver (Irm)', 'Optoelectronics/IR Da Transceiver Modules']],
  ['Photointerrupters & Reflective Sensors', [
    'Optoelectronics/Photointerrupters - Slot Type - Transistor Output',
    'Sensors/Photointerrupters - Slot Type - Logic Output',
    'Optoelectronics/Reflective Optical Interrupters',
    'Sensors/Reflective Optical Interrupters',
  ]],
  ['Fiber Optic Transceivers', ['Optoelectronics/Fiber Optical Transceivers']],
  ['Optoelectronics Accessories', ['Optoelectronics/Optoelectronics Accessories', 'Hardware Fasteners/LED Isolation Column']],
]);

group('Sensors', [
  ['Temperature Sensors', ['Sensors/Temperature Sensors']],
  ['Temperature & Humidity Sensors', ['Sensors/Temperature and Humidity Sensors', 'Sensors/Humidity, Moisture Sensors']],
  ['Thermostat Switches', ['Sensors/Thermostat Switches']],
  ['Hall Effect Switches', ['Magnetic Sensors/Hall Switches', 'Sensors/Hall Sensor']],
  ['Linear Hall & Magnetic Sensors', [
    'Magnetic Sensors/Linear Hall Sensors',
    'Magnetic Sensors/3d Magnetic Sensors',
    'Magnetic Sensors/Magnetic Angle Sensors',
  ]],
  ['Current Sensors', ['Magnetic Sensors/Current Sensors', 'Sensors/Current Sensors']],
  ['Reed Switches', ['Magnetic Sensors/Reed Switches']],
  ['Accelerometers, Gyroscopes, IMUs', ['Sensors/Accelerometers', 'Sensors/Attitude Sensor / Gyroscope']],
  ['Pressure & Force Sensors', ['Sensors/Pressure Sensors', 'Sensors/Force Sensors']],
  ['Ambient Light Sensors', ['Sensors/Ambient Light Sensors']],
  ['Proximity & Presence Sensors', [
    'Sensors/Proximity Sensors',
    'Sensors/Human Body Sensing Sensor',
    'Sensors/Infrared Sensors',
    'Industrial Control Electrical/Proximity Sensors,Proximity Switches',
  ]],
  ['Position Sensors', ['Sensors/Position Sensor', 'Sensors/Position Sensors']],
  ['Touch & Capacitive Sensors', ['Sensors/Touch Sensors', 'Sensors/Capacitive Sensor IC']],
  ['Gas Sensors', ['Sensors/Gas Sensors']],
  ['Image Sensors', ['Sensors/Image Sensors']],
  ['Ultrasonic Transducers', ['Sensors/Ultrasonic Receivers, Transmitters']],
  ['Level, Flow & Vibration Sensors', ['Sensors/Float Level Senors', 'Sensors/Flow Sensors', 'Sensors/Vibration Sensors']],
  ['Sensor Modules & Specialized Sensors', [
    'Sensors/Sensor Modules',
    'Sensors/Specialized Sensors',
    'Sensors/Heart Rate Sensors',
    'Sensors/Fiber Optic / Laser Sensors',
  ]],
]);

group('RF & Wireless', [
  ['RF Transceiver ICs', ['RF and Wireless/RF Transceiver ICs', 'RF and Wireless/RF Chips']],
  ['Antennas', [
    'RF and Wireless/Antennas',
    'Industrial Control Electrical/Antenna Shrapnel',
    'Industrial Control Electrical/Antenna Spring',
  ]],
  ['RF Amplifiers & LNAs', [
    'RF and Wireless/RF Amplifiers',
    'RF and Wireless/Low Noise Amplifiers (LNA) - RF',
    'RF and Wireless/RF Power Amplifiers',
  ]],
  ['RF Switches', ['RF and Wireless/RF Switches']],
  ['RF Filters (incl. SAW)', ['RF and Wireless/RF Filters', 'RF and Wireless/SAW Filters', 'RF and Wireless/Tunable Filters']],
  ['Baluns', ['RF and Wireless/Balun', 'Inductors, Coils and Transformers/Balun']],
  ['RF Attenuators', ['RF and Wireless/RF Attenuator', 'RF and Wireless/RF Attenuators', 'Wire / Cable / Data Cable/Fixed Attenuator']],
  ['RF Couplers, Splitters, Duplexers', [
    'RF and Wireless/RF Directional Coupler',
    'RF and Wireless/RF Power Splitters / Combiners',
    'RF and Wireless/Duplexers',
  ]],
  ['RF Mixers, Modulators, Detectors', [
    'RF and Wireless/RF Mixers',
    'RF and Wireless/RF Modulators / Demodulator',
    'RF and Wireless/RF Modulators and Demodulators',
    'RF and Wireless/RF Detectors',
  ]],
  ['RF Front Ends & Misc RF ICs', ['RF and Wireless/RF Front End Circuits', 'RF and Wireless/RF Misc ICs and Modules']],
  ['RFID ICs', ['RF and Wireless/RFID ICs']],
  ['RF Cables', [
    'RF and Wireless/RF Cables',
    'RF and Wireless/Radio Frequency Cable',
    'Wire / Cable / Data Cable/Coaxial Cables (RF)',
  ]],
]);

group('Wireless & Communication Modules', [
  ['Wi-Fi Modules', ['IoT / Communication Modules/Wi Fi Modules']],
  ['Bluetooth Modules', ['IoT / Communication Modules/Bluetooth Modules']],
  ['LoRa Modules', ['IoT / Communication Modules/LoRa Modules']],
  ['Cellular Modules (2G-5G)', ['IoT / Communication Modules/2g / 3g / 4g / 5g Modules']],
  ['GNSS Modules', ['IoT / Communication Modules/GNSS Modules']],
  ['RF, Zigbee & RFID Modules', [
    'IoT / Communication Modules/RF Modules',
    'IoT / Communication Modules/Zig Bee Modules',
    'IoT / Communication Modules/RFID Modules',
    'Functional Modules/Wireless Modules',
  ]],
  ['Wired Interface Modules (CAN, RS-485, USB, Ethernet)', [
    'IoT / Communication Modules/CAN Bus Modules',
    'IoT / Communication Modules/RS485 Bus Modules',
    'IoT / Communication Modules/RS232 Bus Modules',
    'IoT / Communication Modules/Ethernet Modules',
    'IoT / Communication Modules/USB Conversion Modules',
    'IoT / Communication Modules/USB Modules',
  ]],
]);

group('Connectors', [
  ['Wire-to-Board Connectors', [
    'Connectors/Wire to Board Connector',
    'Connectors/Wire to Board / Wire to Wire Connector',
  ]],
  ['Connector Housings (Wire-to-Board / Wire-to-Wire)', [
    'Connectors/Housings (Wire to Board / Wire to Wire )',
    'Connectors/Connector Housings',
    'Connectors/Connectors - Housings',
    'Connectors/Rectangular Connectors Housings',
    'Connectors/Connector Shells',
  ]],
  ['Crimp Contacts & Terminals', [
    'Connectors/Housing Contact',
    'Connectors/Cold-Pressed Terminals',
    'Connectors/Line Pressing Terminals',
    'Connectors/Wiring Quick-Connect Terminals',
    'Industrial Control Electrical/Cold-Pressed Terminals',
    'Terminal/En Terminal',
    'Terminal/Quick Terminal',
    'Terminal/Ring Terminal',
    'Terminal/Wire Pin Terminal',
    'Terminal/SMD Quick Terminal',
    'Terminal/Square Copper Terminal',
  ]],
  ['Pin Headers', ['Connectors/Pin Headers', 'Connectors/Pin / Jack']],
  ['Female Headers', ['Connectors/Female Headers']],
  ['Board-to-Board & Mezzanine Connectors', [
    'Connectors/Board-to-Board and Backplane Connector',
    'Connectors/Backplane Connector',
    'Connectors/Mezzanine Connectors (Board to Board)',
    'Connectors/Micro-Match Connector',
  ]],
  ['FFC / FPC Connectors', ['Connectors/FFC, FPC (Flat Flexible) Connector Assemblies', 'Connectors/FFC / FPC Connectors']],
  ['FFC Cables', ['Connectors/FFC Cable (Flexible Flat Cable)', 'Wire / Cable / Data Cable/Flat Flex Ribbon Jumpers, Cables']],
  ['IDC Connectors', ['Connectors/IDC Connectors']],
  ['USB Connectors', ['Connectors/USB Connectors']],
  ['Terminal Blocks - Pluggable', ['Connectors/Pluggable System Terminal Block']],
  ['Terminal Blocks - Screw', ['Connectors/Screw Terminal Blocks', 'Connectors/Screw Terminal']],
  ['Terminal Blocks - Spring Clamp', ['Connectors/Spring Clamp System Terminal Block']],
  ['Terminal Blocks - Barrier', ['Connectors/Barrier Terminal Blocks', 'Industrial Control Electrical/Terminal Strips']],
  ['PCB Solder Terminals', [
    'Connectors/PCB Welding Terminal',
    'Terminal/PCB Welding Terminal',
    'Industrial Control Electrical/Terminal Accessories',
  ]],
  ['RF / Coaxial Connectors', [
    'Connectors/Coaxial Connectors (RF)',
    'Connectors/RF Connectors / Coaxial Connectors',
    'Connectors/Feed-Voltage / Radio-Frequency Insulator',
    'Connectors/Radio-Frequency Insulator',
  ]],
  ['Ethernet / Modular Connectors (RJ45, RJ11)', ['Connectors/Ethernet Connectors / Modular Connectors (RJ45 RJ11)']],
  ['Card Connectors (SD, SIM)', [
    'Connectors/SD Card / Memory Card Connector',
    'Connectors/SD Card Connectors',
    'Connectors/SIM Card Connectors',
  ]],
  ['Audio & Video Connectors', [
    'Connectors/Audio Connectors',
    'Connectors/Audio Connectors (Headphones)',
    'Connectors/Audio and Video Connectors',
    'Connectors/RCA Connector',
    'Connectors/XLR (Cannon) Connectors',
  ]],
  ['HDMI / DisplayPort / DVI Connectors', [
    'Connectors/HDMI Connectors',
    'Connectors/Display Port (DP) Connector',
    'Connectors/D-Sub / DVI / HDMI Connectors',
  ]],
  ['D-Sub Connectors', ['Connectors/D-Sub / VGA Connectors', 'Connectors/D-Sub Connectors']],
  ['Power Connectors (DC / AC)', [
    'Connectors/DC Power Connectors',
    'Connectors/AC Power Connectors',
    'Connectors/AC Power Connector',
    'Connectors/AC / DC Power Connectors',
    'Industrial Control Electrical/Power Connectors',
    'Industrial Control Electrical/Power Connector / Plug Connector',
    'Industrial Control Electrical/Plug',
  ]],
  ['Battery Connectors & Holders', [
    'Connectors/Battery Connectors',
    'Connectors/Blade / Shrapnel Contact Battery Connectors',
    'Connectors/Button and Strip Battery Connector',
    'Industrial Control Electrical/Battery Connector',
  ]],
  ['Card Edge Connectors', ['Connectors/Edgeboard Connectors', 'Connectors/Card Edge Connectors']],
  ['PCI / Memory / Storage Connectors', [
    'Connectors/PCI / PCIe Connector',
    'Connectors/Memory Connector (DDR)',
    'Connectors/Hard Disk Connector (SAS / SATA / M.2)',
  ]],
  ['Circular Connectors', [
    'Connectors/Circular Connectors and Cable Connectors',
    'Connectors/Circular Connectors',
    'Connectors/Circular DIN Connectors',
  ]],
  ['Automotive Connectors', ['Connectors/Automobile Connectors']],
  ['IC & Transistor Sockets', ['Connectors/IC / Transistor Socket']],
  ['Pogo Pins', ['Connectors/Pogo Pin Spring Probe Connector']],
  ['Jumpers / Shunts', ['Connectors/Shunts, Jumpers']],
  ['Test Points', ['Connectors/Test Points / Test Rings']],
  ['Banana Connectors & Alligator Clips', ['Connectors/Banana Connectors / Alligator Clips']],
  ['Fiber Optic Connectors', ['Connectors/Fiber Optic Connectors', 'Connectors/Optical Module Connector']],
  ['Connector Accessories', ['Connectors/Connector Accessories', 'Industrial Control Electrical/Connector Accessories']],
  ['Pre-ordered Connectors', ['Connectors/Pre-ordered Connectors']],
]);

group('Switches', [
  ['Tactile Switches', [
    'Switches/Tactile Switches',
    'Industrial Control Electrical/Tact Switchs,Keypad Switches',
    'Industrial Control Electrical/Tactile Switch / Push Button Switch',
    'Switches/Metal Dome Pot',
  ]],
  ['Pushbutton Switches', [
    'Switches/Pushbutton Switches',
    'Switches/Push Switches',
    'Industrial Control Electrical/Pushbutton Switches',
    'Switches/Mechanical Keyboard Shaft',
  ]],
  ['Slide Switches', ['Switches/Slide Switches']],
  ['DIP Switches', ['Switches/Dip Switches']],
  ['Toggle Switches', ['Switches/Toggle Switches']],
  ['Rocker Switches', ['Switches/Rocker Switches']],
  ['Rotary Encoders', ['Switches/Rotary Encoders', 'Industrial Control Electrical/Encoders']],
  ['Rotary Switches', ['Switches/Rotary Switches', 'Switches/Rotary Coding Switch', 'Switches/Rotary Wheel Switches']],
  ['Limit & Micro Switches', [
    'Switches/Limit Switches',
    'Switches/Microswitches',
    'Industrial Control Electrical/Limit Switchs,Travel Switchs',
    'Industrial Control Electrical/Micro Switch',
  ]],
  ['Multi-Directional / Navigation Switches', [
    'Switches/Multi-Directional Switches',
    'Switches/Multidirectional Switch',
    'Switches/Navigation Switches, Joystick',
  ]],
  ['Keylock & Specialty Switches', ['Switches/Keylock Switches', 'Switches/Specialty Switches']],
  ['Switch Accessories & Caps', ['Switches/Switch Accessories / Caps', 'Switches/Switch Accessories or Caps']],
]);

group('Relays', [
  ['Power Relays', ['Relays/Power Relays', 'Relays/Relays', 'Switches/Relays', 'Industrial Control Electrical/Intermediate Relays']],
  ['Signal Relays', ['Relays/Signal Relays']],
  ['Automotive Relays', ['Relays/Automotive Relays']],
  ['Latching Relays', ['Relays/Magnetic Latching Relays']],
  ['Reed Relays', ['Relays/Reed Relays']],
  ['Safety Relays & Contactors', [
    'Industrial Control Electrical/Safety Relays',
    'Industrial Control Electrical/Electromechanical Contactors',
  ]],
  ['Relay Sockets & Accessories', ['Relays/Relay Sockets and Accessories']],
]);

group('Audio & Electromechanical', [
  ['Buzzers', [
    'Audio Products and Motors/Buzzers',
    'Industrial Control Electrical/Buzzers',
    'Industrial Control Electrical/Buzzer / Electronic Beeper',
  ]],
  ['Microphones', [
    'Audio Products and Motors/Microphones',
    ['Audio Products and Motors/MEMS Microphones', { 'Microphone Type': 'MEMS' }],
  ]],
  ['Speakers', ['Audio Products and Motors/Speakers']],
  ['Vibration Motors', ['Audio Products and Motors/Vibration Motors']],
  ['Fans & Heat Sinks', [
    'Industrial Control Electrical/Cooling Fan',
    'Industrial Control Electrical/Heat Sink / Cooling Fin',
    'Industrial Control Electrical/Heat Sink / Heatsink',
  ]],
]);

group('Hardware, Cables & Tools', [
  ['Nuts, Screws, Standoffs & Fasteners', [
    'Hardware / Fasteners / Sealing/Flat Washers',
    'Hardware / Fasteners / Sealing/Hex Nut',
    'Hardware / Fasteners / Sealing/Hex Socket Cylindrical Head Tri-Combination',
    'Hardware / Fasteners / Sealing/Internal Threaded Hex Stud',
    'Hardware / Fasteners / Sealing/Knurled Studs',
    'Hardware / Fasteners / Sealing/Other Hardware',
    'Hardware / Fasteners / Sealing/Outer Hex Bolt and Nut Kit',
    'Hardware / Fasteners / Sealing/Phillips Countersunk Flat Tail Self-Tapping Screws',
    'Hardware / Fasteners / Sealing/Phillips Half Round Head Self-Tapping Screws',
    'Hardware / Fasteners / Sealing/Phillips Large Flat Head Machine Screws',
    'Hardware / Fasteners / Sealing/Phillips Pan Head Machine Screws',
    'Hardware / Fasteners / Sealing/Phillips Pan Head Screws with Collar',
    'Hardware / Fasteners / Sealing/Phillips Recessed Countersunk Machine Screws',
    'Hardware / Fasteners / Sealing/Phillips Round-Headed, Flat-Tailed Self-Tapping Screws',
    'Hardware / Fasteners / Sealing/SMD Round Nut',
    'Hardware / Fasteners / Sealing/Self-Clinching Studs',
    'Hardware / Fasteners / Sealing/Single-Ended Hex Stud',
    'Hardware / Fasteners / Sealing/Studs and Screws',
    'Hardware / Fasteners / Sealing/Through-Hole Insert Round Nuts',
    'Hardware / Fasteners / Sealing/Washers and Retaining Rings',
    'Hardware Fasteners/Patch Round Nut',
    'Hardware Fasteners/Studs and Screws',
    'Hardware Fasteners/Hose Clamp',
  ]],
  ['Springs & Shielding Clips', [
    'Hardware / Fasteners / Sealing/Press Spring',
    'Hardware / Fasteners / Sealing/Springs',
    'Hardware / Fasteners / Sealing/Shielding Clips',
    'Hardware Fasteners/Shielding Clip',
    'Hardware Fasteners/Spring',
  ]],
  ['SMT Copper Sheets / Busbars', [
    'Consumables/Metal Products*SMT Copper Sheets',
    'Consumables and Auxiliary Materials/Metal Products * SMT Copper Sheet',
  ]],
  ['Wires, Cables & Cable Assemblies', [
    'Wire / Cable / Data Cable/Between Series Adapter Cables',
    'Wire / Cable / Data Cable/Circular Cable Assemblies',
    'Wire / Cable / Data Cable/Fiber Optic Cables',
    'Wire / Cable / Data Cable/Jumper Wire / Enameled Wire / Pre-Crimped Leads',
    'Wire / Cable / Data Cable/Network Cables',
    'Wire / Cable / Data Cable/Rectangular Cable Assemblies',
    'Wire / Cable / Data Cable/Single Conductor Cable(Grounding Wire)',
    'Wire / Cable / Data Cable/Smart Cables',
    'Wire / Cable / Data Cable/Specialized Cable Assemblies',
    'Wires and Cables/Dupont Wire / Terminal Block Wire / Electronic Wire',
    'Other/Electronic Cable',
    'Other/Electronic Wire',
  ]],
  ['Cable Management, Heat Shrink & Labels', [
    'Wire / Cable / Data Cable/Cable Supports and Fasteners',
    'Wire / Cable / Data Cable/Cables and Clamps',
    'Wire / Cable / Data Cable/Heat Shrink Boots, Caps',
    'Wire / Cable / Data Cable/Labels, Labeling',
    'Wires and Cables/Cables and Wire Clips',
    'Consumables/Heat Shrink Tubing',
    'Consumables/Holders / Clips',
  ]],
  ['Development Boards & Programmers', [
    'Development Boards and Tools/Development Boards and Kits',
    'Development Boards and Tools/Programmers, Emulators, and Debuggers',
    'Development Boards and Tools/Raspberry Pi',
    'Educational Kits/Modules',
    'Educational Kits/V-Audio Modules',
    'Functional Modules/Modules',
  ]],
]);

group('Uncategorized', [
  ['Global Sourcing Parts', ['Global Sourcing Parts/Global Sourcing Parts', 'Others/Global Sourcing Parts']],
  ['Other / Unsorted Parts', [
    'Others/Others',
    'Others/New Arrivals',
    'Old Batch/Old Batch',
    'Other/Comprehensive Electronic',
    'Test/Mro Pre Sale of New Products',
    'Test/Other',
    'Electronic Tools / Instruments / Consumables/Pre-ordered Products',
    'Industrial Control Electrical/Other Industrial Control Products',
  ]],
]);

export const GROUPS = G;

// Where to put upstream categories that are not listed above.
const FALLBACK_GROUP = {
  'Amplifiers and Comparators': 'Amplifiers & Comparators',
  'Audio Products and Motors': 'Audio & Electromechanical',
  'Capacitors': 'Capacitors',
  'Circuit Protection': 'Circuit Protection',
  'Clock and Timing': 'Clock & Timing',
  'Connectors': 'Connectors',
  'Crystals, Oscillators and Resonators': 'Crystals, Oscillators & Resonators',
  'Data Converters': 'Data Converters',
  'Diodes': 'Diodes',
  'Displays and LED Drivers': 'LED & Display Drivers',
  'Embedded Processors and Controllers': 'Microcontrollers & Processors',
  'Filters and EMI Optimization': 'Filters & EMI',
  'Inductors, Coils and Transformers': 'Inductors, Coils & Transformers',
  'Interface ICs': 'Interface ICs',
  'IoT / Communication Modules': 'Wireless & Communication Modules',
  'Logic': 'Logic',
  'Logic ICs': 'Logic',
  'Magnetic Sensors': 'Sensors',
  'Memory': 'Memory',
  'Motor Driver ICs': 'Motor & Gate Drivers',
  'Optoelectronics': 'Optoelectronics',
  'Power Management': 'Power Management',
  'Power Modules': 'Power Modules & Supplies',
  'RF and Wireless': 'RF & Wireless',
  'Relays': 'Relays',
  'Resistors': 'Resistors',
  'Sensors': 'Sensors',
  'Signal Isolation Devices': 'Isolators & Optocouplers',
  'Switches': 'Switches',
  'Transistors and Thyristors': 'Transistors & Thyristors',
};

const slug = (s) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/**
 * Build the resolver: (upstreamCategory, upstreamSubcategory) -> placement.
 * Returns { resolve(cat, sub) -> { group, name, id, tags, curated }, unused() }.
 */
export function buildTaxonomy() {
  const bySource = new Map();
  const defaultsById = new Map();
  for (const [groupName, cats] of GROUPS) {
    for (const [catName, sources, defaults] of cats) {
      if (defaults) defaultsById.set(slug(`${groupName}-${catName}`), defaults);
      for (const src of sources) {
        const [key, tags] = Array.isArray(src) ? src : [src, null];
        if (bySource.has(key)) throw new Error(`taxonomy: source listed twice: ${key}`);
        bySource.set(key, { group: groupName, name: catName, id: slug(`${groupName}-${catName}`), tags, curated: true, used: false });
      }
    }
  }
  return {
    resolve(cat, sub) {
      const key = `${cat}/${sub}`;
      const hit = bySource.get(key);
      if (hit) { hit.used = true; return hit; }
      const group = FALLBACK_GROUP[cat] ?? 'Uncategorized';
      return { group, name: sub, id: slug(`${group}-${sub}`), tags: null, curated: false };
    },
    unused() {
      return [...bySource.entries()].filter(([, v]) => !v.used).map(([k]) => k);
    },
    /** Tag values for parts whose source does not set that tag itself. */
    defaults: (id) => defaultsById.get(id) ?? null,
    groupOrder: GROUPS.map(([g]) => g),
    catOrder(groupName) {
      return (GROUPS.find(([g]) => g === groupName)?.[1] ?? []).map(([c]) => c);
    },
  };
}
