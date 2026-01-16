
import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Extremely Minimal Header - No branding, no profile */}
      <header className="bg-white border-b border-slate-200 px-6 lg:px-12 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-center">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Merchant Bulk Upload Module</span>
        </div>
      </header>
      
      {/* Main Content Area */}
      <main className="flex-1 py-10 px-6 lg:px-12">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      {/* Simple Footer */}
      <footer className="py-8 border-t border-slate-200 text-center">
        <p className="text-sm text-slate-400">© 2025 Merchant Logistics Portal. Simplified Bulk Upload System.</p>
      </footer>
    </div>
  );
};

export default Layout;
