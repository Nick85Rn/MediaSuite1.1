// src/hooks/useFFmpeg.ts
import { useState, useRef, useCallback, useEffect } from 'react';
import type { FFmpegRequest, FFmpegResponse } from '../workers/ffmpeg.worker';

export function useFFmpeg() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Cleanup: se il componente viene smontato, uccidiamo il worker per liberare memoria
    return () => {
      if (workerRef.current) {
        console.log('Terminazione FFmpeg worker per pulizia memoria.');
        workerRef.current.terminate();
      }
    };
  }, []);

  const processFile = useCallback((request: FFmpegRequest): Promise<any> => {
    return new Promise((resolve, reject) => {
      // 1. Inizializza Worker (se non esiste o se è stato terminato)
      if (!workerRef.current) {
        workerRef.current = new Worker(new URL('../workers/ffmpeg.worker.ts', import.meta.url), {
          type: 'module'
        });
      }

      setStatus('loading');
      setMessage('Avvio processo...');

      // 2. Gestione Messaggi
      workerRef.current.onmessage = async (e: MessageEvent<FFmpegResponse>) => {
        const resp = e.data;

        if (resp.status === 'loading') {
          setMessage(resp.message);
        } 
        else if (resp.status === 'success') {
          setStatus('success');
          
          // Se è una estrazione audio per AI, dobbiamo decodificarla nel Main Thread
          // perché AudioContext non esiste nei worker
          if (request.type === 'EXTRACT_AUDIO' && resp.blob) {
            try {
              const arrayBuffer = await resp.blob.arrayBuffer();
              const audioCtx = new AudioContext({ sampleRate: 16000 });
              const decoded = await audioCtx.decodeAudioData(arrayBuffer);
              audioCtx.close();
              resolve(decoded.getChannelData(0));
            } catch (err) {
              reject(new Error("Errore decodifica audio finale"));
            }
          } else {
            // Conversione standard
            resolve(resp);
          }
          
          // OPZIONALE: Termina worker dopo ogni lavoro pesante per garantire pulizia RAM
          // workerRef.current?.terminate(); 
          // workerRef.current = null;
        } 
        else if (resp.status === 'error') {
          setStatus('error');
          setMessage(resp.message);
          reject(new Error(resp.message));
        }
      };

      // 3. Invio Comando
      workerRef.current.postMessage(request);
    });
  }, []);

  return { status, message, processFile };
}