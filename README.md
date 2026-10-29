# Localify

**Tu música. Tus reglas.** Reproductor web para una biblioteca de audio local, con interfaz adaptable, cola, aleatorio, repetición, favoritos y letras sincronizadas desde archivos `.lrc` externos.

**[Abrir Localify en GitHub Pages](https://ericsnet.github.io/Localify/)** · [Código fuente](https://github.com/ericsnet/Localify)

## Funciones

- Importación de carpetas o selección de archivos de audio.
- Búsqueda por título, artista inferido del nombre y carpeta.
- Controles de reproducción, volumen, progreso, cola, aleatorio y repetición.
- Favoritos guardados en el almacenamiento local del navegador.
- Letras sincronizadas mediante archivos `.lrc` con el mismo nombre base que la canción (por ejemplo, `Cancion.mp3` y `Cancion.lrc`).
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

Esta versión no lee etiquetas ID3/Vorbis completas, carátulas embebidas ni letras incrustadas en metadatos. Las letras se leen de archivos `.lrc` externos. Los archivos importados se reproducen desde la sesión actual; la biblioteca no se restaura automáticamente al cerrar la pestaña. Los favoritos sí se guardan localmente.

## Privacidad

Los archivos de audio se seleccionan y reproducen en el navegador; no se cargan en GitHub Pages ni en un servidor de música. GitHub Pages solo aloja los archivos estáticos de la aplicación. No hay backend ni cuenta de usuario.

## Tecnologías

HTML, CSS y JavaScript sin proceso de compilación. GitHub Pages publica desde la rama `main`, directorio raíz.
