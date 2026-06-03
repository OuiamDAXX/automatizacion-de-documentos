import { useState, useRef } from 'react';
import { type ProductSpec, type SpecItem } from '../data/initialSpecs';
import { 
  extractTextFromPdf, 
  parseSupplierCoaText, 
  compareSpecifications, 
  detectProductFromText,
  type ComparisonResult 
} from '../utils/pdfParser';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  ChevronDown,
  Info,
  Copy,
  Check,
  Printer,
  X
} from 'lucide-react';

import EmailGenerator from './EmailGenerator';

interface ComparatorProps {
  products: ProductSpec[];
  selectedProductId: string;
  onSelectProduct: (id: string) => void;
}

export default function Comparator({ products, selectedProductId, onSelectProduct }: ComparatorProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawText, setRawText] = useState<string>('');
  const [comparisonResults, setComparisonResults] = useState<ComparisonResult[] | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Phase 2 states
  const [selectedClientId, setSelectedClientId] = useState<string>('standard');
  const [showCoaModal, setShowCoaModal] = useState(false);
  
  // COA Metadata State
  const [lotNumber, setLotNumber] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [analystName, setAnalystName] = useState('Quality Control Manager');
  const [analysisDate, setAnalysisDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [internalOrder, setInternalOrder] = useState('');
  const [transportType, setTransportType] = useState<'Isotank' | 'Vehicle'>('Isotank');
  
  // COA Results State
  const [coaResults, setCoaResults] = useState<any[]>([]);



  const activeProduct = products.find(p => p.id === selectedProductId) || products[0];

  // Helper to compile the active specifications (standard + overrides + extras)
  const getSpecsToCompare = (product: ProductSpec, clientId: string) => {
    if (!clientId || clientId === 'standard') {
      return product.specs;
    }
    const clientSpec = product.clientSpecs?.find(c => c.customerId === clientId);
    if (!clientSpec) {
      return product.specs;
    }

    // Standard specs, modified if overridden
    const activeSpecs: SpecItem[] = product.specs.map(spec => {
      const override = clientSpec.specs.find(s => s.specId === spec.id && !(s as any).isExtra);
      if (override) {
        return {
          ...spec,
          value: override.value,
          limitType: override.limitType,
          isOverride: true
        };
      }
      return spec;
    });

    // Client-specific extra specs
    const extraSpecs = clientSpec.specs.filter(s => (s as any).isExtra);
    extraSpecs.forEach(extra => {
      activeSpecs.push({
        id: extra.specId,
        name: (extra as any).name || '',
        unit: (extra as any).unit || '',
        value: extra.value,
        limitType: extra.limitType,
        synonyms: (extra as any).synonyms || [],
        isExtra: true
      });
    });

    return activeSpecs;
  };

  const runComparison = (text: string, product: ProductSpec, clientId: string) => {
    const specsToCompare = getSpecsToCompare(product, clientId);
    const supplierSpecs = parseSupplierCoaText(text, specsToCompare);
    const results = compareSpecifications(specsToCompare, supplierSpecs);
    setComparisonResults(results);
  };


  const handleCopyToClipboard = () => {
    if (!comparisonResults) return;
    
    const clientName = selectedClientId && selectedClientId !== 'standard'
      ? activeProduct.clientSpecs?.find(c => c.customerId === selectedClientId)?.customerName || 'Client'
      : 'Standard Daxx';

    // 1. Plain text format (TSV for easy paste into Excel / Sheets / text documents)
    let plainText = `COA Compliance Report - ${activeProduct.name}\n`;
    plainText += `File: ${file?.name || ''}\n`;
    plainText += `Profile: ${clientName}\n`;
    plainText += `Global Status: ${globalStatus === 'CONFORME' ? 'COMPLIANT' : globalStatus === 'NON_CONFORME' ? 'DEVIATION' : 'INCOMPLETE'}\n\n`;
    
    plainText += `Parameter\tRequired Limit\tCOA Value\tStatus\tExplanation\n`;
    
    comparisonResults.forEach(row => {
      const standardVal = row.spec.limitType === 'text'
        ? row.spec.value
        : row.spec.limitType === 'range'
          ? `${row.spec.value} ${row.spec.unit}`
          : `${row.spec.limitType === 'min' ? '≥' : '≤'} ${row.spec.value} ${row.spec.unit}`;
      const supplierVal = row.supplierData !== null ? `${row.supplierData.value} ${row.supplierData.unit}` : 'Not detected';
      const statusText = row.status === 'CONFORME' ? '✅ Compliant' : row.status === 'NON_CONFORME' ? '❌ Deviation' : '⚠️ Missing';
      
      plainText += `${row.spec.name}\t${standardVal}\t${supplierVal}\t${statusText}\t${row.explanation}\n`;
    });

    // 2. HTML format (Rich formatted table for mail clients, Word, Teams, and Excel)
    let htmlText = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155; line-height: 1.5;">`;
    htmlText += `<h3 style="margin: 0 0 4px 0; color: #1e293b; font-size: 16px;">COA Compliance Report - ${activeProduct.name}</h3>`;
    htmlText += `<p style="margin: 2px 0; font-size: 13px; color: #64748b;"><b>File:</b> ${file?.name || ''}</p>`;
    htmlText += `<p style="margin: 2px 0; font-size: 13px; color: #64748b;"><b>Profile:</b> ${clientName}</p>`;
    const statusColor = globalStatus === 'CONFORME' ? '#059669' : globalStatus === 'NON_CONFORME' ? '#dc2626' : '#d97706';
    const statusText = globalStatus === 'CONFORME' ? 'COMPLIANT' : globalStatus === 'NON_CONFORME' ? 'DEVIATION' : 'INCOMPLETE';
    htmlText += `<p style="margin: 2px 0 16px 0; font-size: 13px; color: #64748b;"><b>Global Status:</b> <span style="color: ${statusColor}; font-weight: bold;">${statusText}</span></p>`;
    
    htmlText += `<table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; border: 1px solid #e2e8f0; font-size: 13px; width: 100%; max-width: 800px; color: #334155;">`;
    htmlText += `<thead style="background-color: #f8fafc; font-weight: bold; text-align: left; color: #475569;">`;
    htmlText += `<tr>`;
    htmlText += `<th style="border: 1px solid #e2e8f0;">Parameter</th>`;
    htmlText += `<th style="border: 1px solid #e2e8f0;">Required Limit</th>`;
    htmlText += `<th style="border: 1px solid #e2e8f0;">COA Value</th>`;
    htmlText += `<th style="border: 1px solid #e2e8f0;">Status</th>`;
    htmlText += `<th style="border: 1px solid #e2e8f0;">Explanation</th>`;
    htmlText += `</tr>`;
    htmlText += `</thead>`;
    htmlText += `<tbody>`;
    
    comparisonResults.forEach(row => {
      const standardVal = row.spec.limitType === 'text'
        ? row.spec.value
        : row.spec.limitType === 'range'
          ? `${row.spec.value} ${row.spec.unit}`
          : `${row.spec.limitType === 'min' ? '≥' : '≤'} ${row.spec.value} ${row.spec.unit}`;
      const supplierVal = row.supplierData !== null ? `${row.supplierData.value} ${row.supplierData.unit}` : 'Not detected';
      
      const rowBgColor = row.status === 'NON_CONFORME' ? '#fef2f2' : row.status === 'MANQUANT' ? '#fffbeb' : '#ffffff';
      const cellStatusColor = row.status === 'CONFORME' ? '#047857' : row.status === 'NON_CONFORME' ? '#b91c1c' : '#b45309';
      const cellStatusText = row.status === 'CONFORME' ? 'Compliant ✅' : row.status === 'NON_CONFORME' ? 'Deviation ❌' : 'Missing ⚠️';
      
      htmlText += `<tr style="background-color: ${rowBgColor};">`;
      htmlText += `<td style="border: 1px solid #e2e8f0; font-weight: bold; color: #0f172a;">${row.spec.name}</td>`;
      htmlText += `<td style="border: 1px solid #e2e8f0;">${standardVal}</td>`;
      htmlText += `<td style="border: 1px solid #e2e8f0; font-weight: bold; color: #1e293b;">${supplierVal}</td>`;
      htmlText += `<td style="border: 1px solid #e2e8f0; color: ${cellStatusColor}; font-weight: bold; white-space: nowrap;">${cellStatusText}</td>`;
      htmlText += `<td style="border: 1px solid #e2e8f0; color: #475569; font-size: 12px; line-height: 1.4;">${row.explanation}</td>`;
      htmlText += `</tr>`;
    });
    
    htmlText += `</tbody>`;
    htmlText += `</table>`;
    htmlText += `</div>`;

    // Try to use Clipboard API with ClipboardItem to write both plain text and HTML
    if (navigator.clipboard && window.ClipboardItem) {
      const plainBlob = new Blob([plainText], { type: 'text/plain' });
      const htmlBlob = new Blob([htmlText], { type: 'text/html' });
      const item = new ClipboardItem({
        'text/plain': plainBlob,
        'text/html': htmlBlob
      });
      navigator.clipboard.write([item]).then(() => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      }).catch(err => {
        console.error('Failed rich copy, falling back to text: ', err);
        navigator.clipboard.writeText(plainText).then(() => {
          setCopySuccess(true);
          setTimeout(() => setCopySuccess(false), 2000);
        });
      });
    } else {
      // Fallback for older browsers
      navigator.clipboard.writeText(plainText).then(() => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      });
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === "application/pdf" || droppedFile.name.endsWith('.pdf')) {
        await processFile(droppedFile);
      } else {
        setError("Please select a valid PDF file.");
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0]);
    }
  };

  const processFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setLoading(true);
    setError(null);
    setComparisonResults(null);
    
    try {
      const text = await extractTextFromPdf(selectedFile);
      setRawText(text);

      // Auto-detect product from text
      const detectedProd = detectProductFromText(text, products);
      let productToUse = activeProduct;
      let nextClientId = selectedClientId;
      if (detectedProd && detectedProd.id !== activeProduct.id) {
        onSelectProduct(detectedProd.id);
        productToUse = detectedProd;
        setSelectedClientId('standard');
        nextClientId = 'standard';
      }

      // Auto-detect metadata fields from text
      let detectedLot = '';
      const lotMatch = text.match(/(?:lot|batch)(?:\s+number|#)?\s*[:\-\s]\s*([a-zA-Z0-9\-]+)/i);
      if (lotMatch) detectedLot = lotMatch[1].trim();
      
      let detectedPo = '';
      const poMatch = text.match(/(?:po|order|purchase\s+order)(?:\s+number|#)?\s*[:\-\s]\s*([a-zA-Z0-9\-]+)/i);
      if (poMatch) detectedPo = poMatch[1].trim();

      let detectedVehicle = '';
      const vehicleMatch = text.match(/(?:isotank|container|tank|truck|vessel)(?:\s+number|#)?\s*[:\-\s]\s*([a-zA-Z0-9\-]+)/i);
      if (vehicleMatch) detectedVehicle = vehicleMatch[1].trim();

      let detectedInternalOrder = '';
      const ioMatch = text.match(/(?:internal\s+order|so|sales\s+order)(?:\s+number|#)?\s*[:\-\s]\s*([a-zA-Z0-9\-]+)/i);
      if (ioMatch) detectedInternalOrder = ioMatch[1].trim();

      let detectedTransport: 'Isotank' | 'Vehicle' = 'Isotank';
      if (text.toLowerCase().includes('vehicle') || text.toLowerCase().includes('truck')) {
        detectedTransport = 'Vehicle';
      }
      if (productToUse.id.includes('toluene')) {
        detectedTransport = 'Isotank';
      }

      setLotNumber(detectedLot);
      setPoNumber(detectedPo);
      setVehicleNumber(detectedVehicle);
      setInternalOrder(detectedInternalOrder);
      setTransportType(detectedTransport);
      setAnalysisDate(new Date().toISOString().split('T')[0]);

      runComparison(text, productToUse, nextClientId);
    } catch (err: any) {
      setError(err.message || "An error occurred during file analysis.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setComparisonResults(null);
    setError(null);
    setRawText('');
    setSelectedClientId('standard');
    setInternalOrder('');
    setTransportType('Isotank');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const getGlobalStatus = (results: ComparisonResult[]) => {
    const hasFail = results.some(r => r.status === 'NON_CONFORME');
    const hasMissing = results.some(r => r.status === 'MANQUANT');
    
    if (hasFail) return 'NON_CONFORME';
    if (hasMissing) return 'INCOMPLET';
    return 'CONFORME';
  };

  const globalStatus = comparisonResults ? getGlobalStatus(comparisonResults) : null;

  // COA Modal Handlers
  const handleOpenCoaGenerator = () => {
    if (comparisonResults) {
      // Auto-detect fields from raw text
      let detectedLot = '';
      const lotMatch = rawText.match(/(?:lot|batch)(?:\s+number|#)?\s*[:\-\s]\s*([a-zA-Z0-9\-]+)/i);
      if (lotMatch) detectedLot = lotMatch[1].trim();
      
      let detectedPo = '';
      const poMatch = rawText.match(/(?:po|order|purchase\s+order)(?:\s+number|#)?\s*[:\-\s]\s*([a-zA-Z0-9\-]+)/i);
      if (poMatch) detectedPo = poMatch[1].trim();

      let detectedVehicle = '';
      const vehicleMatch = rawText.match(/(?:isotank|container|tank|truck|vessel)(?:\s+number|#)?\s*[:\-\s]\s*([a-zA-Z0-9\-]+)/i);
      if (vehicleMatch) detectedVehicle = vehicleMatch[1].trim();

      let detectedInternalOrder = '';
      const ioMatch = rawText.match(/(?:internal\s+order|so|sales\s+order)(?:\s+number|#)?\s*[:\-\s]\s*([a-zA-Z0-9\-]+)/i);
      if (ioMatch) detectedInternalOrder = ioMatch[1].trim();

      let detectedTransport: 'Isotank' | 'Vehicle' = 'Isotank';
      if (rawText.toLowerCase().includes('vehicle') || rawText.toLowerCase().includes('truck')) {
        detectedTransport = 'Vehicle';
      }
      if (activeProduct.id.includes('toluene')) {
        detectedTransport = 'Isotank';
      }

      setLotNumber(detectedLot);
      setPoNumber(detectedPo);
      setVehicleNumber(detectedVehicle);
      setInternalOrder(detectedInternalOrder);
      setTransportType(detectedTransport);
      setAnalysisDate(new Date().toISOString().split('T')[0]);
      
      const initialCoaResults = comparisonResults.map(row => {
        const limitVal = row.spec.value;
        const limitText = (row.spec.limitType === 'text' || row.spec.limitType === 'range')
          ? String(limitVal)
          : `${row.spec.limitType === 'min' ? '≥' : '≤'} ${limitVal}`;
          
        return {
          specId: row.spec.id,
          name: row.spec.name,
          unit: row.spec.unit,
          limitType: row.spec.limitType,
          limitValue: limitVal,
          limitText,
          value: row.supplierData ? String(row.supplierData.value) : '',
          isConform: row.status === 'CONFORME',
          isExtra: row.spec.isExtra,
          isOverride: row.spec.isOverride
        };
      });
      
      setCoaResults(initialCoaResults);
      setShowCoaModal(true);
    } else {
      // Manual mode from currently selected settings
      setLotNumber('');
      setPoNumber('');
      setVehicleNumber('');
      setInternalOrder('');
      setTransportType(activeProduct.id.includes('toluene') ? 'Isotank' : 'Vehicle');
      setAnalysisDate(new Date().toISOString().split('T')[0]);
      
      const specsToCompare = getSpecsToCompare(activeProduct, selectedClientId);
      const initialCoaResults = specsToCompare.map(spec => {
        const limitVal = spec.value;
        const limitText = (spec.limitType === 'text' || spec.limitType === 'range')
          ? String(limitVal)
          : `${spec.limitType === 'min' ? '≥' : '≤'} ${limitVal}`;
          
        return {
          specId: spec.id,
          name: spec.name,
          unit: spec.unit,
          limitType: spec.limitType,
          limitValue: limitVal,
          limitText,
          value: '',
          isConform: true,
          isExtra: spec.isExtra,
          isOverride: spec.isOverride
        };
      });
      
      setCoaResults(initialCoaResults);
      setShowCoaModal(true);
    }
  };

  const handleUpdateCoaResultValue = (specId: string, newValue: string) => {
    setCoaResults(prev => prev.map(item => {
      if (item.specId === specId) {
        let isConform = true;
        if (item.limitType === 'text') {
          isConform = newValue.trim().length > 0;
        } else if (item.limitType === 'range') {
          const rangeRegex = /^([\d.,]+)\s*[-–—]\s*([\d.,\-]+)$/;
          const limitRangeMatch = String(item.limitValue).trim().replace(/–/g, '-').match(rangeRegex);
          const newValStr = newValue.trim().replace(/–/g, '-');
          const valueRangeMatch = newValStr.match(rangeRegex);

          if (limitRangeMatch) {
            const lMin = parseFloat(limitRangeMatch[1].replace(',', '.'));
            const lMax = parseFloat(limitRangeMatch[2].replace(',', '.'));

            let vMin = NaN;
            let vMax = NaN;

            if (valueRangeMatch) {
              vMin = parseFloat(valueRangeMatch[1].replace(',', '.'));
              vMax = parseFloat(valueRangeMatch[2].replace(',', '.'));
            } else {
              const vNum = parseFloat(newValStr.replace(',', '.'));
              if (!isNaN(vNum)) {
                vMin = vNum;
                vMax = vNum;
              }
            }

            if (!isNaN(lMin) && !isNaN(lMax) && !isNaN(vMin) && !isNaN(vMax)) {
              isConform = vMin >= lMin && vMax <= lMax;
            } else {
              isConform = false;
            }
          } else {
            isConform = false;
          }
        } else {
          const parsedVal = parseFloat(newValue);
          const parsedLimit = parseFloat(String(item.limitValue));
          if (!isNaN(parsedVal) && !isNaN(parsedLimit)) {
            if (item.limitType === 'min') {
              isConform = parsedVal >= parsedLimit;
            } else if (item.limitType === 'max') {
              isConform = parsedVal <= parsedLimit;
            }
          } else {
            isConform = false;
          }
        }
        return {
          ...item,
          value: newValue,
          isConform
        };
      }
      return item;
    }));
  };

  const handleToggleCoaResultConform = (specId: string) => {
    setCoaResults(prev => prev.map(item => {
      if (item.specId === specId) {
        return {
          ...item,
          isConform: !item.isConform
        };
      }
      return item;
    }));
  };

  const handlePrint = () => {
    const originalTitle = document.title;
    const formattedLot = lotNumber.trim() ? ` (Lot ${lotNumber.trim()})` : '';
    document.title = `DAXX COA - ${activeProduct?.name || 'Product'}${formattedLot}`;
    window.print();
    document.title = originalTitle;
  };


  const activeClientName = selectedClientId && selectedClientId !== 'standard'
    ? activeProduct.clientSpecs?.find(c => c.customerId === selectedClientId)?.customerName || ''
    : 'Daxx Standard';

  return (
    <div className="space-y-6">
      {/* Product & Client Selector Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xs no-print">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-daxx-blue/10 rounded-xl text-daxx-blue border border-daxx-blue/15">
            <FileText size={20} />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Active Comparison Settings</span>
            <span className="text-sm font-bold text-slate-800">{activeProduct?.name} <span className="text-slate-400 font-normal">({activeClientName})</span></span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          <div className="flex items-center gap-2 w-full sm:w-auto flex-1 sm:flex-none">
            <label className="text-xs text-slate-550 font-semibold hidden sm:inline">Product:</label>
            <div className="relative w-full sm:w-52">
              <select
                value={selectedProductId}
                onChange={e => {
                  onSelectProduct(e.target.value);
                  setSelectedClientId('standard');
                  if (file && rawText) {
                    const newProduct = products.find(p => p.id === e.target.value) || activeProduct;
                    runComparison(rawText, newProduct, 'standard');
                  }
                }}
                className="w-full bg-white border border-slate-250 rounded-lg px-3 py-2 text-slate-700 text-sm focus:border-daxx-blue focus:outline-none appearance-none cursor-pointer shadow-2xs"
              >
                {products.map(prod => (
                  <option key={prod.id} value={prod.id}>{prod.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-3 text-slate-450 pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto flex-1 sm:flex-none">
            <label className="text-xs text-slate-550 font-semibold hidden sm:inline">Customer Specs:</label>
            <div className="relative w-full sm:w-52">
              <select
                value={selectedClientId}
                onChange={e => {
                  setSelectedClientId(e.target.value);
                  if (file && rawText) {
                    runComparison(rawText, activeProduct, e.target.value);
                  }
                }}
                className="w-full bg-white border border-slate-250 rounded-lg px-3 py-2 text-slate-700 text-sm focus:border-daxx-blue focus:outline-none appearance-none cursor-pointer shadow-2xs"
              >
                <option value="standard">Standard Daxx specs</option>
                {activeProduct.clientSpecs?.map(c => (
                  <option key={c.customerId} value={c.customerId}>{c.customerName}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-3 text-slate-450 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Drag and Drop Comparison Interface */}
      {!file ? (
        <div 
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={triggerFileInput}
          className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all min-h-[350px] shadow-2xs no-print ${
            dragActive 
              ? 'border-daxx-blue bg-daxx-blue/5 text-slate-800 scale-[0.99]' 
              : 'border-slate-250 bg-white hover:bg-slate-55/50 hover:border-daxx-blue/45 text-slate-550'
          }`}
        >
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="application/pdf"
            className="hidden" 
          />
          <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-daxx-blue mb-4 shadow-sm">
            <Upload size={32} className="animate-pulse" />
          </div>
          <h3 className="font-bold text-slate-800 text-lg mb-1">
            Drag & drop the Certificate of Analysis (COA)
          </h3>
          <p className="text-sm text-slate-500 text-center max-w-sm mb-5">
            Drop the supplier PDF document to instantly compare it with Daxx reference specifications for
            <span className="text-daxx-blue font-bold block mt-1">"{activeProduct.name}"</span>
          </p>
          <span className="px-4 py-2.5 bg-daxx-blue hover:bg-blue-800 text-white font-semibold rounded-lg text-xs shadow-sm transition-all cursor-pointer">
            Browse files
          </span>
        </div>
      ) : (
        /* Results View */
        <div className="space-y-6 no-print">
          {loading && (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center flex flex-col items-center justify-center space-y-4 shadow-sm no-print">
              <RefreshCw className="animate-spin text-daxx-blue" size={32} />
              <p className="text-slate-700 font-semibold">Analyzing PDF and extracting chemical data...</p>
            </div>
          )}

          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center space-y-3 no-print">
              <XCircle className="text-rose-600 mx-auto" size={32} />
              <h4 className="font-bold text-rose-800 text-lg">Reading Failed</h4>
              <p className="text-sm text-rose-700 max-w-md mx-auto">{error}</p>
              <button 
                onClick={handleReset}
                className="mt-2 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs transition-all font-semibold cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {comparisonResults && !loading && (
            <>
              {/* Compliance Status Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 no-print">
                {/* Global Verdict */}
                <div className={`border rounded-2xl p-5 flex items-start gap-4 shadow-xs ${
                  globalStatus === 'CONFORME' ? 'bg-emerald-55 border-emerald-200 text-emerald-800' :
                  globalStatus === 'NON_CONFORME' ? 'bg-rose-50 border-rose-200 text-rose-800' :
                  'bg-amber-50 border-amber-250 text-amber-800'
                }`}>
                  <div className="p-2.5 bg-white/60 rounded-xl border border-slate-200/50 shadow-2xs">
                    {globalStatus === 'CONFORME' ? <CheckCircle size={28} className="text-emerald-600" /> :
                     globalStatus === 'NON_CONFORME' ? <XCircle size={28} className="text-rose-600" /> :
                     <AlertTriangle size={28} className="text-amber-600" />}
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Global Verdict</span>
                    <h3 className="text-base font-extrabold tracking-wide uppercase">
                      {globalStatus === 'CONFORME' ? 'COMPLIANT ✅' :
                       globalStatus === 'NON_CONFORME' ? 'DEVIATION ❌' :
                       'INCOMPLETE ⚠️'}
                    </h3>
                    <p className="text-xs opacity-90 leading-relaxed">
                      {globalStatus === 'CONFORME' ? `The product meets all required limits for ${activeClientName}.` :
                       globalStatus === 'NON_CONFORME' ? 'One or more parameters exceed the allowed requirements.' :
                       'Some required specifications are missing from the supplier\'s report.'}
                    </p>
                  </div>
                </div>

                {/* File metadata */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-start gap-4 shadow-xs col-span-2">
                  <div className="p-3 bg-daxx-blue/10 border border-daxx-blue/15 rounded-xl text-daxx-blue">
                    <FileText size={24} />
                  </div>
                  <div className="space-y-1 flex-1">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Analyzed Document</span>
                    <h4 className="text-sm font-bold text-slate-800 truncate max-w-xs md:max-w-md">{file.name}</h4>
                    <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
                      <span>Size : <span className="text-slate-750 font-semibold">{(file.size / 1024).toFixed(1)} KB</span></span>
                      <span>Format : <span className="text-slate-750 font-semibold">PDF Document</span></span>
                    </div>
                  </div>
                  <button 
                    onClick={handleReset}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-650 rounded-lg text-xs transition-all font-semibold cursor-pointer border border-slate-200/60 shadow-3xs"
                  >
                    Change File
                  </button>
                </div>
              </div>

              {/* Main Comparison Specs Table */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4 no-print">
                <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center pb-2 border-b border-slate-150 gap-3">
                  <div>
                    <h3 className="font-bold text-slate-850 text-base flex items-center gap-2">
                      <Info size={16} className="text-daxx-blue" />
                      Detailed properties comparison ({activeClientName} limits)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Supplier values are evaluated against the active specification profile
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleCopyToClipboard}
                      className="text-xs text-slate-650 hover:text-slate-850 font-bold flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-250 border border-slate-250 rounded-lg transition-all cursor-pointer shadow-3xs"
                    >
                      {copySuccess ? (
                        <>
                          <Check size={13} className="text-emerald-600" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy size={13} />
                          Copy Table
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleOpenCoaGenerator}
                      className="text-xs text-white bg-daxx-blue hover:bg-blue-800 font-bold flex items-center gap-1.5 px-4 py-1.5 rounded-lg transition-all cursor-pointer shadow-md shadow-blue-900/10"
                    >
                      <Printer size={13} />
                      Generate Daxx COA
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-left border-collapse text-sm text-slate-700">
                    <thead className="bg-slate-50 text-slate-650 font-bold border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3">Required Parameter</th>
                        <th className="px-4 py-3">Limit Rule</th>
                        <th className="px-4 py-3">Supplier Value (COA)</th>
                        <th className="px-4 py-3">COA Unit</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Technical Explanation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150 bg-white">
                      {comparisonResults.map(row => {
                        const standardSpec = activeProduct.specs.find(s => s.id === row.spec.id);
                        const hasOverride = row.spec.isOverride;
                        const hasExtra = row.spec.isExtra;

                        return (
                          <tr key={row.spec.id} className={`hover:bg-slate-50/40 transition-colors ${
                            row.status === 'NON_CONFORME' ? 'bg-rose-50/15' : 
                            row.status === 'MANQUANT' ? 'bg-amber-50/15' : ''
                          }`}>
                            <td className="px-4 py-3">
                              <span className="font-bold text-slate-800 block">{row.spec.name}</span>
                              {hasOverride && standardSpec && (
                                <span className="text-[10px] text-slate-450 block mt-0.5">
                                  Daxx Standard: <span className="font-medium">{standardSpec.value} {standardSpec.unit}</span>
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-700">
                              <div className="flex flex-col">
                                <div className="flex items-center gap-1.5">
                                  <span>{row.spec.value}</span>
                                  <span className="text-xs text-slate-500 font-mono">{row.spec.unit}</span>
                                  {hasOverride && (
                                    <span className="inline-flex items-center text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded leading-none">
                                      Client Override
                                    </span>
                                  )}
                                  {hasExtra && (
                                    <span className="inline-flex items-center text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded leading-none">
                                      Client Extra
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] uppercase font-bold text-slate-450 mt-0.5">
                                  {row.spec.limitType === 'min' ? 'Minimum required' : row.spec.limitType === 'max' ? 'Maximum allowed' : row.spec.limitType === 'range' ? 'Range' : 'Visual Requirement'}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-800">
                              {row.supplierData ? (
                                <span className={row.status === 'NON_CONFORME' ? 'text-rose-600 font-extrabold' : 'text-slate-800'}>
                                  {row.supplierData.value}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic font-normal">Absent from report</span>
                              )}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-slate-500">
                              {row.supplierData ? row.supplierData.unit : '-'}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${
                                row.status === 'CONFORME' 
                                  ? 'bg-emerald-55 border-emerald-200 text-emerald-700' 
                                  : row.status === 'NON_CONFORME'
                                    ? 'bg-rose-55 border-rose-250 text-rose-700 animate-pulse'
                                    : 'bg-amber-55 border-amber-250 text-amber-700'
                              }`}>
                                {row.status === 'CONFORME' ? 'Compliant ✅' :
                                 row.status === 'NON_CONFORME' ? 'Deviation ❌' : 'Missing ⚠️'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-550 leading-relaxed max-w-xs md:max-w-sm">
                              {row.explanation}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Automatic Supplier Communication Generator */}
              <EmailGenerator 
                productName={activeProduct.name}
                results={comparisonResults} 
                globalStatus={globalStatus}
                initialLotNumber={lotNumber}
                initialVehicleNumber={vehicleNumber}
              />
            </>
          )}
        </div>
      )}

      {/* Daxx COA Generator Interactive Modal */}
      {showCoaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden animate-scale-up">
            
            {/* Modal Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between no-print">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-daxx-blue/10 rounded-lg text-daxx-blue">
                  <Printer size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">Official Daxx Certificate of Analysis Generator</h3>
                  <p className="text-xs text-slate-500">Configure shipment details and review results before generating the PDF</p>
                </div>
              </div>
              <button 
                onClick={() => setShowCoaModal(false)}
                className="p-1.5 bg-slate-100 hover:bg-slate-205 text-slate-550 hover:text-slate-850 rounded-lg transition-all cursor-pointer border border-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content Split Layout */}
            <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 bg-slate-100">
              
              {/* Left Column: Editor Form */}
              <div className="lg:col-span-5 p-6 overflow-y-auto space-y-6 bg-white border-r border-slate-200 no-print flex flex-col justify-between h-full">
                
                <div className="space-y-6">
                  {/* Section A: Shipping metadata */}
                  <div className="space-y-4">
                    <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider pb-2 border-b border-slate-150">
                      1. Shipping & Lot Information
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-550 mb-1">Lot / Batch Number</label>
                        <input 
                          type="text" 
                          placeholder="e.g. PO-US58301"
                          value={lotNumber} 
                          onChange={e => setLotNumber(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-slate-850 text-sm focus:border-daxx-blue focus:bg-white focus:outline-none focus:ring-1 focus:ring-daxx-blue"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-[11px] font-bold text-slate-555 mb-1">Order Number (PO)</label>
                        <input 
                          type="text" 
                          placeholder="e.g. COM-179/25 / 135368"
                          value={poNumber} 
                          onChange={e => setPoNumber(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-slate-850 text-sm focus:border-daxx-blue focus:bg-white focus:outline-none focus:ring-1 focus:ring-daxx-blue"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-555 mb-1">Transport Label</label>
                        <select 
                          value={transportType} 
                          onChange={e => setTransportType(e.target.value as 'Isotank' | 'Vehicle')}
                          className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-slate-850 text-sm focus:border-daxx-blue focus:bg-white focus:outline-none cursor-pointer"
                        >
                          <option value="Isotank">Isotank Number</option>
                          <option value="Vehicle">Vehicle Number</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-[11px] font-bold text-slate-555 mb-1">Isotank / Vehicle Number</label>
                        <input 
                          type="text" 
                          placeholder="e.g. XCTU1113832"
                          value={vehicleNumber} 
                          onChange={e => setVehicleNumber(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-slate-850 text-sm focus:border-daxx-blue focus:bg-white focus:outline-none focus:ring-1 focus:ring-daxx-blue"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-[11px] font-bold text-slate-555 mb-1">Internal Order (SO)</label>
                        <input 
                          type="text" 
                          placeholder="e.g. SO-US36121"
                          value={internalOrder} 
                          onChange={e => setInternalOrder(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-slate-850 text-sm focus:border-daxx-blue focus:bg-white focus:outline-none focus:ring-1 focus:ring-daxx-blue"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-555 mb-1">Date Shipped</label>
                        <input 
                          type="text" 
                          placeholder="e.g. 2025-07-23 00:00:00"
                          value={deliveryDate} 
                          onChange={e => setDeliveryDate(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-slate-850 text-sm focus:border-daxx-blue focus:bg-white focus:outline-none focus:ring-1 focus:ring-daxx-blue"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-555 mb-1">Analysis Date (Not printed)</label>
                        <input 
                          type="date" 
                          value={analysisDate} 
                          onChange={e => setAnalysisDate(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-slate-850 text-sm focus:border-daxx-blue focus:bg-white focus:outline-none focus:ring-1 focus:ring-daxx-blue cursor-pointer"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-555 mb-1">QA Analyst (Not printed)</label>
                        <input 
                          type="text" 
                          value={analystName} 
                          onChange={e => setAnalystName(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-slate-850 text-sm focus:border-daxx-blue focus:bg-white focus:outline-none focus:ring-1 focus:ring-daxx-blue"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section B: Editable Parameters Table */}
                  <div className="space-y-3 pt-2">
                    <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider pb-2 border-b border-slate-150">
                      2. Certificate Parameter Results
                    </h4>
                    
                    <div className="space-y-3 max-h-[35vh] overflow-y-auto pr-1">
                      {coaResults.map(res => (
                        <div key={res.specId} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                          <div className="flex justify-between items-start">
                            <span className="font-bold text-xs text-slate-800 truncate block max-w-[200px]" title={res.name}>
                              {res.name}
                            </span>
                            <span className="text-[10px] text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full font-mono font-bold leading-none">
                              Required: {res.limitText} {res.unit}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <input 
                              type="text" 
                              value={res.value} 
                              onChange={e => handleUpdateCoaResultValue(res.specId, e.target.value)}
                              className="bg-white border border-slate-250 rounded-lg px-3 py-1.5 text-slate-850 text-xs flex-1 focus:border-daxx-blue focus:outline-none focus:ring-1 focus:ring-daxx-blue shadow-2xs font-semibold"
                            />
                            <button
                              onClick={() => handleToggleCoaResultConform(res.specId)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                                res.isConform 
                                  ? 'bg-emerald-55 border-emerald-250 text-emerald-700 hover:bg-emerald-100'
                                  : 'bg-rose-50 border-rose-250 text-rose-700 hover:bg-rose-100 animate-pulse'
                              }`}
                            >
                              {res.isConform ? 'Conforms' : 'Fails'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Print button inside form */}
                <div className="pt-4 border-t border-slate-200 flex justify-end gap-3 no-print bg-white">
                  <button
                    onClick={() => setShowCoaModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-650 font-bold border border-slate-205 rounded-lg transition-all text-sm cursor-pointer shadow-3xs"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePrint}
                    className="px-5 py-2 bg-daxx-blue hover:bg-blue-800 text-white font-bold rounded-lg transition-all text-sm flex items-center gap-2 cursor-pointer shadow-md shadow-blue-900/10"
                  >
                    <Printer size={15} />
                    Print COA
                  </button>
                </div>
              </div>

              {/* Right Column: Screen Live Preview */}
              <div className="lg:col-span-7 p-6 overflow-y-auto flex justify-center no-print bg-slate-200">
                <div className="w-[21cm] min-h-[29.7cm] bg-white shadow-xl border border-slate-350/60 rounded flex flex-col justify-between" style={{ padding: '1.0cm 1.2cm', fontFamily: 'Arial, sans-serif' }}>
                  
                  <div>
                    {/* Header Image */}
                    <div className="w-full mb-6">
                      <img src={`${import.meta.env.BASE_URL}image1.jpg`} alt="Daxx Logo Header" className="w-full h-auto" />
                    </div>

                    {/* Header */}
                    <div className="text-right text-black tracking-wide" style={{ fontFamily: '"Arial Black", Arial, sans-serif', fontSize: '14pt', fontWeight: 900 }}>
                      CERTIFICATE OF ANALYSIS
                    </div>
                    
                    <div className="text-right text-black tracking-wide" style={{ fontFamily: '"Arial Black", Arial, sans-serif', fontSize: '14pt', fontWeight: 900 }}>
                      {activeProduct.name}
                    </div>
                    
                    {/* Spacer */}
                    <div className="h-6"></div>
                    
                    {/* Metadata Grid */}
                    <div className="grid grid-cols-[160px_1fr] gap-y-2 text-black text-left" style={{ fontFamily: 'Arial, sans-serif', fontSize: '11pt' }}>
                      <div className="font-bold">Customer:</div>
                      <div>{selectedClientId === 'standard' ? 'Standard Specifications' : activeClientName}</div>
                      
                      <div className="font-bold">Order Number:</div>
                      <div>{poNumber || 'XXXXXXXXX'}</div>
                      
                      <div className="font-bold">Lot Number:</div>
                      <div>{lotNumber || 'XXXXXXXXX'}</div>
                      
                      <div className="font-bold">Date Shipped:</div>
                      <div>{deliveryDate || 'XXXXXXXXX'}</div>
                      
                      <div className="font-bold">Internal Order:</div>
                      <div>{internalOrder || 'XXXXXXXXX'}</div>
                      
                      <div className="font-bold">{transportType === 'Isotank' ? 'Isotank Number:' : 'Vehicle Number:'}</div>
                      <div>{vehicleNumber || 'XXXXXXXXX'}</div>
                    </div>
                    
                    {/* Spacer */}
                    <div className="h-6"></div>
                    
                    {/* Specifications Table */}
                    <table className="w-full text-left border-collapse text-black" style={{ fontFamily: 'Arial, sans-serif', fontSize: '11pt' }}>
                      <thead>
                        <tr className="border-b-[3px] border-[#144b91]">
                          <th className="px-3 py-2 font-bold text-center w-[39.2%]">Description</th>
                          <th className="px-3 py-2 font-bold text-center w-[15.8%]">Units</th>
                          <th className="px-3 py-2 font-bold text-right w-[23.4%]">Specification</th>
                          <th className="px-3 py-2 font-bold text-right w-[21.6%]">Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {coaResults.map((res, idx) => {
                          const topBorderClass = idx === 0 ? 'border-t-[3px] border-t-[#144b91]' : '';
                          return (
                            <tr key={res.specId}>
                              <td className={`px-3 py-1.5 text-left border-l-[2px] border-r-[2px] border-[#144b91] ${topBorderClass}`}>{res.name}</td>
                              <td className={`px-3 py-1.5 text-center italic border-r-[2px] border-[#144b91] ${topBorderClass}`}>{res.unit || ''}</td>
                              <td className={`px-3 py-1.5 text-right border-r-[2px] border-[#144b91] ${topBorderClass}`}>{res.limitText}</td>
                              <td className={`px-3 py-1.5 text-right border-r-[2px] border-[#144b91] ${topBorderClass}`}>{res.value || ''}</td>
                            </tr>
                          );
                        })}
                        {Array.from({ length: Math.max(0, 8 - coaResults.length) }).map((_, idx) => {
                          const isFirstRow = coaResults.length === 0 && idx === 0;
                          const topBorderClass = isFirstRow ? 'border-t-[3px] border-t-[#144b91]' : '';
                          return (
                            <tr key={`empty-${idx}`}>
                              <td className={`px-3 py-1.5 border-l-[2px] border-r-[2px] border-[#144b91] ${topBorderClass}`}>&nbsp;</td>
                              <td className={`px-3 py-1.5 border-r-[2px] border-[#144b91] ${topBorderClass}`}>&nbsp;</td>
                              <td className={`px-3 py-1.5 border-r-[2px] border-[#144b91] ${topBorderClass}`}>&nbsp;</td>
                              <td className={`px-3 py-1.5 border-r-[2px] border-[#144b91] ${topBorderClass}`}>&nbsp;</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Footer Section */}
                  <div className="mt-auto space-y-6">
                    {/* Excel Disclaimer Footer */}
                    <div className="text-[7pt] text-black text-center leading-relaxed max-w-[95%] mx-auto" style={{ fontFamily: 'Arial, sans-serif' }}>
                      This information relates only to the specific material designated and may not be valid for such material used in combination with any other materials or in any process.  Such information is, to the best of our knowledge and belief, accurate and reliable as of the date compiled. However, no presentation, warranty, or guarantee is made as to its accuracy, reliability, or completeness.  It is the user's responsibility to satisfy himself as to the suitability and completeness of such information for his own particular use.  We do not accept liability for any loss or damage that may occur from the use of this information nor do we offer any warranty against patent infringement.
                    </div>

                    {/* Footer Image */}
                    <div className="w-full">
                      <img src={`${import.meta.env.BASE_URL}image2.jpg`} alt="Daxx Footer" className="w-full h-auto" />
                    </div>
                  </div>

                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Hidden Print-Only Layout (rendered at the very root level to prevent parent block hiding bugs) */}
      {showCoaModal && (
        <div className="print-coa-container hidden print:block">
          <div className="w-[100%] bg-white p-0 flex flex-col justify-between" style={{ height: '27.7cm', minHeight: '27.7cm', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box' }}>
            <div>
              {/* Header Image */}
              <div className="w-full mb-6">
                <img src={`${import.meta.env.BASE_URL}image1.jpg`} alt="Daxx Logo Header" className="w-full h-auto" />
              </div>

              {/* Header */}
              <div className="text-right text-black tracking-wide" style={{ fontFamily: '"Arial Black", Arial, sans-serif', fontSize: '14pt', fontWeight: 900 }}>
                CERTIFICATE OF ANALYSIS
              </div>
              
              <div className="text-right text-black tracking-wide" style={{ fontFamily: '"Arial Black", Arial, sans-serif', fontSize: '14pt', fontWeight: 900 }}>
                {activeProduct.name}
              </div>
              
              {/* Spacer */}
              <div className="h-6"></div>
              
              {/* Metadata Grid */}
              <div className="grid grid-cols-[160px_1fr] gap-y-2 text-black text-left" style={{ fontFamily: 'Arial, sans-serif', fontSize: '11pt' }}>
                <div className="font-bold">Customer:</div>
                <div>{selectedClientId === 'standard' ? 'Standard Specifications' : activeClientName}</div>
                
                <div className="font-bold">Order Number:</div>
                <div>{poNumber || 'XXXXXXXXX'}</div>
                
                <div className="font-bold">Lot Number:</div>
                <div>{lotNumber || 'XXXXXXXXX'}</div>
                
                <div className="font-bold">Date Shipped:</div>
                <div>{deliveryDate || 'XXXXXXXXX'}</div>
                
                <div className="font-bold">Internal Order:</div>
                <div>{internalOrder || 'XXXXXXXXX'}</div>
                
                <div className="font-bold">{transportType === 'Isotank' ? 'Isotank Number:' : 'Vehicle Number:'}</div>
                <div>{vehicleNumber || 'XXXXXXXXX'}</div>
              </div>
              
              {/* Spacer */}
              <div className="h-6"></div>
              
              {/* Specifications Table */}
              <table className="w-full text-left border-collapse text-black" style={{ fontFamily: 'Arial, sans-serif', fontSize: '11pt' }}>
                <thead>
                  <tr className="border-b-[3px] border-[#144b91]">
                    <th className="px-3 py-2 font-bold text-center w-[39.2%]">Description</th>
                    <th className="px-3 py-2 font-bold text-center w-[15.8%]">Units</th>
                    <th className="px-3 py-2 font-bold text-right w-[23.4%]">Specification</th>
                    <th className="px-3 py-2 font-bold text-right w-[21.6%]">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {coaResults.map((res, idx) => {
                    const topBorderClass = idx === 0 ? 'border-t-[3px] border-t-[#144b91]' : '';
                    return (
                      <tr key={res.specId}>
                        <td className={`px-3 py-1.5 text-left border-l-[2px] border-r-[2px] border-[#144b91] ${topBorderClass}`}>{res.name}</td>
                        <td className={`px-3 py-1.5 text-center italic border-r-[2px] border-[#144b91] ${topBorderClass}`}>{res.unit || ''}</td>
                        <td className={`px-3 py-1.5 text-right border-r-[2px] border-[#144b91] ${topBorderClass}`}>{res.limitText}</td>
                        <td className={`px-3 py-1.5 text-right border-r-[2px] border-[#144b91] ${topBorderClass}`}>{res.value || ''}</td>
                      </tr>
                    );
                  })}
                  {Array.from({ length: Math.max(0, 8 - coaResults.length) }).map((_, idx) => {
                    const isFirstRow = coaResults.length === 0 && idx === 0;
                    const topBorderClass = isFirstRow ? 'border-t-[3px] border-t-[#144b91]' : '';
                    return (
                      <tr key={`empty-${idx}`}>
                        <td className={`px-3 py-1.5 border-l-[2px] border-r-[2px] border-[#144b91] ${topBorderClass}`}>&nbsp;</td>
                        <td className={`px-3 py-1.5 border-r-[2px] border-[#144b91] ${topBorderClass}`}>&nbsp;</td>
                        <td className={`px-3 py-1.5 border-r-[2px] border-[#144b91] ${topBorderClass}`}>&nbsp;</td>
                        <td className={`px-3 py-1.5 border-r-[2px] border-[#144b91] ${topBorderClass}`}>&nbsp;</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer Section */}
            <div className="mt-auto space-y-6">
              {/* Excel Disclaimer Footer */}
              <div className="text-[7pt] text-black text-center leading-relaxed max-w-[95%] mx-auto" style={{ fontFamily: 'Arial, sans-serif' }}>
                This information relates only to the specific material designated and may not be valid for such material used in combination with any other materials or in any process.  Such information is, to the best of our knowledge and belief, accurate and reliable as of the date compiled. However, no presentation, warranty, or guarantee is made as to its accuracy, reliability, or completeness.  It is the user's responsibility to satisfy himself as to the suitability and completeness of such information for his own particular use.  We do not accept liability for any loss or damage that may occur from the use of this information nor do we offer any warranty against patent infringement.
              </div>

              {/* Footer Image */}
              <div className="w-full">
                <img src={`${import.meta.env.BASE_URL}image2.jpg`} alt="Daxx Footer" className="w-full h-auto" />
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
