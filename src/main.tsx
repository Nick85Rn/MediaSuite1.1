// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
// 1. Importa il Provider
import { ToastProvider } from './components/ToastProvider'; 

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* 2. Avvolgi l'App dentro il Provider */}
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>,
)