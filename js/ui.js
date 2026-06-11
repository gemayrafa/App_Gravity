// UI Manager for SheetsForms

import { getActiveTab, saveActiveTab, getHistory, getQueue, getSheetsStructure } from './storage.js';

// DOM Elements
const connectionStatusDot = document.getElementById('connection-status');
const connectionStatusText = document.getElementById('connection-status-text');
const setupView = document.getElementById('setup-view');
const dashboardView = document.getElementById('dashboard-view');
const scriptUrlInput = document.getElementById('script-url-input');
const sheetTabsList = document.getElementById('sheet-tabs-list');
const activeSheetTitle = document.getElementById('active-sheet-title');
const fieldsCountBadge = document.getElementById('fields-count-badge');
const dynamicFieldsContainer = document.getElementById('dynamic-fields-container');
const entryForm = document.getElementById('dynamic-entry-form');
const offlineSyncCard = document.getElementById('offline-sync-card');
const offlineCountSpan = document.getElementById('offline-count');
const recentLogsList = document.getElementById('recent-logs-list');
const footerSheetName = document.getElementById('footer-sheet-name');
const disconnectBtn = document.getElementById('disconnect-btn');
const guideModal = document.getElementById('guide-modal');
const scriptCodeBlock = document.getElementById('script-code-block');

// Google Apps Script source code to show in the guide
const APPS_SCRIPT_SOURCE = `// Código para el editor de Google Apps Script (Extensiones -> Apps Script)

function doGet(e) {
  var action = e.parameter.action;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  if (action === 'getStructure') {
    try {
      var sheets = ss.getSheets();
      var structure = sheets.map(function(sheet) {
        var name = sheet.getName();
        var headers = [];
        var uniqueValues = {};
        if (sheet.getLastRow() > 0) {
          var lastRow = sheet.getLastRow();
          var lastColumn = sheet.getLastColumn();
          var rangeValues = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
          headers = rangeValues[0];
          
          headers.forEach(function(header, colIndex) {
            if (!header) return;
            var values = [];
            for (var r = 1; r < rangeValues.length; r++) {
              var val = rangeValues[r][colIndex];
              if (val !== null && val !== undefined && val !== "") {
                var strVal = String(val).trim();
                if (strVal && values.indexOf(strVal) === -1) {
                  values.push(strVal);
                }
              }
            }
            values.sort();
            uniqueValues[header] = values;
          });
        }
        return { name: name, headers: headers, uniqueValues: uniqueValues };
      });
      return ContentService.createTextOutput(JSON.stringify({ success: true, sheets: structure }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
  return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Acción no válida' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    var sheetName = data.sheetName;
    var rowData = data.rowData;
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Pestaña no encontrada: ' + sheetName }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'appendRow') {
      var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      var newRow = headers.map(function(header) {
        return rowData[header] !== undefined ? rowData[header] : "";
      });
      sheet.appendRow(newRow);
      return ContentService.createTextOutput(JSON.stringify({ success: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Acción no soportada' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

/**
 * Initializes UI listeners and views
 */
export function initUI(onConnectHandler, onDisconnectHandler, onSubmitHandler, onSyncHandler) {
  // Fill guide code block
  if (scriptCodeBlock) {
    scriptCodeBlock.textContent = APPS_SCRIPT_SOURCE;
  }

  // Bind guide modal buttons
  document.getElementById('open-guide-btn')?.addEventListener('click', openGuide);
  document.querySelectorAll('#close-guide-btn, #close-guide-btn-bottom').forEach(btn => {
    btn.addEventListener('click', closeGuide);
  });
  
  // Theme toggler
  document.getElementById('toggle-theme-btn')?.addEventListener('click', toggleTheme);
  
  // Settings gear opens connection view
  document.getElementById('open-settings-btn')?.addEventListener('click', () => {
    showView('setup');
  });

  // Connect button click
  document.getElementById('connect-btn')?.addEventListener('click', () => {
    const url = scriptUrlInput.value.trim();
    onConnectHandler(url);
  });

  // Disconnect button click
  disconnectBtn?.addEventListener('click', () => {
    onDisconnectHandler();
  });

  // Copy code button click
  document.getElementById('copy-code-btn')?.addEventListener('click', () => {
    navigator.clipboard.writeText(APPS_SCRIPT_SOURCE);
    showToast('success', '¡Código copiado al portapapeles!');
  });

  // Form submit handler
  entryForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    onSubmitHandler(e);
  });

  // Sync now button click
  document.getElementById('sync-now-btn')?.addEventListener('click', () => {
    onSyncHandler();
  });

  // Clear history click
  document.getElementById('clear-history-btn')?.addEventListener('click', () => {
    // Dispatch custom event or handle directly
    import('./storage.js').then(storage => {
      storage.clearHistory();
      renderHistory();
      showToast('success', 'Historial borrado');
    });
  });

  // Initialize theme from storage/prefers
  const savedTheme = localStorage.getItem('sheets_forms_theme') || 
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', savedTheme);
  
  // Re-initialize lucide icons
  lucide.createIcons();
}

/**
 * Switch active views
 * @param {'setup'|'dashboard'} view 
 */
export function showView(view) {
  if (view === 'setup') {
    setupView.classList.add('active');
    dashboardView.classList.remove('active');
    disconnectBtn.classList.add('hidden');
  } else {
    setupView.classList.remove('active');
    dashboardView.classList.add('active');
    disconnectBtn.classList.remove('hidden');
  }
}

/**
 * Updates UI network status indicator
 * @param {boolean} online 
 */
export function updateNetworkStatus(online) {
  if (online) {
    connectionStatusDot.className = 'status-indicator online';
    connectionStatusText.textContent = 'Online';
  } else {
    connectionStatusDot.className = 'status-indicator offline';
    connectionStatusText.textContent = 'Offline';
  }
}

/**
 * Populates connection field with URL
 * @param {string} url 
 */
export function setConnectionUrlInput(url) {
  if (scriptUrlInput) scriptUrlInput.value = url;
}

/**
 * Render sheet tabs list and generates active form
 * @param {Array<{name: string, headers: Array<string>}>} sheets 
 */
export function renderTabs(sheets) {
  sheetTabsList.innerHTML = '';
  
  if (!sheets || sheets.length === 0) {
    sheetTabsList.innerHTML = '<p class="empty-state-text">No se encontraron pestañas.</p>';
    return;
  }
  
  let activeTabName = getActiveTab();
  
  // Fallback to first tab if saved is not in list
  const tabExists = sheets.some(s => s.name === activeTabName);
  if (!activeTabName || !tabExists) {
    activeTabName = sheets[0].name;
    saveActiveTab(activeTabName);
  }

  sheets.forEach(sheet => {
    const btn = document.createElement('button');
    btn.className = `tab-btn ${sheet.name === activeTabName ? 'active' : ''}`;
    btn.dataset.name = sheet.name;
    btn.innerHTML = `<i data-lucide="sheet"></i> <span>${sheet.name}</span>`;
    
    btn.addEventListener('click', () => {
      // Toggle active states in UI
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Save state
      saveActiveTab(sheet.name);
      
      // Render form
      renderFormForSheet(sheet);
    });
    
    sheetTabsList.appendChild(btn);
  });
  
  // Render form for initial active sheet
  const activeSheet = sheets.find(s => s.name === activeTabName) || sheets[0];
  renderFormForSheet(activeSheet);
  
  // Re-run lucide for newly added tabs
  lucide.createIcons();
}

/**
 * Set active sheet information in footer
 * @param {string} url 
 */
export function updateFooterInfo(url) {
  if (url) {
    try {
      const match = url.match(/\/macros\/s\/([^/]+)\/exec/);
      const idStr = match ? match[1].substring(0, 8) + '...' : 'Conectado';
      footerSheetName.textContent = `Script: ${idStr}`;
    } catch {
      footerSheetName.textContent = 'Conectado';
    }
  } else {
    footerSheetName.textContent = 'Sin conectar';
  }
}

/**
 * Auto-detects proper HTML input types from header strings
 * @param {string} header 
 * @returns {{type: string, isRequired: boolean, cleanName: string}}
 */
function parseHeader(header) {
  const cleanHeader = header.trim();
  let isRequired = false;
  let cleanName = cleanHeader;
  
  // Detect if field is required (ends with '*')
  if (cleanHeader.endsWith('*')) {
    isRequired = true;
    cleanName = cleanHeader.substring(0, cleanHeader.length - 1).trim();
  }
  
  const lower = cleanName.toLowerCase();
  let type = 'text'; // Default type
  
  // Simple heuristics based on Spanish & English keywords
  if (lower.includes('fecha') || lower.includes('date') || lower.includes('dia') || lower.includes('día')) {
    type = 'date';
  } else if (lower.includes('hora') || lower.includes('time')) {
    type = 'time';
  } else if (lower.includes('email') || lower.includes('correo') || lower.includes('mail')) {
    type = 'email';
  } else if (lower.includes('tel') || lower.includes('phone') || lower.includes('móvil') || lower.includes('movil') || lower.includes('celular')) {
    type = 'tel';
  } else if (lower.includes('precio') || lower.includes('monto') || lower.includes('cantidad') || lower.includes('costo') || lower.includes('numero') || lower.includes('número') || lower.includes('num') || lower.includes('id') || lower.includes('valor') || lower.includes('edad')) {
    type = 'number';
  } else if (cleanHeader.endsWith('?') || lower.includes('si/no') || lower.includes('sí/no') || lower.includes('activo') || lower.includes('hecho') || lower.includes('entregado') || lower.includes('completado')) {
    type = 'switch';
  } else if (lower.includes('nota') || lower.includes('comentario') || lower.includes('descripcion') || lower.includes('descripción') || lower.includes('observacion') || lower.includes('observaciones') || lower.includes('obs')) {
    type = 'textarea';
  } else if (lower.includes('color')) {
    type = 'color';
  }
  
  return { type, isRequired, cleanName };
}

/**
 * Builds HTML inputs dynamically for a sheet structure
 * @param {{name: string, headers: Array<string>}} sheet 
 */
function renderFormForSheet(sheet) {
  dynamicFieldsContainer.innerHTML = '';
  activeSheetTitle.textContent = sheet.name;
  
  // Exclude empty headers
  const headers = (sheet.headers || []).filter(h => h && h.trim() !== '');
  fieldsCountBadge.textContent = `${headers.length} campos`;
  
  if (headers.length === 0) {
    dynamicFieldsContainer.innerHTML = `
      <div class="empty-state-text">
        <i data-lucide="info" style="margin: 0 auto 8px auto; display: block;"></i>
        Esta pestaña no tiene columnas en la primera fila. Agrega encabezados en tu Google Sheets para generar el formulario.
      </div>`;
    lucide.createIcons();
    return;
  }
  
  headers.forEach(header => {
    const { type, isRequired, cleanName } = parseHeader(header);
    
    const fieldDiv = document.createElement('div');
    
    if (type === 'switch') {
      fieldDiv.className = 'form-field form-field-switch';
      
      const label = document.createElement('label');
      label.setAttribute('for', `field-${header}`);
      label.textContent = cleanName;
      
      const switchControl = document.createElement('label');
      switchControl.className = 'switch-control';
      
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.id = `field-${header}`;
      input.name = header;
      
      const slider = document.createElement('span');
      slider.className = 'switch-slider';
      
      switchControl.appendChild(input);
      switchControl.appendChild(slider);
      
      fieldDiv.appendChild(label);
      fieldDiv.appendChild(switchControl);
      
    } else {
      fieldDiv.className = 'form-field';
      
      const label = document.createElement('label');
      label.setAttribute('for', `field-${header}`);
      label.textContent = cleanName;
      
      if (isRequired) {
        const asterisk = document.createElement('span');
        asterisk.className = 'required-asterisk';
        asterisk.textContent = ' *';
        label.appendChild(asterisk);
      }
      
      fieldDiv.appendChild(label);
      
      const isObrasSheet = sheet.name.trim().toLowerCase() === 'obras';
      const isClienteOrOrigen = cleanName.toLowerCase() === 'cliente' || cleanName.toLowerCase() === 'origen';
      
      if (isObrasSheet && isClienteOrOrigen) {
        const select = document.createElement('select');
        select.id = `field-${header}`;
        select.name = header;
        if (isRequired) select.required = true;
        
        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = `-- Seleccionar ${cleanName.toLowerCase()} --`;
        select.appendChild(defaultOpt);
        
        const values = (sheet.uniqueValues && sheet.uniqueValues[header]) || [];
        values.forEach(val => {
          const option = document.createElement('option');
          option.value = val;
          option.textContent = val;
          select.appendChild(option);
        });
        
        const newOpt = document.createElement('option');
        newOpt.value = '__NEW__';
        newOpt.textContent = `➕ [Agregar nuevo...]`;
        select.appendChild(newOpt);
        
        const newInput = document.createElement('input');
        newInput.type = 'text';
        newInput.id = `field-${header}-new`;
        newInput.className = 'new-option-input hidden';
        newInput.placeholder = `Ingresar nuevo ${cleanName.toLowerCase()}`;
        newInput.style.marginTop = '8px';
        
        select.addEventListener('change', () => {
          if (select.value === '__NEW__') {
            newInput.classList.remove('hidden');
            newInput.required = true;
            newInput.name = header;
            select.removeAttribute('name');
            newInput.focus();
          } else {
            newInput.classList.add('hidden');
            newInput.required = false;
            newInput.removeAttribute('name');
            select.name = header;
            newInput.value = '';
          }
        });
        
        fieldDiv.appendChild(select);
        fieldDiv.appendChild(newInput);
      } else {
        let input;
        if (type === 'textarea') {
          input = document.createElement('textarea');
          input.placeholder = `Escribe tu anotación aquí...`;
        } else {
          input = document.createElement('input');
          input.type = type;
          
          // Auto date/time helpers
          if (type === 'date') {
            input.valueAsDate = new Date();
          } else if (type === 'time') {
            const now = new Date();
            const hrs = String(now.getHours()).padStart(2, '0');
            const mins = String(now.getMinutes()).padStart(2, '0');
            input.value = `${hrs}:${mins}`;
          }
          
          input.placeholder = `Ingresar ${cleanName.toLowerCase()}`;
        }
        
        input.id = `field-${header}`;
        input.name = header;
        if (isRequired) input.required = true;
        
        fieldDiv.appendChild(input);
      }
    }
    
    dynamicFieldsContainer.appendChild(fieldDiv);
  });
  
  // Set focus on first input if text or number
  const firstInput = dynamicFieldsContainer.querySelector('input, textarea');
  if (firstInput && (firstInput.type === 'text' || firstInput.type === 'number')) {
    firstInput.focus();
  }
}

/**
 * Collects form inputs into an object mapping raw headers to values
 * @returns {Object}
 */
export function getFormData() {
  const fields = dynamicFieldsContainer.querySelectorAll('input, textarea, select');
  const data = {};
  
  fields.forEach(field => {
    const name = field.name;
    if (!name) return;
    
    let value = field.value;
    
    if (field.type === 'checkbox') {
      value = field.checked ? 'SÍ' : 'NO';
    } else if (field.type === 'number') {
      value = field.value !== "" ? Number(field.value) : "";
    }
    
    data[name] = value;
  });
  
  return data;
}

/**
 * Resets active form fields
 */
export function resetForm() {
  const fields = dynamicFieldsContainer.querySelectorAll('input, textarea, select');
  fields.forEach(field => {
    if (field.tagName.toLowerCase() === 'select') {
      field.value = '';
      field.dispatchEvent(new Event('change'));
    } else if (field.type === 'checkbox') {
      field.checked = false;
    } else if (field.type === 'date') {
      field.valueAsDate = new Date();
    } else if (field.type === 'time') {
      const now = new Date();
      const hrs = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      field.value = `${hrs}:${mins}`;
    } else {
      field.value = '';
    }
  });
  
  // Return focus to first input
  const firstInput = dynamicFieldsContainer.querySelector('input, textarea, select');
  if (firstInput && (firstInput.type === 'text' || firstInput.type === 'number' || firstInput.tagName.toLowerCase() === 'select')) {
    firstInput.focus();
  }
}

/**
 * Renders history list and sync banner status
 */
export function renderHistory() {
  const queue = getQueue();
  if (queue.length > 0) {
    offlineCountSpan.textContent = queue.length;
    offlineSyncCard.classList.remove('hidden');
  } else {
    offlineSyncCard.classList.add('hidden');
  }

  const history = getHistory();
  recentLogsList.innerHTML = '';
  
  if (history.length === 0) {
    recentLogsList.innerHTML = '<p class="empty-state-text">No has realizado envíos recientes.</p>';
    return;
  }
  
  history.forEach(item => {
    const div = document.createElement('div');
    div.className = 'history-item';
    
    let timeStr = 'Reciente';
    try {
      const date = new Date(item.timestamp);
      timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {}
    
    const isSynced = item.status === 'synced';
    
    div.innerHTML = `
      <div class="history-item-left">
        <div>
          <span class="history-item-tab">[${item.sheetName}]</span>
        </div>
        <div class="history-item-preview" title="${item.preview}">${item.preview}</div>
      </div>
      <div class="history-item-right">
        <span class="history-item-time">${timeStr}</span>
        <div class="status-badge ${isSynced ? 'synced' : 'pending'}" title="${isSynced ? 'Sincronizado' : 'Pendiente offline'}">
          <i data-lucide="${isSynced ? 'check' : 'wifi-off'}" style="width: 12px; height: 12px;"></i>
        </div>
      </div>
    `;
    
    recentLogsList.appendChild(div);
  });
  
  lucide.createIcons();
}

/**
 * Toggles dark/light modes
 */
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('sheets_forms_theme', newTheme);
}

// Modal open/close actions
export function openGuide() {
  guideModal.classList.add('active');
}

export function closeGuide() {
  guideModal.classList.remove('active');
}

/* --- TOAST & DIALOG WRAPPERS (SweetAlert2) --- */

export function showLoading(title = 'Cargando...') {
  Swal.fire({
    title: title,
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });
}

export function closeAlert() {
  Swal.close();
}

export function showAlert(icon, title, text) {
  return Swal.fire({
    icon,
    title,
    text,
    confirmButtonText: 'Aceptar'
  });
}

export function showToast(icon, title) {
  const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    didOpen: (toast) => {
      toast.addEventListener('mouseenter', Swal.stopTimer);
      toast.addEventListener('mouseleave', Swal.resumeTimer);
    }
  });
  
  Toast.fire({
    icon,
    title
  });
}

export function validateForm() {
  const fields = dynamicFieldsContainer.querySelectorAll('input[required], textarea[required], select[required]');
  let isValid = true;
  
  fields.forEach(field => {
    if (!field.value || field.value.trim() === '') {
      isValid = false;
      field.style.borderColor = 'var(--danger)';
      field.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.1)';
      
      const fieldWrapper = field.closest('.form-field');
      if (fieldWrapper) {
        fieldWrapper.style.animation = 'none';
        setTimeout(() => {
          fieldWrapper.style.animation = 'shake 0.3s ease-in-out';
        }, 10);
      }
      
      const resetError = () => {
        field.style.borderColor = '';
        field.style.boxShadow = '';
        field.removeEventListener('input', resetError);
        field.removeEventListener('change', resetError);
      };
      field.addEventListener('input', resetError);
      field.addEventListener('change', resetError);
    }
  });
  
  if (!isValid) {
    showToast('error', 'Por favor, llena los campos obligatorios (*)');
  }
  
  return isValid;
}

/**
 * Oculta la pantalla de carga inicial con una animación de desvanecimiento
 */
export function hideSplashScreen() {
  const splash = document.getElementById('splash-screen');
  if (splash) {
    splash.classList.add('fade-out');
    // La elimina del documento después de que termine la transición de 0.4s
    setTimeout(() => splash.remove(), 400);
  }
}

/**
 * Re-renders the form for the currently active sheet tab from cache
 */
export function refreshActiveForm() {
  const sheets = getSheetsStructure();
  const activeTabName = getActiveTab();
  if (sheets && activeTabName) {
    const activeSheet = sheets.find(s => s.name === activeTabName);
    if (activeSheet) {
      renderFormForSheet(activeSheet);
    }
  }
}
