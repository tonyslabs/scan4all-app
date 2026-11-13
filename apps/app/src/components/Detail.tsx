import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { ApiError, addVote, lookup, rescan, waitAnalysis } from '../api';
import { detect, enginesOf, kindLabel, titleOf, verdictOf } from '../lib/entity';
import { addHistory } from '../lib/history';
import type { Entity, Target } from '../types';
import VerdictChip from './Chip';
import Page from './Page';
import Spinner from './Spinner';
import EngineGrid from './EngineGrid';
import Behaviour from './detail/Behaviour';
import Comments from './detail/Comments';
import Details from './detail/Details';
import Overview from './detail/Overview';
import Relations from './detail/Relations';

type Tab = 'overview' | 'detections' | 'details' | 'relations' | 'comments' | 'behaviour';
const tabLabels: Record<Tab, string> = { overview: 'Resumen', detections: 'Detecciones', details: 'Detalles',
  relations: 'Relaciones', comments: 'Comentarios', behaviour: 'Comportamiento' };

interface Props {
  target: Target; backLabel: string; onBack: () => void; onOpen: (target: Target) => void;
  onAnalyzeUrl: (url: string) => void;
}
export default function Detail({ target, backLabel, onBack, onOpen, onAnalyzeUrl }: Props) {
  const { kind, id } = target;
  const [entity, setEntity] = useState<Entity | null>(null);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');
  const [rescanning, setRescanning] = useState(false);
  const [voting, setVoting] = useState(false);
  const [voted, setVoted] = useState('');
  const [copied, setCopied] = useState('');
  const [onlyDetections, setOnlyDetections] = useState(true);
  const work = useRef<AbortController | null>(null);

  useEffect(() => () => work.current?.abort(), []);

  const load = useCallback(async (signal: AbortSignal) => {
    const found = await lookup(kind, id, signal);
    if (signal.aborted) return;
    setEntity(found);
    addHistory({ kind, id, label: titleOf(kind, found, target.label), verdict: verdictOf(found) });
  }, [kind, id, target.label]);

  useEffect(() => {
    const controller = work.current = new AbortController();
    setEntity(null); setError(''); setNotFound(false);
    load(controller.signal).catch(cause => {
      if (controller.signal.aborted) return;
      if (cause instanceof ApiError && cause.status === 404) setNotFound(true);
      else setError(cause instanceof Error ? cause.message : 'No se pudo cargar.');
    });
    return () => controller.abort();
  }, [load]);

  async function reanalyze() {
    if (rescanning) return;
    const controller = work.current = new AbortController();
    setRescanning(true); setError('');
    try {
      await waitAnalysis(await rescan(kind, id, controller.signal), controller.signal);
      await load(controller.signal);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'No se pudo volver a analizar.');
    } finally { if (!controller.signal.aborted) setRescanning(false); }
  }
  async function vote(verdict: 'harmless' | 'malicious') {
    setVoting(true);
    try {
      await addVote(kind, id, verdict);
      setVoted(verdict);
      setEntity(current => current && { ...current, attributes: { ...current.attributes,
        total_votes: { ...current.attributes.total_votes, [verdict]: (current.attributes.total_votes?.[verdict] ?? 0) + 1 } } });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo votar.'); }
    finally { setVoting(false); }
  }
  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setCopied('Copiado.'); }
    catch { setCopied('No se pudo copiar.'); }
  }
  const tabs: Tab[] = ['overview', 'detections', 'details', 'relations', 'comments', ...(kind === 'file' ? ['behaviour' as const] : [])];
  function onTabKey(event: KeyboardEvent) {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = tabs[(tabs.indexOf(tab) + step + tabs.length) % tabs.length];
    setTab(next);
    document.getElementById(`tab-${next}`)?.focus();
  }

  const back = { label: backLabel, onBack };
  if (!entity && !error && !notFound) return <Page title={kindLabel[kind]} back={back}><div className="center"><Spinner size="lg" /></div></Page>;
  if (notFound) return <Page title={target.label ?? kindLabel[kind]} back={back}>
    <p className="empty">No hay información de este elemento todavía.</p>
    {kind === 'url' && target.label && <button className="btn pri" type="button" onClick={() => onAnalyzeUrl(target.label!)}>Analizar esta URL</button>}
  </Page>;
  if (!entity) return <Page title={kindLabel[kind]} back={back}>
    <p className="error" role="alert">{error}</p>
    <button className="btn" type="button" onClick={onBack}>Volver</button>
  </Page>;

  const attrs = entity.attributes;
  const stats = attrs.last_analysis_stats;
  const engines = enginesOf(entity);
  const total = stats ? (stats.harmless ?? 0) + (stats.malicious ?? 0) + (stats.suspicious ?? 0) + (stats.undetected ?? 0) : 0;
  const title = titleOf(kind, entity, target.label);
  const copyValue = kind === 'url' ? (attrs.url ?? title) : entity.id;
  const hits = engines.filter(e => e.category === 'malicious' || e.category === 'suspicious');
  const verdict = verdictOf(entity);
  const infected = verdict === 'threat' || verdict === 'suspicious';
  const shown = onlyDetections && hits.length ? hits : engines;
  const host = kind === 'url' ? (() => { try { return detect(new URL(String(attrs.url ?? title)).hostname); } catch { return null; } })() : null;

  return <Page title={title} back={back} tone={verdict}>
    <div className="dhead" data-v={verdict}>
      <div className="dhead-main">
        <span className="row-kind">{kindLabel[kind]}</span>
        <VerdictChip kind={verdict} />
        {total > 0 && <span className="score"><b>{stats.malicious ?? 0}</b>/{total}</span>}
      </div>
      <div className="dhead-act">
        <button className="btn" type="button" disabled={rescanning} onClick={() => void reanalyze()}>
          {rescanning ? <Spinner size="sm" label="Analizando de nuevo" /> : 'Volver a analizar'}
        </button>
        {host && <button className="btn" type="button" onClick={() => onOpen(host)}>Ver dominio</button>}
        <button className="btn" type="button" onClick={() => void copy(copyValue)}>Copiar {kind === 'file' ? 'hash' : kind === 'url' ? 'URL' : kind === 'ip' ? 'IP' : 'dominio'}</button>
        <span role="status" className="hint">{copied}</span>
      </div>
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    {infected && <div className={`alarm alarm-${verdict}`} role="alert">
      <p className="alarm-title">{verdict === 'threat' ? '◆ Amenaza detectada' : '△ Elemento sospechoso'}</p>
      <p className="alarm-text">{stats.malicious ?? 0} de {total} motores lo marcan como malicioso{(stats.suspicious ?? 0) > 0 ? ` y ${stats.suspicious} como sospechoso` : ''}.
        {kind === 'file' && attrs.popular_threat_classification?.suggested_threat_label ? ` Clasificación: ${attrs.popular_threat_classification.suggested_threat_label}.` : ''}</p>
      <ul className="alarm-hits">{hits.slice(0, 6).map(e => <li key={e.name}><b>{e.name}</b>{e.result ? ` · ${e.result}` : ''}</li>)}</ul>
      {hits.length > 6 && tab !== 'detections' && <button className="btn" type="button" onClick={() => setTab('detections')}>Ver los {hits.length} motores que lo marcan</button>}
    </div>}
    <div className="tabs" role="tablist" aria-label="Secciones" onKeyDown={onTabKey}>
      {tabs.map(key => <button key={key} id={`tab-${key}`} role="tab" type="button" className="tab" aria-selected={tab === key}
        aria-controls="tabpanel" tabIndex={tab === key ? 0 : -1} onClick={() => setTab(key)}>{tabLabels[key]}</button>)}
    </div>
    <div id="tabpanel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="tabpanel">
      {tab === 'overview' && <Overview kind={kind} attrs={attrs} voting={voting} voted={voted} onVote={verdict => void vote(verdict)} />}
      {tab === 'detections' && (engines.length ? <>
        {hits.length > 0 && <label className="check"><input type="checkbox" checked={onlyDetections} onChange={event => setOnlyDetections(event.currentTarget.checked)} /> Solo detecciones</label>}
        <EngineGrid engines={shown} label={onlyDetections && hits.length ? 'Motores con detecciones' : 'Todos los motores'} />
      </> : <p className="empty">No hay resultados de motores.</p>)}
      {tab === 'details' && <Details kind={kind} attrs={attrs} />}
      {tab === 'relations' && <Relations kind={kind} id={id} onOpen={onOpen} />}
      {tab === 'comments' && <Comments kind={kind} id={id} />}
      {tab === 'behaviour' && <Behaviour id={id} />}
    </div>
  </Page>;
}
