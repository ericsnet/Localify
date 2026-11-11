const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const scriptStart = html.indexOf('<script>') + '<script>'.length;
const scriptEnd = html.indexOf('</script>', scriptStart);
const source = html.slice(scriptStart, scriptEnd);

function between(start, end) {
  const a = source.indexOf(start);
  assert.notEqual(a, -1, `Missing source marker: ${start}`);
  const b = source.indexOf(end, a);
  assert.notEqual(b, -1, `Missing end marker: ${end}`);
  return source.slice(a, b).trim();
}

const definitions = between('const audioExt=', '\nconst esc=');
const baseDefinition = between('const base=', '\nfunction makeTrack');
const makeTrackDefinition = between('function makeTrack(f){', '\nasync function importFiles');
const parseLrcDefinition = between('function parseLrc(s){', '\nfunction parseTTML');
const parseTtmlDefinition = between('function parseTTML(ttml){', '\nfunction setLyricsSource');
const fetchLyricsDefinition = between('async function fetchSyncedLyrics(t,signal){', '\nfunction artistQueriesForSearch');
const pathHelpers = between('const filePath=f=>', '\n let files=');
const retryDefinition = between('async function retryTrackAsDataUrl(t){', "\naudio.addEventListener('error'");
const loadLyricsDefinition = between('async function loadLyrics(t){', '\nfunction centerLyric');

function buildDefinitions() {
  return new Function(`${definitions}\n${baseDefinition}\n${makeTrackDefinition}\nreturn {audioExt, lyricExt, base, makeTrack};`)();
}

function buildLrcParser() {
  return new Function(`${parseLrcDefinition}; return parseLrc;`)();
}

test('el JavaScript completo se puede analizar', () => {
  assert.doesNotThrow(() => new Function(source));
});

test('se reconocen extensiones reproducibles y no se importa MIDI', () => {
  const {audioExt, lyricExt} = buildDefinitions();
  for (const name of ['song.mp3', 'song.flac', 'song.wav', 'song.ogg', 'song.m4a', 'song.aiff', 'song.ape', 'song.wma']) {
    assert.equal(audioExt.test(name), true, name);
  }
  assert.equal(audioExt.test('song.mid'), false);
  assert.equal(audioExt.test('song.midi'), false);
  assert.equal(lyricExt.test('song.lrc'), true);
});

test('se separan artista y título del nombre del archivo', () => {
  const {makeTrack} = buildDefinitions();
  const original = URL.createObjectURL;
  URL.createObjectURL = () => 'blob:test';
  try {
    const track = makeTrack({name: 'Artist - Song.mp3', webkitRelativePath: 'Album/Artist - Song.mp3'});
    assert.equal(track.artist, 'Artist');
    assert.equal(track.title, 'Song');
  } finally {
    URL.createObjectURL = original;
  }
});

test('las letras LRC se separan por líneas y respetan offset', () => {
  const parseLrc = buildLrcParser();
  const lines = parseLrc('[ar:Artist]\n[offset:100]\n[00:01.20]First line\n[00:02.5]Second line');
  assert.equal(lines.length, 2);
  assert.equal(lines[0].txt, 'First line');
  assert.equal(lines[0].t, 1.3);
  assert.equal(lines[1].t, 2.6);
});

test('TTML admite namespace XML y tiempos a nivel de párrafo', () => {
  const span1 = {textContent: 'Hello ', getAttribute: key => key === 'begin' ? '00:00:01.000' : null};
  const span2 = {textContent: 'world', getAttribute: key => key === 'begin' ? '00:00:01.500' : null};
  const p1 = {textContent: 'Hello world', getAttribute: () => null, getElementsByTagNameNS: (ns, name) => name === 'span' ? [span1, span2] : []};
  const p2 = {textContent: 'Next line', getAttribute: key => key === 'begin' ? '00:00:03.000' : null, getElementsByTagNameNS: () => []};
  const doc = {querySelector: () => null, getElementsByTagNameNS: (ns, name) => name === 'p' ? [p1, p2] : []};
  const original = global.DOMParser;
  global.DOMParser = class { parseFromString() { return doc; } };
  try {
    const parseTTML = new Function(`${parseTtmlDefinition}; return parseTTML;`)();
    const lines = parseTTML('<tt xmlns="http://www.w3.org/ns/ttml"><body/></tt>');
    assert.equal(lines.length, 2);
    assert.equal(lines[0].txt, 'Hello world');
    assert.equal(lines[0].words.length, 2);
    assert.equal(lines[1].t, 3);
  } finally {
    global.DOMParser = original;
  }
});

test('la búsqueda lrc.red no usa similarity antes de inicializarla', async () => {
  const parseLrc = buildLrcParser();
  const parseTTML = () => [];
  const setLyricsSource = () => {};
  const fetchLyrics = new Function('setLyricsSource', 'parseLrc', 'parseTTML', `${fetchLyricsDefinition}; return fetchSyncedLyrics;`)(setLyricsSource, parseLrc, parseTTML);
  const originalFetch = global.fetch;
  let calls = 0;
  global.fetch = async url => {
    calls++;
    if (String(url).includes('search.json')) return {ok: true, status: 200, json: async () => ({hits: [{title: 'Song', artist: 'Artist', duration: 180, isrc: 'USABC1234567'}]})};
    if (String(url).endsWith('.lrc')) return {ok: true, text: async () => '[00:01.00]Hello'};
    throw new Error(`Unexpected URL: ${url}`);
  };
  try {
    const result = await fetchLyrics({title: 'Song', artist: 'Artist', duration: 180}, new AbortController().signal);
    assert.equal(result.kind, 'lrc.red');
    assert.equal(result.lines.length, 1);
    assert.equal(calls, 2);
  } finally {
    global.fetch = originalFetch;
  }
});

test('los archivos y sus LRC se emparejan por ruta relativa', () => {
  const {base} = buildDefinitions();
  const helpers = new Function('base', `${pathHelpers}; return {filePath, fileStem};`)(base);
  const aAudio = {name: 'song.mp3', webkitRelativePath: 'A/song.mp3'};
  const aLrc = {name: 'song.lrc', webkitRelativePath: 'A/song.lrc'};
  const bAudio = {name: 'song.mp3', webkitRelativePath: 'B/song.mp3'};
  const bLrc = {name: 'song.lrc', webkitRelativePath: 'B/song.lrc'};
  const lyrics = new Map([[helpers.fileStem(aLrc), aLrc], [helpers.fileStem(bLrc), bLrc]]);
  assert.equal(lyrics.get(helpers.fileStem(aAudio)), aLrc);
  assert.equal(lyrics.get(helpers.fileStem(bAudio)), bLrc);
  assert.notEqual(helpers.filePath(aAudio), helpers.filePath(bAudio));
});

test('una recuperación asíncrona no sustituye la canción seleccionada después', async () => {
  const fakeState = {current: 'track-1'};
  const fakeAudio = {src: 'unchanged', load() {}, play: () => Promise.resolve()};
  class FakeReader {
    readAsDataURL() { this.result = 'data:audio/mpeg;base64,AA'; setImmediate(() => this.onload()); }
  }
  const retry = new Function('proxyMode', 'S', 'FileReader', 'audio', '$', `${retryDefinition}; return retryTrackAsDataUrl;`)(true, fakeState, FakeReader, fakeAudio, () => ({textContent: ''}));
  const pending = retry({id: 'track-1', file: {size: 1024}, dataUrlTried: false});
  fakeState.current = 'track-2';
  assert.equal(await pending, false);
  assert.equal(fakeAudio.src, 'unchanged');
});

test('el panel no repite búsquedas si las letras ya se han cargado', () => {
  assert.match(source, /if\(t\?\.lyricsLoaded&&t\.lyricsDisplay\)/);
  assert.match(source, /if\(t\?\.lyricsLoading\)return;/);
  assert.match(source, /t\.lyricsDisplay=\{/);
  assert.match(source, /if\(current\(\)&&!current\(\)\.lyricsLoaded&&!current\(\)\.lyricsLoading\)loadLyrics\(current\(\)\)/);
});


test('al volver a una canción se restaura su propia letra en vez de dejar la anterior', async () => {
  const lines = {innerHTML: 'previous lyrics'};
  const title = {innerHTML: 'previous title'};
  const sourceEl = {innerHTML: 'previous source', hidden: true};
  const elements = {'#lyrics-track': title, '#lyrics-lines': lines, '#lyrics-source': sourceEl};
  const state = {lyrics: [], lyricsSynced: false, lyricIndex: -1};
  const cachedLines = [{t: 1, txt: 'Cached line', words: []}];
  const track = {lyricsLoaded: true, lyricsDisplay: {track: 'Cached title', lines: '<div>Cached line</div>', source: 'LRCLIB', sourceHidden: false, lyrics: cachedLines, synced: true}};
  let floated = 0, synced = 0;
  const loader = new Function('S', '$', 'updateFloatingLyrics', 'syncLyrics', 'lyricsSearchController', 'lyricsLoadingTrack', `${loadLyricsDefinition}; return loadLyrics;`)(state, selector => elements[selector], () => floated++, () => synced++, null, null);
  await loader(track);
  assert.equal(state.lyrics, cachedLines);
  assert.equal(state.lyricsSynced, true);
  assert.equal(title.innerHTML, 'Cached title');
  assert.equal(lines.innerHTML, '<div>Cached line</div>');
  assert.equal(sourceEl.innerHTML, 'LRCLIB');
  assert.equal(sourceEl.hidden, false);
  assert.equal(floated, 1);
  assert.equal(synced, 1);
});

test('la prueba de compatibilidad retirada no vuelve a aparecer', () => {
  assert.equal(html.includes('Probar compatibilidad'), false);
  assert.equal(source.includes('runProxyTest'), false);
});

test('las letras locales se muestran antes de consultar servicios externos', () => {
  const localPriority = source.indexOf('const localText=String(t.lrc||t.embeddedLyrics||\'\').trim()');
  const remoteSearch = source.indexOf('remote=await fetchSyncedLyrics(t,signal)');
  assert.notEqual(localPriority, -1);
  assert.notEqual(remoteSearch, -1);
  assert.ok(localPriority < remoteSearch);
  assert.doesNotMatch(source, /Lrclib-Client/);
});

test('la cola usa identificadores de canción estables en los botones', () => {
  assert.match(source, /button\.dataset\.qplayid=t\.id/);
  assert.match(source, /if\(b\.dataset\.qplayid\)\{playTrack\(b\.dataset\.qplayid\);return\}/);
  assert.match(source, /list\.replaceChildren\(\)/);
});

test('el guardado de carpeta verifica IndexedDB y solicita almacenamiento persistente', () => {
  assert.match(source, /navigator\.storage\?\.persist\?\.\(\)/);
  assert.match(source, /const saved=await getSavedFolderHandle\(\)/);
  assert.match(source, /if\(!saved\)throw new Error/);
});
test('la restauración de carpeta usa el permiso persistido y vuelve a solicitarlo con acción del usuario', () => {
  assert.match(source, /indexedDB\.open\(FOLDER_DB,2\)/);
  assert.match(source, /createObjectStore\('files'\)/);
  assert.match(source, /cacheFolderFiles\(files,handle\.name\)/);
  assert.match(source, /async function restoreCachedFolder\(\)/);
  assert.match(source, /await importFiles\(files\)/);
  assert.match(source, /handle\.queryPermission\(\{mode:'read'\}\)/);
  assert.match(source, /handle\.requestPermission\(\{mode:'read'\}\)/);
  assert.match(source, /await saveFolderHandle\(handle\)/);
});

test('los controles de letras y cola tienen estado accesible y alternan sus paneles', () => {
  assert.match(html, /id="lyrics-toggle"[^>]*aria-expanded="false"/);
  assert.match(html, /id="queue-toggle"[^>]*aria-expanded="false"/);
  assert.match(source, /button\?\.setAttribute\('aria-expanded',String\(opening\)\)/);
  assert.match(source, /d\.style\.setProperty\('display','block','important'\)/);
  assert.match(source, /d\.style\.setProperty\('pointer-events','auto','important'\)/);
  assert.match(source, /\$\('#queue-toggle'\)\.addEventListener\('click'/);
  assert.match(source, /\$\('#lyrics-toggle'\)\.addEventListener\('click'/);
  assert.match(source, /\$\$\('\[data-close\]'\)\.forEach/);
});

test('el volumen sigue siendo accesible en móvil mediante un control desplegable', () => {
  assert.match(html, /id="volume-toggle"/);
  assert.match(html, /id="volume" type="range"/);
  assert.match(html, /volume-open input#volume/);
  assert.match(source, /audio\.volume=Number\(e\.target\.value\)/);
});


test('los controles del reproductor flotante usan querySelectorAll y no abortan la inicialización', () => {
  assert.equal((source.match(/\$\$\('\[data-float-mode\]'\)\.forEach/g) || []).length, 2);
  assert.doesNotMatch(source, /(^|[^$])\$\('\[data-float-mode\]'\)\.forEach/);
  assert.ok(source.includes("$('#queue-toggle').addEventListener('click'"));
  assert.ok(source.includes("$('#lyrics-toggle').addEventListener('click'"));
  assert.ok(source.includes('void restoreSavedFolder()'));
});
