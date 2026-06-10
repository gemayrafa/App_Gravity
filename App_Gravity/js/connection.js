// Connection & API Client for Google Apps Script

/**
 * Checks if the browser has internet connectivity
 * @returns {boolean}
 */
export function isOnline() {
  return navigator.onLine;
}

/**
 * Tests connection with the Google Apps Script URL by fetching the structure
 * @param {string} url The Web App URL
 * @returns {Promise<Object>} The structure of sheets if successful
 */
export async function testConnection(url) {
  if (!url) throw new Error('La URL de conexión está vacía.');
  
  // Append action parameter to URL for GET
  const requestUrl = new URL(url);
  requestUrl.searchParams.set('action', 'getStructure');
  
  const response = await fetch(requestUrl.toString(), {
    method: 'GET',
    mode: 'cors',
    redirect: 'follow'
  });
  
  if (!response.ok) {
    throw new Error(`Error HTTP: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'El script devolvió un error desconocido.');
  }
  
  return data.sheets; // Array of { name, headers }
}

/**
 * Appends a row of data to a specific sheet
 * @param {string} url The Web App URL
 * @param {string} sheetName Name of the sheet (tab)
 * @param {Object} rowData Keys are headers, values are input entries
 * @returns {Promise<Object>} Success status
 */
export async function sendRowData(url, sheetName, rowData) {
  if (!url) throw new Error('No hay una URL de conexión configurada.');
  
  const payload = {
    action: 'appendRow',
    sheetName: sheetName,
    rowData: rowData
  };
  
  // CRITICAL: We use 'text/plain' Content-Type to prevent the browser from sending
  // a CORS preflight OPTIONS request, which Google Apps Script Web Apps do not support.
  // Apps Script parses the raw JSON string in e.postData.contents.
  const response = await fetch(url, {
    method: 'POST',
    mode: 'cors',
    redirect: 'follow',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    throw new Error(`Error HTTP: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Error al insertar fila en la hoja de cálculo.');
  }
  
  return data;
}
