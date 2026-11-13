import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { detectPlatform, mapAssets, formatSize, parseParams, translations, t } from '../lib.js';

test('plataformas: Client Hints primero, Android antes de Linux y desconocidos', () => {
  for (const [data, ua, expected] of [[{platform:'Windows'}, 'Android Linux', 'windows'], [{platform:'macOS'}, 'Linux', null], [null,'Linux Android','android'], [null,'X11','linux'], [null,'Win64','windows'], [null,'iPhone',null], [null,'FreeBSD',null], [{platform:'Unknown'},'Linux','linux']]) {
    assert.equal(detectPlatform(data, ua), expected);
  }
});
test('assets: extensiones, preferencia setup, seguridad y pureza', () => {
  const names = ['app.exe','APP-SETUP.EXE','app.deb','app.AppImage','app.apk','SHA256SUMS.txt'];
  const release = {tag_name:'v1', assets:names.map(name => ({name,size:123,url:'ignored',browser_download_url:`https://example.org/${name}`}))};
  const original = structuredClone(release);
  const result = mapAssets(release);
  assert.equal(result.version,'v1');
  assert.deepEqual(Object.keys(result.assets).sort(), ['android','checksums','linux-appimage','linux-deb','windows']);
  assert.deepEqual(result.assets.windows,{name:'APP-SETUP.EXE',size:123,url:'https://example.org/APP-SETUP.EXE'});
  assert.deepEqual(release,original);
  assert.deepEqual(mapAssets(null).assets,{});
  assert.deepEqual(mapAssets({assets:[{name:'bad.apk',size:2,browser_download_url:'javascript:alert(1)'}]}).assets,{});
  assert.equal(mapAssets({assets:[release.assets[0]]}).assets.windows.name,'app.exe');
});
test('tamaños MB y parámetros admitidos sin capturas', () => {
  assert.equal(formatSize(8.7*1024**2),'8.7 MB');
  assert.equal(formatSize(104*1024**2),'104.0 MB');
  for (const value of [-1,NaN,Infinity,undefined]) assert.equal(formatSize(value),'0.0 MB');
  for (const demo of ['1','loading','soon','error']) assert.deepEqual(parseParams(`?demo=${demo}&os=none&lang=en`),{demo,os:'none',lang:'en'});
  assert.deepEqual(parseParams('?demo=no&os=mac&lang=fr&shot=x'),{demo:null,os:null,lang:null});
});
test('diccionarios y textos y atributos españoles del HTML real', async () => {
  assert.deepEqual(Object.keys(translations.es).sort(),Object.keys(translations.en).sort());
  const html = await readFile(new URL('../index.html',import.meta.url),'utf8');
  for (const [,key,text] of html.matchAll(/data-i18n="([^"]+)"[^>]*>([^<]*)</g)) assert.equal(text.trim(),translations.es[key],key);
  for (const [,attrs,spec] of html.matchAll(/<[^>]*?\s([^>]*?)data-i18n-attr="([^"]+)"[^>]*>/g)) {
    for (const pair of spec.split(';')) {
      const [attr,key] = pair.split(':').map(s=>s.trim());
      assert.ok(translations.es[key]);

    }
  }
  assert.equal(t('fr','nav.repo'),'Repo');
  assert.equal(t('en','missing'),'missing');
});
