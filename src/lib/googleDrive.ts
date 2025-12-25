// src/lib/googleDrive.ts

// ⚠️ IMPORTANTE: Non scrivere mai più le chiavi reali qui!
// Usiamo le variabili d'ambiente che hai configurato su Netlify.
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// Configurazione base
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
const SCOPES = "https://www.googleapis.com/auth/drive.file";

let gapiInited = false;
let gisInited = false;
let tokenClient: any = null;

/**
 * Carica gli script di Google (gapi e gis)
 */
export async function loadGoogleScripts() {
  if (!API_KEY || !CLIENT_ID) {
    console.warn("⚠️ Google API Key o Client ID mancanti! Controlla le variabili d'ambiente.");
    return;
  }

  try {
    await Promise.all([loadGapi(), loadGis()]);
    console.log("Google Scripts caricati correttamente.");
  } catch (error) {
    console.error("Errore caricamento Google Scripts:", error);
  }
}

function loadGapi(): Promise<void> {
  return new Promise((resolve) => {
    if (gapiInited) return resolve();
    const script = document.createElement('script');
    script.src = "https://apis.google.com/js/api.js";
    script.onload = () => {
      // @ts-ignore
      gapi.load('client', async () => {
        // @ts-ignore
        await gapi.client.init({
          apiKey: API_KEY,
          discoveryDocs: DISCOVERY_DOCS,
        });
        gapiInited = true;
        resolve();
      });
    };
    document.body.appendChild(script);
  });
}

function loadGis(): Promise<void> {
  return new Promise((resolve) => {
    if (gisInited) return resolve();
    const script = document.createElement('script');
    script.src = "https://accounts.google.com/gsi/client";
    script.onload = () => {
      // @ts-ignore
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: '', // Definito dinamicamente dopo
      });
      gisInited = true;
      resolve();
    };
    document.body.appendChild(script);
  });
}

/**
 * Carica un file su Google Drive
 */
export async function uploadToDrive(fileName: string, content: string): Promise<void> {
  if (!tokenClient) throw new Error("Google API non inizializzata. Attendi il caricamento.");

  return new Promise((resolve, reject) => {
    tokenClient.callback = async (resp: any) => {
      if (resp.error) {
        reject(resp);
        return;
      }
      try {
        await uploadFile(fileName, content, resp.access_token);
        resolve();
      } catch (err) {
        reject(err);
      }
    };

    // Richiede l'accesso all'utente (Popup)
    if (gapi.client.getToken() === null) {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      tokenClient.requestAccessToken({ prompt: '' });
    }
  });
}

async function uploadFile(fileName: string, content: string, accessToken: string) {
  const metadata = {
    name: fileName,
    mimeType: 'text/plain',
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([content], { type: 'text/plain' }));

  await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
    body: form,
  });
}

/**
 * Funzione di fallback per scaricare il file in locale se Drive fallisce
 */
export function downloadLocally(fileName: string, content: string) {
  const element = document.createElement("a");
  const file = new Blob([content], { type: 'text/plain' });
  element.href = URL.createObjectURL(file);
  element.download = fileName;
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}