import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../package.json', import.meta.url));
const ts = require('typescript');
const source = ts.transpileModule(await readFile(new URL('../src/hooks/useScan.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const sample = { kind: 'url', url: 'https://example.com', name: 'https://example.com', mime: 'text/plain' };
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
async function harness(t, statuses, uploadError) {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout', 'setInterval'] });
  let state;
  let cleanup;
  let sends = 0;
  const queried = [];
  const context = vm.createContext({ setTimeout, clearTimeout, setInterval, clearInterval, Date, Error, AbortController, DOMException });
  const react = new vm.SyntheticModule(['useState', 'useRef', 'useEffect'], function () {
    this.setExport('useState', initial => { state = initial; return [state, next => { state = typeof next === 'function' ? next(state) : next; }]; });
    this.setExport('useRef', current => ({ current }));
    this.setExport('useEffect', effect => { cleanup = effect(); });
  }, { context });
  const api = new vm.SyntheticModule(['scanFile', 'scanUrl', 'getStatus'], function () {
    const send = async () => { sends++; if (uploadError) throw uploadError; return { vt: { data: { id: 'analysis-123' } } }; };
    this.setExport('scanFile', send); this.setExport('scanUrl', send);
    this.setExport('getStatus', async id => {
      queried.push(id);
      const status = statuses.length > 1 ? statuses.shift() : statuses[0];
      if (status instanceof Error) throw status;
      return { data: { attributes: { status } } };
    });
  }, { context });
  const module = new vm.SourceTextModule(source, { context });
  await module.link(name => name === 'react' ? react : api);
  await module.evaluate();
  const scan = module.namespace.useScan();
  return { scan, state: () => state, sends: () => sends, queried, unmount: () => cleanup(),
    advance: async ms => { t.mock.timers.tick(ms); await flush(); } };
}
test('polling respeta queued/in-progress/completed, reloj y bitácora real', async t => {
  const h = await harness(t, ['queued', 'in-progress', 'completed']);
  h.scan.start(sample); await flush();
  assert.equal(h.sends(), 1);
  assert.equal(h.state().logs[0].label, 'enviado');
  await h.advance(1000); assert.equal(h.state().elapsed, 1); assert.equal(h.state().nextIn, 3);
  await h.advance(3000); assert.equal(h.state().phase, 'queued');
  await h.advance(4000); assert.equal(h.state().phase, 'analyzing');
  await h.advance(4000); assert.equal(h.state().phase, 'done');
  assert.equal(h.state().query, 3);
  assert.deepEqual(Array.from(h.state().logs, e => e.label), ['enviado', 'en cola', 'en análisis', 'última consulta']);
  assert.equal(h.state().lastQuery, 12000);
  assert.equal(h.state().result.data.attributes.status, 'completed');
});
test('error conserva mensaje y muestra para reenviar', async t => {
  const h = await harness(t, [new Error('Límite de VirusTotal alcanzado.')]);
  h.scan.start(sample); await flush(); await h.advance(4000);
  assert.equal(h.state().phase, 'error'); assert.equal(h.state().error, 'Límite de VirusTotal alcanzado.');
  h.scan.retry(); await flush(); assert.equal(h.sends(), 2);
  h.scan.cancel(); assert.equal(h.state().phase, 'idle');
});
test('timeout permite continuar con el mismo id sin reenviar', async t => {
  const statuses = ['queued'];
  const h = await harness(t, statuses);
  h.scan.start(sample); await flush(); await h.advance(240000);
  assert.equal(h.state().timedOut, true); assert.equal(h.state().phase, 'error');
  assert.equal(h.state().analysisId, 'analysis-123');
  statuses[0] = 'completed'; h.scan.continuePolling(); await flush(); await h.advance(4000);
  assert.equal(h.sends(), 1); assert.equal(h.queried.at(-1), 'analysis-123'); assert.equal(h.state().phase, 'done');
});
test('cancelación y desmontaje eliminan timers y consultas pendientes', async t => {
  const h = await harness(t, ['queued']);
  h.scan.start(sample); await flush(); h.scan.cancel(); await h.advance(12000);
  assert.equal(h.queried.length, 0); assert.equal(h.state().phase, 'idle');
  h.scan.start(sample); await flush(); h.unmount(); await h.advance(12000);
  assert.equal(h.queried.length, 0);
});
test('error al enviar permite reintentar sin perder la muestra', async t => {
  const h = await harness(t, [], new Error('Archivo rechazado.'));
  h.scan.start(sample); await flush(); assert.equal(h.state().error, 'Archivo rechazado.');
  h.scan.retry(); await flush(); assert.equal(h.sends(), 2);
});
