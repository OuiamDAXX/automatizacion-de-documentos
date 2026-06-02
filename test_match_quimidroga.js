import fs from 'fs';
import { parseSupplierCoaText } from './src/utils/pdfParser.js';
import { INITIAL_PRODUCTS } from './src/data/initialSpecs.js';

const text = `--- Page 1 ---
Sales Specification
Glycol Ether DPM
Description Units Specification
Assay wt % 99.0 min.
Acidity wt % 0.01 max.
Water wt % 0.1 max.
Color Pt‐Co 15 max.
Distillation range 184-193
Density 25ºC (typical) g/cm3 0.95`;

const dpmProduct = INITIAL_PRODUCTS.find(p => p.id === 'glycol-ether-dpm');

if (dpmProduct) {
  const result = parseSupplierCoaText(text, dpmProduct.specs);
  console.log("Matching results for Glycol Ether DPM specs:");
  console.log(JSON.stringify(result, null, 2));
} else {
  print("Glycol Ether DPM product not found in database.");
}
