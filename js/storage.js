/**
 * MODULE: Storage Manager (storage.js)
 * Manages localStorage for configuration, offline queue, recent logs, schemas and settings.
 */

const KEYS = {
  SCRIPT_URL: 'sheets_forms_url',
  SHEET_SCHEMA: 'sheets_forms_schema',
  OFFLINE_QUEUE: 'sheets_forms_queue',
  RECENT_LOGS: 'sheets_forms_logs',
  THEME: 'sheets_forms_theme'
};

export const StorageManager = {
  // --- Script URL Connection ---
  getScriptUrl() {
    return localStorage.getItem(KEYS.SCRIPT_URL) || '';
  },

  setScriptUrl(url) {
    if (url) {
      localStorage.setItem(KEYS.SCRIPT_URL, url.trim());
    } else {
      localStorage.removeItem(KEYS.SCRIPT_URL);
    }
  },

  clearAllConnection() {
    localStorage.removeItem(KEYS.SCRIPT_URL);
    localStorage.removeItem(KEYS.SHEET_SCHEMA);
  },

  // --- Dynamic Sheets Schema (columns, options) ---
  getSchema() {
    const data = localStorage.getItem(KEYS.SHEET_SCHEMA);
    return data ? JSON.parse(data) : null;
  },

  setSchema(schema) {
    localStorage.setItem(KEYS.SHEET_SCHEMA, JSON.stringify(schema));
  },

  // --- Offline Queue (Queue for submissions when network is unavailable) ---
  getQueue() {
    const data = localStorage.getItem(KEYS.OFFLINE_QUEUE);
    return data ? JSON.parse(data) : [];
  },

  saveQueue(queue) {
    localStorage.setItem(KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
  },

  addToQueue(tabName, rowData) {
    const queue = this.getQueue();
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 5);
    queue.push({
      id,
      tabName,
      data: rowData,
      timestamp: new Date().toISOString()
    });
    this.saveQueue(queue);
    
    // Add to recent logs as 'cached'
    const titleKey = this.getDisplayTitleKey(tabName);
    const titleVal = rowData[titleKey] || `Nuevo registro en ${tabName}`;
    this.addLog(tabName, titleVal, 'cached', id);
    
    return id;
  },

  removeFromQueue(id) {
    let queue = this.getQueue();
    queue = queue.filter(item => item.id !== id);
    this.saveQueue(queue);
  },

  // --- Recent Submissions Log ---
  getLogs() {
    const data = localStorage.getItem(KEYS.RECENT_LOGS);
    return data ? JSON.parse(data) : [];
  },

  saveLogs(logs) {
    localStorage.setItem(KEYS.RECENT_LOGS, JSON.stringify(logs));
  },

  addLog(tabName, title, status, queueId = null) {
    const logs = this.getLogs();
    // Prevent huge storage by keeping last 50 entries
    if (logs.length >= 50) {
      logs.pop();
    }
    
    const newLog = {
      id: Date.now().toString(),
      tabName,
      title,
      timestamp: new Date().toISOString(),
      status, // 'online' or 'cached'
      queueId
    };
    
    logs.unshift(newLog);
    this.saveLogs(logs);
  },

  updateLogStatus(queueId, newStatus) {
    const logs = this.getLogs();
    const log = logs.find(item => item.queueId === queueId);
    if (log) {
      log.status = newStatus;
      log.queueId = null; // Disconnect from queue ID once synchronized
      this.saveLogs(logs);
    }
  },

  clearLogs() {
    localStorage.setItem(KEYS.RECENT_LOGS, JSON.stringify([]));
  },

  // --- Theme Mode ---
  getTheme() {
    return localStorage.getItem(KEYS.THEME) || 'light';
  },

  setTheme(theme) {
    localStorage.setItem(KEYS.THEME, theme);
  },

  // --- Helper to guess log titles based on tab ---
  getDisplayTitleKey(tabName) {
    switch (tabName) {
      case "Obras": return "Obra";
      case "Iniciativas": return "Iniciativa";
      case "Formaciones": return "Formación";
      case "Actividad": return "Asunto";
      default: return "Fecha";
    }
  }
};
