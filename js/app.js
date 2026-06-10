// Main App Orchestrator for SheetsForms

import { isOnline, testConnection, sendRowData } from './connection.js';
import { 
  getScriptUrl, 
  saveScriptUrl, 
  clearConnection, 
  getSheetsStructure, 
  saveSheetsStructure, 
  getActiveTab, 
  getQueue, 
  addToQueue, 
  removeFromQueue, 
  addToHistory 
} from './storage.js';
import { 
  initUI, 
  showView, 
  updateNetworkStatus, 
  setConnectionUrlInput, 
  renderTabs, 
  updateFooterInfo, 
  getFormData, 
  resetForm, 
  renderHistory, 
  showLoading, 
  closeAlert, 
  showAlert, 
  showToast, 
  validateForm,
  openGuide
} from './ui.js';

// Global state
let isSyncing = false;

// Initialize app on DOM content loaded
document.addEventListener('DOMContentLoaded', () => {
  // Bind UI Events
  initUI(handleConnect, handleDisconnect, handleFormSubmit, handleSyncQueue);
  
  // Set initial network indicator
  updateNetworkStatus(isOnline());
  
  // Listen for connection changes
  window.addEventListener('online', () => {
    updateNetworkStatus(true);
    showToast('success', 'Conexión a internet restaurada');
    // Trigger auto sync when coming back online
    handleSyncQueue(true); 
  });
  
  window.addEventListener('offline', () => {
    updateNetworkStatus(false);
    showToast('warning', 'Modo offline activado');
  });

  // Load saved connection state
  initializeAppState();
});

/**
 * Loads saved configuration and sets up the views
 */
async function initializeAppState() {
  const savedUrl = getScriptUrl();
  renderHistory(); // load history list from storage

  if (!savedUrl) {
    // Show connection setup screen
    showView('setup');
    updateFooterInfo(null);
    return;
  }

  // Pre-fill input
  setConnectionUrlInput(savedUrl);
  updateFooterInfo(savedUrl);

  const savedStructure = getSheetsStructure();

  if (isOnline()) {
    try {
      // Fetch latest sheets structure to keep it fresh
      const sheets = await testConnection(savedUrl);
      saveSheetsStructure(sheets);
      renderTabs(sheets);
      showView('dashboard');
    } catch (error) {
      console.warn('Could not refresh sheets structure on startup:', error);
      
      // Fallback to cache if request fails
      if (savedStructure) {
        renderTabs(savedStructure);
        showView('dashboard');
        showToast('warning', 'Mostrando estructura guardada (sin refrescar)');
      } else {
        // Clear corrupt connection URL and force setup
        showView('setup');
        showAlert('error', 'Error de Conexión', 'No se pudo conectar con el script y no hay estructura guardada. Verifica la URL.');
      }
    }
  } else {
    // Offline startup fallback to local cache
    if (savedStructure) {
      renderTabs(savedStructure);
      showView('dashboard');
      showToast('info', 'Iniciado en modo sin conexión');
    } else {
      showView('setup');
      showAlert('warning', 'Sin Conexión', 'Necesitas internet la primera vez para configurar la hoja de cálculo.');
    }
  }
}

/**
 * Handle new connection setup
 * @param {string} url The script web app URL
 */
async function handleConnect(url) {
  if (!url) {
    showAlert('warning', 'Campos vacíos', 'Por favor ingresa una URL válida.');
    return;
  }

  if (!url.startsWith('https://script.google.com/')) {
    showAlert('error', 'URL no válida', 'La URL debe empezar por https://script.google.com/');
    return;
  }

  if (!isOnline()) {
    showAlert('error', 'Sin Internet', 'Debes estar conectado a internet para verificar la conexión inicial.');
    return;
  }

  showLoading('Conectando con Google Sheets...');

  try {
    const sheets = await testConnection(url);
    
    // Save URL and structure
    saveScriptUrl(url);
    saveSheetsStructure(sheets);
    
    // Setup UI
    renderTabs(sheets);
    updateFooterInfo(url);
    showView('dashboard');
    
    closeAlert();
    showAlert('success', '¡Conectado con éxito!', `Se importaron ${sheets.length} pestañas de la hoja de cálculo.`);
    
    // Check if there's anything to sync
    handleSyncQueue(true);

  } catch (error) {
    closeAlert();
    showAlert('error', 'Error de conexión', `No se pudo conectar al script. Detalle: ${error.message}`);
  }
}

/**
 * Disconnects app and clears cached sheet structure
 */
function handleDisconnect() {
  Swal.fire({
    title: '¿Desconectar hoja?',
    text: 'Se borrará la configuración y el historial local de envíos. La cola de envíos offline pendientes se conservará.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, desconectar',
    cancelButtonText: 'Cancelar'
  }).then((result) => {
    if (result.isConfirmed) {
      clearConnection();
      showView('setup');
      updateFooterInfo(null);
      showToast('success', 'Desconectado de Google Sheets');
    }
  });
}

/**
 * Handles submission of dynamic forms
 */
async function handleFormSubmit() {
  if (!validateForm()) return;

  const url = getScriptUrl();
  const activeTab = getActiveTab();
  const data = getFormData();

  if (!url || !activeTab) {
    showAlert('error', 'Error del Sistema', 'No hay conexión activa.');
    return;
  }

  if (isOnline()) {
    showLoading('Guardando registro...');
    
    try {
      await sendRowData(url, activeTab, data);
      
      // Update history and UI
      addToHistory(activeTab, data, 'synced');
      resetForm();
      
      closeAlert();
      showToast('success', '¡Registro guardado con éxito!');
      renderHistory();
      
    } catch (error) {
      closeAlert();
      console.error(error);
      
      // If server communication fails but we are technically online, offer saving offline
      Swal.fire({
        title: 'Error de envío',
        text: 'No se pudo comunicar con Google Sheets. ¿Quieres guardarlo localmente para enviarlo más tarde?',
        icon: 'error',
        showCancelButton: true,
        confirmButtonText: 'Guardar localmente',
        cancelButtonText: 'Descartar'
      }).then((result) => {
        if (result.isConfirmed) {
          saveSubmissionOffline(activeTab, data);
        }
      });
    }
  } else {
    // Save offline directly
    saveSubmissionOffline(activeTab, data);
  }
}

/**
 * Helper to queue submission locally
 */
function saveSubmissionOffline(activeTab, data) {
  addToQueue(activeTab, data);
  resetForm();
  showToast('warning', 'Registro guardado localmente (Offline)');
  renderHistory();
}

/**
 * Synchronizes queued offline submissions in order
 * @param {boolean} silent If true, won't show alert dialogs unless there is an error
 */
async function handleSyncQueue(silent = false) {
  const queue = getQueue();
  const url = getScriptUrl();
  
  if (queue.length === 0) {
    if (!silent) showToast('info', 'No hay registros pendientes de sincronizar.');
    return;
  }

  if (!url) return;

  if (!isOnline()) {
    if (!silent) showAlert('warning', 'Sin conexión', 'Debes estar conectado a internet para sincronizar.');
    return;
  }

  if (isSyncing) return;
  isSyncing = true;

  if (!silent) showLoading(`Sincronizando ${queue.length} registros...`);

  let successCount = 0;
  let failCount = 0;

  for (const item of queue) {
    try {
      await sendRowData(url, item.sheetName, item.rowData);
      
      // Mark as synced in history
      addToHistory(item.sheetName, item.rowData, 'synced', item.id);
      
      // Remove from queue
      removeFromQueue(item.id);
      successCount++;
    } catch (error) {
      console.error(`Failed to sync item ${item.id}:`, error);
      failCount++;
      // Stop synchronization flow on first failure to keep order integrity
      break;
    }
  }

  isSyncing = false;
  closeAlert();
  renderHistory();

  if (successCount > 0) {
    if (failCount > 0) {
      showAlert('warning', 'Sincronización parcial', `Se enviaron ${successCount} registros, pero falló la conexión al procesar el resto.`);
    } else {
      showAlert('success', '¡Sincronizado!', `Se subieron con éxito los ${successCount} registros pendientes.`);
    }
  } else if (failCount > 0) {
    if (!silent) showAlert('error', 'Sincronización fallida', 'Ocurrió un error al intentar enviar los registros pendientes. Reintenta más tarde.');
  }
}
