
import React from 'react';
import { AIAnalysisResult } from '../types';

interface AIInsightsProps {
  result: AIAnalysisResult;
}

const AIInsights: React.FC<AIInsightsProps> = ({ result }) => {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden animate-in fade-in duration-500">
      <div className="p-6 bg-dark-blue text-white">
        <h5 className="font-bold flex items-center">
          <span className="mr-2">✨</span> AI Analysis
        </h5>
        <p className="text-xs text-slate-400 mt-1">Powered by Gemini Pro</p>
      </div>
      
      <div className="p-6 space-y-6">
        <div>
          <h6 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Summary</h6>
          <p className="text-sm text-slate-700 leading-relaxed">{result.summary}</p>
        </div>

        <div>
          <h6 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Recommendations</h6>
          <ul className="space-y-2">
            {result.recommendations.map((rec, i) => (
              <li key={i} className="text-sm text-slate-600 flex items-start">
                <span className="text-brand-orange mr-2">•</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>

        {result.correctedParcels.length > 0 && (
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
            <h6 className="text-xs font-bold text-amber-800 uppercase mb-2">Corrections Applied</h6>
            <div className="space-y-1">
              <p className="text-sm text-amber-700">
                AI has identified {result.correctedParcels.length} address issues and suggested corrections.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIInsights;
