import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as lib from '../lib.js';
const source = (await readFile(new URL('../app.js', import.meta.url), 'utf8')).replace(/^import [^\n]+\n/, '');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const flush = () => new Promise(setImmediate);
const camel = (name) => name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

class Events {
  constructor() { this.listeners = {}; }
  addEventListener(type, listener) {
    (this.listeners[type] ||= new Set()).add(listener);
  }
  removeEventListener(type, listener) { this.listeners[type]?.delete(listener); }
  dispatch(type, details = {}) {
    const event = {
      type, target: this, bubbles: ['click', 'keydown', 'focusin', 'focusout'].includes(type),
      defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...details,
    };
    for (let node = this; node; node = event.bubbles ? node.parentElement : null) {
      event.currentTarget = node;
      for (const listener of [...(node.listeners[type] || [])]) listener(event);
    }
    return event;
  }
}

// DOM mínimo para probar los efectos del módulo sin navegador ni dependencias.
class Element extends Events {
  constructor(tag, attributes = {}, text = '') {
    super();
    this.tag = tag;
    this.attributes = { ...attributes };
    this.dataset = {};
    for (const [name, value] of Object.entries(attributes)) {
      if (name.startsWith('data-')) this.dataset[camel(name.slice(5))] = value;
    }
    this.children = [];
    this.text = text;
  }
  get textContent() { return this.text + this.children.map((child) => child.textContent).join(''); }
  set textContent(value) { this.text = value; this.children = []; }
  getAttribute(name) { return name.startsWith('data-') ? this.dataset[camel(name.slice(5))] : this.attributes[name]; }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name.startsWith('data-')) this.dataset[camel(name.slice(5))] = String(value);
  }
  removeAttribute(name) {
    delete this.attributes[name];
    if (name.startsWith('data-')) delete this.dataset[camel(name.slice(5))];
  }
  get hidden() { return this.getAttribute('hidden') !== undefined; }
  set hidden(value) { if (value) this.setAttribute('hidden', ''); else this.removeAttribute('hidden'); }
  get tabIndex() { return Number(this.getAttribute('tabindex') ?? (this.tag === 'button' ? 0 : -1)); }
  set tabIndex(value) { this.setAttribute('tabindex', value); }
  get classList() {
    return {
      contains: (name) => (this.attributes.class || '').split(/\s+/).includes(name),
      toggle: (name, force) => {
        const names = new Set((this.attributes.class || '').split(/\s+/).filter(Boolean));
        const active = force ?? !names.has(name);
        if (active) names.add(name); else names.delete(name);
        this.attributes.class = [...names].join(' ');
        return active;
      },
    };
  }
  contains(node) { return node === this || this.children.some((child) => child.contains(node)); }
  matches(selector) {
    if (selector === ':hover') return Boolean(this.hovered);
    return selector.split(',').some((part) => {
      part = part.trim();
      const tag = part.match(/^\w+/)?.[0];
      const classes = [...part.replace(/\[[^\]]+\]/g, '').matchAll(/\.([\w-]+)/g)].map((match) => match[1]);
      const attributes = [...part.matchAll(/\[([^=\]]+)(?:="([^"]*)")?\]/g)];
      return Boolean(tag || classes.length || attributes.length) && (!tag || this.tag === tag)
        && classes.every((name) => this.classList.contains(name))
        && attributes.every(([, name, value]) => this.getAttribute(name) !== undefined
          && (value === undefined || this.getAttribute(name) === value));
    });
  }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; }
  querySelectorAll(selector) {
    return this.children.flatMap((child) => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  click() { this.dispatch('click'); }
  focus() {
    const document = this.ownerDocument;
    const previous = document.activeElement;
    if (previous === this) return;
    document.activeElement = this;
    previous?.dispatch('focusout', { relatedTarget: this });
    this.dispatch('focusin', { relatedTarget: previous });
  }
}

function documentFromHtml() {
  const root = new Element('document');
  const stack = [root];
  for (const token of html.matchAll(/<!--[\s\S]*?-->|<\/?([\w-]+)\b([^>]*?)>|([^<]+)/g)) {
    const [raw, tag, attributeText, text] = token;
    if (raw.startsWith('<!--')) continue;
    if (text) { stack.at(-1).text += text; continue; }
    if (raw.startsWith('</')) { stack.pop(); continue; }
    const attributes = Object.fromEntries([...attributeText.matchAll(/([^\s=\/]+)(?:="([^"]*)")?/g)]
      .map(([, name, value]) => [name, value || '']));
    const element = new Element(tag, attributes);
    element.ownerDocument = root;
    element.parentElement = stack.at(-1);
    stack.at(-1).children.push(element);
    if (tag === 'html') root.documentElement = element;
    if (!raw.endsWith('/>') && !['meta', 'link', 'img', 'br', 'hr', 'input'].includes(tag)) stack.push(element);
  }
  root.activeElement = root.querySelector('body');
  return root;
}

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

function boot(options = {}) {
  const document = documentFromHtml();
  document.hidden = Boolean(options.hidden);
  options.prepareDocument?.(document);
  const calls = [];
  const timers = [];
  let now = 0;
  const motion = new Events();
  motion.matches = Boolean(options.reducedMotion);
  const window = new Events();
  window.location = { search: options.search || '' };
  window.matchMedia = (query) => {
    assert.equal(query, '(prefers-reduced-motion: reduce)');
    return motion;
  };
  const context = {
    ...lib,
    document,
    window,
    navigator: { language: 'es-NI', userAgent: 'X11; Linux x86_64', platform: 'Linux x86_64', ...options.navigator },
    localStorage: options.localStorage || storage(),
    sessionStorage: options.sessionStorage || storage(),
    AbortController,
    setTimeout(callback, ms) { const timer = { callback, ms, due: now + ms }; timers.push(timer); return timer; },
    clearTimeout(timer) { if (timer) timer.cleared = true; },
    fetch: (...args) => {
      calls.push(args);
      return options.fetch ? options.fetch(...args) : Promise.reject(new Error('Unexpected fetch'));
    },
  };
  vm.runInNewContext(source, context, { filename: 'app.js' });
  return {
    document, window, motion, calls, timers,
    pendingTimers: () => timers.filter((timer) => !timer.cleared && !timer.fired),
    advance(ms) {
      const end = now + ms;
      for (;;) {
        const next = timers.filter((timer) => !timer.cleared && !timer.fired && timer.due <= end)
          .sort((a, b) => a.due - b.due)[0];
        if (!next) break;
        now = next.due;
        next.fired = true;
        next.callback();
      }
      now = end;
    },
    localStorage: context.localStorage,
    sessionStorage: context.sessionStorage,
    downloads: document.querySelector('[data-downloads]'),
    slots: document.querySelectorAll('a[data-asset]'),
    slot: (name) => document.querySelector(`a[data-asset="${name}"]`),
  };
}

const latest = 'https://github.com/tonyslabs/scan4all-app/releases/latest';
const deb = { name:'Scan4All-1.0.0-linux-amd64.deb', size:2.5*1024**2, browser_download_url:'https://example.org/app.deb' };
const response = assets => ({ok:true, json:async()=>({tag_name:'v9.0.0', assets})});

test('demo completo sobre HTML real: assets, tamaños, versión, plataforma e idioma', () => {
  const app = boot({search:'?demo=1&os=android&lang=en'});
  assert.equal(app.calls.length,0);
  assert.equal(app.downloads.dataset.state,'ready');
  assert.ok(app.slots.every(node=>node.dataset.state==='ready'));
  for (const [slot,size] of [['android','8.7 MB'],['linux-deb','2.5 MB'],['linux-appimage','104.0 MB'],['windows','1.6 MB']]) {
    assert.equal(app.slot(slot).querySelector('[data-asset-size]').textContent,size);
    assert.match(app.slot(slot).href,/releases\/download\/v1.0.0\//);
  }
  assert.equal(app.document.querySelector('[data-app-version]').textContent,'v1.0.0');
  assert.deepEqual(app.document.querySelectorAll('[data-current]').map(node=>node.dataset.platform),['android']);
  assert.equal(app.document.title,lib.t('en','meta.title'));
  assert.equal(app.document.querySelector('[data-dl-status]').textContent,'');
  app.document.querySelector('[data-lang="es"]').click();
  assert.equal(app.document.documentElement.lang,'es');
  assert.equal(app.localStorage.getItem('scan4all.lang'),'es');
  assert.equal(app.document.querySelector('[data-lang="es"]').getAttribute('aria-pressed'),'true');
  assert.equal(app.document.querySelector('[data-lang="en"]').getAttribute('aria-pressed'),'false');
  assert.equal(app.document.querySelector('[data-i18n-attr="content:meta.desc"]').getAttribute('content'),lib.t('es','meta.desc'));
});
for (const state of ['loading','soon','error']) test(`demo ${state}: sin API, sin plataforma, status traducible`, () => {
  const app=boot({search:`?demo=${state}&os=none`});
  assert.equal(app.calls.length,0);
  assert.equal(app.downloads.dataset.state,state);
  assert.ok(app.slots.every(node=>node.dataset.state===state && node.href===latest));
  assert.equal(app.document.querySelectorAll('[data-current]').length,0);
  app.document.querySelector('[data-lang="en"]').click();
  assert.equal(app.document.querySelector('[data-dl-status]').textContent,state==='soon' ? '' : lib.t('en',`dl.${state}`));
});
test('API parcial: carga, fallback, GET, caché reutilizable y versión literal', async () => {
  const app=boot({fetch:async()=>response([deb])});
  assert.equal(app.downloads.dataset.state,'loading');
  assert.equal(app.calls[0][0],'https://api.github.com/repos/tonyslabs/scan4all-app/releases/latest');
  assert.equal(app.calls[0][1].method,'GET');
  await flush();
  assert.equal(app.downloads.dataset.state,'ready');
  assert.equal(app.slot('linux-deb').href,deb.browser_download_url);
  assert.equal(app.slot('android').href,latest);
  assert.equal(app.slot('android').dataset.state,'soon');
  assert.equal(app.document.querySelector('[data-app-version]').textContent,'v9.0.0');
  const cached=boot({sessionStorage:app.sessionStorage});
  assert.equal(cached.calls.length,0);
  assert.equal(cached.downloads.dataset.state,'ready');
  assert.ok(app.timers.every(timer=>timer.cleared));
});
for (const [label,fetch,state] of [
  ['404',async()=>({ok:false,status:404}),'soon'],
  ['vacío',async()=>response([]),'soon'],
  ['sin assets reconocidos',async()=>response([{...deb,name:'source.zip'}]),'soon'],
  ['500',async()=>({ok:false,status:500}),'error'],
  ['red',async()=>{throw new Error('offline');},'error'],
  ['JSON inválido',async()=>({ok:true,json:async()=>{throw new Error('json');}}),'error'],
  ['release inválido',async()=>({ok:true,json:async()=>({})}),'error'],
]) test(`API ${label}: ${state}`,async()=>{
  const app=boot({fetch}); await flush();
  assert.equal(app.downloads.dataset.state,state);
  assert.ok(app.slots.every(node=>node.dataset.state===state && node.href===latest));
});
test('timeout de 8 s incluso si fetch ignora abort; respuesta tardía no altera estado',async()=>{
  let resolve;
  const app=boot({fetch:()=>new Promise(done=>{resolve=done;})});
  app.advance(7999);
  assert.equal(app.downloads.dataset.state,'loading');
  app.advance(1); await flush();
  assert.equal(app.calls[0][1].signal.aborted,true);
  assert.equal(app.downloads.dataset.state,'error');
  resolve(response([deb])); await flush();
  assert.equal(app.downloads.dataset.state,'error');
});
test('idioma: URL > guardado > navegador; storage bloqueado y caché corrupta tolerados',async()=>{
  for (const [options,expected] of [
    [{localStorage:storage({'scan4all.lang':'en'})},'en'],
    [{navigator:{language:'en-US'}},'en'],
    [{navigator:{language:'fr'}},'es'],
    [{search:'?demo=soon&lang=es',localStorage:storage({'scan4all.lang':'en'})},'es'],
    [{localStorage:storage({'scan4all.lang':'bad'}),navigator:{language:'en'}},'en'],
  ]) {
    const app=boot({search:'?demo=soon',...options});
    assert.equal(app.document.documentElement.lang,expected);
  }
  const blocked={getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');}};
  const app=boot({localStorage:blocked,sessionStorage:blocked,fetch:async()=>response([deb])});
  app.document.querySelector('[data-lang="en"]').click(); await flush();
  assert.equal(app.downloads.dataset.state,'ready');
  const corrupted=boot({sessionStorage:storage({'scan4all.release':'bad json'}),fetch:async()=>response([deb])});
  await flush(); assert.equal(corrupted.downloads.dataset.state,'ready');
});
