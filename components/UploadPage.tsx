
import React, { useState, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Parcel, ParcelStatus, BulkUploadBatch, AIAnalysisResult } from '../types';
import { GeminiService } from '../services/geminiService';
import ParcelTable from './ParcelTable';
import AIInsights from './AIInsights';

interface UploadPageProps {
  onBatchComplete: (batch: BulkUploadBatch) => void;
}

const UploadPage: React.FC<UploadPageProps> = ({ onBatchComplete }) => {
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const allowedPrefixes = ['017', '013', '016', '018', '019', '014', '015'];

  const hasDuplicates = useMemo(() => {
    const ids = parcels.map(p => (p.invoiceId || '').trim()).filter(id => id !== "");
    return new Set(ids).size !== ids.length;
  }, [parcels]);

  const hasErrors = useMemo(() => {
    return parcels.some(p => p.status === ParcelStatus.ERROR);
  }, [parcels]);

  const downloadTemplate = () => {
    const headers = ["Invoice ID", "Recipient Name", "Phone Number", "Full Address", "COD Amount", "Weight (kg)", "Note"];
    const sampleData = [
      ["INV-1001", "Abdur Rahman", "01712345678", "House 12, Road 5, Dhanmondi, Dhaka", "1500", "1.5", "Handle with care"],
      ["", "Sumaiya Akter", "01811223344", "Plot 45, Sector 7, Uttara, Dhaka", "0", "0.5", "Fragile - Deliver after 5 PM"],
      ["INV-1003", "Karim Mia", "01912334455", "Shop 4, Market Road, Chittagong", "550", "2.2", "Deliver to reception"]
    ];

    const escapeCSV = (val: string) => `"${val.toString().replace(/"/g, '""')}"`;
    const csvContent = [
      headers.map(escapeCSV).join(","),
      ...sampleData.map(row => row.map(escapeCSV).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "parcel_upload_template.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCSVContent = (text: string): string[][] => {
    const result: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;
    
    const lines = text.split('\n');
    const firstLine = lines[0] || '';
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semiCount = (firstLine.match(/;/g) || []).length;
    const delimiter = semiCount > commaCount ? ';' : ',';

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        row.push(field.trim());
        field = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (field || row.length > 0) {
          row.push(field.trim());
          result.push(row);
        }
        row = [];
        field = '';
        if (char === '\r' && nextChar === '\n') i++;
      } else {
        field += char;
      }
    }
    if (field || row.length > 0) {
      row.push(field.trim());
      result.push(row);
    }
    return result;
  };

  const normalizePhone = (phone: string): string => {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('880') && cleaned.length === 13) cleaned = cleaned.substring(2);
    else if (cleaned.startsWith('88') && cleaned.length === 13) cleaned = cleaned.substring(2);
    else if (cleaned.length === 10 && cleaned.startsWith('1')) cleaned = '0' + cleaned;
    return cleaned;
  };

  const validatePhone = (phone: string): boolean => {
    if (phone.length !== 11) return false;
    return allowedPrefixes.some(prefix => phone.startsWith(prefix));
  };

  const processCSVData = (rows: string[][]): Parcel[] => {
    if (rows.length < 1) return [];

    const headerRow = rows[0];
    const findIndex = (keywords: string[]) => 
      headerRow.findIndex(h => keywords.some(k => h.toLowerCase().trim().includes(k.toLowerCase())));

    const idx = {
      invoice: findIndex(['invoice', 'inv', 'id', 'sl', 'no']),
      name: findIndex(['name', 'recipient', 'customer', 'receiver', 'client']),
      phone: findIndex(['phone', 'mobile', 'contact', 'number', 'tel', 'cell']),
      address: findIndex(['address', 'location', 'dest', 'place', 'area', 'full']),
      cod: findIndex(['cod', 'cash', 'amount', 'collect']),
      weight: findIndex(['weight', 'kg', 'mass', 'gm', 'gram']),
      note: findIndex(['note', 'comment', 'instruction', 'remarks', 'msg'])
    };

    const initialParcels = rows.slice(1).map((row): Parcel => {
      const getVal = (foundIdx: number, fallbackIdx: number) => {
        const finalIdx = foundIdx !== -1 ? foundIdx : fallbackIdx;
        const val = row[finalIdx];
        return val !== undefined ? String(val).trim() : "";
      };

      const rawWeight = getVal(idx.weight, 5).replace(',', '.');
      const parsedWeight = parseFloat(rawWeight) || 0;
      
      const rawCod = getVal(idx.cod, 4).replace(/[^0-9.]/g, '');
      const parsedCod = parseFloat(rawCod) || 0;

      const phone = normalizePhone(getVal(idx.phone, 2));

      return {
        id: uuidv4(),
        invoiceId: getVal(idx.invoice, 0),
        recipientName: getVal(idx.name, 1),
        phone: phone,
        address: getVal(idx.address, 3),
        codAmount: parsedCod,
        weight: parsedWeight,
        note: getVal(idx.note, 6),
        serviceType: 'Standard',
        status: ParcelStatus.PENDING
      };
    }).filter(p => p.invoiceId || p.recipientName || p.phone || p.address);

    const idCounts: Record<string, number> = {};
    initialParcels.forEach(p => {
      const tid = (p.invoiceId || '').trim();
      if (tid) {
        idCounts[tid] = (idCounts[tid] || 0) + 1;
      }
    });

    return initialParcels.map(p => {
      const tid = (p.invoiceId || '').trim();
      if (tid && idCounts[tid] > 1) {
        return { 
          ...p, 
          status: ParcelStatus.WARNING, 
          statusMessage: 'Duplicate Invoice ID' 
        };
      }
      if (!validatePhone(p.phone)) {
        return {
          ...p,
          status: ParcelStatus.ERROR,
          statusMessage: 'Invalid Operator/Length'
        };
      }
      return p;
    });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setIsReading(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const rows = parseCSVContent(text);
        const parsedData = processCSVData(rows);
        
        if (parsedData.length === 0) {
          setUploadError("No valid data found. Please use the official template.");
          setIsReading(false);
        } else {
          setParcels(parsedData);
          setStep(2);
          setIsReading(false);
        }
      } catch (err) {
        setUploadError("Error processing file. Please check the CSV format.");
        setIsReading(false);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleRemoveParcel = (id: string) => {
    setParcels(prev => {
      const filtered = prev.filter(p => p.id !== id);
      
      const idCounts: Record<string, number> = {};
      filtered.forEach(p => {
        const tid = (p.invoiceId || '').trim();
        if (tid) idCounts[tid] = (idCounts[tid] || 0) + 1;
      });

      return filtered.map(p => {
        const tid = (p.invoiceId || '').trim();
        const isCurrentlyMarkedDuplicate = p.statusMessage === 'Duplicate Invoice ID';
        const isStillDuplicate = tid && idCounts[tid] > 1;

        if (isCurrentlyMarkedDuplicate && !isStillDuplicate) {
          const isInvalidPhone = !validatePhone(p.phone);
          if (isInvalidPhone) {
            return {
              ...p,
              status: ParcelStatus.ERROR,
              statusMessage: 'Invalid Operator/Length'
            };
          }
          return {
            ...p,
            status: ParcelStatus.VALID,
            statusMessage: undefined
          };
        }
        
        if (!isCurrentlyMarkedDuplicate && isStillDuplicate) {
          return {
            ...p,
            status: ParcelStatus.WARNING,
            statusMessage: 'Duplicate Invoice ID'
          };
        }

        return p;
      });
    });
  };

  const startAIAnalysis = async () => {
    if (parcels.length === 0) return;
    setIsAnalyzing(true);
    const service = new GeminiService();
    const result = await service.analyzeParcels(parcels);
    
    const updatedParcels = parcels.map(p => {
      const correction = result.correctedParcels.find(c => c.id === p.id);
      if (correction) {
        return { 
          ...p, 
          status: ParcelStatus.WARNING, 
          statusMessage: p.statusMessage 
            ? `${p.statusMessage} & ${correction.issue}` 
            : correction.issue,
          address: correction.suggestedAddress || p.address
        };
      }
      return { ...p, status: p.status === ParcelStatus.PENDING ? ParcelStatus.VALID : p.status };
    });

    setParcels(updatedParcels);
    setAiResult(result);
    setIsAnalyzing(false);
  };

  const confirmUpload = () => {
    if (hasDuplicates || hasErrors) return; 
    const batch: BulkUploadBatch = {
      id: uuidv4(),
      timestamp: new Date(),
      totalParcels: parcels.length,
      validParcels: parcels.filter(p => p.status === ParcelStatus.VALID).length,
      errorParcels: parcels.filter(p => p.status === ParcelStatus.ERROR).length,
      parcels
    };
    onBatchComplete(batch);
    setStep(3);
  };

  const handleBack = () => {
    setStep(1);
    setAiResult(null);
  };

  const resetUpload = () => {
    setStep(1);
    setParcels([]);
    setAiResult(null);
    setUploadError(null);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-center space-x-4 mb-10">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition-all shadow-sm ${
              step >= s ? 'bg-brand-orange text-white' : 'bg-slate-200 text-slate-400'
            }`}>
              {s}
            </div>
            {s < 3 && <div className={`w-20 h-1.5 mx-2 rounded-full ${step > s ? 'bg-brand-orange' : 'bg-slate-200'}`} />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="bg-white p-16 rounded-3xl shadow-sm border-2 border-dashed border-slate-200 text-center space-y-8 animate-in fade-in zoom-in-95 duration-300">
          <div className="w-24 h-24 bg-slate-50 text-slate-300 rounded-3xl flex items-center justify-center text-5xl mx-auto shadow-inner">
            {isReading ? (
              <div className="w-12 h-12 border-4 border-brand-orange border-t-transparent rounded-full animate-spin" />
            ) : "📂"}
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-2xl font-bold text-slate-800">Upload CSV File</h3>
            <p className="text-slate-500 mt-3 leading-relaxed">
              Upload your parcel list. Our system automatically normalizes phone numbers and checks for duplicates.
            </p>
          </div>
          
          {uploadError && (
            <div className="max-w-md mx-auto p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm font-medium animate-in slide-in-from-top-2">
              {uploadError}
            </div>
          )}

          <div className="flex flex-col items-center space-y-4">
            <label className={`cursor-pointer bg-dark-blue text-white px-10 py-4 rounded-2xl font-bold hover:bg-opacity-90 transition-all shadow-xl shadow-dark-blue/20 flex items-center space-x-3 ${isReading ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
              <span>{isReading ? "Processing..." : "Select CSV File"}</span>
              <input type="file" className="hidden" accept=".csv" onChange={handleFileUpload} disabled={isReading} />
            </label>
            <button onClick={downloadTemplate} className="text-sm text-brand-orange font-bold hover:underline flex items-center space-x-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              <span>Download Official Template</span>
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6 animate-in slide-in-from-bottom-6 duration-500">
          {(hasDuplicates || hasErrors) && (
            <div className="bg-red-50 border-l-4 border-red-500 p-5 rounded-2xl flex items-center space-x-4 shadow-sm animate-in shake duration-500">
              <div className="w-10 h-10 bg-red-500 text-white rounded-full flex items-center justify-center font-black text-xl">!</div>
              <div>
                <h4 className="font-black text-red-900">{hasDuplicates ? "Duplicates Detected!" : "Data Errors Found!"}</h4>
                <p className="text-red-700 text-sm font-medium">Please resolve highlighted issues (duplicates or invalid phone numbers) to continue.</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-3 space-y-6">
              <div className="flex items-center justify-between px-2">
                <button 
                  onClick={handleBack}
                  className="flex items-center space-x-2 text-slate-500 hover:text-dark-blue font-bold transition-all group py-2"
                >
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-dark-blue group-hover:text-white transition-all">
                    <span className="text-lg">←</span>
                  </div>
                  <span>Back to Upload</span>
                </button>
                <div className="text-right">
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total Items Detected</p>
                  <p className="text-2xl font-black text-brand-orange">{parcels.length}</p>
                </div>
              </div>
              
              <div className="bg-white rounded-3xl shadow-sm overflow-hidden border border-slate-100 flex flex-col max-h-[750px]">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <h4 className="font-extrabold text-slate-800 flex items-center">
                    Shipment Review Data
                  </h4>
                  <div className="flex space-x-2">
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-black rounded-lg">
                      {parcels.filter(p => p.status === ParcelStatus.VALID).length} VALID
                    </span>
                    <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-black rounded-lg">
                      {parcels.filter(p => p.status === ParcelStatus.ERROR).length} ERROR
                    </span>
                    <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-black rounded-lg">
                      {parcels.filter(p => p.status === ParcelStatus.WARNING).length} ATTENTION
                    </span>
                  </div>
                </div>
                <div className="overflow-y-auto flex-1 custom-scrollbar">
                  <ParcelTable 
                    parcels={parcels} 
                    setParcels={setParcels} 
                    onRemove={handleRemoveParcel}
                  />
                </div>
              </div>
            </div>

            <div className="lg:col-span-1 space-y-6">
              {!aiResult ? (
                <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-2xl space-y-5 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-brand-orange/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-brand-orange/20 transition-all"></div>
                  <div className="flex items-center space-x-2 relative">
                    <div className="w-10 h-10 bg-brand-orange/20 text-brand-orange rounded-xl flex items-center justify-center text-xl">✨</div>
                    <h5 className="font-extrabold">Smart Verification</h5>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed relative">Verify addresses and contact details instantly using AI-powered validation to reduce return-to-origin rates.</p>
                  <button 
                    onClick={startAIAnalysis}
                    disabled={isAnalyzing || parcels.length === 0}
                    className="w-full bg-brand-orange text-white py-4 rounded-2xl font-black hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center shadow-lg shadow-brand-orange/30 relative"
                  >
                    {isAnalyzing ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Checking...</span>
                      </div>
                    ) : "Verify with AI"}
                  </button>
                </div>
              ) : (
                <AIInsights result={aiResult} />
              )}

              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4 sticky top-6">
                 <button 
                  onClick={confirmUpload}
                  disabled={parcels.length === 0 || hasDuplicates || hasErrors}
                  className={`w-full py-5 rounded-2xl font-black transition-all flex items-center justify-center space-x-3 
                    ${(hasDuplicates || hasErrors)
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed border-2 border-dashed border-slate-300 shadow-none' 
                      : 'bg-emerald-600 text-white shadow-xl shadow-emerald-600/20 hover:bg-emerald-700 hover:translate-y-[-2px] active:translate-y-0 disabled:opacity-50'}`}
                >
                  <span>{ (hasDuplicates || hasErrors) ? "Resolve Errors" : `Submit ${parcels.length} Items`}</span>
                  <span className="text-xl">{(hasDuplicates || hasErrors) ? "🚫" : "🚀"}</span>
                </button>
                <button 
                  onClick={resetUpload}
                  className="w-full py-3 text-slate-400 hover:text-red-500 text-sm font-bold transition-colors flex items-center justify-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 2 0 00-1-1h-4a1 2 0 00-1 1v3M4 7h16" /></svg>
                  <span>Discard Batch</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="bg-white p-20 rounded-[3rem] shadow-sm text-center space-y-8 animate-in zoom-in-95 duration-500 border border-slate-100">
          <div className="w-28 h-28 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center text-6xl mx-auto shadow-inner ring-8 ring-emerald-50/50 animate-bounce">✓</div>
          <div className="max-w-md mx-auto">
            <h3 className="text-3xl font-black text-slate-800">Success!</h3>
            <p className="text-slate-500 mt-4 text-lg">Your batch of <span className="text-dark-blue font-bold">{parcels.length} items</span> has been submitted successfully.</p>
          </div>
          <div className="flex justify-center pt-6">
            <button 
              onClick={resetUpload} 
              className="px-12 py-5 bg-brand-orange text-white rounded-3xl font-black shadow-2xl shadow-brand-orange/30 hover:scale-105 active:scale-95 transition-all text-lg"
            >
              Start New Upload
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadPage;
