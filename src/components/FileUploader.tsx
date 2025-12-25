// src/components/FileUploader.tsx
import React, { useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';

interface FileUploaderProps {
  onFileSelect?: (file: File) => void;
  disabled: boolean;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onFileSelect, disabled }) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled || !onFileSelect) return;
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && onFileSelect) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div 
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      style={{
        border: `2px dashed ${isDragOver ? '#2563eb' : '#cbd5e1'}`,
        borderRadius: '16px',
        padding: '40px 20px',
        textAlign: 'center',
        backgroundColor: isDragOver ? '#eff6ff' : '#f8fafc',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s ease',
        opacity: disabled ? 0.6 : 1,
        marginBottom: '20px',
        marginTop: '20px'
      }}
    >
      <input 
        type="file" 
        onChange={handleChange} 
        style={{ display: 'none' }} 
        id="file-upload" 
        disabled={disabled}
      />
      <label htmlFor="file-upload" style={{ cursor: disabled ? 'not-allowed' : 'pointer', display: 'block' }}>
        {/* Abbiamo sostituito la scritta corrotta con una emoji pulita */}
        <div style={{ fontSize: '3.5rem', marginBottom: '15px', filter: disabled ? 'grayscale(1)' : 'none' }}>
          📂
        </div>
        <h3 style={{ margin: '0 0 5px 0', fontSize: '1.1rem', color: '#1e293b' }}>
          Clicca o trascina un file
        </h3>
        <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>
          Video, Audio e Immagini supportati
        </p>
      </label>
    </div>
  );
};