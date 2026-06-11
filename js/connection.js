/**
 * MODULE: Connection Manager (connection.js)
 * Handles API calls to Google Apps Script Web App.
 * Crucial optimization: Sets Content-Type to 'text/plain' to avoid CORS preflight OPTIONS requests,
 * which Google Apps Script web apps do not support.
 */

export const ConnectionManager = {
  /**
   * Fetches sheets schema (columns and unique values for open dropdowns)
   * @param {string} scriptUrl 
   * @returns {Promise<{success: boolean, data?: object, error?: string}>}
   */
  async fetchSchema(scriptUrl) {
    if (!scriptUrl) return { success: false, error: 'URL del script no especificada' };
    
    try {
      // Append a cache-buster query parameter
      const urlWithCacheBuster = `${scriptUrl}?_cb=${Date.now()}`;
      
      const response = await fetch(urlWithCacheBuster, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      if (result.success) {
        return { success: true, data: result.data };
      } else {
        return { success: false, error: result.error || 'Error desconocido del servidor' };
      }
    } catch (error) {
      console.error('Fetch Schema Error:', error);
      return { 
        success: false, 
        error: 'No se pudo conectar con el script. Verifica que la URL esté correcta y el script esté implementado para permitir acceso a "Cualquiera".'
      };
    }
  },

  /**
   * Appends a new row to the specified Google Sheet tab
   * @param {string} scriptUrl 
   * @param {string} tabName 
   * @param {object} rowData 
   * @returns {Promise<{success: boolean, message?: string, error?: string}>}
   */
  async sendRow(scriptUrl, tabName, rowData) {
    if (!scriptUrl) return { success: false, error: 'URL del script no configurada' };
    
    try {
      const payload = {
        tabName: tabName,
        data: rowData
      };

      // CRITICAL CORS BYPASS: Using 'text/plain' Content-Type avoids triggering the preflight OPTIONS request.
      // Apps Script receives it and parses the raw text contents as JSON in doPost(e).
      const response = await fetch(scriptUrl, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        return { success: true, message: result.message };
      } else {
        return { success: false, error: result.error || 'Error al guardar en el servidor' };
      }
    } catch (error) {
      console.error('Send Row Error:', error);
      return { 
        success: false, 
        error: 'Error de red. El registro se guardará en la cola offline y se sincronizará cuando vuelvas a tener conexión.' 
      };
    }
  },

  /**
   * Fast check to verify if the server is accessible (simple ping)
   * @returns {boolean}
   */
  isOnline() {
    return navigator.onLine;
  }
};
