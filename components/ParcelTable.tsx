
import React from 'react';
import { Parcel, ParcelStatus } from '../types';

interface ParcelTableProps {
  parcels: Parcel[];
  setParcels: React.Dispatch<React.SetStateAction<Parcel[]>>;
}

const ParcelTable: React.FC<ParcelTableProps> = ({ parcels, setParcels }) => {
  const updateParcel = (id: string, updates: Partial<Parcel>) => {
    setParcels(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const isFieldMissing = (value: string | number | undefined) => {
    if (typeof value === 'number') return value <= 0 || isNaN(value);
    return !value || value.toString().trim() === '';
  };

  const inputClasses = (value: string | number | undefined, extra: string = "") => `
    w-full bg-white border rounded-xl px-4 py-2.5 text-sm transition-all outline-none text-slate-900 font-medium
    ${isFieldMissing(value) 
      ? 'border-red-200 bg-red-50/30 focus:border-red-500 focus:ring-4 focus:ring-red-500/10' 
      : 'border-slate-300 focus:border-brand-orange focus:ring-4 focus:ring-brand-orange/10'}
    ${extra}
  `;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm border-collapse min-w-[1200px]">
        <thead>
          <tr className="bg-slate-100/80 border-b border-slate-200">
            <th className="px-6 py-5 font-bold text-slate-600 w-64 uppercase tracking-wider text-[11px]">Invoice ID</th>
            <th className="px-6 py-5 font-bold text-slate-600 w-56 uppercase tracking-wider text-[11px]">Recipient Name</th>
            <th className="px-6 py-5 font-bold text-slate-600 w-48 uppercase tracking-wider text-[11px]">Phone Number</th>
            <th className="px-6 py-5 font-bold text-slate-600 min-w-[320px] uppercase tracking-wider text-[11px]">Delivery Address</th>
            <th className="px-6 py-5 font-bold text-slate-600 w-48 uppercase tracking-wider text-[11px] text-center">Weight</th>
            <th className="px-6 py-5 font-bold text-slate-600 w-56 uppercase tracking-wider text-[11px]">Special Note</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {parcels.map((parcel) => (
            <tr key={parcel.id} className={`group transition-colors ${parcel.status === ParcelStatus.WARNING ? 'bg-amber-50/40' : 'hover:bg-slate-50/50'}`}>
              <td className="px-6 py-4 align-top">
                <div className="flex flex-col space-y-1.5">
                  <input 
                    type="text" 
                    value={parcel.invoiceId || ''}
                    onChange={(e) => updateParcel(parcel.id, { invoiceId: e.target.value })}
                    className={inputClasses(parcel.invoiceId, "font-mono font-bold text-dark-blue")}
                    placeholder="INV-0000"
                  />
                  {isFieldMissing(parcel.invoiceId) && <span className="text-[10px] text-red-500 font-bold px-1 flex items-center"><span className="mr-1">⚠</span> Missing ID</span>}
                </div>
              </td>
              <td className="px-6 py-4 align-top">
                <div className="flex flex-col space-y-1.5">
                  <input 
                    type="text" 
                    value={parcel.recipientName || ''}
                    onChange={(e) => updateParcel(parcel.id, { recipientName: e.target.value })}
                    className={inputClasses(parcel.recipientName, "font-semibold")}
                    placeholder="Customer Name"
                  />
                  {isFieldMissing(parcel.recipientName) && <span className="text-[10px] text-red-500 font-bold px-1 flex items-center"><span className="mr-1">⚠</span> Name Required</span>}
                </div>
              </td>
              <td className="px-6 py-4 align-top">
                <div className="flex flex-col space-y-1.5">
                  <input 
                    type="text" 
                    value={parcel.phone || ''}
                    onChange={(e) => updateParcel(parcel.id, { phone: e.target.value })}
                    className={inputClasses(parcel.phone)}
                    placeholder="01XXXXXXXXX"
                  />
                  {isFieldMissing(parcel.phone) && <span className="text-[10px] text-red-500 font-bold px-1 flex items-center"><span className="mr-1">⚠</span> Invalid Phone</span>}
                </div>
              </td>
              <td className="px-6 py-4 align-top">
                <div className="flex flex-col space-y-1.5">
                  <textarea 
                    rows={1}
                    value={parcel.address || ''}
                    onChange={(e) => updateParcel(parcel.id, { address: e.target.value })}
                    className={`${inputClasses(parcel.address)} resize-none overflow-hidden h-auto leading-relaxed`}
                    style={{ minHeight: '44px' }}
                    placeholder="Detailed Address"
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = `${target.scrollHeight}px`;
                    }}
                  />
                  {isFieldMissing(parcel.address) && <span className="text-[10px] text-red-500 font-bold px-1 flex items-center"><span className="mr-1">⚠</span> Address Missing</span>}
                </div>
              </td>
              <td className="px-6 py-4 align-top">
                <div className="flex flex-col space-y-1.5 items-center">
                  <div className="relative w-full">
                    <input 
                      type="number" 
                      step="0.1"
                      value={parcel.weight || ''}
                      onChange={(e) => updateParcel(parcel.id, { weight: parseFloat(e.target.value) || 0 })}
                      className={`${inputClasses(parcel.weight, "text-center pr-12 font-black")}`}
                      placeholder="0.0"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-[11px] font-black uppercase pointer-events-none">KG</span>
                  </div>
                  {isFieldMissing(parcel.weight) && <span className="text-[10px] text-red-500 font-bold flex items-center"><span className="mr-1">⚠</span> Required</span>}
                </div>
              </td>
              <td className="px-6 py-4 align-top">
                <input 
                  type="text" 
                  value={parcel.note || ''}
                  onChange={(e) => updateParcel(parcel.id, { note: e.target.value })}
                  className={inputClasses(parcel.note, "italic text-slate-500")}
                  placeholder="Instructions..."
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {parcels.length === 0 && (
        <div className="py-24 text-center bg-slate-50/30">
          <div className="text-5xl mb-4 opacity-20">📂</div>
          <p className="text-slate-400 font-bold text-lg">No data detected in the file.</p>
          <p className="text-slate-300 text-sm mt-1">Please try re-uploading with a valid CSV file.</p>
        </div>
      )}
    </div>
  );
};

export default ParcelTable;
