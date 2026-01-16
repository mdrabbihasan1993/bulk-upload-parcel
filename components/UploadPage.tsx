
import React, { useState } from 'react';
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

  const downloadTemplate = () => {
    const headers = ["Invoice ID", "Recipient Name", "Phone Number", "Full Address", "Weight (kg)", "Note"];
    const sampleData = [
      ["INV-1001", "Abdur Rahman", "01712345678", "House 12, Road 5, Dhanmondi, Dhaka", "1.5", "Handle with care"],
      ["INV-1002", "Sumaiya Akter", "01811223344", "Plot 45, Sector 7, Uttara, Dhaka", "0.5", "Fragile - Deliver after 5 PM"],
      ["INV-1003", "Karim Mia", "01912334455", "Shop 4, Market Road, Chittagong", "2.2", "Deliver to reception"]
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

  const parseLine = (line: string, delimiter: string = ','): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result.map(v => v.replace(/^"|"$/g, '').replace(/""/g, '"'));
  };

  const parseCSV = (text: string): Parcel[] => {
    const cleanText = text.replace(/^\uFEFF/, '').trim();
    if (!cleanText) return [];

    const lines = cleanText.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) return [];

    const firstLine = lines[0];
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semiCount = (firstLine.match(/;/g) || []).length;
    const delimiter = semiCount > commaCount ? ';' : ',';

    const headerRow = parseLine(lines[0], delimiter);
    const findIndex = (keywords: string[]) => 
      headerRow.findIndex(h => keywords.some(k => h.toLowerCase().trim().includes(k.toLowerCase())));

    const idx = {
      invoice: findIndex(['invoice', 'inv', 'id', 'sl', 'no']),
      name: findIndex(['name', 'recipient', 'customer', 'receiver', 'client']),
      phone: findIndex(['phone', 'mobile', 'contact', 'number', 'tel', 'cell']),
      address: findIndex(['address', 'location', 'dest', 'place', 'area', 'full']),
      weight: findIndex(['weight', 'kg', 'mass', 'gm', 'gram']),
      note: findIndex(['note', 'comment', 'instruction', 'remarks', 'msg'])
    };

    const dataRows = lines.slice(1);
    return dataRows.map((row): Parcel => {
      const vals = parseLine(row, delimiter);
      
      const getVal = (foundIdx: number, fallbackIdx: number) => {
        const finalIdx = foundIdx !== -1 ? foundIdx : fallbackIdx;
        const val = vals[finalIdx];
        return val !== undefined ? String(val).trim() : "";
      };

      const rawWeight = getVal(idx.weight, 4).replace(',', '.');
      const parsedWeight = parseFloat(rawWeight) || 0;

      return {
        id: uuidv4(),
        invoiceId: getVal(idx.invoice, 0),
        recipientName: getVal(idx.name, 1),
        phone: getVal(idx.phone, 2),
        address: getVal(idx.address, 3),
        weight: parsedWeight,
        note: getVal(idx.note, 5),
        serviceType: 'Standard',
        status: ParcelStatus.PENDING
      };
    }).filter(p => p.invoiceId || p.recipientName || p.phone || p.address);
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
        const parsedData = parseCSV(text);
        
        if (parsedData.length === 0) {
          setUploadError("No valid data found in the file. Please use our template or ensure the file contains parcel information.");
          setIsReading(false);
        } else {
          setParcels(parsedData);
          setStep(2);
          setIsReading(false);
        }
      } catch (err) {
        console.error("Parsing error:", err);
        setUploadError("There was an error processing the CSV file.");
        setIsReading(false);
      }
    };
    reader.onerror = () => {
      setUploadError("Failed to read the file. Please try again.");
      setIsReading(false);
    };
    reader.readAsText(file);
    event.target.value = '';
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
          statusMessage: correction.issue,
          address: correction.suggestedAddress || p.address
        };
      }
      return { ...p, status: ParcelStatus.VALID };
    });

    setParcels(updatedParcels);
    setAiResult(result);
    setIsAnalyzing(false);
  };

  const confirmUpload = () => {
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
      {/* Stepper */}
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
              Upload your parcel list in CSV format. Our system will automatically map and organize your data for efficient delivery.
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
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 animate-in slide-in-from-bottom-6 duration-500">
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
                <p className="text-xl font-black text-dark-blue">{parcels.length}</p>
              </div>
            </div>
            
            <div className="bg-white rounded-3xl shadow-sm overflow-hidden border border-slate-100">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h4 className="font-extrabold text-slate-800 flex items-center">
                  <span className="bg-dark-blue text-white w-6 h-6 rounded-md flex items-center justify-center text-[10px] mr-2">LIST</span>
                  Shipment Review Data
                </h4>
                <div className="flex space-x-2">
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-black rounded-lg">
                    {parcels.filter(p => p.status === ParcelStatus.VALID).length} OK
                  </span>
                  <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-black rounded-lg">
                    {parcels.filter(p => p.status === ParcelStatus.WARNING).length} CHECK
                  </span>
                </div>
              </div>
              <div className="min-h-[400px]">
                <ParcelTable parcels={parcels} setParcels={setParcels} />
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

            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
               <button 
                onClick={confirmUpload}
                disabled={parcels.length === 0}
                className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-black shadow-xl shadow-emerald-600/20 hover:bg-emerald-700 hover:translate-y-[-2px] active:translate-y-0 transition-all flex items-center justify-center space-x-3 disabled:opacity-50"
              >
                <span>Submit {parcels.length} Items</span>
                <span className="text-xl">🚀</span>
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
