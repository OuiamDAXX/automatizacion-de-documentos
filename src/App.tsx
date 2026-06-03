import { useState, useEffect } from 'react';
import { type ProductSpec, INITIAL_PRODUCTS } from './data/initialSpecs';
import SpecsDatabase from './components/SpecsDatabase';
import SpecsComparator from './components/SpecsComparator';
import Comparator from './components/Comparator';
import MappingDashboard from './components/MappingDashboard';
import { Layers, Database, Link2, ShieldAlert, Award, ChevronRight, Menu, X, ArrowRightLeft } from 'lucide-react';

export default function App() {
  const [products, setProducts] = useState<ProductSpec[]>(() => {
    const migrated = localStorage.getItem('daxx_specs_v8_cleaned');
    if (!migrated) {
      localStorage.removeItem('daxx_chemical_specs_v2');
      localStorage.setItem('daxx_specs_v8_cleaned', 'true');
      return INITIAL_PRODUCTS;
    }
    const saved = localStorage.getItem('daxx_chemical_specs_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const seen = new Set<string>();
          return parsed
            .filter(p => {
              if (!p.id) return false;
              if (seen.has(p.id)) return false;
              seen.add(p.id);
              return true;
            })
            .map(p => {
              const freshProduct = INITIAL_PRODUCTS.find(ip => ip.id === p.id);
              return {
                ...p,
                dbProductName: freshProduct?.dbProductName || p.dbProductName,
                netsuiteProductName: freshProduct?.netsuiteProductName || p.netsuiteProductName,
                daxxClubId: freshProduct?.daxxClubId || p.daxxClubId,
                synonyms: freshProduct ? freshProduct.synonyms : (p.synonyms || []),
                specs: (p.specs || []).map((s: any) => {
                  const freshSpec = freshProduct?.specs.find(fs => fs.id === s.id);
                  const freshSyns = freshSpec ? freshSpec.synonyms : [];
                  let existingSyns = s.synonyms || [];
                  if (s.id === 'acetic-acid-9659-acetic-acid-acetic-anhydride-water') {
                    existingSyns = existingSyns.filter((syn: string) => 
                      !['water', 'moisture', 'h2o', 'kf', 'agua', 'eau', 'humidity'].some(bad => syn.toLowerCase().includes(bad))
                    );
                  }
                  return {
                    ...s,
                    synonyms: Array.from(
                      new Set(
                        [...freshSyns, ...existingSyns].map((syn: string) => syn.trim().toLowerCase())
                      )
                    )
                  };
                })
              };
            });
        }
      } catch (e) {
        console.error('Failed to load specs from local storage', e);
      }
    }
    return INITIAL_PRODUCTS;
  });

  const [coaSelectedProductId, setCoaSelectedProductId] = useState<string>('');
  const [specsSelectedProductId, setSpecsSelectedProductId] = useState<string>('');
  const [dbSelectedProductId, setDbSelectedProductId] = useState<string>('');

  const [activeTab, setActiveTab] = useState<'comparator' | 'specs-comparator' | 'database' | 'mapping'>('comparator');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('daxx_chemical_specs_v2', JSON.stringify(products));
  }, [products]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col md:flex-row">
      {/* LEFT SIDEBAR - Desktop */}
      <aside className="hidden md:flex w-64 bg-slate-900 text-slate-300 flex-col border-r border-slate-800 shrink-0 sticky top-0 h-screen z-30">
        {/* Sidebar Header with Daxx Logo */}
        <div className="h-20 px-6 border-b border-slate-800 flex items-center gap-3">
          <div className="flex items-center">
            <div className="w-3.5 h-7 bg-daxx-green rounded-l-sm transform -skew-x-12 shadow-md"></div>
            <div className="w-3.5 h-7 bg-daxx-blue transform -skew-x-12 -ml-1.5 shadow-md"></div>
            <div className="w-3.5 h-7 bg-daxx-cyan rounded-r-sm transform -skew-x-12 -ml-1.5 shadow-md"></div>
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight text-white flex items-center gap-1">
              DAXX<span className="text-daxx-cyan font-bold text-xs uppercase tracking-widest bg-daxx-blue/20 px-1 py-0.5 rounded">CLUB</span>
            </h1>
            <span className="text-[9px] text-slate-400 font-bold tracking-wider uppercase block -mt-0.5">
              SPEC COMPARE
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          <button
            onClick={() => setActiveTab('comparator')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'comparator'
                ? 'bg-daxx-blue text-white shadow-lg shadow-daxx-blue/20'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
            }`}
          >
            <Layers size={18} />
            <span>COA Comparator</span>
          </button>
          
          <button
            onClick={() => setActiveTab('specs-comparator')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'specs-comparator'
                ? 'bg-daxx-blue text-white shadow-lg shadow-daxx-blue/20'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
            }`}
          >
            <ArrowRightLeft size={18} />
            <span>Specs Comparator</span>
          </button>
          
          <button
            onClick={() => setActiveTab('database')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'database'
                ? 'bg-daxx-blue text-white shadow-lg shadow-daxx-blue/20'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
            }`}
          >
            <Database size={18} />
            <span>Specifications Database</span>
          </button>

          <button
            onClick={() => setActiveTab('mapping')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'mapping'
                ? 'bg-daxx-blue text-white shadow-lg shadow-daxx-blue/20'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
            }`}
          >
            <Link2 size={18} />
            <span>Mapping & Synonyms</span>
          </button>
        </nav>

        {/* Sidebar Footer Info */}
        <div className="p-4 border-t border-slate-800 text-[11px] text-slate-500 space-y-1">
          <div className="flex items-center gap-1.5">
            <ShieldAlert size={12} className="text-daxx-cyan" />
            <span>Strict Quality Control</span>
          </div>
          <div>© 2026 DAXX.club</div>
        </div>
      </aside>

      {/* MOBILE HEADER & MENU */}
      <div className="md:hidden bg-slate-900 border-b border-slate-800 h-16 px-4 flex items-center justify-between text-white z-40 sticky top-0">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center">
            <div className="w-2.5 h-5 bg-daxx-green rounded-l-sm transform -skew-x-12"></div>
            <div className="w-2.5 h-5 bg-daxx-blue transform -skew-x-12 -ml-1"></div>
            <div className="w-2.5 h-5 bg-daxx-cyan rounded-r-sm transform -skew-x-12 -ml-1"></div>
          </div>
          <span className="font-black text-sm tracking-tight text-white">DAXX.club <span className="text-daxx-cyan text-xs">Compare</span></span>
        </div>
        
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1 text-slate-300 hover:text-white cursor-pointer"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* MOBILE NAVIGATION DRAWER */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-16 bg-slate-950/90 backdrop-blur-sm z-30 flex flex-col">
          <div className="bg-slate-900 border-b border-slate-800 px-4 py-6 space-y-3">
            <button
              onClick={() => { setActiveTab('comparator'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'comparator'
                  ? 'bg-daxx-blue text-white shadow-md'
                  : 'text-slate-400 hover:bg-slate-800 text-slate-200'
              }`}
            >
              <Layers size={18} />
              <span>COA Comparator</span>
            </button>
            <button
              onClick={() => { setActiveTab('specs-comparator'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'specs-comparator'
                  ? 'bg-daxx-blue text-white shadow-md'
                  : 'text-slate-400 hover:bg-slate-800 text-slate-200'
              }`}
            >
              <ArrowRightLeft size={18} />
              <span>Specs Comparator</span>
            </button>
            <button
              onClick={() => { setActiveTab('database'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'database'
                  ? 'bg-daxx-blue text-white shadow-md'
                  : 'text-slate-400 hover:bg-slate-800 text-slate-200'
              }`}
            >
              <Database size={18} />
              <span>Specifications Database</span>
            </button>
            <button
              onClick={() => { setActiveTab('mapping'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'mapping'
                  ? 'bg-daxx-blue text-white shadow-md'
                  : 'text-slate-400 hover:bg-slate-800 text-slate-200'
              }`}
            >
              <Link2 size={18} />
              <span>Mapping & Synonyms</span>
            </button>
          </div>
          <div className="flex-1" onClick={() => setMobileMenuOpen(false)}></div>
        </div>
      )}

      {/* RIGHT SIDE MAIN CONTENT CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="bg-white border-b border-slate-200 h-20 px-6 md:px-8 flex items-center justify-between sticky top-0 z-20 shadow-xs">
          <div>
            <h2 className="text-base md:text-lg font-bold text-slate-850 leading-tight">
              {activeTab === 'comparator' 
                ? "COA Comparator" 
                : activeTab === 'specs-comparator'
                  ? "Specifications Comparator"
                  : activeTab === 'database' 
                    ? "Specifications Database" 
                    : "Mapping & Synonyms"}
            </h2>
            <div className="flex items-center gap-1 text-[11px] text-slate-550 font-medium mt-0.5">
              <span>DAXX.club</span>
              <ChevronRight size={10} className="text-slate-400" />
              <span>Quality & Operations</span>
              <ChevronRight size={10} className="text-slate-400" />
              <span className="text-daxx-blue font-semibold">
                {activeTab === 'comparator' 
                  ? "COA Comparator" 
                  : activeTab === 'specs-comparator'
                    ? "Specifications Comparator"
                    : activeTab === 'database' 
                      ? "Database" 
                      : "Mapping & Synonyms"}
              </span>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-xs">
              <Award size={13} className="text-daxx-green" />
              Daxx Quality Assurance
            </span>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 p-4 md:p-8 space-y-6 max-w-[1400px] w-full mx-auto">
          {/* Active Tab rendering */}
          <div className="transition-all duration-200">
            {activeTab === 'comparator' && (
              <Comparator 
                products={products}
                selectedProductId={coaSelectedProductId}
                onSelectProduct={setCoaSelectedProductId}
              />
            )}
            {activeTab === 'specs-comparator' && (
              <SpecsComparator 
                products={products}
                selectedProductId={specsSelectedProductId}
                onSelectProduct={setSpecsSelectedProductId}
              />
            )}
            {activeTab === 'database' && (
              <SpecsDatabase 
                products={products}
                onUpdateProducts={setProducts}
                selectedProductId={dbSelectedProductId}
                onSelectProduct={setDbSelectedProductId}
              />
            )}
            {activeTab === 'mapping' && (
              <MappingDashboard 
                products={products}
                onUpdateProducts={setProducts}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
