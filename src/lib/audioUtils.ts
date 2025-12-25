// src/lib/audioUtils.ts

/**
 * ⚠️ NOTA ARCHITETTURALE:
 * Le operazioni pesanti (conversione Video/Audio con FFmpeg) sono state spostate
 * nel file `src/workers/ffmpeg.worker.ts` per garantire che l'interfaccia
 * rimanga fluida e per gestire meglio la memoria con file di grandi dimensioni.
 *
 * Questo file ora contiene solo le utility leggere che sfruttano le API
 * native del browser (come Canvas per le immagini).
 */

/**
 * Converte un file immagine usando l'elemento Canvas HTML5 del browser.
 * Questa operazione è nativa, molto veloce e non richiede WebAssembly.
 * Supporta input: Qualsiasi immagine supportata dal browser (JPG, PNG, GIF, WEBP, SVG...)
 * Output: JPEG, PNG, WEBP
 */
 export async function convertImageFile(file: File, format: 'jpeg' | 'png' | 'webp'): Promise<Blob> {
  console.log(`[Main Thread] Avvio conversione immagine verso: ${format.toUpperCase()}...`);
  
  // 1. Creiamo un oggetto immagine HTML in memoria
  const img = new Image();
  const objectUrl = URL.createObjectURL(file);
  img.src = objectUrl;

  // Attendiamo il caricamento asincrono dell'immagine
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error("Impossibile leggere il file immagine. Potrebbe essere corrotto."));
  });

  // 2. Creiamo una tela (Canvas) invisibile delle stesse dimensioni
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    URL.revokeObjectURL(objectUrl);
    throw new Error("Impossibile inizializzare il motore grafico (Canvas).");
  }

  // 3. Gestione sfondo per JPEG
  // Il formato JPEG non supporta la trasparenza. Se convertiamo un PNG trasparente,
  // lo sfondo diventerebbe nero di default. Qui lo forziamo a bianco.
  if (format === 'jpeg') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // 4. Disegniamo l'immagine sulla tela
  ctx.drawImage(img, 0, 0);

  // 5. Esportiamo il risultato nel formato richiesto
  // Quality 0.92 è un ottimo compromesso tra peso e qualità visiva per WebP e JPEG.
  // (Nota: Il parametro quality viene ignorato per i PNG che sono lossless)
  const quality = 0.92; 
  const mimeType = `image/${format}`;

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Errore durante la generazione del blob immagine."));
      }
      
      // Pulizia fondamentale per evitare memory leak nel browser
      URL.revokeObjectURL(objectUrl);
      
    }, mimeType, quality);
  });
}