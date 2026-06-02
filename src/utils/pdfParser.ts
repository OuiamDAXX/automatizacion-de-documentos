import * as pdfjsLib from 'pdfjs-dist';
import PDFWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { type SpecItem, type ProductSpec } from '../data/initialSpecs';

// Set up the PDF.js worker from local bundle (no CDN dependency)
pdfjsLib.GlobalWorkerOptions.workerSrc = PDFWorker;

export function normalizeDashes(str: string): string {
  return str.replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, '-');
}

export function stripAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}


export interface ParsedSupplierSpec {
  name: string;
  rawValue: string;
  value: number | string;
  unit: string;
  type: 'numeric' | 'text';
}

export interface ComparisonResult {
  spec: SpecItem;
  supplierData: ParsedSupplierSpec | null;
  status: 'CONFORME' | 'NON_CONFORME' | 'MANQUANT';
  convertedValue: number | string | null;
  convertedUnit: string | null;
  explanation: string;
}

/**
 * Reconstructs lines of text from PDF.js items based on their coordinates.
 * This resolves the issue where tabular elements are split into separate lines.
 */
function reconstructLinesFromItems(items: any[]): string {
  const textItems = items.filter(
    (item: any) => item && typeof item.str === 'string' && Array.isArray(item.transform)
  );

  if (textItems.length === 0) {
    return items.map((item: any) => item.str || '').join('\n');
  }

  // Group items by Y coordinate with a tolerance of 4 units (approx height of text line)
  const tolerance = 4;
  const lineGroups: { y: number; items: any[] }[] = [];

  for (const item of textItems) {
    const y = item.transform[5];
    let group = lineGroups.find(g => Math.abs(g.y - y) <= tolerance);
    if (!group) {
      group = { y, items: [] };
      lineGroups.push(group);
    }
    group.items.push(item);
  }

  // Sort groups from top to bottom (Y descending)
  lineGroups.sort((a, b) => b.y - a.y);

  // Sort items in each group from left to right (X ascending) and join them
  const lines = lineGroups.map(group => {
    group.items.sort((a, b) => a.transform[4] - b.transform[4]);
    
    let lineText = '';
    for (let i = 0; i < group.items.length; i++) {
      const item = group.items[i];
      if (i === 0) {
        lineText = item.str;
      } else {
        const prevItem = group.items[i - 1];
        const prevEndX = prevItem.transform[4] + (prevItem.width || 0);
        const currentStartX = item.transform[4];
        const gap = currentStartX - prevEndX;
        
        // Add space if there is a gap > 2 units and neither side has spacing
        if (gap > 2 && !prevItem.str.endsWith(' ') && !item.str.startsWith(' ')) {
          lineText += ' ' + item.str;
        } else {
          lineText += item.str;
        }
      }
    }
    return lineText;
  });

  return lines.join('\n');
}

/**
 * Extracts all text page-by-page from a PDF file.
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = reconstructLinesFromItems(textContent.items);
      fullText += `--- PAGE ${i} ---\n${pageText}\n`;
    }
    return fullText;
  } catch (error: any) {
    console.error('Error extracting PDF text:', error);
    const msg = error?.message || '';
    if (msg.includes('Invalid PDF') || msg.includes('Missing PDF')) {
      throw new Error('Invalid PDF file. Please make sure the file is a valid PDF document.');
    } else if (msg.includes('password')) {
      throw new Error('This PDF is password-protected. Please provide an unprotected version.');
    } else {
      throw new Error('Unable to read the PDF file. Make sure it is a valid text-based PDF (not a scanned image-only document).');
    }
  }
}

/**
 * Check if a synonym matches a line, using smart word boundaries.
 */
export function matchSynonymInLine(line: string, synonym: string): boolean {
  const cleanLine = stripAccents(normalizeDashes(line));
  const cleanSynonym = stripAccents(normalizeDashes(synonym));
  const escapedSynonym = cleanSynonym.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const startBoundary = /^\w/.test(cleanSynonym) ? '\\b' : '';
  const endBoundary = /\w$/.test(cleanSynonym) ? '\\b' : '';
  const regex = new RegExp(`${startBoundary}${escapedSynonym}${endBoundary}`, 'i');
  return regex.test(cleanLine);
}

/**
 * Parses numeric value from a line of text, identifying the supplier's result vs spec limits.
 */
export function extractNumericValueFromLine(line: string, defaultUnit: string): { value: number; unit: string } | null {
  const regex = /([\d.,]+)\s*(%|ppm|pt-co|g\/cm3)?/gi;
  const matches: { value: number; unit: string; startIndex: number; endIndex: number }[] = [];
  
  let match;
  while ((match = regex.exec(line)) !== null) {
    // Replace commas with periods to parse floating numbers (e.g. "1,432" -> "1.432")
    const valStr = match[1].replace(',', '.');
    const valNum = parseFloat(valStr);
    if (!isNaN(valNum)) {
      const unit = match[2] || '';
      matches.push({
        value: valNum,
        unit: unit,
        startIndex: match.index,
        endIndex: regex.lastIndex
      });
    }
  }

  if (matches.length === 0) return null;
  if (matches.length === 1) {
    let unit = matches[0].unit;
    if (!unit) {
      if (/\bppm\b/i.test(line)) unit = 'ppm';
      else if (/%/i.test(line)) unit = '%';
      else unit = defaultUnit;
    }
    return { value: matches[0].value, unit };
  }

  // Score candidates to distinguish actual result from specification limit
  const scoredMatches = matches.map(m => {
    let score = 0;
    const contextBefore = line.substring(Math.max(0, m.startIndex - 15), m.startIndex).toLowerCase();
    const contextAfter = line.substring(m.endIndex, Math.min(line.length, m.endIndex + 15)).toLowerCase();

    // Penalize if near limit keywords
    const limitKeywords = ['>=', '<=', '>', '<', 'min', 'max', 'limit', 'spec', 'standard', 'norm', 'requis', 'range', 'limite'];
    for (const kw of limitKeywords) {
      if (contextBefore.includes(kw)) score -= 10;
      if (contextAfter.includes(kw)) score -= 10;
    }

    // Boost if near result keywords
    const resultKeywords = ['result', 'found', 'value', 'actual', 'analysis', 'valeur', 'mesuré', 'trouvé', 'obtenu'];
    for (const kw of resultKeywords) {
      if (contextBefore.includes(kw)) score += 5;
      if (contextAfter.includes(kw)) score += 5;
    }

    // Boost if unit matches the expected spec unit
    if (m.unit && defaultUnit && m.unit.toLowerCase() === defaultUnit.toLowerCase()) {
      score += 15;
    }

    // Prefer values appearing later on the line (standard column layout has results on the right)
    score += (m.startIndex / line.length) * 2;

    return { match: m, score };
  });

  scoredMatches.sort((a, b) => b.score - a.score);
  const best = scoredMatches[0].match;
  
  let unit = best.unit;
  if (!unit) {
    if (/\bppm\b/i.test(line)) unit = 'ppm';
    else if (/%/i.test(line)) unit = '%';
    else unit = defaultUnit;
  }

  return { value: best.value, unit };
}

/**
 * Parses the extracted text to match the specifications of a Daxx product.
 */
export function parseSupplierCoaText(text: string, daxxSpecs: SpecItem[]): Record<string, ParsedSupplierSpec> {
  const results: Record<string, ParsedSupplierSpec> = {};
  const lines = text.split('\n').map(line => normalizeDashes(line.trim())).filter(line => line.length > 0);

  // Method pattern to strip from the end of the line
  const methodRegex = /\s+\b(?:dax|dowm|astm|din|iso|sms|uop|en|aocs|gc|hplc|method|méthode)\b\s+[a-z0-9\-\/._+]+(?:\s+[a-z0-9\-\/._+]+)*\s*$/i;

  for (const spec of daxxSpecs) {
    let bestLine = '';
    let bestScore = -999;

    for (const line of lines) {
      let matchedSynonym = '';
      for (const synonym of spec.synonyms) {
        if (matchSynonymInLine(line, synonym)) {
          matchedSynonym = synonym;
          break;
        }
      }

      if (matchedSynonym) {
        let score = 0;
        const lowerLine = line.toLowerCase();

        // Boost if the line contains a known method prefix
        if (/\b(?:dowm|astm|din|iso|sms|uop|en|aocs|gc|hplc|epa|usp|ip|bp|ph\.?\s*eur)\b/i.test(lowerLine)) {
          score += 15;
        }

        // Penalize if the line looks like document metadata
        const metadataKeywords = ['product', 'customer', 'delivery', 'order', 'container', 'batch', 'po-us', 'po number', 'date', 'shipping', 'quantity', 'weight', 'page', 'shipped', 'specification number', 'client', 'adresse', 'street', 'tel:', 'fax:'];
        for (const kw of metadataKeywords) {
          if (lowerLine.includes(kw)) {
            score -= 10;
          }
        }

        // Penalize if table header
        const headerKeywords = ['description units', 'units specification', 'typical values', 'test method', 'specification limit', 'specification range'];
        for (const kw of headerKeywords) {
          if (lowerLine.includes(kw)) {
            score -= 100;
          }
        }

        // Penalize if certificate title
        if (lowerLine.includes('certificate of analysis') || lowerLine.includes('bulletin d\'analyse') || lowerLine.includes('certificat d\'analyse')) {
          score -= 20;
        }

        // Boost if it contains the spec unit
        if (spec.unit && new RegExp(`\\b${spec.unit.replace(/%/g, '\\%')}\\b`, 'i').test(lowerLine)) {
          score += 5;
        }

        // Boost if synonym is closer to the start
        const synonymIndex = lowerLine.indexOf(matchedSynonym.toLowerCase());
        if (synonymIndex !== -1) {
          score += (1 - synonymIndex / line.length) * 5;
        }

        if (score > bestScore) {
          bestScore = score;
          bestLine = line;
        }
      }
    }

    if (bestLine && bestScore > -50) {
      let cleanLine = bestLine.replace(/^\d+\s+/, '');
      cleanLine = cleanLine.replace(methodRegex, '').trim();

      // Find the matched synonym again for this best line to slice the value part
      let matchedSynonym = '';
      for (const synonym of spec.synonyms) {
        if (matchSynonymInLine(cleanLine, synonym)) {
          matchedSynonym = synonym;
          break;
        }
      }

      let valPart = '';
      if (matchedSynonym) {
        const synonymIndex = cleanLine.toLowerCase().indexOf(matchedSynonym.toLowerCase());
        if (synonymIndex !== -1) {
          valPart = cleanLine.slice(synonymIndex + matchedSynonym.length).trim();
          valPart = valPart.replace(/^[:\-\|=\s]+/, '').trim();
        }
      }
      const textToAnalyze = valPart || cleanLine;

      if (spec.limitType === 'text' || spec.limitType === 'range') {
        const rangeRegex = /^([\d.,]+)\s*[-–—]\s*([\d.,\-]+)$/;
        const rangeMatch = textToAnalyze.match(rangeRegex);
        if (rangeMatch) {
          results[spec.id] = {
            name: spec.name,
            rawValue: bestLine,
            value: textToAnalyze,
            unit: spec.unit || '',
            type: 'text'
          };
        } else {
          const numMatch = extractNumericValueFromLine(textToAnalyze, spec.unit);
          results[spec.id] = {
            name: spec.name,
            rawValue: bestLine,
            value: numMatch ? numMatch.value : textToAnalyze,
            unit: numMatch ? numMatch.unit : (spec.unit || 'Visual'),
            type: numMatch ? 'numeric' : 'text'
          };
        }
      } else {
        const numMatch = extractNumericValueFromLine(textToAnalyze, spec.unit);
        if (numMatch) {
          results[spec.id] = {
            name: spec.name,
            rawValue: bestLine,
            value: numMatch.value,
            unit: numMatch.unit,
            type: 'numeric'
          };
        }
      }
    }
  }

  return results;
}

/**
 * Conversions: PPM to Percentage (%peso) and vice versa.
 */
export function convertUnits(val: number, fromUnit: string, toUnit: string): { value: number; unit: string } {
  const normalize = (u: string) => {
    const l = u.toLowerCase();
    if (l.includes('%') || l.includes('percent')) return '%peso';
    if (l.includes('ppm')) return 'ppm';
    return l;
  };

  const fUnit = normalize(fromUnit);
  const tUnit = normalize(toUnit);

  if (fUnit === tUnit) {
    return { value: val, unit: toUnit };
  }

  // PPM to %
  if (fUnit === 'ppm' && tUnit === '%peso') {
    return { value: val / 10000.0, unit: toUnit };
  }

  // % to PPM
  if (fUnit === '%peso' && tUnit === 'ppm') {
    return { value: val * 10000.0, unit: toUnit };
  }

  return { value: val, unit: fromUnit };
}

/**
 * Runs the full comparison between Daxx and supplier specs.
 */
export function compareSpecifications(daxxSpecs: SpecItem[], supplierSpecs: Record<string, ParsedSupplierSpec>): ComparisonResult[] {
  return daxxSpecs.map(daxxSpec => {
    const supplierData = supplierSpecs[daxxSpec.id] || null;

    if (!supplierData) {
      return {
        spec: daxxSpec,
        supplierData: null,
        status: 'MANQUANT',
        convertedValue: null,
        convertedUnit: null,
        explanation: 'This parameter was not found in the supplier Certificate of Analysis.'
      };
    }

    if (daxxSpec.limitType === 'range') {
      const sValStr = String(supplierData.value).trim();
      const rangeRegex = /^([\d.,]+)\s*[-–—]\s*([\d.,\-]+)$/;

      const daxxRangeMatch = String(daxxSpec.value).trim().replace(/–/g, '-').match(rangeRegex);
      const supplierRangeMatch = sValStr.replace(/–/g, '-').match(rangeRegex);

      if (daxxRangeMatch) {
        const dMin = parseFloat(daxxRangeMatch[1].replace(',', '.'));
        const dMax = parseFloat(daxxRangeMatch[2].replace(',', '.'));

        let sMin = NaN;
        let sMax = NaN;

        if (supplierRangeMatch) {
          sMin = parseFloat(supplierRangeMatch[1].replace(',', '.'));
          sMax = parseFloat(supplierRangeMatch[2].replace(',', '.'));
        } else {
          const sNum = parseFloat(sValStr.replace(',', '.'));
          if (!isNaN(sNum)) {
            sMin = sNum;
            sMax = sNum;
          }
        }

        if (!isNaN(dMin) && !isNaN(dMax) && !isNaN(sMin) && !isNaN(sMax)) {
          let convertedMin = sMin;
          let convertedMax = sMax;
          if (supplierData.type === 'numeric' && typeof supplierData.value === 'number') {
            const converted = convertUnits(supplierData.value, supplierData.unit, daxxSpec.unit);
            convertedMin = converted.value;
            convertedMax = converted.value;
          }

          const isOk = convertedMin >= dMin && convertedMax <= dMax;

          let explanation = '';
          if (supplierData.type === 'numeric' && supplierData.unit.toLowerCase() !== daxxSpec.unit.toLowerCase()) {
            explanation = `Unit conversion applied: ${supplierData.value} ${supplierData.unit} ➔ ${convertedMin.toFixed(4)} ${daxxSpec.unit}. `;
          }
          explanation += isOk
            ? `The measured range/value [${convertedMin} - ${convertedMax}] ${daxxSpec.unit} is within the Daxx standard range [${dMin} - ${dMax}] ${daxxSpec.unit}.`
            : `DISCREPANCY DETECTED! The measured range/value [${convertedMin} - ${convertedMax}] ${daxxSpec.unit} is outside the Daxx standard range [${dMin} - ${dMax}] ${daxxSpec.unit}.`;

          return {
            spec: daxxSpec,
            supplierData,
            status: isOk ? 'CONFORME' : 'NON_CONFORME',
            convertedValue: sValStr,
            convertedUnit: daxxSpec.unit,
            explanation
          };
        }
      }
    }

    if (daxxSpec.limitType === 'text') {
      const sValStr = String(supplierData.value).trim();
      const sValLower = sValStr.toLowerCase();

      // Check if daxxSpec.value is a range (e.g., "10 - 20" or "6.5 - 8.5")
      const rangeRegex = /^([\d.,]+)\s*[-–—]\s*([\d.,\-]+)$/;
      const rangeMatch = String(daxxSpec.value).trim().match(rangeRegex);

      if (rangeMatch) {
        const minVal = parseFloat(rangeMatch[1].replace(',', '.'));
        
        let maxValStr = rangeMatch[2].replace(',', '.');
        if (maxValStr.includes('-') && !maxValStr.startsWith('-')) {
          maxValStr = maxValStr.replace('-', '.');
        }
        const maxVal = parseFloat(maxValStr);

        const supplierVal = parseFloat(sValStr.replace(',', '.'));

        if (!isNaN(minVal) && !isNaN(maxVal) && !isNaN(supplierVal)) {
          // Perform unit conversion if supplier data is numeric and has a unit
          let convertedVal = supplierVal;
          if (supplierData.type === 'numeric' && typeof supplierData.value === 'number') {
            const converted = convertUnits(supplierData.value, supplierData.unit, daxxSpec.unit);
            convertedVal = converted.value;
          }

          const isOk = convertedVal >= minVal && convertedVal <= maxVal;

          let explanation = '';
          if (supplierData.type === 'numeric' && supplierData.unit.toLowerCase() !== daxxSpec.unit.toLowerCase()) {
            explanation = `Unit conversion applied: ${supplierData.value} ${supplierData.unit} ➔ ${convertedVal.toFixed(4)} ${daxxSpec.unit}. `;
          }
          explanation += isOk 
            ? `The measured value of ${convertedVal} ${daxxSpec.unit} is within the Daxx standard range of ${daxxSpec.value} ${daxxSpec.unit}.`
            : `DISCREPANCY DETECTED! The measured value of ${convertedVal} ${daxxSpec.unit} is outside the Daxx standard range of ${daxxSpec.value} ${daxxSpec.unit}.`;

          return {
            spec: daxxSpec,
            supplierData,
            status: isOk ? 'CONFORME' : 'NON_CONFORME',
            convertedValue: convertedVal,
            convertedUnit: daxxSpec.unit,
            explanation
          };
        }
      }

      // Basic text heuristic compliance
      let isOk = false;
      if (sValLower.includes('clean') || sValLower.includes('clear') || sValLower.includes('libre') || sValLower.includes('limpio') || sValLower.includes('colourless') || sValLower.includes('sin color') || sValLower.includes('pass') || sValLower.includes('conforme') || sValLower.includes('conforme a')) {
        isOk = true;
      }

      return {
        spec: daxxSpec,
        supplierData,
        status: isOk ? 'CONFORME' : 'NON_CONFORME',
        convertedValue: supplierData.value,
        convertedUnit: 'Visual',
        explanation: isOk 
          ? `The appearance '${supplierData.value}' complies with Daxx requirements.` 
          : `The appearance '${supplierData.value}' does not match the Daxx specification of '${daxxSpec.value}'.`
      };
    } else {
      // Numeric comparison
      const sVal = supplierData.value as number;
      const sUnit = supplierData.unit;

      const converted = convertUnits(sVal, sUnit, daxxSpec.unit);
      const convertedVal = converted.value;
      
      let daxxLimit = daxxSpec.value as number;
      // Handle potential string spec value by parsing it (e.g. "99.0" or similar)
      if (typeof daxxSpec.value === 'string') {
        const parsedLimit = parseFloat(daxxSpec.value);
        if (!isNaN(parsedLimit)) {
          daxxLimit = parsedLimit;
        }
      }
      
      let isOk = true;
      const limitType = daxxSpec.limitType;

      if (limitType === 'min') {
        isOk = convertedVal >= daxxLimit;
      } else if (limitType === 'max') {
        isOk = convertedVal <= daxxLimit;
      }

      let explanation = '';
      if (sUnit.toLowerCase() !== daxxSpec.unit.toLowerCase()) {
        explanation = `Unit conversion applied: ${sVal} ${sUnit} ➔ ${convertedVal.toFixed(4)} ${daxxSpec.unit}. `;
      }

      const compText = limitType === 'min' ? 'greater than or equal to (>=)' : 'less than or equal to (<=)';
      
      if (isOk) {
        explanation += `The measured value of ${convertedVal} ${daxxSpec.unit} is ${compText} the Daxx standard (${daxxLimit} ${daxxSpec.unit}).`;
      } else {
        explanation += `DISCREPANCY DETECTED! The measured value of ${convertedVal} ${daxxSpec.unit} is ${limitType === 'min' ? 'below the minimum requirement' : 'above the maximum limit'} of ${daxxLimit} ${daxxSpec.unit}.`;
      }

      return {
        spec: daxxSpec,
        supplierData,
        status: isOk ? 'CONFORME' : 'NON_CONFORME',
        convertedValue: convertedVal,
        convertedUnit: daxxSpec.unit,
        explanation
      };
    }
  });
}

/**
 * Auto-detects the product from extracted PDF text using scoring and synonyms.
 */
export function detectProductFromText(text: string, products: ProductSpec[]): ProductSpec | undefined {
  const cleanText = stripAccents(text);
  const upperText = cleanText.toUpperCase();
  const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let detectedProd: ProductSpec | undefined = undefined;

  // 1. Try to find product labels at the beginning of lines (highest precision)
  const lines = cleanText.split('\n');
  const productHeaders = [
    /product\s*:\s*([^\n]+)/i,
    /product\s+name\s*:\s*([^\n]+)/i,
    /producto\s*:\s*([^\n]+)/i,
    /nombre\s+del\s+producto\s*:\s*([^\n]+)/i,
    /produto\s*:\s*([^\n]+)/i,
    /nome\s+do\s+produto\s*:\s*([^\n]+)/i,
    /description\s*:\s*([^\n]+)/i,
    /descripción\s*:\s*([^\n]+)/i,
    /descrição\s*:\s*([^\n]+)/i,
    /articulo\s*:\s*([^\n]+)/i,
    /artigo\s*:\s*([^\n]+)/i,
  ];

  for (const line of lines) {
    for (const regex of productHeaders) {
      const match = line.match(regex);
      if (match) {
        const lineValue = stripAccents(match[1]).trim().toUpperCase();
        // Check if any product's synonyms match inside this specific product line
        for (const p of products) {
          const syns = [...(p.synonyms || []), p.name];
          if (p.dbProductName) syns.push(p.dbProductName);
          if (p.netsuiteProductName) syns.push(p.netsuiteProductName);
          syns.sort((a, b) => b.length - a.length);
          for (const syn of syns) {
            const cleanSyn = stripAccents(syn);
            const rx = new RegExp('\\b' + escapeRegExp(cleanSyn) + '\\b', 'i');
            if (rx.test(lineValue)) {
              detectedProd = p;
              break;
            }
          }
          if (detectedProd) break;
        }
      }
      if (detectedProd) break;
    }
    if (detectedProd) break;
  }

  // 2. Scan the whole text if not matched by label (with word boundaries and scoring)
  if (!detectedProd) {
    const scores: { product: ProductSpec; score: number; maxLen: number }[] = [];

    for (const p of products) {
      const allSyns = [...(p.synonyms || []), p.name];
      if (p.dbProductName) allSyns.push(p.dbProductName);
      if (p.netsuiteProductName) allSyns.push(p.netsuiteProductName);
      const syns = Array.from(new Set(allSyns));
      syns.sort((a, b) => b.length - a.length);

      let matchCount = 0;
      let longestMatchLen = 0;

      for (const syn of syns) {
        const cleanSyn = stripAccents(syn);
        const isShort = cleanSyn.length <= 3;
        const escaped = escapeRegExp(cleanSyn);
        const rx = new RegExp(isShort ? '\\b' + escaped + '\\b' : escaped, 'gi');
        
        const matches = upperText.match(rx);
        if (matches) {
          matchCount += matches.length;
          if (cleanSyn.length > longestMatchLen) {
            longestMatchLen = cleanSyn.length;
          }
        }
      }

      if (matchCount > 0) {
        scores.push({
          product: p,
          score: matchCount,
          maxLen: longestMatchLen
        });
      }
    }

    if (scores.length > 0) {
      scores.sort((a, b) => {
        if (b.maxLen !== a.maxLen) {
          return b.maxLen - a.maxLen;
        }
        return b.score - a.score;
      });
      detectedProd = scores[0].product;
    }
  }

  // 3. Fallback: match by parts of the product name with word boundaries
  if (!detectedProd) {
    detectedProd = products.find(p => {
      const namesToCheck = [p.name];
      if (p.dbProductName) namesToCheck.push(p.dbProductName);
      if (p.netsuiteProductName) namesToCheck.push(p.netsuiteProductName);

      return namesToCheck.some(name => {
        const cleanName = stripAccents(name)
          .replace(/\s*\([^)]+\)/g, '')
          .replace(/,\s*Industrial Grade/gi, '')
          .replace(/\s*Industrial Grade/gi, '')
          .replace(/-\s*Commercial Grade/gi, '')
          .trim();

        if (cleanName.length > 3) {
          const rx = new RegExp('\\b' + escapeRegExp(cleanName) + '\\b', 'i');
          return rx.test(upperText);
        }
        return false;
      });
    });
  }

  return detectedProd;
}

export interface ParsedSpecLimit {
  name: string;
  rawValue: string;
  value: string | number;
  unit: string;
  limitType: 'min' | 'max' | 'text' | 'range';
}

/**
 * Parses the extracted text to match and extract specification limits of a Daxx product
 * from a supplier or customer specification sheet (datasheet) rather than a COA.
 */
export function parseSpecificationPdfText(text: string, daxxSpecs: SpecItem[]): Record<string, ParsedSpecLimit> {
  const results: Record<string, ParsedSpecLimit> = {};
  const lines = text.split('\n').map(line => normalizeDashes(line.trim())).filter(line => line.length > 0);
  
  const methodRegex = /\s+\b(?:dax|dowm|astm|din|iso|sms|uop|en|aocs|gc|hplc|method|méthode)\b\s+[a-z0-9\-\/._+]+(?:\s+[a-z0-9\-\/._+]+)*\s*$/i;

  for (const spec of daxxSpecs) {
    let bestLine = '';
    let bestScore = -999;

    for (const line of lines) {
      let matchedSynonym = '';
      for (const synonym of spec.synonyms) {
        if (matchSynonymInLine(line, synonym)) {
          matchedSynonym = synonym;
          break;
        }
      }

      if (matchedSynonym) {
        let score = 0;
        const lowerLine = line.toLowerCase();

        if (/\b(?:dowm|astm|din|iso|sms|uop|en|aocs|gc|hplc|epa|usp|ip|bp|ph\.?\s*eur)\b/i.test(lowerLine)) {
          score += 15;
        }

        const metadataKeywords = [
          'product', 'customer', 'delivery', 'order', 'container', 'batch', 'po-us', 'po number', 'date', 'shipping', 'quantity', 'weight', 'page', 'shipped', 'specification number', 'client', 'adresse', 'street', 'tel:', 'fax:',
          // Table headers
          'description units', 'units specification', 'typical values', 'test method'
        ];
        for (const kw of metadataKeywords) {
          if (lowerLine.includes(kw)) {
            score -= 100;
          }
        }

        if (lowerLine.includes('certificate of analysis') || lowerLine.includes('bulletin d\'analyse') || lowerLine.includes('certificat d\'analyse')) {
          score -= 20;
        }

        if (spec.unit && new RegExp(`\\b${spec.unit.replace(/%/g, '\\%')}\\b`, 'i').test(lowerLine)) {
          score += 5;
        }

        const synonymIndex = lowerLine.indexOf(matchedSynonym.toLowerCase());
        if (synonymIndex !== -1) {
          score += (1 - synonymIndex / line.length) * 5;
        }

        if (score > bestScore) {
          bestScore = score;
          bestLine = line;
        }
      }
    }

    if (bestLine && bestScore > -50) {
      let cleanLine = bestLine.replace(/^\d+\s+/, '');
      cleanLine = cleanLine.replace(methodRegex, '').trim();

      // Find the matched synonym again for this best line
      let matchedSynonym = '';
      for (const synonym of spec.synonyms) {
        if (matchSynonymInLine(cleanLine, synonym)) {
          matchedSynonym = synonym;
          break;
        }
      }

      let valPart = '';
      if (matchedSynonym) {
        const synonymIndex = cleanLine.toLowerCase().indexOf(matchedSynonym.toLowerCase());
        if (synonymIndex !== -1) {
          valPart = cleanLine.slice(synonymIndex + matchedSynonym.length).trim();
          valPart = valPart.replace(/^[:\-\|=\s]+/, '').trim();
        }
      }
      const textToAnalyze = valPart || cleanLine;
      const lowerText = textToAnalyze.toLowerCase();

      // 1. Detect Range
      const rangeRegex = /(\d+(?:[.,]\d+)?)\s*[-–—]\s*(\d+(?:[.,]\d+)?)/;
      const rangeMatch = textToAnalyze.match(rangeRegex);

      if (rangeMatch) {
        results[spec.id] = {
          name: spec.name,
          rawValue: bestLine,
          value: `${rangeMatch[1]} - ${rangeMatch[2]}`,
          unit: spec.unit || '',
          limitType: 'range'
        };
      } 
      // 2. Detect Text-based parameters (e.g. Appearance, Color description if no numbers)
      else if (spec.limitType === 'text' && !/\d/.test(textToAnalyze)) {
        results[spec.id] = {
          name: spec.name,
          rawValue: bestLine,
          value: textToAnalyze,
          unit: spec.unit || 'Visual',
          limitType: 'text'
        };
      }
      // 3. Detect Numeric Limits
      else {
        // Find all numbers in the text, but ignore temperatures (e.g. 20C, 25C, 20°C, 25ºC)
        const numberRegex = /([\d.,]+)/g;
        const matches: string[] = [];
        let match;
        while ((match = numberRegex.exec(textToAnalyze)) !== null) {
          const numStr = match[1];
          if (!/\d/.test(numStr)) {
            continue;
          }
          // Check if this number is followed by degree or Celsius indicators
          const index = match.index;
          const afterText = textToAnalyze.substring(index + numStr.length, index + numStr.length + 6).toLowerCase();
          if (afterText.includes('°') || afterText.includes('º') || afterText.includes('c') || afterText.includes('f')) {
            // Probably a temperature, ignore it
            continue;
          }
          matches.push(numStr);
        }

        if (matches.length > 0) {
          // Take the last valid number (which represents the limit)
          const valueStr = matches[matches.length - 1];
          const valNum = parseFloat(valueStr.replace(',', '.'));

          let limitType: 'min' | 'max' | 'text' | 'range' = spec.limitType;
          if (lowerText.includes('min') || lowerText.includes('>=') || lowerText.includes('≥') || lowerText.includes('>')) {
            limitType = 'min';
          } else if (lowerText.includes('max') || lowerText.includes('<=') || lowerText.includes('≤') || lowerText.includes('<')) {
            limitType = 'max';
          }

          results[spec.id] = {
            name: spec.name,
            rawValue: bestLine,
            value: isNaN(valNum) ? valueStr : valNum,
            unit: spec.unit || '',
            limitType
          };
        } else {
          // Fallback: treat as text
          results[spec.id] = {
            name: spec.name,
            rawValue: bestLine,
            value: textToAnalyze,
            unit: spec.unit || 'Visual',
            limitType: 'text'
          };
        }
      }
    }
  }

  return results;
}

