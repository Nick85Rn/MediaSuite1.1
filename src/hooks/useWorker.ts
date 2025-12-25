// src/hooks/useWorker.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import type { WorkerResponse, WorkerRequest } from '../types';

export function useWorker() {
  const [status, setStatus] = useState<WorkerResponse['status']>('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<any>(null);
  
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(new URL('../workers/whisper.worker.ts', import.meta.url), {
      type: 'module'
    });

    workerRef.current.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const { status, data, error } = event.data;
      setStatus(status);

      if (status === 'loading') {
        setMessage(data?.file || 'Caricamento...');
        setProgress(data?.progress || 0);
      } else if (status === 'progress') {
        setMessage(data?.text || 'Elaborazione...');
        // Simulo un progresso visivo ciclico perché Whisper non dà % esatta
        setProgress((prev) => (prev >= 90 ? 10 : prev + 5)); 
      } else if (status === 'complete') {
        setResult(data);
        setProgress(100);
      } else if (status === 'error') {
        alert('Errore: ' + error);
        setProgress(0);
      }
    };

    return () => workerRef.current?.terminate();
  }, []);

  // Aggiornato per accettare il modelName
  const transcribe = useCallback((audio: Float32Array, modelName: string) => {
    if (workerRef.current) {
      setStatus('loading');
      setResult(null);
      setProgress(0);
      // @ts-ignore
      workerRef.current.postMessage({ type: 'TRANSCRIBE', audio, modelName });
    }
  }, []);

  return { status, progress, message, result, transcribe };
}