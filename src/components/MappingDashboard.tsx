import { useState, useMemo } from 'react';
import { type ProductSpec } from '../data/initialSpecs';
import { 
  X, 
  AlertCircle, 
  Settings, 
  FileSpreadsheet, 
  Search
} from 'lucide-react';

interface MappingDashboardProps {
  products: ProductSpec[];
  onUpdateProducts: (products: ProductSpec[]) => void;
}

export default function MappingDashboard({ products, onUpdateProducts }: MappingDashboardProps) {
  const [newSyns, setNewSyns] = useState<Record<string, string>>({});
  const [newProductSyns, setNewProductSyns] = useState<Record<string, string>>({});

  // Search filter query states
  const [paramSearchQuery, setParamSearchQuery] = useState('');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [paramTab, setParamTab] = useState<'properties' | 'compounds' | 'granulometry'>('properties');

  const classifyParam = (name: string): 'properties' | 'compounds' | 'granulometry' => {
    const lower = name.toLowerCase();
    
    // Granulometry & Mesh sizing or operator-based numbers
    if (
      lower.includes('mesh') || 
      lower.includes('size') || 
      /^[><=+\-\s\d\./%]+$/.test(name) ||
      lower.startsWith('≤') ||
      lower.startsWith('≥')
    ) {
      return 'granulometry';
    }
    
    // Compounds & Impurities (specific chemical names or formulas)
    if (
      lower.includes('acid') || 
      lower.includes('alcohol') || 
      lower.includes('glycol') ||
      lower.includes('ether') ||
      lower.includes('acetate') ||
      lower.includes('acrylate') ||
      lower.includes('carbonate') ||
      lower.includes('hydroxide') ||
      lower.includes('sulfate') ||
      lower.includes('chloride') ||
      lower.includes('sodium') ||
      lower.includes('potassium') ||
      lower.includes('zinc') ||
      lower.includes('lead') ||
      lower.includes('iron') ||
      lower.includes('mercury') ||
      lower.includes('copper') ||
      lower.includes('methanol') ||
      lower.includes('ethanol') ||
      lower.includes('toluene') ||
      lower.includes('benzene') ||
      lower.includes('hexane') ||
      lower.includes('hydrocarbon') ||
      lower.includes('impurity') ||
      lower.includes('impurities') ||
      lower.includes('other') ||
      lower.includes('others') ||
      lower.includes('inhibitor') ||
      /^[A-Z][a-z]?\d*$/.test(name)
    ) {
      return 'compounds';
    }
    
    return 'properties';
  };

  const getStandardParamName = (name: string): string => {
    const lower = name.toLowerCase().trim();
    
    if (lower.startsWith('purity') || lower.startsWith('assay') || lower.includes('active ingredient') || lower.includes('active content') || lower === 'pureza' || lower === 'pureté' || lower === 'riqueza') {
      return 'Purity / Assay';
    }
    if (lower.startsWith('heavy metals') || lower.includes('heavy metals') || lower === 'métaux lourds' || lower === 'metales pesados') {
      return 'Heavy Metals';
    }
    if (lower.startsWith('refractive index') || lower.startsWith('refraction index') || lower === 'índice de refracción' || lower === 'indice de réfraction') {
      return 'Refractive Index';
    }
    if (lower.startsWith('specific gravity') || lower.startsWith('specific weight') || lower.startsWith('density') || lower === 'densidad' || lower === 'densité') {
      return 'Specific Gravity / Density';
    }
    if (lower.startsWith('saponification')) {
      return 'Saponification Index / Value';
    }
    if (lower.startsWith('water') || lower === 'moisture' || lower === 'humidity' || lower === 'eau' || lower === 'agua' || lower === 'humedad' || lower === 'teneur en eau') {
      return 'Water / Moisture';
    }
    if (lower.startsWith('acidity') || lower === 'acid value' || lower === 'acid number' || lower === 'acidez' || lower === 'acidité' || lower === 'valor de acidez' || lower === 'número de acidez' || lower === 'acidez libre' || lower === 'acidez total' || lower === 'índice de acidez' || lower === 'acidité' || lower === 'indice d\'acide' || lower === 'valor ácido') {
      return 'Acidity / Acid Value';
    }
    if (lower.startsWith('ash') || lower === 'cinzas' || lower === 'cendres' || lower === 'teor de cinzas') {
      return 'Ash Content';
    }
    if (lower.startsWith('iron') || lower === 'fe' || lower === 'ferro' || lower === 'fer') {
      return 'Iron';
    }
    if (lower.includes('impurity') || lower.includes('impurities') || lower.includes('impureza') || lower.includes('impurezas') || lower.includes('impureté') || lower.includes('impuretés')) {
      return 'Total Impurities';
    }
    if (lower.includes('volatile') || lower.includes('volátiles') || lower === 'volatiles') {
      return 'Volatiles / Volatile Content';
    }
    if (lower.includes('distillation range') || lower === 'faixa de destilação' || lower === 'ibp' || lower === 'fbp') {
      return 'Distillation Range';
    }
    if (lower === 'grado alcohólico') {
      return 'Alcohol Grade';
    }
    if (lower.startsWith('grado de hidrólisis') || lower.startsWith('grau de hidrólise')) {
      return 'Hydrolysis Grade';
    }
    if (lower === 'ácido fórmico' || lower === 'formic acid') {
      return 'Formic Acid';
    }
    if (lower === 'ácido p-toluico' || lower === 'p-toluic acid') {
      return 'p-Toluic Acid';
    }
    if (lower.startsWith('appearance') || lower.startsWith('apperance') || lower === 'clarity' || lower === 'turbidity' || lower === 'apparence' || lower === 'apariencia') {
      return 'Appearance';
    }
    if (lower === 'ph' || lower.startsWith('ph ') || lower.startsWith('ph(')) {
      if (lower.includes('10%') || lower.includes('10 %')) return 'pH (10% Solution)';
      if (lower.includes('5%') || lower.includes('5 %')) return 'pH (5% Solution)';
      if (lower.includes('4%') || lower.includes('4 %')) return 'pH (4% Solution)';
      if (lower.includes('20%') || lower.includes('20 %')) return 'pH (20% Solution)';
      if (lower.includes('50/50')) return 'pH (50/50 Solution)';
      return 'pH';
    }
    if (lower.startsWith('chloride') || lower.startsWith('cloruro') || lower.startsWith('chlorine') || lower.includes('chlorinated')) {
      return 'Chlorides';
    }
    if (lower.startsWith('sulfate') || lower.startsWith('sulphate') || lower === 'so4' || lower.startsWith('sulfato')) {
      return 'Sulfates';
    }
    if (lower.startsWith('viscosity') || lower.startsWith('viscosidad') || lower.startsWith('viscosidade')) {
      if (lower.includes('40')) return 'Viscosity @ 40°C';
      if (lower.includes('25')) return 'Viscosity @ 25°C';
      if (lower.includes('20')) return 'Viscosity @ 20°C';
      return 'Viscosity';
    }
    if (lower.startsWith('flash point') || lower.startsWith('flash, tcc') || lower === 'punto de inflamación') {
      if (lower.includes('°f') || lower.includes('(°f)') || lower.includes(' f')) return 'Flash Point (°F)';
      return 'Flash Point (°C)';
    }
    if (lower.startsWith('loss on drying') || lower.startsWith('loss drying') || lower === 'pérdida por secado') {
      return 'Loss on Drying';
    }
    if (lower.startsWith('iodine')) {
      return 'Iodine Value / Index';
    }
    if (lower.startsWith('aldehyde') || lower === 'acetaldehyde') {
      return 'Aldehydes';
    }
    if (lower === 'methanol' || lower === 'metanol') {
      return 'Methanol';
    }
    
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  // Dynamically extract all unique canonical parameters from our database
  const uniqueParams = useMemo(() => {
    const paramsMap: Record<string, { name: string; unit: string; synonyms: string[] }> = {};
    products.forEach(p => {
      p.specs.forEach(s => {
        const cleanName = s.name.trim();
        const stdName = getStandardParamName(cleanName);
        const key = stdName.toLowerCase();
        if (!paramsMap[key]) {
          paramsMap[key] = {
            name: stdName,
            unit: s.unit,
            synonyms: Array.from(new Set(s.synonyms.map(syn => syn.trim().toLowerCase())))
          };
        } else {
          s.synonyms.forEach(syn => {
            const cleanSyn = syn.trim().toLowerCase();
            if (!paramsMap[key].synonyms.includes(cleanSyn)) {
              paramsMap[key].synonyms.push(cleanSyn);
            }
          });
        }
      });
    });

    return Object.values(paramsMap).sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  // Find synonyms that are duplicated across multiple parameters (conflict warning)
  const synonymConflicts = useMemo(() => {
    const synToParams: Record<string, string[]> = {};
    uniqueParams.forEach(param => {
      param.synonyms.forEach(syn => {
        const cleanSyn = syn.trim().toLowerCase();
        if (!synToParams[cleanSyn]) {
          synToParams[cleanSyn] = [];
        }
        const label = param.name;
        if (!synToParams[cleanSyn].includes(label)) {
          synToParams[cleanSyn].push(label);
        }
      });
    });

    const conflicts: Record<string, string[]> = {};
    Object.entries(synToParams).forEach(([syn, paramLabels]) => {
      if (paramLabels.length > 1) {
        conflicts[syn] = paramLabels;
      }
    });
    return conflicts;
  }, [uniqueParams]);

  // Filter unique parameters by search query
  const filteredParams = useMemo(() => {
    const q = paramSearchQuery.toLowerCase().trim();
    if (!q) return uniqueParams;
    return uniqueParams.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.synonyms.some(syn => syn.toLowerCase().includes(q))
    );
  }, [uniqueParams, paramSearchQuery]);

  // Categorized parameters for displaying counts and filtering
  const categorizedParams = useMemo(() => {
    const categories: Record<'properties' | 'compounds' | 'granulometry', typeof filteredParams> = {
      properties: [],
      compounds: [],
      granulometry: []
    };

    filteredParams.forEach(p => {
      const cat = classifyParam(p.name);
      categories[cat].push(p);
    });

    return categories;
  }, [filteredParams]);

  // Group products by category, filtered by product search query
  const productsByCategory = useMemo(() => {
    const q = productSearchQuery.toLowerCase().trim();
    const filtered = products.filter(p => 
      !q ||
      p.name.toLowerCase().includes(q) || 
      p.category.toLowerCase().includes(q) ||
      (p.dbProductName && p.dbProductName.toLowerCase().includes(q)) ||
      (p.netsuiteProductName && p.netsuiteProductName.toLowerCase().includes(q)) ||
      (p.synonyms || []).some(syn => syn.toLowerCase().includes(q))
    );

    const groups: Record<string, typeof products> = {};
    filtered.forEach(p => {
      if (!groups[p.category]) {
        groups[p.category] = [];
      }
      groups[p.category].push(p);
    });
    return groups;
  }, [products, productSearchQuery]);

  const handleAddSynonym = (paramName: string) => {
    const key = paramName.toLowerCase();
    const syn = newSyns[key]?.trim();
    if (!syn) return;
    const cleanSyn = syn.toLowerCase();

    // Propagate synonym addition to all products containing specs that map to this standard name
    const updatedProducts = products.map(prod => ({
      ...prod,
      specs: prod.specs.map(s => {
        if (getStandardParamName(s.name).toLowerCase() === paramName.toLowerCase()) {
          if (!s.synonyms.includes(cleanSyn)) {
            return { ...s, synonyms: [...s.synonyms, cleanSyn] };
          }
        }
        return s;
      })
    }));

    onUpdateProducts(updatedProducts);
    setNewSyns({ ...newSyns, [key]: '' });
  };

  const handleAddProductSynonym = (productId: string) => {
    const syn = newProductSyns[productId]?.trim();
    if (!syn) return;
    const cleanSyn = syn.toLowerCase();

    const updatedProducts = products.map(prod => {
      if (prod.id === productId) {
        const currentSyns = prod.synonyms || [];
        const hasSynonym = currentSyns.some(s => s.toLowerCase() === cleanSyn);
        if (!hasSynonym) {
          return { ...prod, synonyms: [...currentSyns, syn] };
        }
      }
      return prod;
    });

    onUpdateProducts(updatedProducts);
    setNewProductSyns({ ...newProductSyns, [productId]: '' });
  };

  const handleRemoveSynonym = (paramName: string, synToRemove: string) => {
    const updatedProducts = products.map(prod => ({
      ...prod,
      specs: prod.specs.map(s => {
        if (getStandardParamName(s.name).toLowerCase() === paramName.toLowerCase()) {
          return { ...s, synonyms: s.synonyms.filter(x => x !== synToRemove) };
        }
        return s;
      })
    }));

    onUpdateProducts(updatedProducts);
  };

  const handleRemoveProductSynonym = (productId: string, synToRemove: string) => {
    const updatedProducts = products.map(prod => {
      if (prod.id === productId) {
        return {
          ...prod,
          synonyms: (prod.synonyms || []).filter(x => x !== synToRemove)
        };
      }
      return prod;
    });

    onUpdateProducts(updatedProducts);
  };

  const handleExportSynonymsCsv = () => {
    let csvContent = "\uFEFFParameter,Synonyms\n";
    
    uniqueParams.forEach(param => {
      const synListStr = param.synonyms.join('; ');
      const escapedName = `"${param.name.replace(/"/g, '""')}"`;
      const escapedSyns = `"${synListStr.replace(/"/g, '""')}"`;
      csvContent += `${escapedName},${escapedSyns}\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "daxx_synonyms_dictionary.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };



  return (
    <div className="space-y-6">
      {/* Introduction Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-start gap-4">
        <div className="p-3 bg-daxx-blue/10 rounded-xl text-daxx-blue border border-daxx-blue/15">
          <Settings size={22} className="animate-spin-slow" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-800">Synonym Management & Mapping</h3>
          <p className="text-xs text-slate-500 leading-relaxed mt-1">
            Supplier Certificates of Analysis (COA) and technical datasheets often use different terminology for chemical properties.
            The mapping system below links these terms to your standard DAXX properties to enable automatic and reliable extraction.
          </p>
        </div>
      </div>

      {/* Main Layout Container */}
      <div className="space-y-8">
        
        {/* SECTION 1: Synonym Dictionary (Parameters) */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h4 className="font-extrabold text-slate-850 text-sm">1. Parameter Synonyms Dictionary</h4>
              <p className="text-[10px] text-slate-400">Link technical terms from imported COAs to standard properties</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search for a parameter..."
                  value={paramSearchQuery}
                  onChange={e => setParamSearchQuery(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs font-semibold focus:border-daxx-blue focus:outline-none w-48 shadow-3xs focus:bg-white transition-all"
                />
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
              </div>
              <button
                onClick={handleExportSynonymsCsv}
                className="text-xs text-daxx-blue hover:text-blue-800 font-bold flex items-center gap-1.5 px-3 py-1.5 bg-daxx-blue/10 hover:bg-daxx-blue/15 border border-daxx-blue/20 rounded-lg transition-all cursor-pointer shadow-3xs"
              >
                <FileSpreadsheet size={13} />
                Export (CSV)
              </button>
            </div>
          </div>

          {/* Sub-tabs Toggle for Parameter Categories */}
          <div className="flex flex-wrap border-b border-slate-200 mb-2 gap-x-6 gap-y-2 text-xs font-bold text-slate-500 shrink-0">
            <button
              onClick={() => setParamTab('properties')}
              className={`pb-2.5 border-b-2 transition-all cursor-pointer ${
                paramTab === 'properties' ? 'border-daxx-blue text-daxx-blue' : 'border-transparent hover:text-slate-750'
              }`}
            >
              Chemical & Physical Properties ({categorizedParams.properties.length})
            </button>
            <button
              onClick={() => setParamTab('compounds')}
              className={`pb-2.5 border-b-2 transition-all cursor-pointer ${
                paramTab === 'compounds' ? 'border-daxx-blue text-daxx-blue' : 'border-transparent hover:text-slate-750'
              }`}
            >
              Compounds & Impurities ({categorizedParams.compounds.length})
            </button>
            <button
              onClick={() => setParamTab('granulometry')}
              className={`pb-2.5 border-b-2 transition-all cursor-pointer ${
                paramTab === 'granulometry' ? 'border-daxx-blue text-daxx-blue' : 'border-transparent hover:text-slate-750'
              }`}
            >
              Granulometry & Mesh Sizes ({categorizedParams.granulometry.length})
            </button>
          </div>

          {categorizedParams[paramTab].length === 0 ? (
            <div className="text-center py-8 text-slate-400 italic text-xs">
              No parameters in this category match your search.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-1">
              {categorizedParams[paramTab].map(param => {
                const paramKey = param.name.toLowerCase();
                return (
                  <div key={paramKey} className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-3xs flex flex-col justify-between space-y-3 hover:shadow-xs hover:border-slate-300 transition-all">
                    <div>
                      <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                        <span className="font-bold text-slate-800 text-xs truncate max-w-[200px]" title={param.name}>
                          {param.name}
                        </span>
                      </div>
                      
                      <span className="text-[9px] text-slate-400 block mt-1">
                        Unit: <span className="font-mono text-slate-600 font-bold">{param.unit || '-'}</span>
                      </span>

                      {/* Synonym list */}
                      <div className="flex flex-wrap gap-1 mt-2.5 min-h-[36px] content-start">
                        {param.synonyms.map(syn => {
                          const conflicts = synonymConflicts[syn.trim().toLowerCase()];
                          const hasConflict = conflicts && conflicts.length > 1;
                          const conflictTooltip = hasConflict 
                            ? `Conflict: this synonym is also associated with: ${conflicts.filter(n => n !== param.name).join(', ')}`
                            : undefined;

                          return (
                            <span 
                              key={syn} 
                              className={`inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full font-bold border transition-all ${
                                hasConflict 
                                  ? 'bg-rose-50 border-rose-250 text-rose-700 hover:bg-rose-100/50 shadow-3xs cursor-help' 
                                  : 'bg-white border-slate-250 text-slate-700 hover:border-slate-350 shadow-3xs'
                              }`}
                              title={conflictTooltip}
                            >
                              {hasConflict && <AlertCircle size={9} className="text-rose-500 shrink-0" />}
                              {syn}
                              <button 
                                onClick={() => handleRemoveSynonym(param.name, syn)} 
                                className="text-slate-400 hover:text-rose-600 cursor-pointer ml-0.5"
                                title={`Remove ${syn}`}
                              >
                                <X size={9} />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {/* Add synonym inline */}
                    <div className="pt-2 border-t border-slate-200/60 flex gap-1.5">
                      <input 
                        type="text" 
                        placeholder="Add a synonym..." 
                        value={newSyns[paramKey] || ''} 
                        onChange={e => setNewSyns({...newSyns, [paramKey]: e.target.value})}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleAddSynonym(param.name);
                        }}
                        className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 text-[11px] flex-1 focus:border-daxx-blue focus:outline-none focus:ring-1 focus:ring-daxx-blue/20 transition-all shadow-3xs"
                      />
                      <button
                        onClick={() => handleAddSynonym(param.name)}
                        className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[10px] font-bold transition-all cursor-pointer shadow-3xs"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SECTION 2: Product Name Synonym Dictionary */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h4 className="font-extrabold text-slate-850 text-sm">2. Product Name Synonyms</h4>
              <p className="text-[10px] text-slate-400">Link supplier trade or regional names to your product records</p>
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="Search for a product..."
                value={productSearchQuery}
                onChange={e => setProductSearchQuery(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs font-semibold focus:border-daxx-blue focus:outline-none w-48 shadow-3xs focus:bg-white transition-all"
              />
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
            </div>
          </div>

          {Object.keys(productsByCategory).length === 0 ? (
            <div className="text-center py-8 text-slate-400 italic text-xs">
              No product matches your search.
            </div>
          ) : (
            <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-1">
              {Object.entries(productsByCategory).map(([category, prods]) => (
                <div key={category} className="space-y-3">
                  <h5 className="text-[11px] font-black text-slate-400 uppercase tracking-wider pl-1">
                    {category}
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {prods.map(prod => (
                      <div key={prod.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-3xs flex flex-col justify-between space-y-3 hover:shadow-xs hover:border-slate-300 transition-all">
                        <div>
                          <div className="flex items-start justify-between gap-2 border-b border-slate-200/60 pb-1.5">
                            <span className="font-bold text-slate-800 text-xs" title={prod.name}>
                              {prod.name}
                            </span>
                            {(prod.dbProductName || prod.daxxClubId) && (
                              <div className="flex flex-col items-end gap-1">
                                {prod.dbProductName && (
                                  <span className="text-[7.5px] font-black bg-blue-50 text-blue-700 border border-blue-200/60 px-1 py-0.2 rounded leading-none">
                                    Daxx.club: {prod.dbProductName}
                                  </span>
                                )}
                                {prod.netsuiteProductName && (
                                  <span className="text-[8px] font-bold bg-teal-50 text-teal-700 border border-teal-200/60 px-1 py-0.2 rounded leading-none">
                                    NetSuite: {prod.netsuiteProductName}
                                  </span>
                                )}
                                {prod.daxxClubId && (
                                  <span className="text-[7.5px] font-mono bg-slate-100 text-slate-500 border border-slate-200 px-1 py-0.2 rounded leading-none truncate max-w-[130px]" title={`Daxx.club ID: ${prod.daxxClubId}`}>
                                    ID: {prod.daxxClubId}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Synonym list */}
                          <div className="flex flex-wrap gap-1 mt-2.5 min-h-[36px] content-start">
                            {(prod.synonyms || []).map(syn => (
                              <span 
                                key={syn} 
                                className="inline-flex items-center gap-1 text-[9px] bg-white border border-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold hover:border-slate-350 transition-colors shadow-3xs"
                              >
                                {syn}
                                <button 
                                  onClick={() => handleRemoveProductSynonym(prod.id, syn)} 
                                  className="text-slate-400 hover:text-rose-600 cursor-pointer ml-0.5"
                                  title={`Remove ${syn}`}
                                >
                                  <X size={9} />
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Add synonym inline */}
                        <div className="pt-2 border-t border-slate-200/60 flex gap-1.5">
                          <input 
                            type="text" 
                            placeholder="Add a synonym..." 
                            value={newProductSyns[prod.id] || ''} 
                            onChange={e => setNewProductSyns({...newProductSyns, [prod.id]: e.target.value})}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleAddProductSynonym(prod.id);
                            }}
                            className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 text-[11px] flex-1 focus:border-daxx-blue focus:outline-none focus:ring-1 focus:ring-daxx-blue/20 transition-all shadow-3xs"
                          />
                          <button
                            onClick={() => handleAddProductSynonym(prod.id)}
                            className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[10px] font-bold transition-all cursor-pointer shadow-3xs"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
