import { useState } from 'react';
import { type ProductSpec, type SpecItem } from '../data/initialSpecs';
import { Plus, Trash2, Edit2, Check, X, FileText, ChevronRight, Search } from 'lucide-react';


interface SpecsDatabaseProps {
  products: ProductSpec[];
  onUpdateProducts: (products: ProductSpec[]) => void;
  selectedProductId: string;
  onSelectProduct: (id: string) => void;
}

export default function SpecsDatabase({
  products,
  onUpdateProducts,
  selectedProductId,
  onSelectProduct
}: SpecsDatabaseProps) {
  const [editingSpecId, setEditingSpecId] = useState<string | null>(null);
  const [editingSpec, setEditingSpec] = useState<Partial<SpecItem>>({});
  
  // Client/customer spec states
  const [dbTab, setDbTab] = useState<'standard' | 'client' | 'supplier'>('standard');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [newSupplierName, setNewSupplierName] = useState<string>('');
  // States for overriding standard parameters
  const [editingSupplierSpecId, setEditingSupplierSpecId] = useState<string | null>(null);
  const [editingSupplierSpecValue, setEditingSupplierSpecValue] = useState<string | number>('');
  const [editingSupplierSpecLimitType, setEditingSupplierSpecLimitType] = useState<'min' | 'max' | 'text' | 'range'>('min');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [newCustomerName, setNewCustomerName] = useState<string>('');
  
  // States for overriding standard parameters
  const [editingClientSpecId, setEditingClientSpecId] = useState<string | null>(null);
  const [editingClientSpecValue, setEditingClientSpecValue] = useState<string | number>('');
  const [editingClientSpecLimitType, setEditingClientSpecLimitType] = useState<'min' | 'max' | 'text' | 'range'>('min');
  
  // States for client-specific extra parameters
  const [newClientExtraName, setNewClientExtraName] = useState<string>('');
  const [newClientExtraUnit, setNewClientExtraUnit] = useState<string>('%peso');
  const [newClientExtraValue, setNewClientExtraValue] = useState<string | number>('');
  const [newClientExtraLimitType, setNewClientExtraLimitType] = useState<'min' | 'max' | 'text' | 'range'>('min');
  const [newClientExtraSynonym, setNewClientExtraSynonym] = useState<string>('');
  const [newClientExtraSynonyms, setNewClientExtraSynonyms] = useState<string[]>([]);

  // Adding a new product state
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('Glycols');
  
  // Adding a new spec parameter state
  const [newSpec, setNewSpec] = useState<Partial<SpecItem>>({
    name: '',
    unit: '%peso',
    value: '',
    limitType: 'min',
    synonyms: []
  });
  const [newSynonym, setNewSynonym] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const activeProduct = products.find(p => p.id === selectedProductId) || products[0];

  const handleStartEditSpec = (spec: SpecItem) => {
    setEditingSpecId(spec.id);
    setEditingSpec({ ...spec });
  };

  const handleSaveSpec = (productId: string, specId: string) => {
    if (!editingSpec.name) return;

    const updatedProducts = products.map(prod => {
      if (prod.id === productId) {
        return {
          ...prod,
          specs: prod.specs.map(s => {
            if (s.id === specId) {
              return { ...s, ...editingSpec } as SpecItem;
            }
            return s;
          })
        };
      }
      return prod;
    });

    onUpdateProducts(updatedProducts);
    setEditingSpecId(null);
  };

  const handleDeleteSpec = (productId: string, specId: string) => {
    const updatedProducts = products.map(prod => {
      if (prod.id === productId) {
        return {
          ...prod,
          specs: prod.specs.filter(s => s.id !== specId)
        };
      }
      return prod;
    });
    onUpdateProducts(updatedProducts);
  };

  const handleAddSpec = (productId: string) => {
    if (!newSpec.name || newSpec.value === undefined || newSpec.value === '') return;

    const updatedProducts = products.map(prod => {
      if (prod.id === productId) {
        const valueTyped = (newSpec.limitType === 'text' || newSpec.limitType === 'range') 
          ? String(newSpec.value) 
          : parseFloat(String(newSpec.value));

        const rawSyns = [
          (newSpec.name || '').toLowerCase(),
          ...((newSpec.synonyms || [])).map(s => s.toLowerCase())
        ];
        const newItem: SpecItem = {
          id: `${productId}-${Date.now()}`,
          name: newSpec.name || '',
          unit: newSpec.unit || '',
          value: valueTyped,
          limitType: newSpec.limitType || 'min',
          synonyms: Array.from(new Set(rawSyns.map(s => s.trim().toLowerCase())))
        };

        return {
          ...prod,
          specs: [...prod.specs, newItem]
        };
      }
      return prod;
    });

    onUpdateProducts(updatedProducts);
    
    // Reset add spec form
    setNewSpec({
      name: '',
      unit: '%peso',
      value: '',
      limitType: 'min',
      synonyms: []
    });
    setNewSynonym('');
  };

  const handleAddSynonym = () => {
    if (!newSynonym) return;
    const currentSynonyms = newSpec.synonyms || [];
    if (!currentSynonyms.includes(newSynonym.toLowerCase())) {
      setNewSpec({
        ...newSpec,
        synonyms: [...currentSynonyms, newSynonym.toLowerCase()]
      });
    }
    setNewSynonym('');
  };

  const handleRemoveSynonym = (syn: string) => {
    setNewSpec({
      ...newSpec,
      synonyms: (newSpec.synonyms || []).filter(s => s !== syn)
    });
  };

  const handleCreateProduct = () => {
    if (!newProductName) return;
    const newId = newProductName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const newProduct: ProductSpec = {
      id: newId,
      name: newProductName,
      category: newProductCategory,
      synonyms: [newProductName.toLowerCase()],
      specs: []
    };

    onUpdateProducts([...products, newProduct]);
    onSelectProduct(newId);
    setNewProductName('');
    setShowAddProductModal(false);
  };

  // Supplier Management Handlers
  const handleCreateSupplierProfile = () => {
    if (!newSupplierName.trim() || !activeProduct) return;
    const supplierId = newSupplierName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    
    const supplierSpecs = activeProduct.supplierSpecs || [];
    if (supplierSpecs.some(s => s.supplierId === supplierId)) {
      alert("This supplier profile already exists for this product.");
      return;
    }

    const newSupplierSpec = {
      supplierId,
      supplierName: newSupplierName.trim(),
      specs: []
    };

    const updatedProducts = products.map(p => {
      if (p.id === activeProduct.id) {
        return {
          ...p,
          supplierSpecs: [...(p.supplierSpecs || []), newSupplierSpec]
        };
      }
      return p;
    });

    onUpdateProducts(updatedProducts);
    setSelectedSupplierId(supplierId);
    setNewSupplierName('');
  };

  const handleDeleteSupplierProfile = () => {
    if (!selectedSupplierId || !activeProduct) return;
    if (!confirm("Are you sure you want to delete this supplier profile and all its custom requirements?")) return;

    const updatedProducts = products.map(p => {
      if (p.id === activeProduct.id) {
        return {
          ...p,
          supplierSpecs: (p.supplierSpecs || []).filter(s => s.supplierId !== selectedSupplierId)
        };
      }
      return p;
    });

    onUpdateProducts(updatedProducts);
    setSelectedSupplierId('');
  };

  const handleSaveSupplierSpecOverride = (specId: string, value: string | number, limitType: 'min' | 'max' | 'text' | 'range') => {
    if (!selectedSupplierId || !activeProduct) return;

    const updatedProducts = products.map(p => {
      if (p.id === activeProduct.id) {
        const supplierSpecs = (p.supplierSpecs || []).map(s => {
          if (s.supplierId === selectedSupplierId) {
            const existingSpecIndex = s.specs.findIndex(sp => sp.specId === specId);
            let newSpecs = [...s.specs];
            
            const numericVal = (limitType === 'text' || limitType === 'range') ? String(value) : parseFloat(String(value));

            if (existingSpecIndex !== -1) {
               newSpecs[existingSpecIndex] = {
                 ...newSpecs[existingSpecIndex],
                 value: numericVal,
                 limitType
               };
            } else {
               newSpecs.push({
                 specId,
                 value: numericVal,
                 limitType
               });
            }

            return { ...s, specs: newSpecs };
          }
          return s;
        });

        return { ...p, supplierSpecs };
      }
      return p;
    });

    onUpdateProducts(updatedProducts);
    setEditingSupplierSpecId(null);
  };

  const handleDeleteSupplierSpecOverride = (specId: string) => {
    if (!selectedSupplierId || !activeProduct) return;

    const updatedProducts = products.map(p => {
      if (p.id === activeProduct.id) {
        const supplierSpecs = (p.supplierSpecs || []).map(s => {
          if (s.supplierId === selectedSupplierId) {
            return {
              ...s,
              specs: s.specs.filter(sp => sp.specId !== specId)
            };
          }
          return s;
        });

        return { ...p, supplierSpecs };
      }
      return p;
    });

    onUpdateProducts(updatedProducts);
  };

  // Customer Management Handlers
  const handleCreateClientProfile = () => {
    if (!newCustomerName.trim() || !activeProduct) return;
    const customerId = newCustomerName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    
    const clientSpecs = activeProduct.clientSpecs || [];
    if (clientSpecs.some(c => c.customerId === customerId)) {
      alert("This customer profile already exists for this product.");
      return;
    }

    const newClientSpec = {
      customerId,
      customerName: newCustomerName.trim(),
      specs: []
    };

    const updatedProducts = products.map(p => {
      if (p.id === activeProduct.id) {
        return {
          ...p,
          clientSpecs: [...(p.clientSpecs || []), newClientSpec]
        };
      }
      return p;
    });

    onUpdateProducts(updatedProducts);
    setSelectedClientId(customerId);
    setNewCustomerName('');
  };

  const handleDeleteClientProfile = () => {
    if (!selectedClientId || !activeProduct) return;
    if (!confirm("Are you sure you want to delete this customer profile and all its custom requirements?")) return;

    const updatedProducts = products.map(p => {
      if (p.id === activeProduct.id) {
        return {
          ...p,
          clientSpecs: (p.clientSpecs || []).filter(c => c.customerId !== selectedClientId)
        };
      }
      return p;
    });

    onUpdateProducts(updatedProducts);
    setSelectedClientId('');
  };

  const handleSaveClientSpecOverride = (specId: string, value: string | number, limitType: 'min' | 'max' | 'text' | 'range') => {
    if (!selectedClientId || !activeProduct) return;

    const updatedProducts = products.map(p => {
      if (p.id === activeProduct.id) {
        const clientSpecs = (p.clientSpecs || []).map(c => {
          if (c.customerId === selectedClientId) {
            const existingSpecIndex = c.specs.findIndex(s => s.specId === specId);
            let newSpecs = [...c.specs];
            
            const numericVal = (limitType === 'text' || limitType === 'range') ? String(value) : parseFloat(String(value));

            if (existingSpecIndex !== -1) {
               newSpecs[existingSpecIndex] = {
                 ...newSpecs[existingSpecIndex],
                 value: numericVal,
                 limitType
               };
            } else {
               newSpecs.push({
                 specId,
                 value: numericVal,
                 limitType
               });
            }

            return { ...c, specs: newSpecs };
          }
          return c;
        });

        return { ...p, clientSpecs };
      }
      return p;
    });

    onUpdateProducts(updatedProducts);
    setEditingClientSpecId(null);
  };

  const handleDeleteClientSpecOverride = (specId: string) => {
    if (!selectedClientId || !activeProduct) return;

    const updatedProducts = products.map(p => {
      if (p.id === activeProduct.id) {
        const clientSpecs = (p.clientSpecs || []).map(c => {
          if (c.customerId === selectedClientId) {
            return {
              ...c,
              specs: c.specs.filter(s => s.specId !== specId)
            };
          }
          return c;
        });

        return { ...p, clientSpecs };
      }
      return p;
    });

    onUpdateProducts(updatedProducts);
  };

  const handleAddClientExtraParam = () => {
    if (!selectedClientId || !activeProduct || !newClientExtraName.trim() || newClientExtraValue === '') return;

    const extraId = `client-extra-${selectedClientId}-${Date.now()}`;
    const valueTyped = (newClientExtraLimitType === 'text' || newClientExtraLimitType === 'range') 
      ? String(newClientExtraValue) 
      : parseFloat(String(newClientExtraValue));

    const newExtra = {
      specId: extraId,
      value: valueTyped,
      limitType: newClientExtraLimitType,
      name: newClientExtraName.trim(),
      unit: newClientExtraUnit,
      synonyms: Array.from(new Set([
        newClientExtraName.trim().toLowerCase(),
        ...newClientExtraSynonyms.map(s => s.toLowerCase())
      ])),
      isExtra: true
    } as any; // Cast as any because it has extra fields name, unit, synonyms, isExtra

    const updatedProducts = products.map(p => {
      if (p.id === activeProduct.id) {
        const clientSpecs = (p.clientSpecs || []).map(c => {
          if (c.customerId === selectedClientId) {
            return {
              ...c,
              specs: [...c.specs, newExtra]
            };
          }
          return c;
        });
        return { ...p, clientSpecs };
      }
      return p;
    });

    onUpdateProducts(updatedProducts);
    
    // Reset fields
    setNewClientExtraName('');
    setNewClientExtraUnit('%peso');
    setNewClientExtraValue('');
    setNewClientExtraLimitType('min');
    setNewClientExtraSynonym('');
    setNewClientExtraSynonyms([]);
  };

  const handleAddExtraSynonym = () => {
    if (!newClientExtraSynonym.trim()) return;
    if (!newClientExtraSynonyms.includes(newClientExtraSynonym.trim().toLowerCase())) {
      setNewClientExtraSynonyms([...newClientExtraSynonyms, newClientExtraSynonym.trim().toLowerCase()]);
    }
    setNewClientExtraSynonym('');
  };

  const handleRemoveExtraSynonym = (syn: string) => {
    setNewClientExtraSynonyms(newClientExtraSynonyms.filter(s => s !== syn));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Product List Sidebar - scrollable with fixed height */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col" style={{maxHeight: '80vh', position: 'sticky', top: '6rem'}}>
        <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-200 shrink-0">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <FileText size={18} className="text-daxx-blue" />
            Daxx Specifications
          </h3>
          <button 
            onClick={() => setShowAddProductModal(true)}
            className="p-1.5 bg-daxx-green hover:bg-emerald-700 text-white rounded-lg transition-all cursor-pointer"
            title="Add a product"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* Product Search Input */}
        <div className="mb-4 relative shrink-0">
          <input
            type="text"
            placeholder="Search product..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-250 rounded-lg pl-9 pr-8 py-2 text-slate-850 text-sm focus:border-daxx-blue focus:bg-white focus:outline-none focus:ring-1 focus:ring-daxx-blue shadow-2xs"
          />
          <Search size={16} className="absolute left-3 top-3 text-slate-400" />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 font-semibold cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Categories / Products list - scrollable */}
        <div className="space-y-2 overflow-y-auto flex-1 pr-1">
          {(() => {
            const filtered = products.filter(prod => 
              prod.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
              prod.category.toLowerCase().includes(searchTerm.toLowerCase())
            );
            if (filtered.length === 0) {
              return (
                <div className="text-center text-slate-400 py-6 text-sm italic">
                  No products found
                </div>
              );
            }
            return filtered.map(prod => (
              <button
                key={prod.id}
                onClick={() => onSelectProduct(prod.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between transition-all group cursor-pointer ${
                  selectedProductId === prod.id
                    ? 'bg-daxx-blue text-white shadow-md font-medium'
                    : 'bg-slate-50 text-slate-600 hover:text-slate-800 hover:bg-slate-100/70 border border-slate-200/50'
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
            ));
          })()}
        </div>
      </div>

      {/* Product Specs Detail Area */}
      <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-6">
        {activeProduct ? (
          <>
            <div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
                <div>
                  <span className="px-2.5 py-0.5 bg-slate-50 border border-slate-200 rounded-full text-xs text-daxx-blue font-semibold">
                    {activeProduct.category}
                  </span>
                  <h2 className="text-xl font-bold text-slate-800 mt-1">{activeProduct.name}</h2>
                </div>
              </div>

              {/* Tabs Toggle */}
              <div className="flex border-b border-slate-200 mb-6 gap-6">
                <button
                  onClick={() => setDbTab('standard')}
                  className={`pb-3 font-semibold text-sm border-b-2 transition-all cursor-pointer ${
                    dbTab === 'standard' ? 'border-daxx-blue text-daxx-blue' : 'border-transparent text-slate-450 hover:text-slate-650'
                  }`}
                >
                  Standard Specs Daxx
                </button>
                <button
                  onClick={() => setDbTab('client')}
                  className={`pb-3 font-semibold text-sm border-b-2 transition-all cursor-pointer ${
                    dbTab === 'client' ? 'border-daxx-blue text-daxx-blue' : 'border-transparent text-slate-450 hover:text-slate-650'
                  }`}
                >
                  Client Profiles
                </button>
                <button
                  onClick={() => setDbTab('supplier')}
                  className={`pb-3 font-semibold text-sm border-b-2 transition-all cursor-pointer ${
                    dbTab === 'supplier' ? 'border-daxx-blue text-daxx-blue' : 'border-transparent text-slate-450 hover:text-slate-650'
                  }`}
                >
                  Supplier Profiles
                </button>
              </div>

              {dbTab === 'standard' ? (
                <>
                  {/* Specs Table */}
                  <div className="overflow-x-auto rounded-lg border border-slate-200 mb-6">
                    <table className="w-full text-left border-collapse text-sm text-slate-700">
                      <thead className="bg-slate-50 text-slate-650 font-bold border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3">Parameter</th>
                          <th className="px-4 py-3">Unit</th>
                          <th className="px-4 py-3">Limit Value</th>
                          <th className="px-4 py-3">Rule</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 bg-white">
                        {activeProduct.specs.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic">
                              No specifications configured. Add a parameter below.
                            </td>
                          </tr>
                        ) : (
                          activeProduct.specs.map(spec => (
                            <tr key={spec.id} className="hover:bg-slate-50/40 transition-colors">
                              <td className="px-4 py-3 font-medium text-slate-850">
                                {editingSpecId === spec.id ? (
                                  <input
                                    type="text"
                                    value={editingSpec.name || ''}
                                    onChange={e => setEditingSpec({ ...editingSpec, name: e.target.value })}
                                    className="bg-white border border-slate-250 rounded px-2 py-1 text-slate-800 w-full text-sm focus:border-daxx-blue focus:outline-none focus:ring-1 focus:ring-daxx-blue"
                                  />
                                ) : (
                                  spec.name
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {editingSpecId === spec.id ? (
                                  <input
                                    type="text"
                                    value={editingSpec.unit || ''}
                                    onChange={e => setEditingSpec({ ...editingSpec, unit: e.target.value })}
                                    className="bg-white border border-slate-250 rounded px-2 py-1 text-slate-800 w-full text-sm focus:border-daxx-blue focus:outline-none focus:ring-1 focus:ring-daxx-blue"
                                  />
                                ) : (
                                  <span className="font-mono text-slate-600 text-xs px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded">
                                    {spec.unit}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {editingSpecId === spec.id ? (
                                  <input
                                    type={(editingSpec.limitType === 'text' || editingSpec.limitType === 'range') ? 'text' : 'number'}
                                    step="any"
                                    value={editingSpec.value !== undefined ? editingSpec.value : ''}
                                    onChange={e => setEditingSpec({ 
                                      ...editingSpec, 
                                      value: (editingSpec.limitType === 'text' || editingSpec.limitType === 'range') ? e.target.value : parseFloat(e.target.value) || 0 
                                    })}
                                    className="bg-white border border-slate-250 rounded px-2 py-1 text-slate-800 w-full text-sm focus:border-daxx-blue focus:outline-none focus:ring-1 focus:ring-daxx-blue"
                                  />
                                ) : (
                                  <span className="font-semibold text-slate-800">{spec.value}</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {editingSpecId === spec.id ? (
                                  <select
                                    value={editingSpec.limitType}
                                    onChange={e => setEditingSpec({ 
                                      ...editingSpec, 
                                      limitType: e.target.value as 'min' | 'max' | 'text' | 'range',
                                      value: (e.target.value === 'text' || e.target.value === 'range') ? '' : 0
                                    })}
                                    className="bg-white border border-slate-250 rounded px-2 py-1 text-slate-800 w-full text-sm focus:border-daxx-blue focus:outline-none focus:ring-1 focus:ring-daxx-blue"
                                  >
                                    <option value="min">Minimum (Min)</option>
                                    <option value="max">Maximum (Max)</option>
                                    <option value="text">Text / Visual</option>
                                    <option value="range">Range</option>
                                  </select>
                                ) : (
                                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                                    spec.limitType === 'min' ? 'bg-cyan-50 text-cyan-700 border-cyan-200' :
                                    spec.limitType === 'max' ? 'bg-amber-50 text-amber-750 border-amber-200' :
                                    spec.limitType === 'range' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                    'bg-slate-100 text-slate-600 border-slate-200'
                                  }`}>
                                    {spec.limitType === 'min' ? 'Min' : spec.limitType === 'max' ? 'Max' : spec.limitType === 'range' ? 'Range' : 'Text'}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex justify-end gap-2">
                                  {editingSpecId === spec.id ? (
                                    <>
                                      <button
                                        onClick={() => handleSaveSpec(activeProduct.id, spec.id)}
                                        className="p-1.5 bg-daxx-green hover:bg-emerald-600 rounded-lg text-white transition-colors cursor-pointer"
                                      >
                                        <Check size={14} />
                                      </button>
                                      <button
                                        onClick={() => setEditingSpecId(null)}
                                        className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors cursor-pointer border border-slate-200"
                                      >
                                        <X size={14} />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => handleStartEditSpec(spec)}
                                        className="p-1.5 text-slate-550 hover:text-daxx-blue hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                                        title="Edit"
                                      >
                                        <Edit2 size={13} />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteSpec(activeProduct.id, spec.id)}
                                        className="p-1.5 text-slate-550 hover:text-rose-600 hover:bg-rose-55 rounded-lg transition-all cursor-pointer"
                                        title="Delete"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Quick Add Specification parameter */}
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-4">
                    <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                      <Plus size={16} className="text-daxx-blue" />
                      Add a specification to {activeProduct.name}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-550 mb-1">Parameter Name</label>
                        <input
                          type="text"
                          placeholder="e.g.: Purity, Acidity"
                          value={newSpec.name}
                          onChange={e => setNewSpec({ ...newSpec, name: e.target.value })}
                          className="w-full bg-white border border-slate-250 rounded-lg px-3 py-2 text-slate-850 text-sm focus:border-daxx-blue focus:outline-none focus:ring-1 focus:ring-daxx-blue shadow-2xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-550 mb-1">Limit Type</label>
                        <select
                          value={newSpec.limitType}
                          onChange={e => setNewSpec({ 
                            ...newSpec, 
                            limitType: e.target.value as 'min' | 'max' | 'text' | 'range',
                            value: (e.target.value === 'text' || e.target.value === 'range') ? '' : ''
                          })}
                          className="w-full bg-white border border-slate-250 rounded-lg px-3 py-2 text-slate-850 text-sm focus:border-daxx-blue focus:outline-none focus:ring-1 focus:ring-daxx-blue shadow-2xs cursor-pointer"
                        >
                          <option value="min">Minimum (Min)</option>
                          <option value="max">Maximum (Max)</option>
                          <option value="text">Text / Visual</option>
                          <option value="range">Range</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-550 mb-1">Standard Value</label>
                        <input
                          type="text"
                          placeholder={(newSpec.limitType === 'text' || newSpec.limitType === 'range') ? 'ex: 183 - 185' : '99.0'}
                          value={newSpec.value !== undefined ? newSpec.value : ''}
                          onChange={e => setNewSpec({ ...newSpec, value: e.target.value })}
                          className="w-full bg-white border border-slate-250 rounded-lg px-3 py-2 text-slate-850 text-sm focus:border-daxx-blue focus:outline-none focus:ring-1 focus:ring-daxx-blue shadow-2xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-550 mb-1">Unit</label>
                        <input
                          type="text"
                          placeholder="e.g.: wt%, ppm"
                          value={newSpec.unit}
                          onChange={e => setNewSpec({ ...newSpec, unit: e.target.value })}
                          disabled={newSpec.limitType === 'text' || newSpec.limitType === 'range'}
                          className="w-full bg-white border border-slate-250 rounded-lg px-3 py-2 text-slate-850 text-sm focus:border-daxx-blue focus:outline-none disabled:opacity-50 disabled:bg-slate-100 shadow-2xs"
                        />
                      </div>
                    </div>

                    {/* Synonym mapping editor */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-550 mb-1">
                        Synonym Mapping (how the supplier may call this parameter in the COA)
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Enter a synonym (e.g.: purity, moisture, water content) and press add"
                          value={newSynonym}
                          onChange={e => setNewSynonym(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddSynonym())}
                          className="flex-1 bg-white border border-slate-250 rounded-lg px-3 py-2 text-slate-850 text-sm focus:border-daxx-blue focus:outline-none focus:ring-1 focus:ring-daxx-blue shadow-2xs"
                        />
                        <button
                          onClick={handleAddSynonym}
                          className="px-4 bg-slate-250 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg text-sm transition-all cursor-pointer border border-slate-300/40"
                        >
                          Add
                        </button>
                      </div>
                      
                      {/* Render current synonyms tag list */}
                      {newSpec.synonyms && newSpec.synonyms.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {newSpec.synonyms.map(syn => (
                            <span key={syn} className="inline-flex items-center gap-1 text-[11px] bg-daxx-blue/10 text-daxx-blue border border-daxx-blue/20 px-2 py-0.5 rounded-full font-bold shadow-2xs">
                              {syn}
                              <button onClick={() => handleRemoveSynonym(syn)} className="text-slate-450 hover:text-rose-600 cursor-pointer">
                                <X size={10} />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        onClick={() => handleAddSpec(activeProduct.id)}
                        disabled={!newSpec.name || newSpec.value === ''}
                        className="px-5 py-2.5 bg-daxx-green hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold rounded-lg text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer"
                      >
                        <Plus size={16} />
                        Create Specification
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* CLIENT PROFILES VIEW */}
                  <div className="flex flex-wrap items-end gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-xs font-semibold text-slate-550 mb-1">Select Customer Profile</label>
                      <select
                        value={selectedClientId}
                        onChange={e => setSelectedClientId(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm focus:border-daxx-blue focus:outline-none"
                      >
                        <option value="">-- Choose a Customer --</option>
                        {activeProduct.clientSpecs?.map(c => (
                          <option key={c.customerId} value={c.customerId}>{c.customerName}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <div className="flex-1 sm:flex-none">
                        <input
                          type="text"
                          placeholder="New customer name..."
                          value={newCustomerName}
                          onChange={e => setNewCustomerName(e.target.value)}
                          className="w-full sm:w-48 bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm focus:border-daxx-blue focus:outline-none shadow-2xs"
                        />
                      </div>
                      <button
                        onClick={handleCreateClientProfile}
                        disabled={!newCustomerName.trim()}
                        className="px-4 py-2 bg-daxx-blue hover:bg-blue-800 text-white font-semibold rounded-lg text-sm transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <Plus size={16} /> Add
                      </button>
                      {selectedClientId && (
                        <button
                          onClick={handleDeleteClientProfile}
                          className="p-2 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition-all cursor-pointer"
                          title="Delete customer profile"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </div>

                  {selectedClientId ? (
                    (() => {
                      const activeClientSpec = activeProduct.clientSpecs?.find(c => c.customerId === selectedClientId);
                      const extraSpecs = activeClientSpec?.specs.filter(s => (s as any).isExtra) || [];

                      return (
                        <div className="space-y-6">
                          <div>
                            <h4 className="font-bold text-slate-800 text-sm mb-3">
                              Standard Limit Overrides for {activeClientSpec?.customerName}
                            </h4>
                            <div className="overflow-x-auto rounded-lg border border-slate-200">
                              <table className="w-full text-left border-collapse text-sm text-slate-700">
                                <thead className="bg-slate-50 text-slate-650 font-bold border-b border-slate-200">
                                  <tr>
                                    <th className="px-4 py-3">Parameter</th>
                                    <th className="px-4 py-3">Unit</th>
                                    <th className="px-4 py-3">Daxx Standard Limit</th>
                                    <th className="px-4 py-3">Client Override Limit</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-150 bg-white">
                                  {activeProduct.specs.map(spec => {
                                    const override = activeClientSpec?.specs.find(s => s.specId === spec.id);
                                    const isEditing = editingClientSpecId === spec.id;

                                    return (
                                      <tr key={spec.id} className="hover:bg-slate-50/40 transition-colors">
                                        <td className="px-4 py-3 font-semibold text-slate-800">{spec.name}</td>
                                        <td className="px-4 py-3 font-mono text-xs text-slate-550">{spec.unit}</td>
                                        <td className="px-4 py-3 text-slate-600">
                                          <span className="font-semibold">{spec.value}</span>
                                          <span className="text-[10px] uppercase font-bold text-slate-400 block">
                                            {spec.limitType === 'min' ? 'Min' : spec.limitType === 'max' ? 'Max' : spec.limitType === 'range' ? 'Range' : 'Text'}
                                          </span>
                                        </td>
                                        <td className="px-4 py-3">
                                          {isEditing ? (
                                            <div className="flex gap-2 items-center">
                                              <input
                                                type={(editingClientSpecLimitType === 'text' || editingClientSpecLimitType === 'range') ? 'text' : 'number'}
                                                step="any"
                                                value={editingClientSpecValue}
                                                onChange={e => setEditingClientSpecValue(e.target.value)}
                                                className="bg-white border border-slate-250 rounded px-2 py-1 text-slate-800 w-24 text-sm focus:border-daxx-blue focus:outline-none"
                                              />
                                              <select
                                                value={editingClientSpecLimitType}
                                                onChange={e => setEditingClientSpecLimitType(e.target.value as 'min' | 'max' | 'text' | 'range')}
                                                className="bg-white border border-slate-250 rounded px-2 py-1 text-slate-800 text-sm focus:border-daxx-blue"
                                              >
                                                <option value="min">Min</option>
                                                <option value="max">Max</option>
                                                <option value="text">Visual</option>
                                                <option value="range">Range</option>
                                              </select>
                                            </div>
                                          ) : override ? (
                                            <span className="inline-flex flex-col">
                                              <span className="font-bold text-daxx-blue">{override.value}</span>
                                              <span className="text-[10px] uppercase font-black text-daxx-blue bg-daxx-blue/10 px-1 py-0.5 rounded w-max mt-0.5 border border-daxx-blue/20">
                                                {override.limitType === 'min' ? 'Min (Client Override)' : override.limitType === 'max' ? 'Max (Client Override)' : override.limitType === 'range' ? 'Range (Client)' : 'Text (Client)'}
                                              </span>
                                            </span>
                                          ) : (
                                            <span className="text-slate-400 italic">Daxx Standard (Default)</span>
                                          )}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                          <div className="flex justify-end gap-2">
                                            {isEditing ? (
                                              <>
                                                <button
                                                  onClick={() => handleSaveClientSpecOverride(spec.id, editingClientSpecValue, editingClientSpecLimitType)}
                                                  className="p-1.5 bg-daxx-green hover:bg-emerald-600 rounded-lg text-white cursor-pointer"
                                                >
                                                  <Check size={14} />
                                                </button>
                                                <button
                                                  onClick={() => setEditingClientSpecId(null)}
                                                  className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-500 cursor-pointer border border-slate-200"
                                                >
                                                  <X size={14} />
                                                </button>
                                              </>
                                            ) : (
                                              <>
                                                <button
                                                  onClick={() => {
                                                    setEditingClientSpecId(spec.id);
                                                    setEditingClientSpecValue(override ? override.value : spec.value);
                                                    setEditingClientSpecLimitType(override ? override.limitType : spec.limitType);
                                                  }}
                                                  className="px-2.5 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 font-semibold cursor-pointer"
                                                >
                                                  Set Override
                                                </button>
                                                {override && (
                                                  <button
                                                    onClick={() => handleDeleteClientSpecOverride(spec.id)}
                                                    className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                                                    title="Reset to Daxx default"
                                                  >
                                                    <Trash2 size={13} />
                                                  </button>
                                                )}
                                              </>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* Extra Specific client specifications */}
                          <div>
                            <h4 className="font-bold text-slate-800 text-sm mb-3">
                              Additional Parameters Specific to {activeClientSpec?.customerName}
                            </h4>
                            <div className="overflow-x-auto rounded-lg border border-slate-200">
                              <table className="w-full text-left border-collapse text-sm text-slate-700">
                                <thead className="bg-slate-50 text-slate-650 font-bold border-b border-slate-200">
                                  <tr>
                                    <th className="px-4 py-3">Parameter Name</th>
                                    <th className="px-4 py-3">Unit</th>
                                    <th className="px-4 py-3">Client Specific Requirement</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-150 bg-white">
                                  {extraSpecs.length === 0 ? (
                                    <tr>
                                      <td colSpan={4} className="px-4 py-6 text-center text-slate-400 italic">
                                        No custom parameters defined for this client. Use the creator form below.
                                      </td>
                                    </tr>
                                  ) : (
                                    extraSpecs.map(extra => (
                                      <tr key={extra.specId} className="hover:bg-slate-50/40 transition-colors">
                                        <td className="px-4 py-3 font-bold text-daxx-blue">{(extra as any).name}</td>
                                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{(extra as any).unit}</td>
                                        <td className="px-4 py-3 font-bold">
                                          {extra.value}
                                          <span className="text-[10px] uppercase font-bold text-slate-450 block">
                                            {extra.limitType === 'min' ? 'Minimum limit' : extra.limitType === 'max' ? 'Maximum limit' : extra.limitType === 'range' ? 'Required Range' : 'Required Text'}
                                          </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                          <button
                                            onClick={() => handleDeleteClientSpecOverride(extra.specId)}
                                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                                            title="Delete extra parameter"
                                          >
                                            <Trash2 size={13} />
                                          </button>
                                        </td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* Quick Add Custom Parameter specific to Client */}
                          <div className="bg-slate-55 rounded-xl p-4 border border-slate-200 space-y-4">
                            <h5 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                              <Plus size={14} className="text-daxx-blue" />
                              Add Custom Additional Parameter for {activeClientSpec?.customerName}
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                              <div>
                                <label className="block text-xs font-semibold text-slate-550 mb-1">Parameter Name</label>
                                <input
                                  type="text"
                                  placeholder="e.g.: Density at 15°C, Impurities"
                                  value={newClientExtraName}
                                  onChange={e => setNewClientExtraName(e.target.value)}
                                  className="w-full bg-white border border-slate-250 rounded-lg px-3 py-2 text-slate-850 text-sm focus:border-daxx-blue focus:outline-none focus:ring-1 focus:ring-daxx-blue"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-slate-550 mb-1">Limit Rule</label>
                                <select
                                  value={newClientExtraLimitType}
                                  onChange={e => setNewClientExtraLimitType(e.target.value as 'min' | 'max' | 'text' | 'range')}
                                  className="w-full bg-white border border-slate-250 rounded-lg px-3 py-2 text-slate-850 text-sm focus:border-daxx-blue focus:outline-none cursor-pointer"
                                >
                                  <option value="min">Minimum (Min)</option>
                                  <option value="max">Maximum (Max)</option>
                                  <option value="text">Text / Visual</option>
                                  <option value="range">Range</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-slate-550 mb-1">Required Limit</label>
                                <input
                                  type="text"
                                  placeholder={(newClientExtraLimitType === 'text' || newClientExtraLimitType === 'range') ? 'ex: 183 - 185' : '0.850'}
                                  value={newClientExtraValue}
                                  onChange={e => setNewClientExtraValue(e.target.value)}
                                  className="w-full bg-white border border-slate-250 rounded-lg px-3 py-2 text-slate-850 text-sm focus:border-daxx-blue focus:outline-none focus:ring-1 focus:ring-daxx-blue"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-slate-550 mb-1">Unit</label>
                                <input
                                  type="text"
                                  placeholder="e.g.: g/cm3, ppm"
                                  value={newClientExtraUnit}
                                  onChange={e => setNewClientExtraUnit(e.target.value)}
                                  disabled={newClientExtraLimitType === 'text' || newClientExtraLimitType === 'range'}
                                  className="w-full bg-white border border-slate-250 rounded-lg px-3 py-2 text-slate-850 text-sm focus:border-daxx-blue focus:outline-none disabled:opacity-50 disabled:bg-slate-100"
                                />
                              </div>
                            </div>

                            {/* Synonym mapping editor for extra param */}
                            <div>
                              <label className="block text-xs font-semibold text-slate-550 mb-1">
                                Synonym Mapping (how the supplier may name it in the COA)
                              </label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  placeholder="Enter a synonym (e.g.: density, density15) and press add"
                                  value={newClientExtraSynonym}
                                  onChange={e => setNewClientExtraSynonym(e.target.value)}
                                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddExtraSynonym())}
                                  className="flex-1 bg-white border border-slate-250 rounded-lg px-3 py-2 text-slate-850 text-sm focus:border-daxx-blue focus:outline-none focus:ring-1 focus:ring-daxx-blue"
                                />
                                <button
                                  onClick={handleAddExtraSynonym}
                                  className="px-4 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg text-sm transition-all cursor-pointer border border-slate-350"
                                >
                                  Add
                                </button>
                              </div>
                              
                              {/* Synonym tag rendering */}
                              {newClientExtraSynonyms.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  {newClientExtraSynonyms.map(syn => (
                                    <span key={syn} className="inline-flex items-center gap-1 text-[11px] bg-daxx-blue/10 text-daxx-blue border border-daxx-blue/20 px-2 py-0.5 rounded-full font-bold">
                                      {syn}
                                      <button onClick={() => handleRemoveExtraSynonym(syn)} className="text-slate-450 hover:text-rose-600 cursor-pointer">
                                        <X size={10} />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="flex justify-end pt-1">
                              <button
                                onClick={handleAddClientExtraParam}
                                disabled={!newClientExtraName.trim() || newClientExtraValue === ''}
                                className="px-4 py-2 bg-daxx-blue hover:bg-blue-800 disabled:opacity-50 text-white font-semibold rounded-lg text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer"
                              >
                                <Plus size={14} />
                                Add Extra Parameter
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="text-center py-16 border border-dashed border-slate-250 bg-slate-50/50 rounded-xl text-slate-450 italic">
                      Please select an existing customer profile or create a new one above to configure specific chemical requirements.
                    </div>
                  )}
                </>
              )}

              {dbTab === 'supplier' && (
                <>
                  {/* SUPPLIER PROFILES VIEW */}
                  <div className="flex flex-wrap items-end gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-xs font-semibold text-slate-550 mb-1">Select Supplier Profile</label>
                      <select
                        value={selectedSupplierId}
                        onChange={e => setSelectedSupplierId(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm focus:border-daxx-blue focus:outline-none"
                      >
                        <option value="">-- Choose a Supplier --</option>
                        {activeProduct.supplierSpecs?.map(s => (
                          <option key={s.supplierId} value={s.supplierId}>{s.supplierName}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <div className="flex-1 sm:flex-none">
                        <input
                          type="text"
                          placeholder="New supplier name..."
                          value={newSupplierName}
                          onChange={e => setNewSupplierName(e.target.value)}
                          className="w-full sm:w-48 bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm focus:border-daxx-blue focus:outline-none shadow-2xs"
                        />
                      </div>
                      <button
                        onClick={handleCreateSupplierProfile}
                        disabled={!newSupplierName.trim()}
                        className="px-4 py-2 bg-daxx-blue hover:bg-blue-800 text-white font-semibold rounded-lg text-sm transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <Plus size={16} /> Add
                      </button>
                      {selectedSupplierId && (
                        <button
                          onClick={handleDeleteSupplierProfile}
                          className="p-2 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition-all cursor-pointer"
                          title="Delete supplier profile"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </div>

                  {selectedSupplierId ? (
                    (() => {
                      const activeSupplierSpec = activeProduct.supplierSpecs?.find(s => s.supplierId === selectedSupplierId);

                      return (
                        <div className="space-y-6">
                          <div>
                            <h4 className="font-bold text-slate-800 text-sm mb-3">
                              Standard Limit Overrides for {activeSupplierSpec?.supplierName}
                            </h4>
                            <div className="overflow-x-auto rounded-lg border border-slate-200">
                              <table className="w-full text-left border-collapse text-sm text-slate-700">
                                <thead className="bg-slate-50 text-slate-650 font-bold border-b border-slate-200">
                                  <tr>
                                    <th className="px-4 py-3">Parameter</th>
                                    <th className="px-4 py-3">Unit</th>
                                    <th className="px-4 py-3">Daxx Standard Limit</th>
                                    <th className="px-4 py-3">Supplier Override Limit</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-150 bg-white">
                                  {activeProduct.specs.map(spec => {
                                    const override = activeSupplierSpec?.specs.find(s => s.specId === spec.id);
                                    const isEditing = editingSupplierSpecId === spec.id;

                                    return (
                                      <tr key={spec.id} className="hover:bg-slate-50/40 transition-colors">
                                        <td className="px-4 py-3 font-semibold text-slate-800">{spec.name}</td>
                                        <td className="px-4 py-3 font-mono text-xs text-slate-550">{spec.unit}</td>
                                        <td className="px-4 py-3 text-slate-600">
                                          <span className="font-semibold">{spec.value}</span>
                                          <span className="text-[10px] uppercase font-bold text-slate-400 block">
                                            {spec.limitType === 'min' ? 'Min' : spec.limitType === 'max' ? 'Max' : spec.limitType === 'range' ? 'Range' : 'Text'}
                                          </span>
                                        </td>
                                        <td className="px-4 py-3">
                                          {isEditing ? (
                                            <div className="flex gap-2 items-center">
                                              <input
                                                type={editingSupplierSpecLimitType === 'text' ? 'text' : 'number'}
                                                step="any"
                                                value={editingSupplierSpecValue}
                                                onChange={e => setEditingSupplierSpecValue(e.target.value)}
                                                className="bg-white border border-slate-250 rounded px-2 py-1 text-slate-800 w-24 text-sm focus:border-daxx-blue focus:outline-none"
                                              />
                                              <select
                                                value={editingSupplierSpecLimitType}
                                                onChange={e => setEditingSupplierSpecLimitType(e.target.value as 'min' | 'max' | 'text' | 'range')}
                                                className="bg-white border border-slate-250 rounded px-2 py-1 text-slate-800 text-sm focus:border-daxx-blue"
                                              >
                                                <option value="min">Min</option>
                                                <option value="max">Max</option>
                                                <option value="text">Text</option>
                                                <option value="range">Range</option>
                                              </select>
                                            </div>
                                          ) : override ? (
                                            <span className="inline-flex flex-col">
                                              <span className="font-bold text-daxx-blue">{override.value}</span>
                                              <span className="text-[10px] uppercase font-black text-daxx-blue bg-daxx-blue/10 px-1 py-0.5 rounded w-max mt-0.5 border border-daxx-blue/20">
                                                {override.limitType === 'min' ? 'Min (Supplier Override)' : override.limitType === 'max' ? 'Max (Supplier Override)' : override.limitType === 'range' ? 'Range (Supplier)' : 'Text (Supplier)'}
                                              </span>
                                            </span>
                                          ) : (
                                            <span className="text-slate-400 italic">Daxx Standard (Default)</span>
                                          )}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                          <div className="flex justify-end gap-2">
                                            {isEditing ? (
                                              <>
                                                <button
                                                  onClick={() => handleSaveSupplierSpecOverride(spec.id, editingSupplierSpecValue, editingSupplierSpecLimitType)}
                                                  className="p-1.5 bg-daxx-green hover:bg-emerald-600 rounded-lg text-white cursor-pointer"
                                                >
                                                  <Check size={14} />
                                                </button>
                                                <button
                                                  onClick={() => setEditingSupplierSpecId(null)}
                                                  className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-500 cursor-pointer border border-slate-200"
                                                >
                                                  <X size={14} />
                                                </button>
                                              </>
                                            ) : (
                                              <>
                                                <button
                                                  onClick={() => {
                                                    setEditingSupplierSpecId(spec.id);
                                                    setEditingSupplierSpecValue(override ? override.value : spec.value);
                                                    setEditingSupplierSpecLimitType(override ? override.limitType : spec.limitType);
                                                  }}
                                                  className="px-2.5 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 font-semibold cursor-pointer"
                                                >
                                                  Set Override
                                                </button>
                                                {override && (
                                                  <button
                                                    onClick={() => handleDeleteSupplierSpecOverride(spec.id)}
                                                    className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                                                    title="Reset to Daxx default"
                                                  >
                                                    <Trash2 size={13} />
                                                  </button>
                                                )}
                                              </>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="text-center py-16 border border-dashed border-slate-250 bg-slate-50/50 rounded-xl text-slate-450 italic">
                      Please select an existing supplier profile or create a new one above to configure specific chemical requirements.
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        ) : (
            <div className="text-center py-12 text-slate-450 italic">
              No product selected.
            </div>
          )}
        </div>

        {/* Add Product Modal Dialog */}
        {showAddProductModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xl w-full max-w-md space-y-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                <Plus size={20} className="text-daxx-blue" />
                Create a new product
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-550 mb-1">Chemical Product Name</label>
                  <input
                    type="text"
                    placeholder="e.g.: Ethylene Glycol, Butanol"
                    value={newProductName}
                    onChange={e => setNewProductName(e.target.value)}
                    className="w-full bg-white border border-slate-250 rounded-lg px-3 py-2 text-slate-850 text-sm focus:border-daxx-blue focus:outline-none focus:ring-1 focus:ring-daxx-blue shadow-2xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-550 mb-1">Category</label>
                  <select
                    value={newProductCategory}
                    onChange={e => setNewProductCategory(e.target.value)}
                    className="w-full bg-white border border-slate-250 rounded-lg px-3 py-2 text-slate-850 text-sm focus:border-daxx-blue focus:outline-none focus:ring-1 focus:ring-daxx-blue shadow-2xs cursor-pointer"
                  >
                    <option value="Glycols">Glycols</option>
                    <option value="Alcohols">Alcohols</option>
                    <option value="Esters">Esters</option>
                    <option value="Solvents">Solvents</option>
                    <option value="Others">Others</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowAddProductModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-650 font-semibold rounded-lg text-sm border border-slate-200 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateProduct}
                  disabled={!newProductName}
                  className="px-4 py-2 bg-daxx-green hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold rounded-lg text-sm shadow-md transition-all cursor-pointer"
                >
                  Create Product
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
