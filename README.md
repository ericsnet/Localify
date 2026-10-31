# Localify

**Tu música. Tus reglas.** Reproductor web para una biblioteca de audio local, con interfaz minimalista inspirada en reproductores musicales oscuros, cola, aleatorio, repetición, favoritos y letras integradas o externas.

**[Abrir Localify en GitHub Pages](https://ericsnet.github.io/Localify/)** · [Código fuente](https://github.com/ericsnet/Localify)

## Funciones

- Importación de carpetas o selección de archivos de audio.
- Búsqueda por título, artista inferido del nombre y carpeta.
- Controles de reproducción, volumen, progreso, cola, aleatorio y repetición.
- Favoritos guardados en el almacenamiento local del navegador.
- Lectura de letras incrustadas en metadatos compatibles de MP3 (ID3 USLT) y FLAC (comentarios Vorbis `LYRICS`/`UNSYNCEDLYRICS`), además de archivos `.lrc` externos con el mismo nombre base. Las letras con marcas de tiempo se sincronizan; las letras sin marcas se muestran como texto.
- Diseño adaptable a móvil y escritorio.
- Reproducción de MP3 y FLAC: primero utiliza el decodificador nativo del navegador y, si falla, intenta decodificarlos con FFmpeg WebAssembly.

## Ejecutar localmente

Abre `index.html` en un navegador moderno. Para la API de selección de carpetas, algunos navegadores exigen un contexto seguro. Si es necesario, inicia un servidor local:

```bash
python -m http.server 8000
```

Después abre `http://localhost:8000`.

## Compatibilidad y limitaciones

MP3 cuenta con soporte nativo en los navegadores modernos. Para FLAC y MP3, si el navegador no consigue reproducir el archivo, Localify intenta cargar bajo demanda FFmpeg WebAssembly y convertirlo a WAV PCM para reproducirlo. Esta alternativa requiere conexión a internet la primera vez, porque descarga el decodificador desde un CDN, y consume memoria adicional; la conversión a WAV puede ocupar bastante espacio en memoria. WAV, Ogg y M4A/AAC dependen de los códecs disponibles en el navegador. No se garantiza compatibilidad con todos los formatos, incluidos WMA, APE o MIDI.

La selección de carpetas (botón «Elegir carpeta») usa la API File System Access, disponible solo en navegadores basados en Chromium (Chrome, Edge, Opera). En Firefox y Safari, usa «Importar» para seleccionar archivos sueltos; el resto de funciones funciona igual.

La lectura de letras incrustadas se limita a campos comunes de letras no sincronizadas en etiquetas ID3 de MP3 y comentarios Vorbis de FLAC; no cubre todas las variantes de etiquetas ni letras sincronizadas embebidas. No lee carátulas embebidas ni todos los metadatos ID3/Vorbis. Los archivos importados se reproducen desde la sesión actual; la biblioteca no se restaura automáticamente al cerrar la pestaña. Los favoritos sí se guardan localmente.

## Privacidad

Los archivos de audio se seleccionan y reproducen en el navegador; no se cargan en GitHub Pages ni en un servidor de música. GitHub Pages solo aloja los archivos estáticos de la aplicación. No hay backend ni cuenta de usuario.

## Tecnologías

HTML, CSS y JavaScript sin proceso de compilación. GitHub Pages publica desde la rama `main`, directorio raíz.
