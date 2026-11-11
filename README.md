# Localify

**Tu música. Tus reglas.** Reproductor web para una biblioteca de audio local, con interfaz minimalista inspirada en reproductores musicales oscuros, cola, aleatorio, repetición, favoritos y letras integradas o externas.

**[Abrir Localify en GitHub Pages](https://ericsnet.github.io/Localify/)** · **[Abrir en Cloudflare Pages](https://localify.pages.dev/)** · [Código fuente](https://github.com/ericsnet/Localify)

## Funciones

- Importación de carpetas o selección de archivos de audio.
- Búsqueda por título, artista inferido del nombre y carpeta.
- Controles de reproducción, volumen, progreso, cola, aleatorio y repetición.
- Favoritos guardados en el almacenamiento local del navegador.
- Lectura de letras incrustadas en metadatos compatibles de MP3 (ID3 USLT y SYLT) y FLAC (comentarios Vorbis `LYRICS`/`UNSYNCEDLYRICS`), además de archivos `.lrc` externos emparejados por ruta relativa y nombre base. Las letras sincronizadas se muestran siguiendo la reproducción; las letras sin marcas de tiempo se muestran como texto. También lee portadas APIC de MP3.
- Diseño adaptable a móvil y escritorio.
- Reproducción con el decodificador nativo del navegador y alternativa bajo demanda con FFmpeg WebAssembly para formatos compatibles cuando falla la reproducción nativa.

## Ejecutar localmente

Abre `index.html` en un navegador moderno. Para la API de selección de carpetas, algunos navegadores exigen un contexto seguro. Si es necesario, inicia un servidor local:

```bash
python -m http.server 8000
```

Después abre `http://localhost:8000`.

## Pruebas

Requiere Node.js 20 o posterior. Desde la raíz del repositorio, ejecuta:

```bash
node --test tests/regression.test.cjs
```

La misma suite se ejecuta automáticamente en GitHub Actions al actualizar `main` o abrir una solicitud de cambios.

## Compatibilidad y limitaciones

MP3, WAV, Ogg/Opus y M4A/AAC se reproducen mediante los códecs disponibles en el navegador. Si falla la reproducción nativa, Localify puede intentar convertir el archivo a WAV PCM con FFmpeg WebAssembly para los formatos que admita ese decodificador (por ejemplo, FLAC, WMA, APE, ALAC o AIFF). La alternativa requiere conexión a internet la primera vez, porque descarga FFmpeg desde un CDN, y consume memoria adicional; la conversión a WAV puede ocupar bastante espacio. En entornos de proxy que bloquean el decodificador adicional, esta alternativa no está disponible. Los archivos MIDI (`.mid`/`.midi`) no se importan porque el reproductor no incluye un sintetizador MIDI.

La selección de carpetas (botón «Elegir carpeta») usa la API File System Access, disponible solo en navegadores basados en Chromium (Chrome, Edge, Opera). En Firefox y Safari, usa «Importar» para seleccionar archivos sueltos; el resto de funciones funciona igual.

La lectura de metadatos ID3/FLAC cubre campos comunes, no todas las variantes. Las portadas APIC de MP3 se leen; no se extraen imágenes de FLAC. Cuando el navegador permite guardar un identificador de carpeta, Localify puede intentar restaurar esa carpeta en visitas posteriores y pedir permiso de nuevo; la selección de archivos sueltos no se restaura. Los favoritos y la caché limitada de letras se guardan localmente.

## Privacidad

Los archivos de audio se seleccionan y reproducen en el navegador; no se suben a GitHub Pages ni a un servidor de música. Si activas la búsqueda de letras, Localify envía el título y el artista a proveedores externos de letras (lrc.red, LRCLIB y lyrics.ovh) para localizar coincidencias; no les envía el archivo de audio. GitHub Pages solo aloja los archivos estáticos de la aplicación. No hay backend ni cuenta de usuario.

## Tecnologías

HTML, CSS y JavaScript sin proceso de compilación. GitHub Pages publica desde la rama `main`, directorio raíz.
