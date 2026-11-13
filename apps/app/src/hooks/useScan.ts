import { useEffect, useRef, useState } from 'react';
import { getStatus, scanFile, scanUrl } from '../api';
import type { Analysis, ScanSubmission } from '../types';

export type ScanPhase = 'idle' | 'sending' | 'queued' | 'analyzing' | 'done' | 'error';
export interface ScanLog { label: string; time: number }
interface ScanState {
  phase: ScanPhase; elapsed: number; query: number; nextIn: number;
  logs: ScanLog[]; result: Analysis | null; error: string; timedOut: boolean;
  analysisId: string | null; lastQuery: number | null;
}
const initial: ScanState = { phase: 'idle', elapsed: 0, query: 0, nextIn: 0, logs: [],
  result: null, error: '', timedOut: false, analysisId: null, lastQuery: null };
const TIMEOUT = 'El análisis superó los 4 minutos de espera.';
function pause(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new DOMException('Cancelado', 'AbortError')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, 4000);
    if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true });
  });
}
export function useScan() {
  const [state, setState] = useState<ScanState>(initial);
  const active = useRef<AbortController | null>(null);
  const sample = useRef<ScanSubmission | null>(null);
  const id = useRef<string | null>(null);
  const started = useRef(0);
  const lastPhase = useRef<ScanPhase>('sending');
  useEffect(() => () => active.current?.abort(), []);

  function cancel() {
    active.current?.abort(); active.current = null;
    sample.current = null; id.current = null; setState(initial);
  }
  async function run(submission: ScanSubmission, resume = false) {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller; sample.current = submission;
    const { signal } = controller;
    if (!resume) { started.current = Date.now(); id.current = null; lastPhase.current = 'sending'; }
    let timedOut = false;
    let nextAt = 0;
    const update = (patch: Partial<ScanState>) => {
      if (active.current === controller) setState(previous => ({ ...previous, ...patch }));
    };
    setState(previous => ({ ...(resume ? previous : initial), phase: resume ? lastPhase.current : 'sending',
      query: 0, nextIn: 0, error: '', timedOut: false }));
    const clock = setInterval(() => update({ elapsed: Math.floor((Date.now() - started.current) / 1000),
      nextIn: nextAt ? Math.max(0, Math.ceil((nextAt - Date.now()) / 1000)) : 0 }), 1000);
    // El plazo de 4 min corre desde que la muestra se envió: una subida grande no lo consume.
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const arm = () => { deadline = setTimeout(() => { timedOut = true; controller.abort(); }, 240000); };
    try {
      if (!resume || !id.current) {
        const response = submission.kind === 'file' ? await scanFile(submission.file, signal) : await scanUrl(submission.url, signal);
        signal.throwIfAborted();
        id.current = response.vt.data.id;
        update({ analysisId: id.current });
        setState(previous => ({ ...previous, logs: [{ label: 'enviado', time: Date.now() }] }));
      }
      arm();
      for (let attempt = 1; attempt <= 60; attempt++) {
        nextAt = Date.now() + 4000; update({ nextIn: 4 });
        await pause(signal);
        update({ query: attempt, nextIn: 0 }); nextAt = 0;
        let analysis;
        try { analysis = await getStatus(id.current!, signal); }
        catch (cause) { if ((cause as { status?: number }).status === 429) continue; throw cause; }  // cuota momentánea: se espera y se reintenta
        signal.throwIfAborted();
        const now = Date.now();
        const status = analysis.data.attributes.status;
        if (status === 'queued') lastPhase.current = 'queued';
        else if (status === 'in-progress') lastPhase.current = 'analyzing';
        setState(previous => {
          const logs = previous.logs.filter(entry => entry.label !== 'última consulta');
          const label = status === 'queued' ? 'en cola' : status === 'in-progress' ? 'en análisis' : null;
          if (label && !logs.some(entry => entry.label === label)) logs.push({ label, time: now });
          logs.push({ label: 'última consulta', time: now });
          return { ...previous, logs, lastQuery: now,
            phase: status === 'completed' ? 'done' : status === 'queued' ? 'queued' : status === 'in-progress' ? 'analyzing' : previous.phase,
            result: status === 'completed' ? analysis : null };
        });
        if (status === 'completed') return;
      }
      timedOut = true;
      throw new Error(TIMEOUT);
    } catch (cause: unknown) {
      if (!signal.aborted || timedOut) update({ phase: 'error', timedOut, nextIn: 0,
        error: timedOut ? TIMEOUT : cause instanceof Error ? cause.message : 'No se pudo completar el análisis.' });
    } finally {
      clearInterval(clock); if (deadline) clearTimeout(deadline);
      if (active.current === controller) active.current = null;
    }
  }
  return { ...state, cancel, start: (submission: ScanSubmission) => void run(submission),
    retry: () => { if (sample.current) void run(sample.current); },
    continuePolling: () => { if (sample.current && id.current) void run(sample.current, true); } };
}
export type ScanController = ReturnType<typeof useScan>;
