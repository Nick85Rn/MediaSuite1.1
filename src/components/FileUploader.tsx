import React, { useState, useCallback } from 'react';

// NOTA: Abbiamo rimosso l'import di 'readAudioFromVideo' perché quella logica
// ora vive nel Worker FFmpeg e non qui. Questo componente serve solo per l'input.

interface FileUploaderProps {
  // Callback unificata: restituisce il file grezzo al padre (App.tsx)
  onFileSelect?: (file: File) => void;
  disabled?: boolean;
}

export function FileUploader({ onFileSelect, disabled }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);

  const processFile = (file: File) => {
    if (!file || disabled) return;

    // Controllo sicurezza tipi file
    const isVideo = file.type.startsWith('video/');
    const isAudio = file.type.startsWith('audio/');
    const isImage = file.type.startsWith('image/');

    if (!isVideo && !isAudio && !isImage) {
      alert('Formato non supportato. Carica file Video, Audio o Immagini.');
      return;
    }

    // Passiamo il file direttamente al padre.
    // Sarà App.tsx a decidere se mandarlo al Worker FFmpeg (Audio/Video)
    // o processarlo nel thread principale (Immagini).
    if (onFileSelect) {
      onFileSelect(file);
    }
  };

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  }, []);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div 
      onDragOver={!disabled ? onDragOver : undefined}
      onDragLeave={!disabled ? onDragLeave : undefined}
      onDrop={!disabled ? onDrop : undefined}
      style={{
        border: `2px dashed ${isDragging ? '#2563eb' : '#ccc'}`,
        borderRadius: '16px',
        padding: '40px',
        textAlign: 'center',
        backgroundColor: isDragging ? '#eff6ff' : '#fafafa',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'all 0.3s ease',
        marginTop: '20px'
      }}
    >
      <input 
        type="file" 
        // Accettiamo tutto, poi filtriamo nella logica
        accept="video/*,audio/*,image/*" 
        onChange={onInputChange} 
        style={{ display: 'none' }} 
        id="file-upload"
        disabled={disabled}
      />
      
      <label htmlFor="file-upload" style={{ cursor: disabled ? 'not-allowed' : 'pointer', width: '100%', display: 'block' }}>
        <div>
          <div style={{ fontSize: '3rem', marginBottom: '10px' }}>
              {isDragging ? '📂' : 'cloud_upload'}
          </div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '10px', color: '#333' }}>
            {isDragging ? 'Rilascia il file qui!' : 'Clicca o trascina un file'}
          </h3>
          <p style={{ color: '#666', fontSize: '0.9rem' }}>
            Video, Audio e Immagini supportati
          </p>
        </div>
      </label>
    </div>
  );
}