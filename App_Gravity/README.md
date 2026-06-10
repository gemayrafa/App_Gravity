# SheetsForms: Entrada de Datos Móvil para Google Sheets

Esta aplicación web te permite conectar tus hojas de cálculo de Google Sheets y generar automáticamente formularios interactivos y responsivos optimizados para smartphones. 

La aplicación está diseñada para funcionar **100% en el cliente** (sin servidores externos) y cuenta con **soporte offline** para que puedas registrar datos incluso sin cobertura móvil o internet, sincronizándolos automáticamente cuando recuperes la conexión.

---

## 📋 Requisitos Previos

Antes de ejecutar la aplicación, debes preparar tu hoja de cálculo en Google Sheets.

1. **Estructura las Pestañas:** Crea tantas pestañas (hojas internas) como formularios desees tener en tu móvil.
2. **Escribe los Encabezados (Campos):** En la **Fila 1** (columnas A, B, C, D, etc.) de cada pestaña, escribe los títulos de los datos que deseas capturar. Estos títulos representarán los campos del formulario en tu smartphone.
   * *Ejemplo:* En la pestaña `Clientes`, escribe en la fila 1: `Nombre`, `Teléfono`, `Email`, `Fecha de Alta*` (el asterisco indica que el campo será obligatorio).
3. **Deja las filas inferiores vacías (o con datos de ejemplo):** El sistema insertará los nuevos registros al final del archivo.

---

## ⚡ Conexión Paso a Paso (Google Apps Script)

La aplicación se conecta a Google Sheets mediante un script seguro e inmediato que actúa como puente. Sigue estos pasos para configurarlo:

1. En tu hoja de cálculo, abre el menú superior: **Extensiones ➔ Apps Script**.
2. Borra cualquier código existente en el archivo `Código.gs` y pega el código que se muestra más abajo.
3. Haz clic en el icono del disco (**Guardar proyecto**).
4. Haz clic en el botón azul **Implementar ➔ Nueva implementación**.
5. Haz clic en el icono de engranaje (Tipo de implementación) y selecciona **Aplicación web**.
6. Configura los parámetros:
   * **Descripción:** Conector App Móvil (opcional).
   * **Ejecutar como:** Mi cuenta (Tu correo de Google).
   * **Quién tiene acceso:** Cualquiera.
7. Haz clic en **Implementar**.
8. Google te solicitará autorizar permisos para el script:
   * Haz clic en **Autorizar acceso** y selecciona tu cuenta de Google.
   * Aparecerá un aviso de advertencia ("Google no ha verificado esta aplicación"). Esto es normal porque es tu propio script. Haz clic abajo en **Configuración avanzada** y luego en **Ir a Proyecto (no seguro)**.
   * Haz clic en **Permitir** (o *Allow*).
9. Copia la **URL de la aplicación web** generada (debe terminar en `/exec`).

---

### Código del Script (Google Apps Script)

Copia este código y pégalo en el editor de Apps Script:

```javascript
function doGet(e) {
  var action = e.parameter.action;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  if (action === 'getStructure') {
    try {
      var sheets = ss.getSheets();
      var structure = sheets.map(function(sheet) {
        var name = sheet.getName();
        var headers = [];
        if (sheet.getLastRow() > 0) {
          headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        }
        return { name: name, headers: headers };
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
}
```

---

## 🚀 Cómo ejecutar la Aplicación

Esta aplicación es una Single Page Application (SPA) modular hecha con HTML5, CSS y JavaScript modernos. No requiere instalar dependencias con `npm` ni compilar código. 

### Opción 1: Abrir Localmente (PC)
1. Simplemente haz doble clic en el archivo [index.html](index.html) para abrirlo en tu navegador favorito.
2. Ingresa la URL copiada de Apps Script y haz clic en **Conectar**.

### Opción 2: Usar en tu Smartphone (Recomendado)
Para usarla en tu móvil, puedes subir el proyecto a un hosting gratuito de archivos estáticos.
* **GitHub Pages:** Sube estos archivos a un repositorio público de GitHub y activa GitHub Pages desde la pestaña *Settings*.
* **Vercel / Netlify:** Arrastra y suelta la carpeta del proyecto en la consola web de Netlify o Vercel para obtener una URL pública (`https://...`) en menos de 10 segundos de manera gratuita.
* Abre esa dirección web en tu smartphone, ingresa la URL de conexión de Apps Script, ¡y listo! Puedes añadir un acceso directo en la pantalla de inicio de tu teléfono para que se comporte como una App nativa.

---

## 💡 Detección Inteligente de Campos

La aplicación lee los títulos de las columnas (fila 1) de tu Google Sheets e identifica de forma automática el mejor control de entrada (Input Type) analizando palabras clave:

| Palabra Clave en la Columna | Tipo de Input en el Móvil | Comportamiento |
|---|---|---|
| `fecha`, `date`, `dia` | **Fecha** | Muestra un calendario para elegir día/mes/año. |
| `hora`, `time` | **Hora** | Muestra un selector de hora y minutos. |
| `email`, `correo` | **Email** | Optimiza el teclado del móvil para escribir correos (`@` y `.com`). |
| `tel`, `phone`, `móvil`, `celular` | **Teléfono** | Activa el teclado numérico telefónico. |
| `precio`, `monto`, `cantidad`, `valor`, `numero` | **Numérico** | Activa el teclado numérico convencional. |
| Termina con `?` o incluye `si/no` | **Interruptor (Switch)** | Muestra un interruptor Sí/No (se guarda en Sheets como "SÍ" o "NO"). |
| `nota`, `comentario`, `descripcion` | **Área de Texto** | Caja grande para escribir textos largos de múltiples párrafos. |
| `color` | **Selector de Color** | Muestra la paleta de colores del dispositivo. |
| *Cualquier otro título* | **Texto libre** | Teclado estándar de texto. |

* **Campos Obligatorios:** Si el título de tu columna termina con un asterisco (ej. `Cliente*` o `Total*`), la aplicación no te dejará enviar el formulario hasta rellenar ese campo, iluminándolo en rojo y aplicando una animación.

---

## 🌐 Funcionalidad Offline (Sin Conexión)

Si estás en un sitio sin señal o sin wifi:
1. La aplicación te mostrará un aviso **"Offline"** en color rojo en la esquina superior izquierda.
2. Podrás seguir rellenando los formularios con total normalidad.
3. Al pulsar **Guardar Registro**, el envío se guardará de forma segura en el almacenamiento local del teléfono (`localStorage`).
4. Verás un panel amarillo que te indicará cuántos registros tienes pendientes de sincronizar.
5. **Auto-Sincronización:** En cuanto el teléfono recupere la conexión a internet, la aplicación detectará la red y sincronizará de forma automática los envíos pendientes respetando el orden cronológico en el que los creaste. También puedes forzar la sincronización pulsando el botón manual de **Sincronizar**.
