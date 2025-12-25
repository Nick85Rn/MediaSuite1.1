// src/types/index.ts

// 1. Cosa può chiedere l'UI al Worker?
export interface WorkerRequest {
  type: 'TRANSCRIBE';
  audio: string | Blob | Float32Array; // L'input audio (URL o dati grezzi)
}

// 2. Cosa risponde il Worker all'UI?
export interface WorkerResponse {
  status: 'loading' | 'progress' | 'complete' | 'error';
  data?: {
    text?: string;        // Il risultato finale
    file?: string;        // Nome del file modello che sta scaricando
    progress?: number;    // Percentuale (0-100) per download o elaborazione
  };
  error?: string;
}

// 3. Parametri per configurare Whisper (opzionale, per espansioni future)
export interface TranscribeConfig {
  language: string;       // es. 'italian'
  task: 'transcribe' | 'translate';
}