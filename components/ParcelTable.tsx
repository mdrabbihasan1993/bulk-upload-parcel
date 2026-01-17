
import React from 'react';
import { Parcel, ParcelStatus } from '../types';

interface ParcelTableProps {
  parcels: Parcel[];
  setParcels: React.Dispatch<React.SetStateAction<Parcel[]>>;
  onRemove: (id: string) => void;
}

const ParcelTable: React.FC<ParcelTableProps> = ({ parcels, setParcels, onRemove }) => {
  const allowedPrefixes = ['017', '013', '016', '018', '019', '014', '015'];

  const normalizePhoneNumber = (phone: string): string => {
    // Remove all non-numeric characters
    let cleaned = phone.replace(/\D/g, '');
    
    // If it starts with 880 (13 digits), strip 88 to get 017...
    if (cleaned.startsWith('880') && cleaned.length === 13) {
      cleaned = cleaned.substring(2);
    } 
    // If it starts with 88 (13 digits), strip 88
    else if (cleaned.startsWith('88') && cleaned.length === 13) {
      cleaned = cleaned.substring(2);
    }
    // If 10 digits and starts with 1, prepend 0 (e.g., 1712... -> 01712...)
    else if (cleaned.length === 10 && cleaned.startsWith('1')) {
      cleaned = '0' + cleaned;
    }

    return cleaned;
  };

  const validatePhone = (phone: string): boolean => {
    if (phone.length !== 11) return false;
    return allowedPrefixes.some(prefix => phone.startsWith(prefix));
  };

  const updateParcel = (id: string, updates: Partial<Parcel>) => {
    setParcels(prev => {
      const next = prev.map(p => {
        if (p.id !== id) return p;
        
        const updated = { ...p, ...updates };
        
        // If phone is being updated, normalize it
        if (updates.phone !== undefined) {
          updated.phone = normalizePhoneNumber(updates.phone);
        }

        return updated;
      });
      
      // Re-run all validations (Duplicates, Phone, Fields)
      const idCounts: Record<string, number> = {};
      next.forEach(p => {
        if (p.invoiceId) idCounts[p.invoiceId] = (idCounts[p.invoiceId] || 0) + 1;
      });

      return next.map(p => {
        let status = ParcelStatus.VALID;
        let statusMessage: string | undefined = undefined;

        const isDuplicate = p.invoiceId && idCounts[p.invoiceId] > 1;
        const isInvalidPhone = !validatePhone(p.phone);
        const isMissingFields = !p.invoiceId || !p.recipientName || !p.address || p.weight <= 0;

        if (isDuplicate) {
          status = ParcelStatus.WARNING;
          statusMessage = 'Duplicate Invoice ID';
        } else if (isInvalidPhone) {
          status = ParcelStatus.ERROR;
          statusMessage = 'Invalid Operator/Length';
        } else if (isMissingFields) {
          status = ParcelStatus.ERROR;
          statusMessage = 'Missing Required Fields';
        }

        return { ...p, status, statusMessage };
      });
    });
  };

  const isFieldMissing = (value: string | number | undefined) => {
    if (typeof value === 'number') return isNaN(value);
    return !value || value.toString().trim() === '';
  };

  const inputClasses = (value: string | number | undefined, extra: string = "", isError: boolean = false, isWarning: boolean = false) => `
    w-full bg-white border rounded-xl px-4 py-2.5 text-sm transition-all outline-none text-slate-900 font-semibold
    ${isError 
      ? 'border-red-300 bg-red-50/30 focus:border-red-500 focus:ring-4 focus:ring-red-500/10' 
      : isWarning 
        ? 'border-amber-300 bg-amber-50/50 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10'
        : isFieldMissing(value)
          ? 'border-slate-200 bg-slate-50/50'
          : 'border-slate-300 focus:border-brand-orange focus:ring-4 focus:ring-brand-orange/10'}
    ${extra}
  `;

  return (
    <div className="w-full">
      <table className="w-full text-left text-sm border-separate border-spacing-0 min-w-[1550px]">
        <thead className="sticky top-0 z-20 shadow-sm">
          <tr className="bg-slate-100 text-slate-600">
            <th className="px-6 py-5 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200 w-64">Invoice ID</th>
            <th className="px-6 py-5 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200 w-64">Recipient Name</th>
            <th className="px-6 py-5 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200 w-56">Phone Number</th>
            <th className="px-6 py-5 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200 min-w-[350px]">Delivery Address</th>
            <th className="px-6 py-5 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200 w-40 text-center">COD Amount</th>
            <th className="px-6 py-5 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200 w-40 text-center">Weight</th>
            <th className="px-6 py-5 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200 w-64">Special Note</th>
            <th className="px-6 py-5 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200 w-24 text-center">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {parcels.map((parcel, index) => {
            const isDuplicate = parcel.statusMessage === 'Duplicate Invoice ID';
            const isPhoneError = parcel.statusMessage === 'Invalid Operator/Length';
            const isMissingError = parcel.statusMessage === 'Missing Required Fields';
            
            return (
              <tr key={parcel.id} className={`group transition-colors ${isDuplicate ? 'bg-amber-50/60' : parcel.status === ParcelStatus.ERROR ? 'bg-red-50/20' : index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'} hover:bg-slate-100/50`}>
                <td className="px-6 py-4 align-top">
                  <div className="flex flex-col space-y-1.5">
                    <input 
                      type="text" 
                      value={parcel.invoiceId || ''}
                      onChange={(e) => updateParcel(parcel.id, { invoiceId: e.target.value })}
                      className={inputClasses(parcel.invoiceId, "font-mono font-bold text-dark-blue", false, isDuplicate)}
                      placeholder="INV-0000"
                    />
                    {isDuplicate && (
                      <span className="text-[10px] text-amber-600 font-black px-1 flex items-center uppercase tracking-tighter">
                        <span className="mr-1">⚠</span> Duplicate ID
                      </span>
                    )}
                    {isFieldMissing(parcel.invoiceId) && !isDuplicate && (
                      <span className="text-[10px] text-red-500 font-bold px-1 flex items-center">
                        <span className="mr-1">⚠</span> ID Missing
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 align-top">
                  <div className="flex flex-col space-y-1.5">
                    <input 
                      type="text" 
                      value={parcel.recipientName || ''}
                      onChange={(e) => updateParcel(parcel.id, { recipientName: e.target.value })}
                      className={inputClasses(parcel.recipientName)}
                      placeholder="Customer Name"
                    />
                    {isFieldMissing(parcel.recipientName) && <span className="text-[10px] text-red-500 font-bold px-1 flex items-center"><span className="mr-1">⚠</span> Name Missing</span>}
                  </div>
                </td>
                <td className="px-6 py-4 align-top">
                  <div className="flex flex-col space-y-1.5">
                    <input 
                      type="text" 
                      value={parcel.phone || ''}
                      onChange={(e) => updateParcel(parcel.id, { phone: e.target.value })}
                      className={inputClasses(parcel.phone, "font-mono", isPhoneError)}
                      placeholder="01XXXXXXXXX"
                    />
                    {isPhoneError && (
                      <span className="text-[10px] text-red-500 font-black px-1 flex items-center uppercase tracking-tighter">
                        <span className="mr-1">⚠</span> Invalid Prefix/Len
                      </span>
                    )}
                    {isFieldMissing(parcel.phone) && !isPhoneError && (
                      <span className="text-[10px] text-red-500 font-bold px-1 flex items-center"><span className="mr-1">⚠</span> Phone Missing</span>
                    )}
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
                      placeholder="Full Address"
                      onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = 'auto';
                        target.style.height = `${target.scrollHeight}px`;
                      }}
                    />
                    {isFieldMissing(parcel.address) && <span className="text-[10px] text-red-500 font-bold px-1 flex items-center"><span className="mr-1">⚠</span> Addr. Missing</span>}
                  </div>
                </td>
                <td className="px-6 py-4 align-top">
                  <div className="flex flex-col space-y-1.5 items-center">
                    <div className="relative w-full max-w-[140px]">
                      <input 
                        type="number" 
                        value={parcel.codAmount || ''}
                        onChange={(e) => updateParcel(parcel.id, { codAmount: parseFloat(e.target.value) || 0 })}
                        className={`${inputClasses(parcel.codAmount, "text-center font-black")}`}
                        placeholder="0"
                      />
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 align-top">
                  <div className="flex flex-col space-y-1.5 items-center">
                    <div className="relative w-full max-w-[140px]">
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
                    {(parcel.weight <= 0 || isNaN(parcel.weight)) && <span className="text-[10px] text-red-500 font-bold flex items-center"><span className="mr-1">⚠</span> Weight Req.</span>}
                  </div>
                </td>
                <td className="px-6 py-4 align-top">
                  <input 
                    type="text" 
                    value={parcel.note || ''}
                    onChange={(e) => updateParcel(parcel.id, { note: e.target.value })}
                    className={inputClasses(parcel.note, "italic text-slate-500 font-normal")}
                    placeholder="Special instructions..."
                  />
                </td>
                <td className="px-6 py-4 align-top text-center">
                  <button 
                    onClick={() => onRemove(parcel.id)}
                    className="p-2.5 text-slate-400 hover:text-white hover:bg-red-500 rounded-xl transition-all shadow-sm group/btn"
                    title="Remove item"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 2 0 00-1-1h-4a1 2 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {parcels.length === 0 && (
        <div className="py-24 text-center bg-white">
          <div className="text-5xl mb-4 opacity-10">📂</div>
          <p className="text-slate-400 font-bold text-lg">No shipments to display</p>
        </div>
      )}
    </div>
  );
};

export default ParcelTable;
