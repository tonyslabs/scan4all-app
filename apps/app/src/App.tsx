import { useEffect, useRef, useState } from 'react';
import Stage from './components/Stage';
import Home from './components/Home';
import Wait from './components/Wait';
import Verdict from './components/Verdict';
import Nav from './components/Nav';
import type { Section } from './components/Nav';
import Detail from './components/Detail';
import Search from './components/Search';
import History from './components/History';
import Settings from './components/Settings';
import { useScan } from './hooks/useScan';
import { classify, sortedEngines } from './lib/verdict';
import { addHistory } from './lib/history';
import { MAX_UPLOAD_MB } from './config';
import { detect, kindLabel } from './lib/entity';
import type { ScanSubmission, Target } from './types';

const sectionLabel: Record<Section, string> = { analyze: 'Analizar', search: 'Buscar', history: 'Historial', settings: 'Ajustes' };
interface Step { target: Target; from: Section }
import './App.css';

export default function App() {
  const scan = useScan();
  const [submission, setSubmission] = useState<ScanSubmission | null>(null);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const pasteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef(false);
  // Solo desarrollo: #search, #history, #settings o #detail/<tipo>/<id> abren esa pantalla directo (para capturas).
  const dev = import.meta.env.DEV ? location.hash.slice(1).split('/') : [];
  const [section, setSection] = useState<Section>((['search', 'history', 'settings'] as const).find(k => k === dev[0]) ?? 'analyze');
  const [trail, setTrail] = useState<Step[]>(() => dev[0] === 'detail' && dev[1] && dev[2]
    ? [{ target: { kind: dev[1] as Target['kind'], id: decodeURIComponent(dev.slice(2).join('/')) }, from: 'analyze' }] : []);
  const top = trail[trail.length - 1];
  const onStage = section === 'analyze' && !top;
  const state = scan.phase === 'idle' ? 'home' : scan.phase === 'done' ? 'verdict' : 'wait';
  function submit(sample: ScanSubmission) {
    if (state !== 'home') return;
    setError(''); setSubmission(sample); scan.start(sample);
  }
  function selectFile(file: File) {
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) { setError(`El archivo supera el límite de ${MAX_UPLOAD_MB} MB. Elige uno más pequeño.`); return; }
    submit({ kind: 'file', file, name: file.name, mime: file.type || 'application/octet-stream' });
  }
  function submitUrl(value: string) {
    const trimmed = value.trim();
    const found = detect(trimmed);
    if (found && found.kind !== 'url') { setError(''); open(found); return; }  // dominio, IP o hash: se abre su informe
    try {
      if (!trimmed || trimmed.length > 2048 || !/^https?:\/\//i.test(trimmed)) throw new Error();
      const parsed = new URL(trimmed);
      if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) throw new Error();
    } catch { setError('Ingresa una URL con http:// o https:// (máx. 2048 caracteres), un dominio, una IP o un hash.'); return; }
    submit({ kind: 'url', url: trimmed, name: trimmed, mime: 'text/plain' });
  }
  function open(target: Target) { setTrail(steps => [...steps, { target, from: section }]); }
  function back() { setTrail(steps => steps.slice(0, -1)); }
  function select(next: Section) { setTrail([]); setSection(next); }
  function analyzeUrl(value: string) { setTrail([]); setSection('analyze'); setUrl(value); if (state === 'home') submitUrl(value); }
  // Lo analizado entra al historial al terminar, aunque la persona esté en otra pantalla.
  useEffect(() => {
    const result = scan.result;
    if (scan.phase !== 'done' || !result || !submission) return;
    const id = submission.kind === 'file' ? result.meta?.file_info?.sha256 : result.meta?.url_info?.id;
    if (typeof id === 'string' && id) addHistory({ kind: submission.kind, id, label: submission.name, verdict: classify(result) });
  }, [scan.phase]);
  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      if (!onStage || state !== 'home' || pending.current) return;
      const file = event.clipboardData?.files[0];
      if (file) { event.preventDefault(); selectFile(file); return; }
      const value = event.clipboardData?.getData('text/plain').trim() ?? '';
      if (!/^https?:\/\//i.test(value)) return;
      event.preventDefault(); setUrl(value); setError(''); pending.current = true;
      // Permite que el campo muestre la URL pegada antes de iniciar el análisis.
      pasteTimer.current = setTimeout(() => { pending.current = false; submitUrl(value); }, 500);
    }
    document.addEventListener('paste', onPaste);
    return () => { document.removeEventListener('paste', onPaste); if (pasteTimer.current) clearTimeout(pasteTimer.current); pending.current = false; };
  }, [state, onStage]);
  const engines = scan.result ? sortedEngines(scan.result) : [];
  const variant = scan.result ? classify(scan.result) : 'clean';
  const parts: [string, string] = state === 'home' ? ['scan', '4all'] : state === 'wait'
    ? [`${Math.floor(scan.elapsed / 60)}:`, String(scan.elapsed % 60).padStart(2, '0')]
    : [variant === 'unknown' ? '?' : String((variant === 'suspicious' ? scan.result?.data.attributes.stats?.suspicious : scan.result?.data.attributes.stats?.malicious) ?? 0), `/${engines.length}`];
  const backLabel = trail.length > 1 ? `${kindLabel[trail[trail.length - 2].target.kind]}` : sectionLabel[top?.from ?? section];
  return <>
    <Nav section={section} busy={['sending', 'queued', 'analyzing'].includes(scan.phase)} quiet={onStage && state === 'home'} onSelect={select} />
    {onStage && <Stage state={state} variant={variant} parts={parts} engines={engines} onFile={selectFile}>
      {state === 'home' && <Home url={url} setUrl={value => { setUrl(value); setError(''); }} onUrl={() => submitUrl(url)} onFile={selectFile} error={error} />}
      {state === 'wait' && submission && <Wait scan={scan} submission={submission} />}
      {state === 'verdict' && scan.result && submission && <Verdict analysis={scan.result} engines={engines} submission={submission} lastQuery={scan.lastQuery}
        onDetails={open} onReset={() => { scan.cancel(); setSubmission(null); setUrl(''); setError(''); }} />}
    </Stage>}
    {section === 'search' && <div hidden={Boolean(top)}><Search onOpen={open} /></div>}
    {!top && section === 'history' && <History onOpen={open} />}
    {!top && section === 'settings' && <Settings />}
    {top && <Detail key={`${top.target.kind}:${top.target.id}`} target={top.target} backLabel={backLabel} onBack={back} onOpen={open} onAnalyzeUrl={analyzeUrl} />}
  </>;
}
