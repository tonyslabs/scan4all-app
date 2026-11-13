import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../package.json', import.meta.url));
const ts = require('typescript');
const source = await readFile(new URL('../src/lib/mockScan.ts', import.meta.url), 'utf8');
for (const mode of ['threat', 'clean', 'unknown']) {
  test(`mock ${mode}: estados reales, 68 motores y metadatos`, async t => {
    t.mock.timers.enable({ apis: ['Date'] });
    const code = ts.transpileModule(source.replace('import.meta.env.VITE_MOCK', JSON.stringify(mode)), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    }).outputText;
    const context = vm.createContext({ Date, crypto });
    const module = new vm.SourceTextModule(code, { context });
    await module.link(() => { throw new Error('El mock no debe importar la red.'); });
    await module.evaluate();
    const api = module.namespace;
    const { vt: { data: { id } } } = await api.submitMock('file');
    assert.equal((await api.statusMock(id)).data.attributes.status, 'queued');
    t.mock.timers.tick(8000);
    assert.equal((await api.statusMock(id)).data.attributes.status, 'in-progress');
    t.mock.timers.tick(4000);
    const result = await api.statusMock(id);
    assert.equal(result.data.attributes.status, 'completed');
    assert.equal(Object.keys(result.data.attributes.results).length, 68);
    assert.equal(result.data.attributes.stats.malicious, mode === 'threat' ? 3 : 0);
    assert.equal(result.data.attributes.stats.suspicious, mode === 'threat' ? 1 : 0);
    assert.equal(result.data.attributes.stats.undetected, mode === 'unknown' ? 0 : mode === 'threat' ? 64 : 68);
    assert.match(result.meta.file_info.sha256, /^[a-f\d]{64}$/);
    const urlJob = await api.submitMock('url');
    assert.match((await api.statusMock(urlJob.vt.data.id)).meta.url_info.id, /^[a-f\d]{64}$/);
    const controller = new AbortController(); controller.abort();
    await assert.rejects(api.submitMock('file', controller.signal), { name: 'AbortError' });
  });
}
