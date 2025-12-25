// src/workers/ffmpeg.worker.ts
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

export type FFmpegRequest = 
  | { type: 'CONVERT'; file: File; format: string }
  | { type: 'EXTRACT_AUDIO'; file: File };

export type FFmpegResponse = 
  | { status: 'loading'; message: string; progress?: number }
  | { status: 'success'; blob?: Blob; filename?: string }
  | { status: 'error'; message: string };

const MAX_SAFE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB

let ffmpeg: FFmpeg | null = null;

async function loadFFmpeg() {
  if (ffmpeg) return ffmpeg;

  const instance = new FFmpeg();

  // MODIFICA FONDAMENTALE: 
  // 1. Usiamo 'esm' invece di 'umd' (meglio per Vite)
  // 2. Usiamo la versione 0.12.10 (stabile)
  // 3. Puntiamo a 'ffmpeg-core.js' (NON 'ffmpeg-core-mt.js' -> questo garantisce Single Thread)
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm';

  try {
    await instance.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
  } catch (e) {
    console.error("Errore caricamento FFmpeg:", e);
    throw new Error("Impossibile caricare il motore di conversione.");
  }

  ffmpeg = instance;
  return instance;
}

// Helper per leggere il file
async function fetchFile(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

function getMimeType(format: string): string {
  const types: Record<string, string> = {
    mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4',
    mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
    avi: 'video/x-msvideo', mkv: 'video/x-matroska'
  };
  return types[format] || 'application/octet-stream';
}

self.onmessage = async (e: MessageEvent<FFmpegRequest>) => {
  const { type, file } = e.data;

  try {
    if (file.size > MAX_SAFE_SIZE) throw new Error("File troppo grande (>2GB)");

    postMessage({ status: 'loading', message: 'Avvio motore (Single Thread)...' });

    let instance;
    try {
      instance = await loadFFmpeg();
    } catch (loadErr: any) {
      console.error(loadErr);
      throw new Error("Errore avvio FFmpeg. Riprova o ricarica la pagina.");
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const inputName = `input_${safeName}`;

    postMessage({ status: 'loading', message: 'Lettura file in corso...' });
    await instance.writeFile(inputName, await fetchFile(file));

    if (type === 'CONVERT') {
      const format = (e.data as any).format;
      const outputName = `output.${format}`;

      postMessage({ status: 'loading', message: `Conversione in ${format.toUpperCase()}...` });

      let args: string[] = [];
      switch (format) {
        case 'mp3': args = ['-i', inputName, '-vn', '-ab', '192k', outputName]; break;
        case 'wav': args = ['-i', inputName, '-vn', '-acodec', 'pcm_s16le', outputName]; break;
        case 'm4a': args = ['-i', inputName, '-vn', '-c:a', 'aac', '-b:a', '192k', outputName]; break;
        case 'mp4': args = ['-i', inputName, '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '24', '-c:a', 'aac', '-b:a', '128k', outputName]; break; // "ultrafast" per compensare il single thread
        case 'mov': args = ['-i', inputName, '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', '-f', 'mov', outputName]; break;
        case 'mkv': args = ['-i', inputName, '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', outputName]; break;
      }

      await instance.exec(args);

      const data = await instance.readFile(outputName);
      const blob = new Blob([(data as Uint8Array).buffer], { type: getMimeType(format) });

      // Pulizia
      await instance.deleteFile(inputName);
      await instance.deleteFile(outputName);

      postMessage({ status: 'success', blob, filename: `convertito_${safeName.split('.')[0]}.${format}` });

    } else if (type === 'EXTRACT_AUDIO') {
      const outputName = 'output_whisper.wav';
      postMessage({ status: 'loading', message: 'Estrazione audio ottimizzata...' });

      await instance.exec([
        '-i', inputName,
        '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ac', '1', '-ar', '16000',
        outputName
      ]);

      const data = await instance.readFile(outputName);
      
      // Pulizia
      await instance.deleteFile(inputName);
      await instance.deleteFile(outputName);

      const blob = new Blob([(data as Uint8Array).buffer], { type: 'audio/wav' });
      postMessage({ status: 'success', blob });
    }

  } catch (err: any) {
    console.error("Worker Error:", err);
    postMessage({ status: 'error', message: err.message || 'Errore durante l\'elaborazione' });
  }
};

function postMessage(msg: FFmpegResponse) {
  self.postMessage(msg);
}