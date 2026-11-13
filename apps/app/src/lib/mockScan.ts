import type { Analysis, EngineResult, ScanResponse } from '../types';

const names = ['Kaspersky','BitDefender','ESET-NOD32','Sophos','Microsoft','Avast','AVG','Avira','McAfee','Symantec','TrendMicro','Fortinet','GData','Emsisoft','F-Secure','DrWeb','ClamAV','Malwarebytes','Panda','Sangfor','CrowdStrike','SentinelOne','Cylance','Elastic','Paloalto','Trellix','Ikarus','Jiangmin','K7AntiVirus','K7GW','Kingsoft','Lionic','MAX','MaxSecure','NANO-Antivirus','Rising','Skyhigh','SUPERAntiSpyware','TACHYON','Tencent','TrendMicro-HouseCall','VBA32','VIPRE','ViRobot','Varist','Webroot','Xcitium','Yandex','Zillya','ZoneAlarm','AhnLab-V3','Alibaba','ALYac','Antiy-AVL','Arcabit','Baidu','Bkav','CAT-QuickHeal','CMC','Cynet','DeepInstinct','Google','Gridinsoft','Acronis','APEX','Cybereason','huorong','alibabacloud'];
const jobs = new Map<string, { started: number; kind: 'file' | 'url' }>();
export async function submitMock(kind: 'file' | 'url', signal?: AbortSignal): Promise<ScanResponse> {
  signal?.throwIfAborted();
  const id = `mock-${crypto.randomUUID()}`;
  jobs.set(id, { started: Date.now(), kind });
  return { ok: true, vt: { data: { id } } };
}
export async function statusMock(id: string, signal?: AbortSignal): Promise<Analysis> {
  signal?.throwIfAborted();
  const job = jobs.get(id);
  if (!job) throw new Error('No se encontró el análisis de prueba.');
  const seconds = (Date.now() - job.started) / 1000;
  const status = seconds < 6 ? 'queued' : seconds < 12 ? 'in-progress' : 'completed';
  const mode = import.meta.env.VITE_MOCK;
  const signatures = ['Trojan.Win32.Agent.demo','Gen:Variant.Zusy.Demo','Win32/Kryptik.Demo','Generic ML PUA'];
  const results: Record<string, EngineResult> = Object.fromEntries(names.map((name, i) => [name, {
    category: mode === 'unknown' ? 'type-unsupported' : mode === 'threat' && i < 4 ? i < 3 ? 'malicious' : 'suspicious' : 'undetected',
    result: mode === 'threat' && i < 4 ? signatures[i] : null,
  }]));
  return {
    data: { attributes: { status, date: Math.floor(Date.now() / 1000), results,
      stats: { harmless: 0, malicious: mode === 'threat' ? 3 : 0, suspicious: mode === 'threat' ? 1 : 0,
        undetected: mode === 'unknown' ? 0 : mode === 'threat' ? 64 : 68, 'type-unsupported': mode === 'unknown' ? 68 : 0 } } },
    meta: job.kind === 'file' ? { file_info: { sha256: 'a4d18e72b9f036c5a4d18e72b9f036c5a4d18e72b9f036c5a4d18e72b9f036c5' } }
      : { url_info: { id: 'b8e1d702a69f34c5b8e1d702a69f34c5b8e1d702a69f34c5b8e1d702a69f34c5' } },
  };
}
