/**
 * MAIN CONTROLLER: Application Orchestrator (app.js)
 * Coordinates UI states, theme, navigation, dynamic form rendering,
 * combobox instantiation, network status changes, and submission workflows.
 */

import { StorageManager } from './storage.js';
import { ConnectionManager } from './connection.js';
import { Combobox } from './combobox.js';

// --- Default Hardcoded Schema (Fallback if offline or not yet connected) ---
const DEFAULT_SCHEMA = {
  "Obras": {
    headers: ["Fecha", "Obra", "Cliente", "Origen", "Productos", "Metros", "Importe", "Estado", "Notas"],
    dropdownOptions: {
      "Estado": ["25%", "50%", "75%", "100%"],
      "Cliente": [],
      "Origen": []
    }
  },
  "Iniciativas": {
    headers: ["Fecha", "Iniciativa", "Responsable", "Descripción", "Presupuesto", "Estado", "Notas"],
    dropdownOptions: {
      "Estado": ["Planificada", "En Curso", "Evaluada", "Finalizada"],
      "Responsable": []
    }
  },
  "Formaciones": {
    headers: ["Fecha", "Formación", "Instructor", "Asistentes", "Costo", "Estado", "Notas"],
    dropdownOptions: {
      "Estado": ["Programada", "Impartida", "Cancelada"],
      "Instructor": []
    }
  },
  "Actividad": {
    headers: ["Fecha", "Actividad", "Tipo", "Horas", "Coste Asoc", "Notas"],
    dropdownOptions: {
      "Tipo": []
    }
  }
};

// --- App State ---
const state = {
  scriptUrl: '',
  activeTab: 'Obras', // Default active sheet tab
  schema: null,
  activeComboboxes: {}, // Map of initialized Combobox instances
  isSyncing: false
};

// --- DOM Elements ---
const DOM = {
  splash: document.getElementById('splash-screen'),
  toggleThemeBtn: document.getElementById('toggle-theme-btn'),
  connectionStatus: document.getElementById('connection-status'),
  connectionStatusText: document.getElementById('connection-status-text'),
  
  // Views
  setupView: document.getElementById('setup-view'),
  dashboardView: document.getElementById('dashboard-view'),
  settingsView: document.getElementById('settings-view'),
  
  // Setup fields
  scriptUrlInput: document.getElementById('script-url-input'),
  connectBtn: document.getElementById('connect-btn'),
  openGuideBtn: document.getElementById('open-guide-btn'),
  
  // Dashboard fields
  tabCategoryTitle: document.getElementById('tab-category-title'),
  activeSheetTitle: document.getElementById('active-sheet-title'),
  fieldsCountBadge: document.getElementById('fields-count-badge'),
  dynamicForm: document.getElementById('dynamic-entry-form'),
  fieldsContainer: document.getElementById('dynamic-fields-container'),
  
  // Sync banner
  offlineSyncCard: document.getElementById('offline-sync-card'),
  offlineCount: document.getElementById('offline-count'),
  syncNowBtn: document.getElementById('sync-now-btn'),
  
  // History list
  recentLogsList: document.getElementById('recent-logs-list'),
  clearHistoryBtn: document.getElementById('clear-history-btn'),
  
  // Settings view
  settingsUrlInput: document.getElementById('settings-url-input'),
  saveSettingsBtn: document.getElementById('save-settings-btn'),
  disconnectBtn: document.getElementById('disconnect-btn'),
  settingsNetworkStatus: document.getElementById('settings-network-status'),
  settingsTabsList: document.getElementById('settings-tabs-list'),
  openGuideBtnSettings: document.getElementById('open-guide-btn-settings'),
  
  // Navigation
  navbar: document.querySelector('.app-navbar'),
  navItems: document.querySelectorAll('.nav-item'),
  
  // Modals
  guideModal: document.getElementById('guide-modal'),
  closeGuideBtn: document.getElementById('close-guide-btn'),
  closeGuideBtnBottom: document.getElementById('close-guide-btn-bottom')
};

// --- Initialize App ---
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadConnectionState();
  bindEvents();
  checkNetworkStatus();
  
  // Trigger initial schema rendering
  renderActiveForm();
  renderOfflineBanner();
  renderLogs();
  
  // Auto-sync on startup if connected
  if (ConnectionManager.isOnline()) {
    setTimeout(syncOfflineQueue, 1500);
    // Silent schema reload on startup to fetch latest sheet values in the background
    setTimeout(refreshSchemaSilently, 800);
  }
  
  // Hide splash screen after 600ms
  setTimeout(() => {
    DOM.splash.classList.add('fade-out');
  }, 600);
});

// --- Theme Mode ---
function initTheme() {
  const savedTheme = StorageManager.getTheme();
  document.documentElement.setAttribute('data-theme', savedTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  StorageManager.setTheme(newTheme);
}

// --- Connection & View Loading ---
function loadConnectionState() {
  state.scriptUrl = StorageManager.getScriptUrl();
  state.schema = StorageManager.getSchema() || DEFAULT_SCHEMA;
  
  DOM.scriptUrlInput.value = state.scriptUrl;
  DOM.settingsUrlInput.value = state.scriptUrl;
  
  updateViewVisibility();
}

function updateViewVisibility() {
  // If URL is missing, enforce setup view
  if (!state.scriptUrl) {
    DOM.setupView.classList.remove('hidden');
    DOM.setupView.classList.add('active');
    DOM.dashboardView.classList.add('hidden');
    DOM.dashboardView.classList.remove('active');
    DOM.settingsView.classList.add('hidden');
    DOM.settingsView.classList.remove('active');
    DOM.navbar.classList.add('hidden'); // Hide bottom nav during setup
  } else {
    DOM.navbar.classList.remove('hidden');
    // Decide which view is active (if config tab selected)
    const activeNavItem = document.querySelector('.nav-item.active');
    const tabName = activeNavItem ? activeNavItem.getAttribute('data-tab') : 'Obras';
    
    if (tabName === 'Config') {
      showView('settings');
    } else {
      state.activeTab = tabName;
      showView('dashboard');
    }
  }
}

function showView(viewName) {
  if (viewName === 'dashboard') {
    DOM.dashboardView.classList.remove('hidden');
    DOM.dashboardView.classList.add('active');
    DOM.setupView.classList.add('hidden');
    DOM.setupView.classList.remove('active');
    DOM.settingsView.classList.add('hidden');
    DOM.settingsView.classList.remove('active');
  } else if (viewName === 'settings') {
    DOM.settingsView.classList.remove('hidden');
    DOM.settingsView.classList.add('active');
    DOM.setupView.classList.add('hidden');
    DOM.setupView.classList.remove('active');
    DOM.dashboardView.classList.add('hidden');
    DOM.dashboardView.classList.remove('active');
    
    // Refresh info in settings
    DOM.settingsNetworkStatus.textContent = ConnectionManager.isOnline() ? 'Online' : 'Offline';
    if (state.schema) {
      DOM.settingsTabsList.textContent = Object.keys(state.schema).join(', ');
    }
  }
}

// --- Navigation Handler ---
function handleNavigation(e) {
  const btn = e.currentTarget;
  const targetTab = btn.getAttribute('data-tab');
  
  DOM.navItems.forEach(item => item.classList.remove('active'));
  btn.classList.add('active');
  
  if (targetTab === 'Config') {
    showView('settings');
  } else {
    state.activeTab = targetTab;
    showView('dashboard');
    renderActiveForm();
  }
}

// --- Dynamic Form Renderer ---
function renderActiveForm() {
  const currentTab = state.activeTab;
  const tabSchema = state.schema[currentTab] || DEFAULT_SCHEMA[currentTab] || { headers: ["Fecha", "Datos", "Notas"], dropdownOptions: {} };
  
  DOM.tabCategoryTitle.textContent = `Pestaña Activa`;
  DOM.activeSheetTitle.textContent = currentTab;
  DOM.fieldsCountBadge.textContent = `${tabSchema.headers.length} campos`;
  
  DOM.fieldsContainer.innerHTML = '';
  state.activeComboboxes = {}; // Clear old references
  
  // Render fields based on headers
  tabSchema.headers.forEach(header => {
    const fieldGroup = document.createElement('div');
    fieldGroup.className = 'input-group';
    
    const label = document.createElement('label');
    label.setAttribute('for', `field-${header}`);
    label.textContent = header;
    fieldGroup.appendChild(label);
    
    // Determine the field type and setup matching input constraints
    const dropdownOptions = tabSchema.dropdownOptions ? tabSchema.dropdownOptions[header] : null;
    const isOpenDropdown = ["Cliente", "Responsable", "Instructor", "Tipo", "Origen"].includes(header);
    
    if (isOpenDropdown) {
      // 1. OPEN DROPDOWN: Autocomplete Combobox
      const comboboxWrapper = document.createElement('div');
      comboboxWrapper.id = `combobox-${header}`;
      fieldGroup.appendChild(comboboxWrapper);
      DOM.fieldsContainer.appendChild(fieldGroup);
      
      // Initialize Combobox component
      const initialOptions = dropdownOptions || (DEFAULT_SCHEMA[currentTab]?.dropdownOptions[header] || []);
      state.activeComboboxes[header] = new Combobox(comboboxWrapper, {
        options: initialOptions,
        placeholder: `Escribe o selecciona un ${header.toLowerCase()}`,
        id: `field-${header}`,
        name: header,
        required: true,
        value: ''
      });
      
    } else if (dropdownOptions && !isOpenDropdown) {
      // 2. CLOSED DROPDOWN: Simple HTML Select dropdown
      const select = document.createElement('select');
      select.id = `field-${header}`;
      select.name = header;
      select.required = true;
      
      const defaultOpt = document.createElement('option');
      defaultOpt.value = '';
      defaultOpt.textContent = `-- Selecciona un ${header.toLowerCase()} --`;
      select.appendChild(defaultOpt);
      
      dropdownOptions.forEach(opt => {
        const o = document.createElement('option');
        o.value = opt;
        o.textContent = opt;
        select.appendChild(o);
      });
      fieldGroup.appendChild(select);
      DOM.fieldsContainer.appendChild(fieldGroup);
      
    } else if (header.toLowerCase() === 'fecha') {
      // 3. DATE FIELD: Auto fill with current date
      const input = document.createElement('input');
      input.type = 'date';
      input.id = `field-${header}`;
      input.name = header;
      input.required = true;
      
      // Set default value to today's local date
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      input.value = `${yyyy}-${mm}-${dd}`;
      
      fieldGroup.appendChild(input);
      DOM.fieldsContainer.appendChild(fieldGroup);
      
    } else if (header.toLowerCase() === 'notas' || header.toLowerCase() === 'descripción') {
      // 4. TEXTAREA FIELD
      const textarea = document.createElement('textarea');
      textarea.id = `field-${header}`;
      textarea.name = header;
      textarea.placeholder = `Ingresa detalles o comentarios sobre ${currentTab.toLowerCase()}...`;
      
      fieldGroup.appendChild(textarea);
      DOM.fieldsContainer.appendChild(fieldGroup);
      
    } else if (["presupuesto", "costo", "coste asoc", "horas", "asistentes", "metros", "importe"].includes(header.toLowerCase())) {
      // 5. NUMERIC FIELDS: Trigger correct mobile keyboard keypads
      const input = document.createElement('input');
      input.type = 'number';
      input.id = `field-${header}`;
      input.name = header;
      input.placeholder = '0';
      
      if (["asistentes", "metros", "importe"].includes(header.toLowerCase())) {
        input.inputMode = 'numeric'; // Integer only keypad
        input.step = '1';
      } else {
        input.inputMode = 'decimal'; // Keypad with decimal point
        input.step = 'any';
        input.placeholder = '0.00';
      }
      
      fieldGroup.appendChild(input);
      DOM.fieldsContainer.appendChild(fieldGroup);
      
    } else {
      // 6. STANDARD TEXT INPUT
      const input = document.createElement('input');
      input.type = 'text';
      input.id = `field-${header}`;
      input.name = header;
      input.placeholder = `Ingresa ${header.toLowerCase()}`;
      
      fieldGroup.appendChild(input);
      DOM.fieldsContainer.appendChild(fieldGroup);
    }
  });
  
  // Re-trigger Lucide Icons
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// --- Submit Handler ---
async function handleFormSubmit(e) {
  e.preventDefault();
  
  const currentTab = state.activeTab;
  const tabSchema = state.schema[currentTab] || DEFAULT_SCHEMA[currentTab];
  const rowData = {};
  
  let isValid = true;
  
  // Collect data and perform HTML5 validation checks
  for (const header of tabSchema.headers) {
    let value = '';
    
    if (state.activeComboboxes[header]) {
      value = state.activeComboboxes[header].getValue();
      const comboboxInput = document.getElementById(`field-${header}`);
      
      // Perform validation check on combobox
      if (state.activeComboboxes[header].required && !value) {
        isValid = false;
        comboboxInput.style.borderColor = 'var(--danger)';
        comboboxInput.focus();
      } else {
        comboboxInput.style.borderColor = '';
      }
    } else {
      const el = document.getElementById(`field-${header}`);
      if (el) {
        value = el.value.trim();
        if (el.required && !value) {
          isValid = false;
          el.style.borderColor = 'var(--danger)';
          el.focus();
        } else {
          el.style.borderColor = '';
        }
      }
    }
    
    rowData[header] = value;
  }
  
  if (!isValid) {
    Swal.fire({
      icon: 'warning',
      title: 'Campos incompletos',
      text: 'Por favor, rellena todos los campos requeridos para guardar el registro.',
      confirmButtonColor: 'var(--primary)'
    });
    return;
  }
  
  const displayTitleKey = StorageManager.getDisplayTitleKey(currentTab);
  const logTitle = rowData[displayTitleKey] || `Fila en ${currentTab}`;
  
  // Check network connection
  if (ConnectionManager.isOnline() && state.scriptUrl) {
    // Show spinner loader dialog
    Swal.fire({
      title: 'Guardando registro...',
      text: 'Enviando los datos a Google Sheets.',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });
    
    const result = await ConnectionManager.sendRow(state.scriptUrl, currentTab, rowData);
    
    Swal.close();
    
    if (result.success) {
      StorageManager.addLog(currentTab, logTitle, 'online');
      
      Swal.fire({
        icon: 'success',
        title: '¡Guardado con éxito!',
        text: result.message || 'El registro se guardó en Google Sheets.',
        timer: 2000,
        timerProgressBar: true,
        showConfirmButton: false
      });
      
      resetActiveForm();
      
      // Fetch schema in the background to capture any new unique dropdown options
      refreshSchemaSilently();
    } else {
      // Server returned error, cache local
      saveOfflineAndAlert(currentTab, rowData, logTitle, result.error);
    }
  } else {
    // Offline mode: cache local
    saveOfflineAndAlert(currentTab, rowData, logTitle);
  }
}

function saveOfflineAndAlert(tabName, data, logTitle, errorMsg = '') {
  StorageManager.addToQueue(tabName, data);
  
  let subtitle = 'Tu dispositivo está sin conexión.';
  if (errorMsg) {
    subtitle = 'Hubo un inconveniente al conectar con el servidor.';
    console.warn('API connection failed:', errorMsg);
  }
  
  Swal.fire({
    icon: 'info',
    title: 'Registro guardado localmente',
    text: `${subtitle} El registro se guardó en la cola y se enviará automáticamente cuando recuperes la señal.`,
    confirmButtonColor: 'var(--warning)',
    confirmButtonText: 'Entendido'
  });
  
  resetActiveForm();
  renderOfflineBanner();
  renderLogs();
}

function resetActiveForm() {
  DOM.dynamicForm.reset();
  
  // Re-populate Date input with today's date
  const dateInputs = DOM.fieldsContainer.querySelectorAll('input[type="date"]');
  dateInputs.forEach(input => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    input.value = `${yyyy}-${mm}-${dd}`;
  });
  
  // Reset combobox elements
  Object.keys(state.activeComboboxes).forEach(key => {
    state.activeComboboxes[key].setValue('');
  });
}

// --- Sync Offline Queue ---
async function syncOfflineQueue() {
  if (state.isSyncing) return;
  
  const queue = StorageManager.getQueue();
  if (queue.length === 0) return;
  
  if (!ConnectionManager.isOnline() || !state.scriptUrl) {
    renderOfflineBanner();
    return;
  }
  
  state.isSyncing = true;
  DOM.syncNowBtn.disabled = true;
  DOM.syncNowBtn.innerHTML = '<i class="spin" data-lucide="refresh-cw"></i> Sincronizando...';
  if (window.lucide) window.lucide.createIcons();
  
  console.log(`Starting synchronization of ${queue.length} items...`);
  
  // Process queue item-by-item to guarantee order
  for (const item of queue) {
    const result = await ConnectionManager.sendRow(state.scriptUrl, item.tabName, item.data);
    if (result.success) {
      StorageManager.removeFromQueue(item.id);
      StorageManager.updateLogStatus(item.id, 'online');
    } else {
      console.error(`Failed syncing item ${item.id}:`, result.error);
      // Stop sync queue processing if error is server-wide to avoid repeat requests
      break;
    }
  }
  
  state.isSyncing = false;
  DOM.syncNowBtn.disabled = false;
  DOM.syncNowBtn.innerHTML = '<i data-lucide="refresh-cw"></i> Sincronizar';
  if (window.lucide) window.lucide.createIcons();
  
  renderOfflineBanner();
  renderLogs();
  
  // Refresh schema to sync new dropdown unique lists
  refreshSchemaSilently();
}

function renderOfflineBanner() {
  const queue = StorageManager.getQueue();
  if (queue.length > 0) {
    DOM.offlineCount.textContent = queue.length;
    DOM.offlineSyncCard.classList.remove('hidden');
  } else {
    DOM.offlineSyncCard.classList.add('hidden');
  }
}

// --- Render History Logs ---
function renderLogs() {
  const logs = StorageManager.getLogs();
  DOM.recentLogsList.innerHTML = '';
  
  if (logs.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state-text';
    empty.textContent = 'No hay envíos recientes registrados en este navegador.';
    DOM.recentLogsList.appendChild(empty);
    return;
  }
  
  logs.forEach(log => {
    const item = document.createElement('div');
    item.className = 'history-item';
    
    const left = document.createElement('div');
    left.className = 'history-item-left';
    
    const title = document.createElement('div');
    title.className = 'history-item-title';
    title.textContent = log.title;
    left.appendChild(title);
    
    const sub = document.createElement('div');
    sub.className = 'history-item-sub';
    
    // Format timestamp
    const date = new Date(log.timestamp);
    const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    const dateStr = `${date.getDate()}/${date.getMonth()+1}`;
    sub.textContent = `${log.tabName} • ${dateStr} ${timeStr}`;
    left.appendChild(sub);
    
    item.appendChild(left);
    
    const badge = document.createElement('span');
    badge.className = `history-item-badge ${log.status}`;
    badge.textContent = log.status === 'online' ? 'Enviado' : 'Guardado';
    item.appendChild(badge);
    
    DOM.recentLogsList.appendChild(item);
  });
}

function clearLogsHistory() {
  Swal.fire({
    title: '¿Borrar historial?',
    text: 'Se limpiará la lista visual de envíos recientes en este dispositivo. La hoja de cálculo de Google no sufrirá cambios.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: 'var(--danger)',
    cancelButtonColor: 'var(--text-muted)',
    confirmButtonText: 'Sí, borrar',
    cancelButtonText: 'Cancelar'
  }).then((result) => {
    if (result.isConfirmed) {
      StorageManager.clearLogs();
      renderLogs();
    }
  });
}

// --- Sync Connection URL & Schema ---
async function handleConnect() {
  const url = DOM.scriptUrlInput.value.trim();
  if (!url) {
    Swal.fire({
      icon: 'warning',
      title: 'Enlace requerido',
      text: 'Debes proporcionar una URL válida de Apps Script.',
      confirmButtonColor: 'var(--primary)'
    });
    return;
  }

  Swal.fire({
    title: 'Conectando con Google Sheets...',
    text: 'Sincronizando pestañas y campos de la hoja de cálculo.',
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  const result = await ConnectionManager.fetchSchema(url);
  Swal.close();

  if (result.success) {
    state.scriptUrl = url;
    const cleanSchema = result.data.sheets || result.data;
    state.schema = cleanSchema;
    
    // Save to storage
    StorageManager.setScriptUrl(url);
    StorageManager.setSchema(cleanSchema);
    
    DOM.settingsUrlInput.value = url;
    
    Swal.fire({
      icon: 'success',
      title: '¡Conexión establecida!',
      text: 'Se han sincronizado correctamente todas las pestañas.',
      timer: 2000,
      showConfirmButton: false
    });
    
    updateViewVisibility();
    renderActiveForm();
    
    // Sync any pending items in queue now
    syncOfflineQueue();
  } else {
    Swal.fire({
      icon: 'error',
      title: 'Fallo de conexión',
      text: result.error,
      confirmButtonColor: 'var(--primary)'
    });
  }
}

async function refreshSchemaSilently() {
  if (!state.scriptUrl || !ConnectionManager.isOnline()) return;
  const result = await ConnectionManager.fetchSchema(state.scriptUrl);
  if (result.success) {
    console.log("Esquema descargado con éxito del servidor:", result.data);
    const cleanSchema = result.data.sheets || result.data;
    state.schema = cleanSchema;
    StorageManager.setSchema(cleanSchema);
    renderActiveForm();
  } else {
    console.warn("Fallo al descargar el esquema:", result.error);
  }
}

function handleDisconnect() {
  Swal.fire({
    title: '¿Desconectar aplicación?',
    text: 'Se borrará la URL y el esquema guardados. No perderás los envíos ya realizados ni la cola offline, pero deberás reconectar para volver a sincronizar.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: 'var(--danger)',
    cancelButtonColor: 'var(--text-muted)',
    confirmButtonText: 'Sí, desconectar',
    cancelButtonText: 'Cancelar'
  }).then((result) => {
    if (result.isConfirmed) {
      StorageManager.clearAllConnection();
      loadConnectionState();
      renderActiveForm();
      
      Swal.fire({
        icon: 'success',
        title: 'Desconectado',
        text: 'La conexión se ha eliminado.',
        timer: 1500,
        showConfirmButton: false
      });
    }
  });
}

async function handleSaveSettings() {
  const url = DOM.settingsUrlInput.value.trim();
  if (!url) {
    handleDisconnect();
    return;
  }

  Swal.fire({
    title: 'Sincronizando cambios...',
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  const result = await ConnectionManager.fetchSchema(url);
  Swal.close();

  if (result.success) {
    state.scriptUrl = url;
    const cleanSchema = result.data.sheets || result.data;
    state.schema = cleanSchema;
    
    StorageManager.setScriptUrl(url);
    StorageManager.setSchema(cleanSchema);
    
    DOM.scriptUrlInput.value = url;
    
    Swal.fire({
      icon: 'success',
      title: 'Configuración guardada',
      text: 'Se actualizó la conexión con el servidor.',
      timer: 1500,
      showConfirmButton: false
    });
    
    // Switch navigation back to active tab
    const firstTab = DOM.navbar.querySelector('[data-tab="Obras"]');
    if (firstTab) firstTab.click();
  } else {
    Swal.fire({
      icon: 'error',
      title: 'Fallo al guardar',
      text: result.error,
      confirmButtonColor: 'var(--primary)'
    });
  }
}

// --- Network connection listeners ---
function checkNetworkStatus() {
  const isOnline = ConnectionManager.isOnline();
  
  if (isOnline) {
    DOM.connectionStatus.className = 'status-indicator online';
    DOM.connectionStatusText.textContent = 'Online';
    // Auto-trigger synchronization of cached queue items
    syncOfflineQueue();
  } else {
    DOM.connectionStatus.className = 'status-indicator offline';
    DOM.connectionStatusText.textContent = 'Offline';
  }
}

// --- Bind Event Listeners ---
function bindEvents() {
  // Theme Toggle
  DOM.toggleThemeBtn.addEventListener('click', toggleTheme);
  
  // Navigation tabs
  DOM.navItems.forEach(item => {
    item.addEventListener('click', handleNavigation);
  });
  
  // Setup Actions
  DOM.connectBtn.addEventListener('click', handleConnect);
  DOM.openGuideBtn.addEventListener('click', () => toggleModal(true));
  
  // Settings Actions
  DOM.saveSettingsBtn.addEventListener('click', handleSaveSettings);
  DOM.disconnectBtn.addEventListener('click', handleDisconnect);
  DOM.openGuideBtnSettings.addEventListener('click', () => toggleModal(true));
  
  // Dashboard Actions
  DOM.dynamicForm.addEventListener('submit', handleFormSubmit);
  DOM.syncNowBtn.addEventListener('click', syncOfflineQueue);
  DOM.clearHistoryBtn.addEventListener('click', clearLogsHistory);
  
  // Modal Actions
  DOM.closeGuideBtn.addEventListener('click', () => toggleModal(false));
  DOM.closeGuideBtnBottom.addEventListener('click', () => toggleModal(false));
  DOM.guideModal.addEventListener('click', (e) => {
    if (e.target === DOM.guideModal) toggleModal(false);
  });
  
  // Network connection changes
  window.addEventListener('online', checkNetworkStatus);
  window.addEventListener('offline', checkNetworkStatus);
}

function toggleModal(show) {
  if (show) {
    DOM.guideModal.classList.add('open');
  } else {
    DOM.guideModal.classList.remove('open');
  }
}
