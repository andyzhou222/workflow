import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import './styles.css';

const router = (
  <BrowserRouter
    future={{
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    }}
  >
    <Routes>
      <Route path="/*" element={<App/>} />
    </Routes>
  </BrowserRouter>
);

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {router}
  </React.StrictMode>
);
