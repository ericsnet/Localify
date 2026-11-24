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


test('el aleatorio genera una permutación sin duplicados y no modifica la lista original', () => {
  const helper = new Function('globalThis', 'Uint32Array', 'Math', `
    function randomIndex(maxExclusive){
      if(!Number.isSafeInteger(maxExclusive)||maxExclusive<1)throw new RangeError('maxExclusive debe ser un entero positivo');
      const cryptoApi=globalThis.crypto;
      if(cryptoApi?.getRandomValues){
        const range=0x100000000,limit=Math.floor(range/maxExclusive)*maxExclusive,word=new Uint32Array(1);
        let value;do{cryptoApi.getRandomValues(word);value=word[0]}while(value>=limit);
        return value%maxExclusive;
      }
      return Math.floor(Math.random()*maxExclusive);
    }
    function shuffleIds(ids){
      const shuffled=ids.slice();
      for(let i=shuffled.length-1;i>0;i--){const j=randomIndex(i+1);[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]]}
      return shuffled;
    }
    return {randomIndex,shuffleIds};
  `);
  const values = [0, 1, 2, 3];
  const {shuffleIds} = helper({crypto: {getRandomValues: array => { array[0] = 0; return array; }}}, Uint32Array, Math);
  const shuffled = shuffleIds(values);
  assert.deepEqual([...shuffled].sort(), values);
  assert.deepEqual(values, [0, 1, 2, 3]);
  assert.equal(new Set(shuffled).size, values.length);
});

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

test('se separan artista y tÃ­tulo del nombre del archivo', () => {
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

test('las letras LRC se separan por lÃ­neas y respetan offset', () => {
  const parseLrc = buildLrcParser();
  const lines = parseLrc('[ar:Artist]\n[offset:100]\n[00:01.20]First line\n[00:02.5]Second line');
  assert.equal(lines.length, 2);
  assert.equal(lines[0].txt, 'First line');
  assert.equal(lines[0].t, 1.3);
  assert.equal(lines[1].t, 2.6);
});

test('TTML admite namespace XML y tiempos a nivel de pÃ¡rrafo', () => {
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

test('la bÃºsqueda lrc.red no usa similarity antes de inicializarla', async () => {
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

test('una recuperaciÃ³n asÃ­ncrona no sustituye la canciÃ³n seleccionada despuÃ©s', async () => {
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

test('el panel no repite bÃºsquedas si las letras ya se han cargado', () => {
  assert.match(source, /if\(t\?\.lyricsLoaded&&t\.lyricsDisplay\)/);
  assert.match(source, /if\(t\?\.lyricsLoading\)return;/);
  assert.match(source, /t\.lyricsDisplay=\{/);
  assert.match(source, /if\(current\(\)&&!current\(\)\.lyricsLoaded&&!current\(\)\.lyricsLoading\)loadLyrics\(current\(\)\)/);
});


test('al volver a una canciÃ³n se restaura su propia letra en vez de dejar la anterior', async () => {
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

test('las letras web tienen prioridad y los archivos locales/metadatos son fallback', () => {
  const loadStart = source.indexOf('async function loadLyrics(t){');
  const loadEnd = source.indexOf('function centerLyric(', loadStart);
  assert.ok(loadStart >= 0 && loadEnd > loadStart);
  const load = source.slice(loadStart, loadEnd);
  const remoteSearch = load.indexOf('remote=await fetchSyncedLyrics(t,signal)');
  const localFallback = load.indexOf('let localPlain=String(t.lrc||t.embeddedLyrics||\'\')');
  assert.notEqual(remoteSearch, -1);
  assert.notEqual(localFallback, -1);
  assert.ok(remoteSearch < localFallback, 'la búsqueda web debe ejecutarse antes del fallback local');
  assert.doesNotMatch(load.slice(0, remoteSearch), /const localText=String\(t\.lrc\|\|t\.embeddedLyrics/);
  assert.doesNotMatch(source, /Lrclib-Client/);
});

test('la cola usa identificadores de canciÃ³n estables en los botones', () => {
  assert.match(source, /button\.dataset\.qplayid=t\.id/);
  assert.match(source, /if\(b\.dataset\.qplayid\)\{playTrack\(b\.dataset\.qplayid\);return\}/);
  assert.match(source, /list\.replaceChildren\(\)/);
});

test('el guardado de carpeta verifica IndexedDB y solicita almacenamiento persistente', () => {
  assert.match(source, /navigator\.storage\?\.persist\?\.\(\)/);
  assert.match(source, /const saved=await getSavedFolderHandle\(\)/);
  assert.match(source, /if\(!saved\)throw new Error/);
});
test('la restauraciÃ³n de carpeta usa el permiso persistido y vuelve a solicitarlo con acciÃ³n del usuario', () => {
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

test('el volumen sigue siendo accesible en mÃ³vil mediante un control desplegable', () => {
  assert.match(html, /id="volume-toggle"/);
  assert.match(html, /id="volume" type="range"/);
  assert.match(html, /volume-open input#volume/);
  assert.match(source, /audio\.volume=Number\(e\.target\.value\)/);
});


test('los controles del reproductor flotante usan querySelectorAll y no abortan la inicializaciÃ³n', () => {
  assert.equal((source.match(/\$\$\('\[data-float-mode\]'\)\.forEach/g) || []).length, 2);
  assert.doesNotMatch(source, /(^|[^$])\$\('\[data-float-mode\]'\)\.forEach/);
  assert.ok(source.includes("$('#queue-toggle').addEventListener('click'"));
  assert.ok(source.includes("$('#lyrics-toggle').addEventListener('click'"));
  assert.ok(source.includes('void restoreSavedFolder()'));
});


test('las letras planas de metadatos normalizan saltos de lÃ­nea, NUL y BOM', () => {
  const start = source.indexOf('function formatPlainLyrics(value){');
  const end = source.indexOf('function setLyricsSource', start);
  assert.notEqual(start, -1);
  assert.ok(end > start);
  const formatPlainLyrics = new Function(`${source.slice(start, end)}; return formatPlainLyrics;`)();
  const input = String.fromCharCode(0xfeff) + 'First line' + String.fromCharCode(13, 10) + 'Second line' + String.fromCharCode(0);
  assert.deepEqual(formatPlainLyrics(input), ['First line', 'Second line']);
});

test('las letras ID3 en un solo pÃ¡rrafo se dividen en fragmentos legibles sin perder texto', () => {
  const start = source.indexOf('function formatPlainLyrics(value){');
  const end = source.indexOf('function setLyricsSource', start);
  const formatPlainLyrics = new Function(`${source.slice(start, end)}; return formatPlainLyrics;`)();
  const input = 'You could never know what it is like Your blood like winter freezes just like ice And there is a cold lonely light that shines from you';
  const lines = formatPlainLyrics(input);
  assert.ok(lines.length > 1);
  assert.equal(lines.join(' '), input);
  assert.ok(lines.every(line => line.split(/\s+/).length <= 14));
});


test('el lector ID3 conserva tildes UTF-8 y saltos de lÃ­nea de USLT', async () => {
  const start = source.indexOf('function synchsafe(b,o){');
  const end = source.indexOf('async function embeddedLyrics(file){', start);
  assert.ok(start >= 0 && end > start);
  const readId3Lyrics = new Function('TextDecoder', 'Uint8Array', 'Blob', 'btoa', `${source.slice(start, end)}; return readId3Lyrics;`)(TextDecoder, Uint8Array, Blob, btoa);
  const text = 'LÃ­nea uno\r\nLÃ­nea dos â cafÃ©';
  const body = Buffer.concat([Buffer.from([3, 101, 110, 103, 0]), Buffer.from(text, 'utf8')]);
  const frame = Buffer.alloc(10 + body.length);
  frame.write('USLT', 0, 'ascii');
  frame.writeUInt32BE(body.length, 4);
  body.copy(frame, 10);
  const size = frame.length;
  const header = Buffer.from([73, 68, 51, 3, 0, 0, (size >> 21) & 127, (size >> 14) & 127, (size >> 7) & 127, size & 127]);
  const result = await readId3Lyrics(new Blob([header, frame]));
  assert.equal(result.plain, text);
  assert.deepEqual(formatFromSource(result.plain), ['LÃ­nea uno', 'LÃ­nea dos â cafÃ©']);
});

test('el lector ID3 decodifica letras antiguas Windows-1252', async () => {
  const start = source.indexOf('function synchsafe(b,o){');
  const end = source.indexOf('async function embeddedLyrics(file){', start);
  const readId3Lyrics = new Function('TextDecoder', 'Uint8Array', 'Blob', 'btoa', `${source.slice(start, end)}; return readId3Lyrics;`)(TextDecoder, Uint8Array, Blob, btoa);
  const body = Buffer.from([0, 101, 110, 103, 0, ...Buffer.from('CanciÃ³n nÃºmero uno', 'latin1')]);
  const frame = Buffer.alloc(10 + body.length);
  frame.write('USLT', 0, 'ascii'); frame.writeUInt32BE(body.length, 4); body.copy(frame, 10);
  const size = frame.length;
  const header = Buffer.from([73, 68, 51, 3, 0, 0, (size >> 21) & 127, (size >> 14) & 127, (size >> 7) & 127, size & 127]);
  const result = await readId3Lyrics(new Blob([header, frame]));
  assert.equal(result.plain, 'CanciÃ³n nÃºmero uno');
});

function formatFromSource(value) {
  const start = source.indexOf('function formatPlainLyrics(value){');
  const end = source.indexOf('function setLyricsSource', start);
  return new Function(`${source.slice(start, end)}; return formatPlainLyrics;`)()(value);
}
