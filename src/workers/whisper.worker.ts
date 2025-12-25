// src/workers/whisper.worker.ts
import { pipeline, env } from '@xenova/transformers';
import type { WorkerRequest, WorkerResponse } from '../types';

env.allowLocalModels = false;
env.useBrowserCache = false;

// Teniamo traccia del modello caricato
let currentModelName: string | null = null;
let transcriber: any = null;

self.addEventListener('message', async (event: MessageEvent<WorkerRequest>) => {
  // Aggiungiamo 'modelName' ai dati in ingresso (che dovremo aggiungere anche all'interfaccia Types)
  // @ts-ignore
  const { type, audio, modelName } = event.data;
  
  // Default a 'base' se non specificato
  const targetModel = modelName || 'Xenova/whisper-base';

  if (type === 'TRANSCRIBE') {
    try {
      // Se il modello richiesto è diverso da quello caricato, ricarichiamo
      if (transcriber === null || currentModelName !== targetModel) {
        postMessage({ 
          status: 'loading', 
          data: { progress: 0, file: `Cambio modello in corso: ${targetModel}...` } 
        });

        // Pulizia memoria precedente (se possibile)
        if (transcriber) {
             // In JS il GC fa il lavoro se togliamo il riferimento
             transcriber = null; 
        }

        transcriber = await pipeline('automatic-speech-recognition', targetModel, {
          progress_callback: (data: any) => {
            if (data.status === 'progress') {
              postMessage({
                status: 'loading',
                data: { file: data.file, progress: data.progress || 0 }
              });
            }
          }
        });
        currentModelName = targetModel;
      }

      postMessage({ status: 'progress', data: { progress: 0, text: 'Trascrizione in corso...' } });

      const output = await transcriber(audio, {
        language: 'italian',
        task: 'transcribe',
        return_timestamps: true,
        chunk_length_s: 30,
        stride_length_s: 5,
        no_repeat_ngram_size: 2,
        repetition_penalty: 1.2,
      });

      postMessage({
        status: 'complete',
        data: { text: output.text, chunks: output.chunks }
      });

    } catch (err: any) {
      console.error("Errore Worker:", err);
      postMessage({ status: 'error', error: err.message });
    }
  }
});

function postMessage(message: WorkerResponse) {
  self.postMessage(message);
}