// Starting catalogue, transcribed from the 6 photographed price-sheet pages.
//
// How the sheet columns are read:
//   Qty + Price                 -> purchase (wholesale) quantity and total price  => cost per unit = Price / Qty
//   Qty-Retail + Price          -> retail quantity and price                       => selling per unit = Price / Qty
// Nothing is invented: a blank in the sheet stays blank (null) here.
// Stock, minimum stock and suppliers are NOT in the sheet, so they are all left unset.

const taxonomy = [
  { name: 'Fans & Ventilation', icon: 'fan', subs: ['Ceiling Fans', 'Table, Pedestal & Wall Fans', 'Exhaust Fans', 'Fan Rods, Clamps & Hooks', 'Fan Capacitors'] },
  { name: 'Lights & Lamps', icon: 'bulb', subs: ['LED Bulbs', 'LED Tube Lights', 'Panel & Surface Lights', 'Charging Bulbs', 'Lamp Holders'] },
  { name: 'Switches & Sockets', icon: 'switch', subs: ['Modular Switches', 'Modular Sockets', 'Fan Regulators', 'Switch-Socket Combos', 'Plug Tops & Adapters', 'Extension Boards', 'Door Bells'] },
  { name: 'Switchboards & Boxes', icon: 'box', subs: ['GI Concealed Boxes', 'MCB Boxes', 'Cover Plates', 'Modular Surface Boxes', 'PVC Switch Boards'] },
  { name: 'MCB & Protection', icon: 'breaker', subs: ['MCBs'] },
  { name: 'Wires & Cables', icon: 'wire', subs: ['PVC Flexible House Wire', 'Copper Wire', 'Other Wires', 'Coaxial & Speaker Cable'] },
  { name: 'Conduit, Pipes & Casing', icon: 'pipe', subs: ['Pica Conduit Pipes', 'PVC Pipes', 'PVC Pipe Fittings', 'Casing & Capping', 'Casing Fittings'] },
  { name: 'Fittings & Accessories', icon: 'clamp', subs: ['Saddles & Clamps', 'Cable Ties', 'Insulation Tapes', 'Connector Strips'] },
  { name: 'Hand Tools', icon: 'tools', subs: ['Hand Tools'] },
  { name: 'Batteries & AV Accessories', icon: 'battery', subs: ['Batteries & Cells', 'AV Cables'] },
];

// [subcategory, name, brand, spec, unit, purchaseQty, purchasePrice, retailQty, retailPrice, flags]
// flags: { pack:true }  retail rate is per piece but the product is bought by the packet -> no selling price set
//        { review:'text' } something in the sheet looks odd; shown in the import report and the private notes
const rows = [
  // ---- Conduit, Pipes & Casing
  ['Pica Conduit Pipes', 'Pica Pipe 20 mm', '', '', 'Mtr', 30, 450, 1, 16],
  ['Pica Conduit Pipes', 'Pica Pipe 25 mm', '', '', 'Mtr', null, null, null, null],
  ['Pica Conduit Pipes', 'Pica Pipe 10 mm', '', '', 'Mtr', 50, 540, 1, 10, { review: 'Selling price (10) is below the purchase price per metre (10.80). Please confirm.' }],
  ['Pica Conduit Pipes', 'Pica Pipe 16 mm', '', '', 'Mtr', 30, 420, 1, 15],

  ['PVC Pipes', 'PVC Pipe 20 mm', '', 'White', 'Nos', 1, 35, null, null],
  ['PVC Pipes', 'PVC Pipe 25 mm', '', 'White', 'Nos', 1, 45, null, null],
  ['PVC Pipes', 'PVC Grey Pipe 5 ft', '', 'Gray', 'Nos', 1, null, null, null],
  ['PVC Pipe Fittings', 'PVC Elbow 20 mm', '', 'White', 'Nos', 1, 4, null, null],
  ['PVC Pipe Fittings', 'PVC Tee 20 mm', '', 'White', 'Nos', 1, 7, null, null],
  ['PVC Pipe Fittings', 'PVC Junction 20 mm', '', 'White', 'Nos', 1, 10, null, null],
  ['PVC Pipe Fittings', 'PVC Elbow 25 mm', '', 'White', 'Nos', 1, 5, null, null],
  ['PVC Pipe Fittings', 'PVC Tee 25 mm', '', 'White', 'Nos', 1, 8, null, null],
  ['PVC Pipe Fittings', 'PVC Junction 25 mm', '', 'White', 'Nos', 1, 10, null, null],

  ['Casing & Capping', 'Casing Patti 25 mm', 'Royal', '', 'Nos', 1, 35, null, null],
  ['Casing & Capping', 'Casing Patti 25 mm', 'Gold', '', 'Nos', 1, 45, null, null],
  ['Casing & Capping', 'Casing Patti 12 mm', '', '', 'Nos', null, null, null, null],
  ['Casing Fittings', 'Casing Elbow', '', '', 'Nos', 1, 5, null, null],
  ['Casing Fittings', 'Casing Tee', '', '', 'Nos', 1, 5, null, null],
  ['Casing Fittings', 'Casing Internal', '', '', 'Nos', 1, 5, null, null],
  ['Casing Fittings', 'Casing External', '', '', 'Nos', 1, 5, null, null],
  ['Casing Fittings', 'Casing Junction Box 1, 2, 3, 4', '', '', 'Nos', 1, 8, null, null],

  // ---- Fittings & Accessories
  ['Saddles & Clamps', 'C-Clamp (China Saddle) 20 mm', '', '', 'Pkt', 1, 100, 8, 12, { pack: true, review: 'Retail quantity is 8 here but 10 on the other clamp sizes. Please confirm.' }],
  ['Saddles & Clamps', 'C-Clamp (China Saddle) 25 mm', '', '', 'Pkt', 1, 125, 10, 15, { pack: true }],
  ['Saddles & Clamps', 'C-Clamp (China Saddle) 6 mm', '', '', 'Pkt', 1, 20, 10, 2, { pack: true }],
  ['Saddles & Clamps', 'C-Clamp (China Saddle) 8 mm', '', '', 'Pkt', 1, 30, 10, 3, { pack: true }],
  ['Saddles & Clamps', 'C-Clamp (China Saddle) 10 mm', '', '', 'Pkt', 1, 45, 10, 5, { pack: true }],
  ['Saddles & Clamps', 'C-Clamp (China Saddle) 16 mm', '', '', 'Pkt', 1, 85, 10, 8, { pack: true }],

  ['Cable Ties', 'PVC Cable Tie 100 mm (4")', '', '', 'Pkt', 1, 20, 10, 2, { pack: true }],
  ['Cable Ties', 'PVC Cable Tie 150 mm (6")', '', '', 'Pkt', 1, 50, 10, 5, { pack: true }],
  ['Cable Ties', 'PVC Cable Tie 200 mm (8")', '', '', 'Pkt', 1, 60, 10, 6, { pack: true }],
  ['Cable Ties', 'PVC Cable Tie 250 mm (10")', '', '', 'Pkt', 1, 75, 10, 8, { pack: true }],
  ['Cable Ties', 'PVC Cable Tie 300 mm (12")', '', '', 'Pkt', 1, 100, 10, 10, { pack: true }],
  ['Cable Ties', 'PVC Cable Tie 350 mm (14")', '', '', 'Pkt', 1, 150, 10, 15, { pack: true }],
  ['Cable Ties', 'PVC Cable Tie 400 mm (16")', '', '', 'Pkt', 1, 200, 10, 20, { pack: true }],

  ['Insulation Tapes', 'Insulation Tape', 'G2', '', 'Nos', 1, 15, null, null],
  ['Insulation Tapes', 'Insulation Tape', 'Hifi', '', 'Nos', 1, 10, null, null],
  ['Insulation Tapes', 'Water Proof Tape', '', '', 'Nos', 1, 10, null, null],
  ['Connector Strips', 'Connector Strip 10A', '', '', 'Nos', null, null, null, null],
  ['Connector Strips', 'Connector Strip 16A', '', '', 'Nos', null, null, null, null],

  // ---- Fans & Ventilation
  ['Ceiling Fans', 'Ceiling Fan 48"', 'Fortune', '', 'Nos', 1, 1200, null, null],
  ['Ceiling Fans', 'Ceiling Fan 48" Design', 'Fortune', 'Design', 'Nos', 1, 1375, null, null],
  ['Ceiling Fans', 'Ceiling Fan 48"', 'Orient', '', 'Nos', 1, 1950, null, null],
  ['Ceiling Fans', 'Ceiling Fan 48"', 'Crompton', '', 'Nos', 1, null, null, null],
  ['Ceiling Fans', 'Ceiling Fan 48" Design', 'Crompton', 'Design', 'Nos', 1, null, null, null],
  ['Table, Pedestal & Wall Fans', 'Table Fan', '', '', 'Nos', null, null, null, null],
  ['Table, Pedestal & Wall Fans', 'Pedestal Fan', '', '', 'Nos', null, null, null, null],
  ['Table, Pedestal & Wall Fans', 'Wall Fan', '', '', 'Nos', null, null, null, null],
  ['Exhaust Fans', 'Exhaust Fan 6"', '', '', 'Nos', null, null, null, null],
  ['Exhaust Fans', 'Exhaust Fan 9"', '', '', 'Nos', null, null, null, null],
  ['Exhaust Fans', 'Exhaust Fan 12"', '', '', 'Nos', null, null, null, null],
  ['Fan Rods, Clamps & Hooks', 'Fan Pipe 12"', '', '', 'Nos', null, null, null, null],
  ['Fan Rods, Clamps & Hooks', 'Fan Pipe 15"', '', '', 'Nos', 1, 38, null, null],
  ['Fan Rods, Clamps & Hooks', 'Fan Pipe 18"', '', '', 'Nos', 1, 45, null, null],
  ['Fan Rods, Clamps & Hooks', 'Fan Pipe 24"', '', '', 'Nos', null, null, null, null],
  ['Fan Rods, Clamps & Hooks', 'Fan Pipe 30"', '', '', 'Nos', null, null, null, null],
  ['Fan Rods, Clamps & Hooks', 'Fan Pipe 36"', '', '', 'Nos', null, null, null, null],
  ['Fan Rods, Clamps & Hooks', 'Rubber Clamp Fan', '', '', 'Nos', 1, 25, null, null],
  ['Fan Rods, Clamps & Hooks', 'Fan Clamp Double Fastener', '', '', 'Nos', 1, 35, null, null],
  ['Fan Rods, Clamps & Hooks', 'Fan Clamp Single Fastener', '', '', 'Nos', 1, 50, null, null],
  ['Fan Rods, Clamps & Hooks', 'Fan Hook', '', '', 'Nos', null, null, null, null],
  ['Fan Capacitors', 'Fan Capacitor 2.5 Paper', '', 'Paper type', 'Nos', null, null, null, null],
  ['Fan Capacitors', 'Fan Capacitor 3.15 Paper', '', 'Paper type', 'Nos', null, null, null, null],
  ['Fan Capacitors', 'Fan Capacitor 2.5 Oil', '', 'Oil type', 'Nos', 1, 30, null, null],
  ['Fan Capacitors', 'Fan Capacitor 3.15 Oil', '', 'Oil type', 'Nos', 1, 40, null, null],

  // ---- Switchboards & Boxes
  ['GI Concealed Boxes', 'GI Concealed Box 4x4', '', '', 'Nos', 1, 45, null, null],
  ['GI Concealed Boxes', 'GI Concealed Fan Box', '', '', 'Nos', 1, 59, null, null],
  ['GI Concealed Boxes', 'GI Concealed Box 1-2 M', '', '', 'Nos', 1, 28, null, null],
  ['GI Concealed Boxes', 'GI Concealed Box 3 M', '', '', 'Nos', 1, 33, null, null],
  ['GI Concealed Boxes', 'GI Concealed Box 4 M', '', '', 'Nos', 1, 40, null, null],
  ['GI Concealed Boxes', 'GI Concealed Box 6 M', '', '', 'Nos', 1, 53, null, null],
  ['GI Concealed Boxes', 'GI Concealed Box 8 M', '', '', 'Nos', 1, 60, null, null],
  ['MCB Boxes', 'GI MCB Box 1-2', '', '', 'Nos', 1, 30, null, null],
  ['MCB Boxes', 'GI MCB Box 3-4', '', '', 'Nos', 1, 45, null, null],
  ['Cover Plates', 'Round Plate', 'Royal', '', 'Nos', 1, 17, 1, 20],
  ['Cover Plates', 'Round Button', '', '', 'Nos', 1, 41, 1, 45],
  ['Cover Plates', 'Plate Angle', '', '', 'Nos', 1, 28, 1, 30],
  ['Cover Plates', 'Plate Button', '', '', 'Nos', null, null, null, null],
  ['Cover Plates', 'Angle Regular', '', '', 'Nos', 1, 25, null, null],
  ['Cover Plates', 'Button Regular', '', '', 'Nos', 1, 20, null, null],
  ['Cover Plates', 'Dummy Plate 5x5', 'Specific', '', 'Nos', 1, 17, null, null],
  ['Modular Surface Boxes', 'Modular Surface Box 1 M', 'Rapid', '', 'Nos', null, null, 1, 30],
  ['Modular Surface Boxes', 'Modular Surface Box 2 M', 'Rapid', '', 'Nos', null, null, 1, 35],
  ['Modular Surface Boxes', 'Modular Surface Box 3 M', 'Rapid', '', 'Nos', null, null, 1, 45],
  ['Modular Surface Boxes', 'Modular Surface Box 4 M', 'Rapid', '', 'Nos', null, null, 1, 50],
  ['Modular Surface Boxes', 'Modular Surface Box 6 M', 'Rapid', '', 'Nos', null, null, 1, 65],
  ['Modular Surface Boxes', 'Modular Surface Box 8 M', 'Rapid', '', 'Nos', null, null, 1, 80],
  ['Modular Surface Boxes', 'Modular Surface Box 12 M', 'Rapid', '', 'Nos', null, null, 1, 90],
  ['Modular Surface Boxes', 'Modular Surface Box 16 M', 'Rapid', '', 'Nos', null, null, 1, 125],
  ['PVC Switch Boards', 'PVC Board Junction Box', '', 'Red', 'Nos', 1, null, null, null],
  ['PVC Switch Boards', 'PVC Board 1 Switch + 1', '', 'Red', 'Nos', 1, null, null, null],
  ['PVC Switch Boards', 'PVC Board 2 Switch + 1', '', 'Red', 'Nos', 1, null, null, null],
  ['PVC Switch Boards', 'PVC Board 3 Switch + 1', '', 'Red', 'Nos', 1, null, null, null],
  ['PVC Switch Boards', 'PVC Board 2 Switch + 2', '', 'Red', 'Nos', 1, null, null, null],
  ['PVC Switch Boards', 'PVC Board 4 Switch + 4', '', 'Red', 'Nos', 1, null, null, null],
  ['PVC Switch Boards', 'PVC Board SS Combine', '', 'Red', 'Nos', 1, null, null, null],

  // ---- Switches & Sockets
  ['Extension Boards', 'Extension Board 2x4', 'Monalisa', '', 'Nos', 1, 90, null, null],
  ['Extension Boards', 'Extension Board 2x8', 'Monalisa', '', 'Nos', 1, 115, null, null],
  ['Extension Boards', 'Extension Board 2x2', '', '2 Yard', 'Nos', 1, 215, null, null],
  ['Extension Boards', 'Extension Board 2x2', '', '5 Yard', 'Nos', 1, 275, null, null],
  ['Extension Boards', 'Extension Board 4x4', '', '2 Yard', 'Nos', 1, 335, null, null],
  ['Extension Boards', 'Extension Board 4x4', '', '5 Yard', 'Nos', 1, 345, null, null],
  ['Modular Switches', 'Modular Switch 6A One Way', '', '6A', 'Nos', null, null, null, null],
  ['Modular Switches', 'Modular Switch 10A One Way', 'Hifi', '10A', 'Nos', 1, 17, 1, 20],
  ['Modular Switches', 'Modular Switch 20A One Way', 'Hifi', '20A', 'Nos', 1, 50, 1, 55],
  ['Modular Switches', 'Modular Switch 2 Way', '', '', 'Nos', 1, 50, 1, 55],
  ['Modular Switches', 'Bell Push', '', '', 'Nos', null, null, null, null],
  ['Modular Switches', 'Bed Switch', '', '', 'Nos', null, null, null, null],
  ['Modular Switches', 'Indicator', '', '', 'Nos', 1, 45, 1, 450, { review: 'Selling price 450 is 10x the purchase price 45 - possibly meant to be 45. Please confirm.' }],
  ['Fan Regulators', 'Fan Regulator 1 M', 'Hifi', '1 Module', 'Nos', 1, 210, null, null],
  ['Fan Regulators', 'Fan Regulator 2 M', 'Hifi', '2 Module', 'Nos', 1, 220, null, null],
  ['Modular Sockets', 'Modular Socket 16A', 'Hifi', '16A', 'Nos', 1, 90, null, null],
  ['Modular Sockets', 'Modular Socket 6A', 'Hifi', '6A', 'Nos', 1, 40, null, null],
  ['Plug Tops & Adapters', 'Plug Top 6A 3 Pin', 'Hero', '6A', 'Nos', 1, 35, null, null],
  ['Plug Tops & Adapters', 'Plug Top 6A 3 Pin', 'Straco', '6A', 'Nos', 1, 45, null, null],
  ['Plug Tops & Adapters', 'Plug Top 16A 3 Pin', 'Hero', '16A', 'Nos', 1, 50, null, null],
  ['Plug Tops & Adapters', 'Plug Top 16A 3 Pin', 'Straco', '16A', 'Nos', 1, 70, null, null],
  ['Plug Tops & Adapters', 'Male Female Plug', 'Rapid', '', 'Nos', 1, 30, null, null],
  ['Plug Tops & Adapters', '2 Pin Plug', 'Rapid', '', 'Nos', 1, 15, null, null],
  ['Plug Tops & Adapters', 'Adapter', '', '', 'Nos', 1, 15, null, null],
  ['Plug Tops & Adapters', 'Round 2 Pin', '', '', 'Nos', 1, null, null, null],
  ['Modular Switches', 'Switch - Regular Plus', 'Hifi', '', 'Nos', 1, 20, null, null],
  ['Modular Sockets', 'Socket - Regular Plus', 'Hifi', '', 'Nos', 1, 35, null, null],
  ['Modular Switches', 'Switch 16A Plus', 'Straco', '16A', 'Nos', 1, 60, null, null],
  ['Modular Sockets', 'Socket 16A Plus', 'Straco', '16A', 'Nos', 1, 65, null, null],
  ['Switch-Socket Combos', 'SS Combine', 'Straco', 'Switch + Socket', 'Nos', 1, 120, null, null],
  ['Switch-Socket Combos', 'SS Combine with Box', 'Straco', 'Switch + Socket, with box', 'Nos', 1, 150, null, null],
  ['Door Bells', 'Door Bell Ding Dong', '', '', 'Nos', 1, 170, null, null],
  ['Door Bells', 'Door Bell Bull Bull', '', '', 'Nos', 1, 170, null, null],
  ['Door Bells', 'Water Level Bell', '', '', 'Nos', null, null, null, null],

  // ---- MCB & Protection
  ['MCBs', 'MCB SP 10A - 32A', 'Schneider', 'Single pole, 10A-32A', 'Nos', 1, 160, null, null],
  ['MCBs', 'MCB DP 10A - 32A', 'Schneider', 'Double pole, 10A-32A', 'Nos', 1, 598, null, null],
  ['MCBs', 'MCB TPN 32A', 'Schneider', 'TPN, 32A', 'Nos', 1, 1898, null, null],
  ['MCBs', 'MCB TPN 40A', 'Schneider', 'TPN, 40A', 'Nos', null, null, null, null],
  ['MCBs', 'MCB TPN 63A', 'Schneider', 'TPN, 63A', 'Nos', 1, 2015, null, null],

  // ---- Lights & Lamps
  ['Lamp Holders', 'Pendent Holder', 'Skirt', '', 'Nos', 1, 25, null, null],
  ['Lamp Holders', 'Multi Holder', '', '', 'Nos', null, null, null, null],
  ['Panel & Surface Lights', 'LED Panel Light 12W', 'Panasonic', '12W', 'Nos', 1, 280, null, null],
  ['Panel & Surface Lights', 'LED Panel Light 15W', 'Panasonic', '15W', 'Nos', 1, 350, null, null],
  ['Panel & Surface Lights', 'LED Panel Light 15W', 'G.Jaks', '15W', 'Nos', 1, 240, null, null],
  ['Panel & Surface Lights', 'LED Surface Light 15W', 'G.Jaks', '15W', 'Nos', 1, 300, null, null],
  ['LED Bulbs', 'LED Bulb 0.5W', 'Panasonic', '0.5W - Red, Yellow, Blue, Green, WW', 'Nos', 1, 30, null, null],
  ['LED Bulbs', 'LED Bulb 3W', 'Panasonic', '3W - Pink, Blue, Green, WW, White', 'Nos', 1, 100, null, null],
  ['LED Bulbs', 'LED Bulb 5W', 'Panasonic', '5W', 'Nos', 1, 50, null, null],
  ['LED Bulbs', 'LED Bulb 7W', 'Panasonic', '7W', 'Nos', null, null, null, null],
  ['LED Bulbs', 'LED Bulb 9W', 'Panasonic', '9W', 'Nos', 1, 45, null, null],
  ['LED Bulbs', 'LED Bulb 12W', 'Panasonic', '12W', 'Nos', null, null, null, null],
  ['LED Bulbs', 'LED Bulb 15W', 'Panasonic', '15W', 'Nos', null, null, null, null],
  ['LED Bulbs', 'LED Bulb 18W', 'Panasonic', '18W', 'Nos', 1, 165, null, null],
  ['LED Bulbs', 'LED Bulb 23W', 'Panasonic', '23W', 'Nos', 1, 250, null, null],
  ['LED Bulbs', 'LED Bulb 30W', 'Panasonic', '30W', 'Nos', null, null, null, null],
  ['LED Bulbs', 'LED Bulb 40W', 'Panasonic', '40W', 'Nos', null, null, null, null],
  ['LED Bulbs', 'LED Bulb 50W', 'Panasonic', '50W', 'Nos', null, null, null, null],
  ['LED Bulbs', 'LED Bulb 70W', 'Panasonic', '70W', 'Nos', null, null, null, null],
  ['LED Tube Lights', 'LED Tube Light 4 ft 20W', 'Panasonic', '4 ft, 20W', 'Nos', 1, 110, null, null],
  ['LED Tube Lights', 'LED Tube Light 4 ft 24W', 'Panasonic', '4 ft, 24W', 'Nos', null, null, null, null],
  ['LED Tube Lights', 'LED Tube Light 4 ft 28W', 'Panasonic', '4 ft, 28W', 'Nos', 1, 310, null, null],
  ['LED Tube Lights', 'LED Tube Light 4 ft 36W', 'Panasonic', '4 ft, 36W', 'Nos', 1, 450, null, null],
  ['LED Tube Lights', 'LED Tube Light 4 ft 40W', 'Panasonic', '4 ft, 40W', 'Nos', 1, 550, null, null],
  ['Charging Bulbs', 'Charging Bulb 9W', 'Halonix', '9W', 'Nos', 1, 250, null, null],
  ['Charging Bulbs', 'Charging Bulb 12W', 'Halonix', '12W', 'Nos', 1, 290, null, null],

  // ---- Wires & Cables
  ['PVC Flexible House Wire', 'PVC Flexible Wire 1.0 sqmm', 'Kothari', '90 mtr coil - Red, Black, Green', 'Mtr', 90, 1380, 1, 16],
  ['PVC Flexible House Wire', 'PVC Flexible Wire 1.5 sqmm', 'Kothari', '90 mtr coil - Red, Black, Green', 'Mtr', 90, 2280, 1, 26],
  ['PVC Flexible House Wire', 'PVC Flexible Wire 2.5 sqmm', 'Kothari', '90 mtr coil - Red, Black, Green', 'Mtr', 90, 3480, 1, 40],
  ['PVC Flexible House Wire', 'PVC Flexible Wire 1.0 sqmm', 'R.R/Polycab', '90 mtr coil - Red, Black, Green', 'Mtr', 90, 2070, 1, 24],
  ['PVC Flexible House Wire', 'PVC Flexible Wire 1.5 sqmm', 'R.R/Polycab', '90 mtr coil - Red, Black, Green', 'Mtr', 90, 3048, 1, 35],
  ['PVC Flexible House Wire', 'PVC Flexible Wire 2.5 sqmm', 'R.R/Polycab', '90 mtr coil - Red, Black, Green', 'Mtr', 90, 4830, 1, 56],
  ['Other Wires', '2 Core Flat Wire 0.5 mm', '', '90 mtr', 'Mtr', null, null, null, null],
  ['Other Wires', 'Wire 24x20', '', '80 mtr', 'Mtr', null, null, null, null],
  ['Other Wires', 'Wire 32x20', '', '80 mtr', 'Mtr', null, null, null, null],
  ['Other Wires', 'Wire 1.0 sqmm', '', '', 'Mtr', null, null, null, null],
  ['Other Wires', 'Wire 1.5 sqmm', '', '', 'Mtr', null, null, null, null],
  ['Other Wires', 'Wire 2.5 sqmm', '', '', 'Mtr', null, null, null, null],
  ['Copper Wire', 'Copper Wire 16x20', '', '90 mtr coil', 'Mtr', 90, 900, 1, 10],
  ['Copper Wire', 'Copper Wire 24x20', '', '90 mtr coil', 'Mtr', 90, 1260, 1, 15],
  ['Copper Wire', 'Copper Wire 32x20', '', '90 mtr coil', 'Mtr', 90, 1740, 1, 20],
  ['Coaxial & Speaker Cable', 'RG-6 Cable Alloy', '', 'Alloy', 'Mtr', null, null, null, null],
  ['Coaxial & Speaker Cable', 'RG-6 Cable Copper', '', 'Copper, 70 mtr', 'Mtr', null, null, null, null],
  ['Coaxial & Speaker Cable', 'Speaker Wire 0.5 mm', '', '', 'Mtr', null, null, null, null],

  // ---- Hand Tools
  ['Hand Tools', 'Line Tester', 'Taparia', '', 'Nos', 1, 50, null, null],
  ['Hand Tools', 'Combination Plier 8"', 'Taparia', '8 inch', 'Nos', 1, 270, null, null],
  ['Hand Tools', 'Wire Stripper and Cutter', 'PYE', '', 'Nos', 1, 60, null, null],
  ['Hand Tools', 'Screw Driver Big', 'Taparia', '', 'Nos', 1, 100, null, null],
  ['Hand Tools', 'Screw Driver Small', 'Taparia', '', 'Nos', 1, 95, null, null],

  // ---- Batteries & AV Accessories
  ['Batteries & Cells', 'Pencil Cell AA', '', 'AA', 'Nos', 1, null, null, null],
  ['Batteries & Cells', 'Pencil Cell AAA', '', 'AAA', 'Nos', 1, null, null, null],
  ['Batteries & Cells', 'Battery 9V', '', '9V', 'Nos', 1, null, null, null],
  ['Batteries & Cells', 'Cell 2032 3V', '', '2032, 3V', 'Nos', 1, null, null, null],
  ['AV Cables', 'HDMI Cable', '', '', 'Nos', 1, null, null, null],
  ['AV Cables', 'RCA Cable', '', '', 'Nos', 1, null, null, null],
  ['AV Cables', 'Stereo To RCA Cable', '', '', 'Nos', null, null, null, null],
];

// sheet column labels "Brand" that are really a colour; kept in the spec column and noted
const colourAsBrand = new Set(['White', 'Red', 'Gray']);

const round2 = (n) => Math.round(n * 100) / 100;

function build() {
  const subToCat = new Map();
  taxonomy.forEach((c) => c.subs.forEach((s) => subToCat.set(s, c.name)));
  return rows.map((r, i) => {
    const [sub, name, brand, spec, unit, pq, pp, rq, rp, flags = {}] = r;
    if (!subToCat.has(sub)) throw new Error('Unknown subcategory ' + sub);
    const cost = pp != null && pq ? round2(pp / pq) : null;
    const sell = rp != null && rq && !flags.pack ? round2(rp / rq) : null;
    const notes = [];
    const sheet = [];
    if (pq != null || pp != null) sheet.push(`purchase Qty ${pq ?? '-'} ${unit} @ Rs ${pp ?? '-'}`);
    if (rq != null || rp != null) sheet.push(`retail Qty ${rq ?? '-'} @ Rs ${rp ?? '-'}`);
    if (sheet.length) notes.push('From price sheet: ' + sheet.join('; ') + '.');
    if (flags.pack) notes.push(`Bought by the packet; retail rate on the sheet is ${rq} pcs for Rs ${rp} (Rs ${round2(rp / rq)}/pc). Selling price per packet not set.`);
    if (flags.review) notes.push('CHECK: ' + flags.review);
    if (colourAsBrand.has(spec)) notes.push(`Sheet listed "${spec}" in the Brand column; kept as colour.`);
    return {
      seq: i + 1,
      category: subToCat.get(sub),
      subcategory: sub,
      name,
      brand,
      spec,
      unit,
      cost_price: cost,
      sell_price: sell,
      notes: notes.join(' '),
      review: flags.review || null,
    };
  });
}

module.exports = { taxonomy, build };
