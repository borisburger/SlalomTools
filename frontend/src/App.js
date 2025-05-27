import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import OperatorPage from './OperatorPage';
import PublicPage from './PublicPage';
import RegistrationPage from './RegistrationPage';
import RankingsPage from './RankingsPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/operator" element={<OperatorPage />} />
        <Route path="/public" element={<PublicPage />} />
        <Route path="/reg" element={<RegistrationPage />} />
        <Route path="/rankings" element={<RankingsPage />} />
        <Route path="/" element={<Navigate to="/operator" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
export default App;