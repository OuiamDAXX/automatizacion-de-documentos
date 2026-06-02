import { useState, useEffect } from 'react';
import { type ComparisonResult } from '../utils/pdfParser';
import { Mail, RotateCcw, Send, Globe, Hash } from 'lucide-react';

interface EmailGeneratorProps {
  productName: string;
  results: ComparisonResult[];
  globalStatus: 'CONFORME' | 'NON_CONFORME' | 'INCOMPLET' | null;
  initialLotNumber?: string;
  initialVehicleNumber?: string; // Kept in props for compatibility, can be ignored in UI
}

export default function EmailGenerator({
  productName,
  results,
  globalStatus,
  initialLotNumber = ''
}: EmailGeneratorProps) {
  // Config states - default language is English ('en')
  const [lang, setLang] = useState<'en' | 'es'>('en');
  const [lotNumber, setLotNumber] = useState(initialLotNumber);

  // Sync with parsed PDF outputs
  useEffect(() => {
    setLotNumber(initialLotNumber || '');
  }, [initialLotNumber]);

  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  // Re-generate email when inputs change
  useEffect(() => {
    if (!globalStatus) return;

    const batchStr = lotNumber.trim() || '---';
    const nonCompliant = results.filter(r => r.status === 'NON_CONFORME');
    const missing = results.filter(r => r.status === 'MANQUANT');

    // Helper to format discrepancies
    let details = '';
    if (globalStatus !== 'CONFORME') {
      let counter = 1;
      if (lang === 'es') {
        if (nonCompliant.length > 0) {
          details += `🔴 DESVIACIONES EN LAS ESPECIFICACIONES:\n`;
          nonCompliant.forEach(item => {
            details += `${counter}. ${item.spec.name} :\n`;
            details += `   - Requisito de Daxx: ${item.spec.value} ${item.spec.unit} (${item.spec.limitType === 'max' ? 'Máx' : 'Mín'})\n`;
            details += `   - Valor medido en COA: ${item.supplierData?.value || 'N/A'} ${item.supplierData?.unit || ''}\n`;
            details += `   - Detalle técnico: ${item.explanation}\n\n`;
            counter++;
          });
        }
        if (missing.length > 0) {
          details += `⚠️ PARÁMETROS FALTANTES EN EL COA:\n`;
          missing.forEach(item => {
            details += `${counter}. ${item.spec.name} :\n`;
            details += `   - Requisito de Daxx: ${item.spec.value} ${item.spec.unit}\n`;
            details += `   - Comentario: Este parámetro es obligatorio según nuestras pautas de calidad pero no aparece en su informe.\n\n`;
            counter++;
          });
        }
      } else {
        // English
        if (nonCompliant.length > 0) {
          details += `🔴 SPECIFICATION DISCREPANCIES:\n`;
          nonCompliant.forEach(item => {
            details += `${counter}. ${item.spec.name} :\n`;
            details += `   - Daxx Requirement: ${item.spec.value} ${item.spec.unit} (${item.spec.limitType === 'max' ? 'Max' : 'Min'})\n`;
            details += `   - COA Measured Value: ${item.supplierData?.value || 'N/A'} ${item.supplierData?.unit || ''}\n`;
            details += `   - Technical Rebuttal: ${item.explanation}\n\n`;
            counter++;
          });
        }
        if (missing.length > 0) {
          details += `⚠️ PARAMETERS MISSING FROM SUPPLIER REPORT:\n`;
          missing.forEach(item => {
            details += `${counter}. ${item.spec.name} :\n`;
            details += `   - Daxx Requirement: ${item.spec.value} ${item.spec.unit}\n`;
            details += `   - Justification: This parameter is required in our quality guidelines but does not appear on your COA.\n\n`;
            counter++;
          });
        }
      }
    }

    let subject = '';
    let body = '';

    if (globalStatus === 'CONFORME') {
      if (lang === 'es') {
        subject = `Aprobación de COA Conforme - ${productName} (Lote: ${batchStr})`;
        body = `Estimado equipo,\n\n` +
               `Hemos recibido y revisado su Certificado de Análisis (COA) para el lote de ${productName} (Lote ${batchStr}).\n\n` +
               `Nos complace confirmar que todos los parámetros analizados cumplen plenamente con nuestras especificaciones de referencia de Daxx.\n\n` +
               `El lote está formalmente aprobado para la carga. Pueden proceder con el llenado según el cronograma logístico previsto.\n\n` +
               `Agradecemos su valiosa cooperación.\n\n` +
               `Un saludo cordial,\n\n` +
               `Equipo de Calidad y Operaciones\n` +
               `Daxx Quality & Operations Department`;
      } else {
        // English
        subject = `COA Compliance Approval - ${productName} (Batch: ${batchStr})`;
        body = `Dear Team,\n\n` +
               `We have received and reviewed your Certificate of Analysis (COA) for the batch of ${productName} (Batch ${batchStr}).\n\n` +
               `We are pleased to confirm that all measured parameters are fully compliant with our agreed Daxx reference specifications.\n\n` +
               `This batch is officially approved for loading. You may proceed in accordance with the planned logistics schedule.\n\n` +
               `Thank you for your excellent cooperation.\n\n` +
               `Best regards,\n\n` +
               `Quality & Operations Team\n` +
               `Daxx Quality & Operations Department`;
      }
    } else {
      // NON-CONFORME / INCOMPLET
      if (lang === 'es') {
        subject = `Desviación en Certificado de Análisis (COA) - ${productName} (Lote: ${batchStr})`;
        body = `Estimado equipo,\n\n` +
               `Confirmamos la recepción del Certificado de Análisis (COA) de ${productName} (Lote ${batchStr}).\n\n` +
               `Tras verificarlo contra nuestra especificación técnica oficial de Daxx, se han identificado las siguientes diferencias :\n\n` +
               `${details}` +
               `Solicitamos que consulten con su personal técnico para evaluar esta información e indicarnos si el lote es aceptable, o en su defecto, coordinar el envío de un lote conforme.\n\n` +
               `Para no demorar las actividades logísticas de carga, agradecemos su respuesta a la mayor brevedad posible.\n\n` +
               `Saludos cordiales,\n\n` +
               `Equipo de Calidad y Operaciones\n` +
               `Daxx Quality & Operations Department`;
      } else {
        // English
        subject = `Specification Discrepancy Notification - ${productName} (Batch: ${batchStr})`;
        body = `Dear Team,\n\n` +
               `We confirm receipt of the Certificate of Analysis (COA) for ${productName} (Batch ${batchStr}).\n\n` +
               `Upon comparison with our Daxx reference specifications, the following discrepancies were identified:\n\n` +
               `${details}` +
               `Please coordinate with your technical department to evaluate these results and advise if this batch is acceptable or if another compliant lot can be allocated.\n\n` +
               `To prevent disruptions to the scheduled loading logistics, we request your response as soon as possible.\n\n` +
               `Best regards,\n\n` +
               `Quality & Operations Team\n` +
               `Daxx Quality & Operations Department`;
      }
    }

    setEmailSubject(subject);
    setEmailBody(body);
  }, [productName, results, globalStatus, lang, lotNumber]);

  // Reset helper
  const handleReset = () => {
    setLang('en');
    setLotNumber(initialLotNumber || '');
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-6 text-slate-850">
      {/* Panel Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-150 pb-4 gap-4">
        <div>
          <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
            <Mail size={18} className="text-daxx-blue" />
            Supplier Communication Email Generator
          </h3>
          <p className="text-xs text-slate-450 mt-0.5">
            Generate customized validation or alert emails for suppliers in one click.
          </p>
        </div>
        
        {/* Top level toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleReset}
            className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100/80 text-slate-650 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-slate-200"
            title="Reset to defaults"
          >
            <RotateCcw size={13} />
            Reset
          </button>
          
          <button
            onClick={() => {
              window.location.href = `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
            }}
            className="px-4 py-2 bg-daxx-blue hover:bg-blue-800 text-white font-bold rounded-lg text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-sm hover:shadow-md font-sans"
            title="Open default mail client"
          >
            <Send size={13} />
            Mail client
          </button>
        </div>
      </div>

      {/* Inputs Configuration Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-150">
        {/* Lot / Batch Number */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Hash size={11} className="text-slate-400" />
            Batch / Lot Number
          </label>
          <input
            type="text"
            placeholder="Auto-detected or custom lot number..."
            value={lotNumber}
            onChange={e => setLotNumber(e.target.value)}
            className="w-full bg-white border border-slate-250 rounded-lg px-3 py-1.5 text-slate-800 text-xs focus:border-daxx-blue focus:outline-none focus:ring-1 focus:ring-daxx-blue shadow-3xs"
          />
        </div>

        {/* Language Selection */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Globe size={11} className="text-slate-400" />
            Email Language
          </label>
          <select
            value={lang}
            onChange={e => setLang(e.target.value as any)}
            className="w-full bg-white border border-slate-250 rounded-lg px-3 py-1.5 text-slate-855 text-xs focus:border-daxx-blue focus:outline-none focus:ring-1 focus:ring-daxx-blue shadow-3xs cursor-pointer"
          >
            <option value="en">English</option>
            <option value="es">Español (Spanish)</option>
          </select>
        </div>
      </div>

      {/* Subject and Body Area */}
      <div className="space-y-4">
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Subject</label>
          <input
            type="text"
            value={emailSubject}
            onChange={e => setEmailSubject(e.target.value)}
            className="w-full bg-white border border-slate-250 rounded-lg px-3 py-2 text-slate-800 text-xs font-semibold focus:border-daxx-blue focus:outline-none focus:ring-1 focus:ring-daxx-blue shadow-3xs"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Email Body (Editable)</label>
          <textarea
            rows={10}
            value={emailBody}
            onChange={e => setEmailBody(e.target.value)}
            className="w-full bg-white border border-slate-250 rounded-lg p-3 text-slate-800 text-xs font-sans focus:border-daxx-blue focus:outline-none focus:ring-1 focus:ring-daxx-blue leading-relaxed resize-y shadow-3xs"
          />
        </div>
      </div>
    </div>
  );
}
