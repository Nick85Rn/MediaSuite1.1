// src/workers/ffmpeg.worker.ts
import { FFmpeg } from '@ffmpeg/ffmpeg';
// Rimuoviamo toBlobURL per provare il caricamento diretto che a volte bypassa i blocchi
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
  
  // Usiamo unpkg che spesso è più permissivo
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd';
  
  try {
    // TENTATIVO 1: Caricamento con Blob (Metodo standard)
    await instance.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
  } catch (e) {
    console.warn("Caricamento Blob fallito, provo caricamento diretto...", e);
    // TENTATIVO 2: Caricamento Diretto (Fallback)
    await instance.load({
        coreURL: `${baseURL}/ffmpeg-core.js`,
        wasmURL: `${baseURL}/ffmpeg-core.wasm`,
    });
  }
  
  ffmpeg = instance;
  return instance;
}

// ... (Il resto delle funzioni fetchFile, getMimeType rimangono uguali) ...
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

    postMessage({ status: 'loading', message: 'Avvio FFmpeg (potrebbe richiedere qualche secondo)...' });
    
    // Gestione specifica dell'errore di caricamento
    let instance;
    try {
        instance = await loadFFmpeg();
    } catch (loadErr: any) {
        // Se fallisce qui, è 100% un problema di sicurezza del browser
        console.error(loadErr);
        throw new Error("Il browser ha bloccato il motore video. Apri l'app in una NUOVA SCHEDA per risolvere.");
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const inputName = `input_${safeName}`;
    
    postMessage({ status: 'loading', message: 'Caricamento file...' });
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
        case 'mp4': args = ['-i', inputName, '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-c:a', 'aac', '-b:a', '128k', outputName]; break;
        case 'mov': args = ['-i', inputName, '-c:v', 'libx264', '-preset', 'fast', '-c:a', 'aac', '-f', 'mov', outputName]; break;
        case 'mkv': args = ['-i', inputName, '-c:v', 'libx264', '-preset', 'fast', '-c:a', 'aac', outputName]; break;
      }

      await instance.exec(args);

      const data = await instance.readFile(outputName);
      const blob = new Blob([(data as Uint8Array).buffer], { type: getMimeType(format) });

      await instance.deleteFile(inputName);
      await instance.deleteFile(outputName);

      postMessage({ status: 'success', blob, filename: `convertito_${safeName.split('.')[0]}.${format}` });

    } else if (type === 'EXTRACT_AUDIO') {
      const outputName = 'output_whisper.wav';
      postMessage({ status: 'loading', message: 'Preparazione audio AI...' });

      await instance.exec([
        '-i', inputName,
        '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ac', '1', '-ar', '16000',
        outputName
      ]);

      const data = await instance.readFile(outputName);
      await instance.deleteFile(inputName);
      await instance.deleteFile(outputName);

      const blob = new Blob([(data as Uint8Array).buffer], { type: 'audio/wav' });
      postMessage({ status: 'success', blob });
    }

  } catch (err: any) {
    postMessage({ status: 'error', message: err.message || 'Errore FFmpeg' });
  }
};

function postMessage(msg: FFmpegResponse) {
  self.postMessage(msg);
}