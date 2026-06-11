// Storage & Queue Manager for SheetsForms

const KEYS = {
  SCRIPT_URL: 'sheets_forms_script_url',
  OFFLINE_QUEUE: 'sheets_forms_offline_queue',
  SUBMISSION_HISTORY: 'sheets_forms_history',
  ACTIVE_TAB: 'sheets_forms_active_tab',
  SHEETS_STRUCTURE: 'sheets_forms_structure'
};

/**
 * Save Google Apps Script Web App URL
 * @param {string} url 
 */
export function saveScriptUrl(url) {
  localStorage.setItem(KEYS.SCRIPT_URL, url.trim());
}

/**
 * Get Google Apps Script Web App URL
 * @returns {string|null}
 */
export function getScriptUrl() {
  return localStorage.getItem(KEYS.SCRIPT_URL);
}

/**
 * Clear connection details
 */
export function clearConnection() {
  localStorage.removeItem(KEYS.SCRIPT_URL);
  localStorage.removeItem(KEYS.SHEETS_STRUCTURE);
  localStorage.removeItem(KEYS.ACTIVE_TAB);
}

/**
 * Save structure of sheets (tabs & columns)
 * @param {Array} structure 
 */
export function saveSheetsStructure(structure) {
  localStorage.setItem(KEYS.SHEETS_STRUCTURE, JSON.stringify(structure));
}

/**
 * Get saved sheets structure
 * @returns {Array|null}
 */
export function getSheetsStructure() {
  const data = localStorage.getItem(KEYS.SHEETS_STRUCTURE);
  return data ? JSON.parse(data) : null;
}

/**
 * Save active tab name
 * @param {string} tabName 
 */
export function saveActiveTab(tabName) {
  localStorage.setItem(KEYS.ACTIVE_TAB, tabName);
}

/**
 * Get active tab name
 * @returns {string|null}
 */
export function getActiveTab() {
  return localStorage.getItem(KEYS.ACTIVE_TAB);
}

/* --- OFFLINE QUEUE MANAGEMENT --- */

/**
 * Get all queued offline submissions
 * @returns {Array}
 */
export function getQueue() {
  const queue = localStorage.getItem(KEYS.OFFLINE_QUEUE);
  return queue ? JSON.parse(queue) : [];
}

/**
 * Add submission to offline queue
 * @param {string} sheetName 
 * @param {Object} rowData 
 * @returns {Object} The added queue item
 */
export function addToQueue(sheetName, rowData) {
  const queue = getQueue();
  const id = 'offline_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  const queueItem = {
    id,
    sheetName,
    rowData,
    timestamp: new Date().toISOString()
  };
  
  queue.push(queueItem);
  localStorage.setItem(KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
  
  // Also add to history as 'pending'
  addToHistory(sheetName, rowData, 'pending', id);
  
  return queueItem;
}

/**
 * Remove a single item from the queue by ID
 * @param {string} id 
 */
export function removeFromQueue(id) {
  let queue = getQueue();
  queue = queue.filter(item => item.id !== id);
  localStorage.setItem(KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
}

/**
 * Clear entire queue
 */
export function clearQueue() {
  localStorage.removeItem(KEYS.OFFLINE_QUEUE);
}


/* --- HISTORY MANAGEMENT --- */

/**
 * Get all submission logs
 * @returns {Array}
 */
export function getHistory() {
  const history = localStorage.getItem(KEYS.SUBMISSION_HISTORY);
  return history ? JSON.parse(history) : [];
}

/**
 * Add or update an item in history
 * @param {string} sheetName 
 * @param {Object} rowData 
 * @param {'synced'|'pending'} status 
 * @param {string} id 
 */
export function addToHistory(sheetName, rowData, status = 'synced', id = null) {
  const history = getHistory();
  const itemId = id || 'history_' + Date.now();
  
  // Find if it already exists (e.g. updating a pending item to synced)
  const existingIndex = history.findIndex(item => item.id === itemId);
  
  // Create preview string (first 3 column values combined)
  const values = Object.values(rowData).filter(val => val !== "" && typeof val !== 'boolean');
  const preview = values.slice(0, 3).join(' | ') || 'Registro vacío';
  
  const historyItem = {
    id: itemId,
    sheetName,
    preview,
    status,
    timestamp: new Date().toISOString()
  };
  
  if (existingIndex >= 0) {
    history[existingIndex] = historyItem;
  } else {
    // Add to top of list
    history.unshift(historyItem);
  }
  
  // Keep only the last 20 items
  const trimmedHistory = history.slice(0, 20);
  localStorage.setItem(KEYS.SUBMISSION_HISTORY, JSON.stringify(trimmedHistory));
}

/**
 * Clear history
 */
export function clearHistory() {
  localStorage.removeItem(KEYS.SUBMISSION_HISTORY);
}

/**
 * Appends new unique values to the local cache of sheets structure
 * @param {string} sheetName 
 * @param {Object} rowData Keys are headers, values are input entries
 */
export function updateCachedUniqueValues(sheetName, rowData) {
  const structure = getSheetsStructure();
  if (!structure) return;
  
  let modified = false;
  structure.forEach(sheet => {
    if (sheet.name === sheetName) {
      if (!sheet.uniqueValues) sheet.uniqueValues = {};
      
      Object.entries(rowData).forEach(([header, val]) => {
        if (val !== null && val !== undefined && val !== "" && typeof val !== 'boolean') {
          const strVal = String(val).trim();
          if (strVal) {
            if (!sheet.uniqueValues[header]) {
              sheet.uniqueValues[header] = [];
            }
            if (sheet.uniqueValues[header].indexOf(strVal) === -1) {
              sheet.uniqueValues[header].push(strVal);
              sheet.uniqueValues[header].sort();
              modified = true;
            }
          }
        }
      });
    }
  });
  
  if (modified) {
    saveSheetsStructure(structure);
  }
}
