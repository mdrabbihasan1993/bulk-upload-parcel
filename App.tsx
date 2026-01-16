
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import UploadPage from './components/UploadPage';
import { BulkUploadBatch } from './types';

const App: React.FC = () => {
  // We keep a simple handler for completion, but Dashboard is gone
  const handleBatchComplete = (batch: BulkUploadBatch) => {
    console.log('Batch completed:', batch);
  };

  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<UploadPage onBatchComplete={handleBatchComplete} />} />
          <Route path="/upload" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
};

export default App;
