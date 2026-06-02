import { useState, useEffect, useRef } from 'react';
import { type ProductSpec, type SpecItem } from '../data/initialSpecs';
import { extractTextFromPdf, parseSpecificationPdfText, detectProductFromText } from '../utils/pdfParser';
import { FileText, ChevronRight, User, Truck, CheckCircle2, AlertCircle, ArrowRightLeft, XCircle, RotateCcw, Upload, Search, ArrowLeft } from 'lucide-react';

interface SpecsComparatorProps {
  products: ProductSpec[];
  selectedProductId: string;
  onSelectProduct: (id: string) => void;
}

interface LocalSpecValue {
  specId: string;
  value: string | number;
  limitType: 'min' | 'max' | 'text' | 'range';
}

export default function SpecsComparator({
  products,
  selectedProductId,
  onSelectProduct
}: SpecsComparatorProps) {
  const [compareMode, setCompareMode] = useState<'client' | 'supplier'>('client');
  const [selectedProfileId, setSelectedProfileId] = useState<string>('manual');
  
  // Local state for manual input overrides
  const [manualValues, setManualValues] = useState<Record<string, LocalSpecValue>>({});

  // Parsing status states
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseSuccessMsg, setParseSuccessMsg] = useState<string | null>(null);

  const isSyncingFromPdf = useRef(false);
  const [dragActive, setDragActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const activeProduct = products.find(p => p.id === selectedProductId) || null;

  const handleClearSimulator = () => {
    setManualValues({});
    setSelectedProfileId('manual');
    setParseError(null);
    setParseSuccessMsg(null);
  };

  const handleBackToLanding = () => {
    onSelectProduct('');
    setManualValues({});
    setSelectedProfileId('manual');
    setParseError(null);
    setParseSuccessMsg(null);
    setSearchQuery('');
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
      const file = e.dataTransfer.files[0];
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        await processPdfFile(file);
      } else {
        setParseError("Unsupported file format. Please upload a PDF document.");
      }
    }
  };

  // Reset profile selection when product or mode changes
  useEffect(() => {
    if (isSyncingFromPdf.current) {
      isSyncingFromPdf.current = false;
      return;
    }
    setSelectedProfileId('manual');
    setManualValues({});
  }, [selectedProductId, compareMode]);

  // Load predefined profile values if a profile is selected
  useEffect(() => {
    if (!activeProduct || selectedProfileId === 'manual') {
      return;
    }

    const newManual: Record<string, LocalSpecValue> = {};
    if (compareMode === 'client') {
      const profile = activeProduct.clientSpecs?.find(c => c.customerId === selectedProfileId);
      if (profile) {
        profile.specs.forEach(s => {
          newManual[s.specId] = {
            specId: s.specId,
            value: s.value,
            limitType: s.limitType
          };
        });
      }
    } else {
      const profile = activeProduct.supplierSpecs?.find(s => s.supplierId === selectedProfileId);
      if (profile) {
        profile.specs.forEach(s => {
          newManual[s.specId] = {
            specId: s.specId,
            value: s.value,
            limitType: s.limitType
          };
        });
      }
    }
    setManualValues(newManual);
  }, [selectedProfileId, activeProduct, compareMode]);

  const handleValueChange = (specId: string, val: string, limitType: 'min' | 'max' | 'text' | 'range') => {
    setManualValues(prev => ({
      ...prev,
      [specId]: {
        specId,
        value: val,
        limitType
      }
    }));
  };

  const handleLimitTypeChange = (specId: string, limitType: 'min' | 'max' | 'text' | 'range') => {
    setManualValues(prev => ({
      ...prev,
      [specId]: {
        specId,
        value: prev[specId]?.value ?? '',
        limitType
      }
    }));
  };

  const processPdfFile = async (file: File) => {
    setIsParsing(true);
    setParseError(null);
    setParseSuccessMsg(null);

    try {
      const text = await extractTextFromPdf(file);
      
      // Auto-detect product
      const detectedProd = detectProductFromText(text, products);
      let productToUse: ProductSpec | null = activeProduct;
      let detectionMsg = '';
      
      if (detectedProd) {
        productToUse = detectedProd;
        if (!activeProduct || detectedProd.id !== activeProduct.id) {
          isSyncingFromPdf.current = true;
          onSelectProduct(detectedProd.id);
        }
        detectionMsg = `Product "${productToUse.name}" automatically detected. `;
      } else {
        if (!activeProduct) {
          throw new Error("No product could be automatically detected in this document. Please first select the product from the list below, then upload the file.");
        }
        productToUse = activeProduct;
        detectionMsg = `No product detected, using "${activeProduct.name}". `;
      }

      if (!productToUse) {
        throw new Error("No product to compare.");
      }

      const parsedResults = parseSpecificationPdfText(text, productToUse.specs);
      
      const newManual: Record<string, LocalSpecValue> = {};
      let count = 0;
      
      productToUse.specs.forEach(spec => {
        const parsed = parsedResults[spec.id];
        if (parsed) {
          newManual[spec.id] = {
            specId: spec.id,
            value: parsed.value,
            limitType: parsed.limitType
          };
          count++;
        }
      });

      if (count > 0) {
        setManualValues(newManual);
        setParseSuccessMsg(`${detectionMsg}${count} specifications successfully extracted from the PDF!`);
        setSelectedProfileId('manual'); // switch to simulator mode to show the values
      } else {
        setParseError(`${detectionMsg}No matching parameter was detected in the PDF.`);
      }
    } catch (err: any) {
      console.error(err);
      setParseError(err.message || "Error reading the PDF.");
    } finally {
      setIsParsing(false);
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processPdfFile(file);
    e.target.value = '';
  };

  // Helper to parse numbers/ranges
  const parseRangeOrNumber = (val: string | number): { min: number | null; max: number | null; isRange: boolean } => {
    const sVal = String(val).trim();
    const rangeRegex = /^([\d.,]+)\s*-\s*([\d.,\-]+)$/;
    const rangeMatch = sVal.match(rangeRegex);

    if (rangeMatch) {
      const min = parseFloat(rangeMatch[1].replace(',', '.'));
      let maxStr = rangeMatch[2].replace(',', '.');
      if (maxStr.includes('-') && !maxStr.startsWith('-')) {
        maxStr = maxStr.replace('-', '.');
      }
      const max = parseFloat(maxStr);
      return {
        min: isNaN(min) ? null : min,
        max: isNaN(max) ? null : max,
        isRange: true
      };
    }

    const num = parseFloat(sVal.replace(',', '.'));
    return {
      min: isNaN(num) ? null : num,
      max: isNaN(num) ? null : num,
      isRange: false
    };
  };

  // Compare specifications for a row
  const evaluateCompliance = (
    daxxSpec: SpecItem,
    otherValStr: string | number | undefined,
    otherLimit: 'min' | 'max' | 'text' | 'range' | undefined
  ): { status: 'CONFORME' | 'NON_CONFORME' | 'MANQUANT'; explanation: string } => {
    if (otherValStr === undefined || String(otherValStr).trim() === '') {
      return {
        status: 'MANQUANT',
        explanation: 'The corresponding specification is not configured.'
      };
    }

    const daxxLimit = daxxSpec.limitType;

    // Helper to resolve limit to an interval [min, max]
    const getInterval = (
      type: 'min' | 'max' | 'text' | 'range' | undefined,
      val: string | number | undefined
    ): { min: number; max: number } | null => {
      if (!type || type === 'text') return null;
      const sVal = String(val).trim();
      if (!sVal) return null;

      if (type === 'min') {
        const num = parseFloat(sVal.replace(',', '.'));
        return isNaN(num) ? null : { min: num, max: Infinity };
      }
      if (type === 'max') {
        const num = parseFloat(sVal.replace(',', '.'));
        return isNaN(num) ? null : { min: -Infinity, max: num };
      }
      if (type === 'range') {
        const range = parseRangeOrNumber(sVal);
        if (range.min === null) return null;
        return { min: range.min, max: range.max ?? range.min };
      }
      return null;
    };

    const dInterval = getInterval(daxxLimit, daxxSpec.value);
    const oInterval = getInterval(otherLimit, otherValStr);

    // 1. If both evaluate to numeric/range intervals, run strict subset comparison
    if (dInterval && oInterval) {
      const dMin = dInterval.min;
      const dMax = dInterval.max;
      const oMin = oInterval.min;
      const oMax = oInterval.max;

      let isOk = false;
      let explanation = '';

      const dStr = daxxLimit === 'range' ? `[${dMin} - ${dMax}]` : daxxLimit === 'min' ? `(Min ≥ ${dMin})` : `(Max ≤ ${dMax})`;
      const oStr = otherLimit === 'range' ? `[${oMin} - ${oMax}]` : otherLimit === 'min' ? `(Min ≥ ${oMin})` : `(Max ≤ ${oMax})`;

      if (compareMode === 'client') {
        // Daxx must be stricter or equal to Client (Daxx interval must be subset of Client interval)
        isOk = dMin >= oMin && dMax <= oMax;
        explanation = isOk
          ? `Compliant. The Daxx limit ${dStr} ${daxxSpec.unit} is within/stricter than the client requirement ${oStr} ${daxxSpec.unit}.`
          : `OUT OF SPECIFICATION! The Daxx limit ${dStr} ${daxxSpec.unit} exceeds or is less strict than the client requirement ${oStr} ${daxxSpec.unit}.`;
      } else {
        // Supplier must be stricter or equal to Daxx (Supplier interval must be subset of Daxx interval)
        isOk = oMin >= dMin && oMax <= dMax;
        explanation = isOk
          ? `Compliant. The supplier guaranteed range ${oStr} ${daxxSpec.unit} is within/stricter than the Daxx requirement ${dStr} ${daxxSpec.unit}.`
          : `OUT OF SPECIFICATION! The supplier range ${oStr} ${daxxSpec.unit} is outside the Daxx required specification ${dStr} ${daxxSpec.unit}.`;
      }

      return {
        status: isOk ? 'CONFORME' : 'NON_CONFORME',
        explanation
      };
    }

    // 2. Text / Fallback comparisons
    const daxxValStr = String(daxxSpec.value);
    const dLower = daxxValStr.toLowerCase().trim();
    const oLower = String(otherValStr).toLowerCase().trim();

    // Fallback range check if both are ranges typed as text
    const dRange = parseRangeOrNumber(daxxSpec.value);
    const oRange = parseRangeOrNumber(otherValStr);

    if (dRange.min !== null && oRange.min !== null) {
      const dMin = dRange.min;
      const dMax = dRange.max ?? dMin;
      const oMin = oRange.min;
      const oMax = oRange.max ?? oMin;

      let isOk = false;
      if (compareMode === 'client') {
        isOk = dMin >= oMin && dMax <= oMax;
      } else {
        isOk = oMin >= dMin && oMax <= dMax;
      }

      return {
        status: isOk ? 'CONFORME' : 'NON_CONFORME',
        explanation: isOk
          ? `Compliant. The ranges [${dMin} - ${dMax}] and [${oMin} - ${oMax}] are compatible.`
          : `Non-compliant. Incompatible ranges [${dMin} - ${dMax}] vs [${oMin} - ${oMax}].`
      };
    }

    const ok = dLower === oLower || dLower.includes(oLower) || oLower.includes(dLower);
    return {
      status: ok ? 'CONFORME' : 'NON_CONFORME',
      explanation: ok
        ? `Compliant. Text criteria match ('${daxxSpec.value}' vs '${otherValStr}').`
        : `Non-compliant. Appearance criteria mismatch ('${daxxSpec.value}' vs '${otherValStr}').`
    };
  };

  const getGlobalVerdict = () => {
    if (!activeProduct || activeProduct.specs.length === 0) return 'VIDE';
    
    let hasFail = false;
    let hasMissing = false;
    let hasValue = false;

    activeProduct.specs.forEach(spec => {
      const localSpec = manualValues[spec.id];
      const otherVal = localSpec ? localSpec.value : '';
      const otherLimit = localSpec ? localSpec.limitType : spec.limitType;
      
      if (otherVal !== undefined && String(otherVal).trim() !== '') {
        hasValue = true;
      }
      
      const evalResult = evaluateCompliance(spec, otherVal, otherLimit);
      if (evalResult.status === 'NON_CONFORME') {
        hasFail = true;
      } else if (evalResult.status === 'MANQUANT') {
        hasMissing = true;
      }
    });

    if (hasFail) return 'NON_CONFORME';
    if (!hasValue) return 'VIDE';
    if (hasMissing) return 'INCOMPLET';
    return 'CONFORME';
  };

  if (!activeProduct) {
    // Filter products by search query
    const filteredProducts = products.filter(p => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.synonyms || []).some(s => s.toLowerCase().includes(q))
      );
    });

    // Group products by category
    const categories = filteredProducts.reduce((acc, p) => {
      if (!acc[p.category]) {
        acc[p.category] = [];
      }
      acc[p.category].push(p);
      return acc;
    }, {} as Record<string, ProductSpec[]>);

    return (
      <div className="space-y-6 max-w-5xl mx-auto py-6">
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-4">
          <div className="w-14 h-14 bg-gradient-to-tr from-daxx-blue to-daxx-cyan rounded-2xl flex items-center justify-center mx-auto shadow-md shadow-daxx-blue/20">
            <ArrowRightLeft className="text-white" size={24} />
          </div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Specifications Comparator</h2>
          <p className="text-xs text-slate-550 leading-relaxed font-semibold">
            Select a product or upload a PDF to start the comparative analysis of limits and requirements.
          </p>
        </div>

        {/* Mode Selector Toggle */}
        <div className="flex justify-center pb-4 animate-fade-in">
          <div className="bg-slate-100 p-1.5 rounded-2xl flex border border-slate-200 w-max shadow-3xs">
            <button
              onClick={() => setCompareMode('client')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                compareMode === 'client'
                  ? 'bg-white text-daxx-blue shadow-sm border border-slate-200/60'
                  : 'text-slate-550 hover:text-slate-800'
              }`}
            >
              <User size={14} />
              <span>Sales: Daxx vs Client</span>
            </button>
            <button
              onClick={() => setCompareMode('supplier')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                compareMode === 'supplier'
                  ? 'bg-white text-daxx-blue shadow-sm border border-slate-200/60'
                  : 'text-slate-550 hover:text-slate-800'
              }`}
            >
              <Truck size={14} />
              <span>Purchasing: Supplier vs Daxx</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {/* PDF UPLOAD CARD */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wider">
              Option A: Upload the {compareMode === 'client' ? 'Client' : 'Supplier'} specification (PDF)
            </h3>
            <div 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`bg-white border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all duration-300 min-h-[310px] ${
                dragActive 
                  ? 'border-daxx-blue bg-blue-50/30 scale-[1.01]' 
                  : 'border-slate-250 hover:border-slate-400 bg-slate-50/20'
              }`}
            >
              <input
                type="file"
                accept=".pdf"
                onChange={handlePdfUpload}
                disabled={isParsing}
                className="hidden"
                id="landing-pdf-upload"
              />
              
              {isParsing ? (
                <div className="space-y-4 animate-fade-in">
                  <div className="w-12 h-12 border-4 border-daxx-blue border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <div>
                    <p className="font-bold text-slate-700 text-sm">Analyzing document...</p>
                    <p className="text-[11px] text-slate-550 mt-1">Text extraction and product detection</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-455 border border-slate-200">
                    <Upload size={24} />
                  </div>
                  <div>
                    <label 
                      htmlFor="landing-pdf-upload"
                      className="bg-daxx-blue hover:bg-daxx-blue-dark text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md cursor-pointer transition-all duration-200 inline-block"
                    >
                      Choose PDF file
                    </label>
                    <p className="text-xs text-slate-600 mt-3 font-bold">
                      or drag and drop the document here
                    </p>
                    <p className="text-[10px] text-slate-400 mt-2 font-semibold">
                      Automatic analysis and comparison {compareMode === 'client' ? 'Daxx vs Client' : 'Supplier vs Daxx'}
                    </p>
                  </div>
                </div>
              )}
            </div>
            
            {parseError && (
              <div className="bg-rose-50 border border-rose-250 text-rose-700 px-4 py-3 rounded-xl text-xs flex items-center gap-2 animate-shake mt-4">
                <AlertCircle size={14} className="shrink-0" />
                <span className="font-semibold text-left leading-relaxed">{parseError}</span>
              </div>
            )}
          </div>

          {/* PRODUCT MANUAL SELECTION CARD */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wider">Option B: Manual selection</h3>
            
            <div className="flex flex-col h-full min-h-[310px] space-y-4">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search for a product..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50/50 border border-slate-250 rounded-xl pl-9 pr-4 py-2 text-xs font-semibold focus:bg-white focus:border-daxx-blue focus:outline-none focus:ring-1 focus:ring-daxx-blue transition-all"
                />
              </div>

              <div className="flex-1 overflow-y-auto max-h-[250px] pr-1 space-y-4">
                {Object.keys(categories).length === 0 ? (
                  <div className="text-center py-12 text-slate-400 italic text-xs">
                    No product matches your search.
                  </div>
                ) : (
                  Object.entries(categories).map(([category, prods]) => (
                    <div key={category} className="space-y-1.5">
                      <span className="text-[9px] font-black text-slate-455 uppercase tracking-widest block pl-1">
                        {category}
                      </span>
                      <div className="grid grid-cols-1 gap-1.5">
                        {prods.map(prod => (
                          <button
                            key={prod.id}
                            onClick={() => {
                              onSelectProduct(prod.id);
                              handleClearSimulator();
                            }}
                            className="w-full text-left px-3 py-2 bg-slate-50 hover:bg-slate-100/85 border border-slate-200/50 rounded-lg text-slate-700 hover:text-slate-900 transition-all text-xs font-semibold flex items-center justify-between group cursor-pointer"
                          >
                            <span className="truncate">{prod.name}</span>
                            <ChevronRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-daxx-blue" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const globalStatus = getGlobalVerdict();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Product List Sidebar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col" style={{ maxHeight: '80vh', position: 'sticky', top: '6rem' }}>
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 shrink-0">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <FileText size={18} className="text-daxx-blue" />
            Daxx Products
          </h3>
        </div>

        {/* Categories / Products list */}
        <div className="space-y-2 overflow-y-auto flex-1 pr-1">
          {products.map(prod => (
            <button
              key={prod.id}
              onClick={() => onSelectProduct(prod.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between transition-all group cursor-pointer ${
                selectedProductId === prod.id
                  ? 'bg-daxx-blue text-white shadow-md font-medium'
                  : 'bg-slate-50 text-slate-655 hover:text-slate-800 hover:bg-slate-100/70 border border-slate-200/50'
              }`}
            >
              <div className="truncate">
                <span className={`text-[10px] uppercase font-semibold block transition-colors ${
                  selectedProductId === prod.id ? 'text-cyan-200' : 'text-daxx-blue group-hover:text-daxx-cyan'
                }`}>
                  {prod.category}
                </span>
                <span className="text-sm truncate block">{prod.name}</span>
              </div>
              <ChevronRight size={14} className={selectedProductId === prod.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 transition-opacity'} />
            </button>
          ))}
        </div>
      </div>

      {/* Main Specs Comparison Area */}
      <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-150 pb-4 gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBackToLanding}
              className="p-2 hover:bg-slate-100 text-slate-550 hover:text-slate-800 border border-slate-250 rounded-lg transition-all shadow-3xs cursor-pointer"
              title="Back to products / Import another file"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <span className="px-2.5 py-0.5 bg-slate-100 border border-slate-250 rounded-full text-xs text-daxx-blue font-bold">
                {activeProduct.category}
              </span>
              <h2 className="text-xl font-extrabold text-slate-800 mt-1">{activeProduct.name}</h2>
            </div>
          </div>

          {/* Mode Selector Toggle */}
          <div className="bg-slate-100 p-1 rounded-xl flex border border-slate-200 w-max shadow-3xs">
            <button
              onClick={() => setCompareMode('client')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                compareMode === 'client'
                  ? 'bg-white text-daxx-blue shadow-xs border border-slate-200/60'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <User size={14} />
              <span>Sales: Daxx vs Client</span>
            </button>
            <button
              onClick={() => setCompareMode('supplier')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                compareMode === 'supplier'
                  ? 'bg-white text-daxx-blue shadow-xs border border-slate-200/60'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Truck size={14} />
              <span>Purchasing: Supplier vs Daxx</span>
            </button>
          </div>
        </div>

        {/* Profile Dropdown & Controls */}
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-wrap items-end gap-4 shadow-3xs">
          <div className="flex-1 min-w-[250px]">
            <label className="block text-xs font-bold text-slate-550 mb-1.5 uppercase tracking-wider">
              {compareMode === 'client' ? 'Client Specification Profile' : 'Supplier Specification Profile'}
            </label>
            <select
              value={selectedProfileId}
              onChange={e => {
                setSelectedProfileId(e.target.value);
                if (e.target.value === 'manual') {
                  setManualValues({});
                }
              }}
              className="w-full bg-white border border-slate-250 rounded-lg px-3 py-2 text-slate-800 text-sm focus:border-daxx-blue focus:outline-none focus:ring-1 focus:ring-daxx-blue shadow-2xs cursor-pointer font-medium"
            >
              <option value="manual">-- Manual Input (Simulator) --</option>
              {compareMode === 'client'
                ? activeProduct.clientSpecs?.map(c => (
                    <option key={c.customerId} value={c.customerId}>{c.customerName}</option>
                  ))
                : activeProduct.supplierSpecs?.map(s => (
                    <option key={s.supplierId} value={s.supplierId}>{s.supplierName}</option>
                  ))}
            </select>
          </div>

          <div className="flex-1 min-w-[250px]">
            <label className="block text-xs font-bold text-slate-550 mb-1.5 uppercase tracking-wider">
              Or Import from a PDF document
            </label>
            <div className="relative">
              <input
                type="file"
                accept=".pdf"
                onChange={handlePdfUpload}
                disabled={isParsing}
                className="hidden"
                id="specs-pdf-upload"
              />
              <label
                htmlFor="specs-pdf-upload"
                className={`w-full bg-white border border-dashed border-slate-350 rounded-lg px-4 py-2 text-slate-700 text-sm flex items-center justify-center gap-2 cursor-pointer hover:border-daxx-blue hover:text-daxx-blue transition-all font-semibold shadow-2xs ${
                  isParsing ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isParsing ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-daxx-blue border-t-transparent rounded-full animate-spin"></span>
                    Analysis in progress...
                  </span>
                ) : (
                  <>
                    <FileText size={16} className="text-slate-400" />
                    <span>Upload a Specifications PDF</span>
                  </>
                )}
              </label>
            </div>
          </div>
          
          <button
            onClick={handleClearSimulator}
            className="bg-white hover:bg-slate-100 text-slate-655 hover:text-slate-800 border border-slate-250 rounded-lg px-4 py-2 text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1.5 h-[38px] shrink-0"
            title="Clear all entered values"
          >
            <RotateCcw size={13} />
            Reset
          </button>

          <div className="w-full flex items-center gap-2 text-xs font-medium text-slate-500 mt-2">
            <ArrowRightLeft size={16} className="text-daxx-cyan shrink-0" />
            <span>
              {compareMode === 'client'
                ? 'Compliance rule: Daxx standard limits must be strictly equal to or tighter than those required by the client.'
                : 'Compliance rule: Supplier guaranteed limits must be strictly equal to or tighter than Daxx requirements.'}
            </span>
          </div>
        </div>

        {parseError && (
          <div className="bg-rose-50 border border-rose-250 text-rose-700 px-4 py-3 rounded-xl text-xs flex items-center gap-2 animate-shake">
            <AlertCircle size={14} />
            <span className="font-semibold">{parseError}</span>
          </div>
        )}

        {parseSuccessMsg && (
          <div className="bg-emerald-55 border border-emerald-250 text-emerald-700 px-4 py-3 rounded-xl text-xs flex items-center gap-2 animate-fade-in">
            <CheckCircle2 size={14} />
            <span className="font-semibold">{parseSuccessMsg}</span>
          </div>
        )}

        {/* Global Verdict Card */}
        {globalStatus !== 'VIDE' && (
          <div className={`border rounded-xl p-4 flex items-start gap-4 shadow-sm transition-all duration-300 animate-fade-in ${
            globalStatus === 'CONFORME' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
            globalStatus === 'NON_CONFORME' ? 'bg-rose-50 border-rose-250 text-rose-800' :
            'bg-amber-50 border-amber-250 text-amber-800'
          }`}>
            <div className="p-2.5 bg-white/80 rounded-lg shadow-3xs border border-slate-200/50 shrink-0">
              {globalStatus === 'CONFORME' ? <CheckCircle2 size={22} className="text-emerald-600" /> :
               globalStatus === 'NON_CONFORME' ? <XCircle size={22} className="text-rose-600" /> :
               <AlertCircle size={22} className="text-amber-600" />}
            </div>
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Overall compliance verdict</span>
              <h3 className="text-sm font-extrabold tracking-wide uppercase">
                {globalStatus === 'CONFORME' ? 'COMPATIBLE ✅' :
                 globalStatus === 'NON_CONFORME' ? 'INCOMPATIBLE ❌' :
                 'INCOMPLETE ⚠️'}
              </h3>
              <p className="text-xs opacity-90 leading-relaxed">
                {globalStatus === 'CONFORME' && (
                  compareMode === 'client'
                    ? 'All Daxx standard specifications meet or exceed client requirements.'
                    : 'All supplier specifications meet or exceed Daxx standard requirements.'
                )}
                {globalStatus === 'NON_CONFORME' && (
                  compareMode === 'client'
                    ? 'One or more Daxx standard specifications do not meet client requirements (Daxx is less strict).'
                    : 'One or more supplier specifications do not meet Daxx standard requirements (supplier is less strict).'
                )}
                {globalStatus === 'INCOMPLET' && 'Some required parameters have not yet been entered or imported.'}
              </p>
            </div>
          </div>
        )}

        {/* Comparison Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-3xs">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-slate-900 text-slate-300 font-bold border-b border-slate-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3">Parameter</th>
                <th className="px-4 py-3 w-[25%]">Standard Daxx</th>
                <th className="px-4 py-3 w-[30%]">
                  {compareMode === 'client' ? 'Client Specification' : 'Supplier Specification'}
                </th>
                <th className="px-4 py-3 w-[15%]">Compliance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 bg-white">
              {activeProduct.specs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400 italic">
                    No standard specification is configured for this product.
                  </td>
                </tr>
              ) : (
                activeProduct.specs.map(spec => {
                  const localSpec = manualValues[spec.id];
                  const otherVal = localSpec ? localSpec.value : '';
                  const otherLimit = localSpec ? localSpec.limitType : spec.limitType;
                  
                  const evalResult = evaluateCompliance(spec, otherVal, otherLimit);

                  return (
                    <tr key={spec.id} className="hover:bg-slate-55/20 transition-colors align-top">
                      {/* Param name & unit */}
                      <td className="px-4 py-4">
                        <div className="font-semibold text-slate-850">{spec.name}</div>
                        <span className="font-mono text-[10px] text-slate-500 px-1.5 py-0.2 bg-slate-50 border border-slate-200 rounded mt-1 inline-block">
                          {spec.unit || 'Visual'}
                        </span>
                      </td>

                      {/* Daxx standard value */}
                      <td className="px-4 py-4">
                        <div className="font-bold text-slate-800 text-sm">
                          {spec.limitType === 'min' ? '≥ ' : spec.limitType === 'max' ? '≤ ' : ''}
                          {spec.value}
                        </div>
                        <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded leading-none mt-1.5 inline-block ${
                          spec.limitType === 'min' ? 'bg-cyan-50 text-cyan-700 border border-cyan-200' :
                          spec.limitType === 'max' ? 'bg-amber-50 text-amber-750 border border-amber-200' :
                          spec.limitType === 'range' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                          'bg-slate-150 text-slate-600 border border-slate-250'
                        }`}>
                          {spec.limitType === 'min' ? 'Min required' : spec.limitType === 'max' ? 'Max allowed' : spec.limitType === 'range' ? 'Range' : 'Text'}
                        </span>
                      </td>

                      {/* Client / Supplier Spec Field (Input in manual/simulator mode, read-only if profile loaded) */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder={spec.limitType === 'text' ? 'ex: Pass' : 'ex: 99.0'}
                            value={otherVal}
                            onChange={e => handleValueChange(spec.id, e.target.value, otherLimit)}
                            className="bg-slate-50 border border-slate-250 rounded-lg px-2.5 py-1.5 text-slate-800 text-sm focus:border-daxx-blue focus:bg-white focus:outline-none focus:ring-1 focus:ring-daxx-blue w-full font-bold shadow-3xs"
                          />
                          
                          <select
                            value={otherLimit}
                            onChange={e => handleLimitTypeChange(spec.id, e.target.value as 'min' | 'max' | 'text' | 'range')}
                            className="bg-slate-50 border border-slate-250 rounded-lg px-2 py-1.5 text-slate-700 text-xs focus:border-daxx-blue focus:bg-white focus:outline-none shadow-3xs cursor-pointer"
                          >
                            <option value="min">Min</option>
                            <option value="max">Max</option>
                            <option value="text">Txt</option>
                            <option value="range">Int</option>
                          </select>
                        </div>
                      </td>

                      {/* Compliance Status & Explanation */}
                      <td className="px-4 py-4">
                        <div className="space-y-1.5">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                            evalResult.status === 'CONFORME'
                              ? 'bg-emerald-50 border-emerald-250 text-emerald-700'
                              : evalResult.status === 'NON_CONFORME'
                              ? 'bg-rose-50 border-rose-250 text-rose-700 animate-pulse'
                              : 'bg-amber-50 border-amber-250 text-amber-700'
                          }`}>
                            {evalResult.status === 'CONFORME' ? (
                              <CheckCircle2 size={11} className="text-emerald-700" />
                            ) : (
                              <AlertCircle size={11} className={evalResult.status === 'NON_CONFORME' ? 'text-rose-700' : 'text-amber-700'} />
                            )}
                            {evalResult.status}
                          </span>
                          
                          <div className="text-[11px] text-slate-550 leading-relaxed font-medium">
                            {evalResult.explanation}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
