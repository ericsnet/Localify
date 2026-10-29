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

## Ejecutar localmente

Abre `index.html` en un navegador moderno. Para la API de selección de carpetas, algunos navegadores exigen un contexto seguro. Si es necesario, inicia un servidor local:

```bash
python -m http.server 8000
```

Después abre `http://localhost:8000`.

## Compatibilidad y limitaciones

La reproducción depende de los códecs disponibles en el navegador y el sistema operativo. MP3, WAV, Ogg y M4A/AAC suelen funcionar en combinaciones habituales; no se garantiza compatibilidad con todos los formatos, y FLAC, WMA, APE o MIDI pueden variar según navegador. No se incluye decodificador universal.

Esta versión no lee etiquetas ID3/Vorbis completas, carátulas embebidas ni letras incrustadas en metadatos. Las letras se leen de archivos `.lrc` externos. Los archivos importados se reproducen desde la sesión actual; la biblioteca no se restaura automáticamente al cerrar la pestaña. Los favoritos sí se guardan localmente.

## Privacidad

Los archivos de audio se seleccionan y reproducen en el navegador; no se cargan en GitHub Pages ni en un servidor de música. GitHub Pages solo aloja los archivos estáticos de la aplicación. No hay backend ni cuenta de usuario.

## Tecnologías

HTML, CSS y JavaScript sin proceso de compilación. GitHub Pages publica desde la rama `main`, directorio raíz.
