// src/App.tsx
import { useEffect, useState } from 'react';
import { useWorker } from './hooks/useWorker';
import { useFFmpeg } from './hooks/useFFmpeg';
import { FileUploader } from './components/FileUploader';
import { loadGoogleScripts, uploadToDrive, downloadLocally } from './lib/googleDrive';
import { convertImageFile } from './lib/audioUtils'; 
import './App.css';

// Funzioni helper
function convertToSRT(chunks: any[]) {
  if (!chunks) return '';
  return chunks.map((chunk, index) => {
    const start = formatTime(chunk.timestamp[0]);
    const end = formatTime(chunk.timestamp[1]);
    return `${index + 1}\n${start} --> ${end}\n${chunk.text.trim()}\n`;
  }).join('\n');
}

function formatTime(seconds: number) {
  if (!seconds && seconds !== 0) return '00:00:00,000';
  const date = new Date(seconds * 1000);
  const hh = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss},${ms}`;
}

function App() {
  const whisperWorker = useWorker();
  const ffmpegWorker = useFFmpeg();

  const [mode, setMode] = useState<'transcribe' | 'convert_media' | 'convert_image'>('transcribe');
  const [modelType, setModelType] = useState<string>('Xenova/whisper-base');
  const [mediaFormat, setMediaFormat] = useState<string>('mp3');
  const [imageFormat, setImageFormat] = useState<'jpeg' | 'png' | 'webp'>('jpeg');
  
  const [isWorking, setIsWorking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fullText = whisperWorker.result?.text;
  const chunks = whisperWorker.result?.chunks;

  useEffect(() => { loadGoogleScripts().catch(console.warn); }, []);

  // HANDLER TRASCRIZIONE
  const handleFileForTranscription = async (file: File) => {
    try {
      const audioData = await ffmpegWorker.processFile({ type: 'EXTRACT_AUDIO', file });
      whisperWorker.transcribe(audioData, modelType);
    } catch (e: any) {
      alert("Errore estrazione audio: " + e.message);
    }
  };

  // HANDLER CONVERSIONE MEDIA
  const handleFileForMediaConversion = async (file: File) => {
    if (!file) return;
    setIsWorking(true);
    try {
      const res = await ffmpegWorker.processFile({ 
        type: 'CONVERT', 
        file, 
        format: mediaFormat 
      });
      
      if (res.blob) {
        const url = URL.createObjectURL(res.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = res.filename || 'download';
        a.click();
      }
    } catch (e: any) {
      alert("Errore conversione: " + e.message);
    } finally {
      setIsWorking(false);
    }
  };

  // HANDLER IMMAGINI
  const handleFileForImageConversion = async (file: File) => {
    if (!file) return;
    setIsWorking(true);
    try {
      const blob = await convertImageFile(file, imageFormat);
      const ext = imageFormat === 'jpeg' ? 'jpg' : imageFormat;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `immagine_${file.name.split('.')[0]}.${ext}`;
      a.click();
    } catch (e: any) {
      alert("Errore immagine: " + e.message);
    } finally {
      setIsWorking(false);
    }
  };

  const handleSaveAI = async (format: 'txt' | 'srt') => {
    if (!fullText) return;
    setIsSaving(true);
    const timestamp = new Date().toLocaleString().replace(/[/, :]/g, '-');
    let content = ''; let ext = '';
    if (format === 'srt' && chunks) { content = convertToSRT(chunks); ext = 'srt'; } 
    else { content = fullText; ext = 'txt'; }
    const fileName = `Trascrizione_${timestamp}.${ext}`;
    try {
      await uploadToDrive(fileName, content);
      alert(`✅ Salvato su Drive!`);
    } catch (error) {
      downloadLocally(fileName, content);
    } finally {
      setIsSaving(false);
    }
  };

  const isFFmpegBusy = ffmpegWorker.status === 'loading';
  const isWhisperBusy = whisperWorker.status === 'loading' || whisperWorker.status === 'progress';
  const isBusy = isFFmpegBusy || isWhisperBusy || isWorking;
  
  const getStatusMessage = () => {
    if (isFFmpegBusy) return ffmpegWorker.message;
    if (isWhisperBusy) return whisperWorker.message;
    if (isWorking) return "Elaborazione immagine in corso...";
    return "";
  };

  const getFileHandler = () => {
    if (mode === 'transcribe') return handleFileForTranscription;
    if (mode === 'convert_media') return handleFileForMediaConversion;
    if (mode === 'convert_image') return handleFileForImageConversion;
    return undefined;
  };

  const getBtnStyle = (btnMode: typeof mode) => ({
    backgroundColor: mode === btnMode ? (btnMode === 'transcribe' ? '#2563eb' : btnMode === 'convert_media' ? '#9333ea' : '#059669') : '#f3f4f6',
    color: mode === btnMode ? 'white' : '#4b5563',
    border: '1px solid #e5e7eb', flex: 1, padding: '12px 5px', fontSize: '0.95rem'
  });

  return (
    <div className="app-container">
      <div className="main-card">
        <header className="header">
          <h1 className="title">🎙️ Media Suite Pro <span className="badge">Worker Edition</span></h1>
          <p className="subtitle">Scalabile: Processi separati per stabilità e performance.</p>
        </header>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '25px' }}>
          <button className="drive-button" style={getBtnStyle('transcribe')} onClick={() => setMode('transcribe')} disabled={isBusy}>📝 Trascrivi AI</button>
          <button className="drive-button" style={getBtnStyle('convert_media')} onClick={() => setMode('convert_media')} disabled={isBusy}>🔄 Video/Audio</button>
          <button className="drive-button" style={getBtnStyle('convert_image')} onClick={() => setMode('convert_image')} disabled={isBusy}>🖼️ Immagini</button>
        </div>

        <main>
           {!isBusy && mode === 'transcribe' && (
            <div className="config-box">
              <label className="config-label">Precisione Modello:</label>
              <select value={modelType} onChange={(e) => setModelType(e.target.value)} className="config-select">
                <option value="Xenova/whisper-tiny">🚀 Tiny (Velocissimo)</option>
                <option value="Xenova/whisper-base">🧠 Base (Bilanciato)</option>
                <option value="Xenova/whisper-small">🐢 Small (Alta precisione)</option>
              </select>
            </div>
          )}
          
          {!isBusy && mode === 'convert_media' && (
             <div className="config-box">
             <label className="config-label">Converti Media in:</label>
             <select value={mediaFormat} onChange={(e) => setMediaFormat(e.target.value)} className="config-select">
               <optgroup label="🎵 Solo Audio">
                 <option value="mp3">MP3</option><option value="wav">WAV</option><option value="m4a">M4A</option>
               </optgroup>
               <optgroup label="🎬 Video">
                 <option value="mp4">MP4</option><option value="mov">MOV</option><option value="mkv">MKV</option>
               </optgroup>
             </select>
           </div>
          )}

           {!isBusy && mode === 'convert_image' && (
            <div className="config-box" style={{ backgroundColor: '#ecfdf5' }}>
              <label className="config-label" style={{ color: '#065f46' }}>Converti Immagine in:</label>
              <select value={imageFormat} onChange={(e) => setImageFormat(e.target.value as any)} className="config-select" style={{ border: '1px solid #a7f3d0' }}>
                <option value="jpeg">📸 JPG</option><option value="png">✨ PNG</option><option value="webp">🌐 WebP</option>
              </select>
            </div>
          )}

          {isBusy && (
            <div className="status-box">
              <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{getStatusMessage()}</p>
              <div className="progress-bar-bg">
                <div className="progress-bar-fill" style={{ 
                  width: whisperWorker.progress ? `${whisperWorker.progress}%` : '100%', 
                  animation: !whisperWorker.progress ? 'pulse 1.5s infinite' : 'none',
                  backgroundColor: isFFmpegBusy ? '#9333ea' : '#4CAF50'
                }} />
              </div>
              <p style={{ fontSize: '0.8rem', color: '#666' }}>
                Il processo gira in background. Il browser rimarrà reattivo.
              </p>
            </div>
          )}

          {!isBusy && (
            <FileUploader 
              onFileSelect={getFileHandler()}
              disabled={isBusy} 
            />
          )}

           {fullText && mode === 'transcribe' && (
            <div className="result-box">
              <div className="result-header">
                <h3>📝 Risultato AI</h3>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => handleSaveAI('txt')} className="drive-button" disabled={isSaving}>💾 TXT</button>
                  <button onClick={() => handleSaveAI('srt')} className="drive-button" disabled={isSaving}>🎬 SRT</button>
                </div>
              </div>
              <div className="text-area" style={{ overflowY: 'auto', whiteSpace: 'pre-wrap', maxHeight: '400px' }}>
                {chunks ? chunks.map((chunk: any, i: number) => (
                    <div key={i} style={{ marginBottom: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '4px' }}>
                      <span style={{ color: '#2563eb', fontSize: '0.75rem', fontWeight: 'bold', marginRight: '8px', backgroundColor: '#eff6ff', padding: '2px 6px', borderRadius: '4px' }}>
                        {formatTime(chunk.timestamp[0]).split(',')[0]}
                      </span>
                      {chunk.text}
                    </div>
                  )) : fullText}
              </div>
            </div>
          )}

        </main>
        
        {/* FOOTER MODIFICATO */}
        <footer className="footer">
          <p>Powered by <strong>Nick85Rn</strong> 🚀</p>
        </footer>
      </div>
    </div>
  );
}

export default App;