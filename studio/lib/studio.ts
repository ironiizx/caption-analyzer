import { pixelMetrics, parseAnalysis, type Metrics, type Analysis } from './core';
import { imageSignature, validateComparison, type Signature, type Comparison } from './comparison';

export type Variant = { id: string; name: string; src: string; width: number; height: number; metrics: Metrics; signature?: Signature; originalBytes?: number; originalType?: string; imageKey?: string; analysis?: Analysis; analysisContext?: string; analysisCreatedAt?: string; usage?: unknown };
export type Experiment = { hypothesis: string; source: string; design: string; start: string; end: string; aImpressions: string; aClicks: string; bImpressions: string; bClicks: string; variantA: string; variantB: string };
export type Prediction = { id: string; createdAt: string; variantA: string; variantB: string; context: string; recommendation: 'A' | 'B' | 'tie'; source: 'manual' | 'ai'; reason: string; comparison?: Comparison; jobId?: string; model?: string };
export type EpicRecord = { id: string; variantId: string; status: 'clear' | 'similarity' | 'content' | 'blocked'; checkedAt: string; createdAt: string; island: string; notes: string };
export type ABRecord = { id: string; createdAt: string; experiment: Experiment; predictionId?: string };
export type Project = { id: string; name: string; context: string; variants: Variant[]; experiment: Experiment; brief: { mechanic: string; style: string; subject: string }; predictions: Prediction[]; epicRecords: EpicRecord[]; abRecords: ABRecord[] };
export const initialExperiment: Experiment = { hypothesis: '', source: '', design: 'randomized', start: '', end: '', aImpressions: '', aClicks: '', bImpressions: '', bClicks: '', variantA: '', variantB: '' };
export const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(16))).map(x => x.toString(16).padStart(2, '0')).join('');
export const createProject = (): Project => ({ id: newId(), name: 'Mi próximo mapa', context: '', variants: [], experiment: { ...initialExperiment }, brief: { mechanic: '', style: 'Cartoon limpio', subject: '' }, predictions: [], epicRecords: [], abRecords: [] });
export const validDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
export const pct = (n: number, digits = 0) => n.toLocaleString('es-AR', { maximumFractionDigits: digits, minimumFractionDigits: digits }) + ' %';
export const prettyDate = (s: string) => Number.isFinite(Date.parse(s)) ? new Date(s).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : 'Fecha no disponible';
export function downloadFile(name: string, text: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type })), a = document.createElement('a');
  a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function api(url: string, init?: RequestInit) {
  const r = await fetch(url, init); let data: any;
  try { data = await r.json(); } catch { throw new Error('No pudimos conectar. Probá de nuevo en unos segundos.'); }
  if (!r.ok) throw new Error(data.error || 'No se pudo completar la operación.'); return data;
}
export async function blobData(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result as string); r.onerror = () => reject(new Error('No se pudo leer la imagen.')); r.readAsDataURL(blob); });
}
async function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => { const url = URL.createObjectURL(blob), img = new Image(); img.onload = () => { URL.revokeObjectURL(url); resolve(img); }; img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Probá con una imagen PNG, JPG o WebP.')); }; img.src = url; });
}
export async function makeVariant(blob: Blob, name: string): Promise<Variant> {
  const img = await loadImage(blob);
  if (img.width * img.height > 64000000) throw new Error('La imagen supera 64 megapíxeles. Reducila antes de subirla.');
  const c = document.createElement('canvas'), scale = Math.min(1, 320 / img.width, 320 / img.height);
  c.width = Math.max(1, Math.round(img.width * scale)); c.height = Math.max(1, Math.round(img.height * scale));
  const ctx = c.getContext('2d', { willReadFrequently: true })!; ctx.drawImage(img, 0, 0, c.width, c.height);
  const pixels = ctx.getImageData(0, 0, c.width, c.height).data;
  const metrics = pixelMetrics(pixels, c.width, c.height), signature = imageSignature(pixels, c.width, c.height);
  const p = document.createElement('canvas'), ratio = Math.min(1, 1280 / img.width, 1280 / img.height);
  p.width = Math.max(1, Math.round(img.width * ratio)); p.height = Math.max(1, Math.round(img.height * ratio));
  const pc = p.getContext('2d')!; pc.fillStyle = '#fff'; pc.fillRect(0, 0, p.width, p.height); pc.drawImage(img, 0, 0, p.width, p.height);
  // Bound the working copy to the upload service limit, even for noisy inputs.
  let quality = .88, src = p.toDataURL('image/jpeg', quality);
  while (src.length > 1900000 && quality > .4) { quality -= .12; src = p.toDataURL('image/jpeg', quality); }
  if (src.length > 1900000) throw new Error('La copia sigue siendo muy pesada. Reducí la imagen e intentá otra vez.');
  return { id: newId(), name: name.slice(0, 120), src, width: img.width, height: img.height, metrics, signature, originalBytes: blob.size, originalType: blob.type };
}
const clean = (v: unknown, max = 1500) => typeof v === 'string' ? v.slice(0, max) : '';
export function normalizeProject(raw: any): Project {
  if (!raw || !Array.isArray(raw.variants) || raw.variants.length > 6) throw new Error('Proyecto incompatible.');
  const base = createProject();
  base.id = /^[\w-]{10,80}$/.test(raw.id) ? raw.id : base.id;
  base.name = clean(raw.name, 120) || base.name; base.context = clean(raw.context);
  base.variants = raw.variants.map((v: any) => {
    if (!v || typeof v.id !== 'string' || !v.metrics || !Number.isFinite(v.width) || !Number.isFinite(v.height)) throw new Error('Imagen incompatible.');
    const src = typeof v.src === 'string' && (/^data:image\/(png|jpeg|webp);base64,/.test(v.src) || /^\/api\/images\/[\w-]+$/.test(v.src)) ? v.src : '';
    if (!src && !v.imageKey) throw new Error('Falta una imagen.');
    let analysis: Analysis | undefined;
    if (v.analysis) try { analysis = parseAnalysis({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(v.analysis) }] }] }); } catch { /* old incomplete result */ }
    const signature = v.signature?.grid?.length === 288 ? v.signature : undefined;
    return { ...v, id: clean(v.id, 80), name: clean(v.name, 120) || 'Miniatura', src, analysis, analysisContext: clean(v.analysisContext ?? raw.context), analysisCreatedAt: clean(v.analysisCreatedAt, 40), signature };
  });
  for (const key of Object.keys(initialExperiment) as (keyof Experiment)[]) base.experiment[key] = clean(raw.experiment?.[key]);
  if (!['observational', 'randomized'].includes(base.experiment.design)) base.experiment.design = 'observational';
  for (const key of ['mechanic', 'subject', 'style'] as const) base.brief[key] = clean(raw.brief?.[key], 200) || base.brief[key];
  const ids = new Set(base.variants.map(v => v.id));
  base.predictions = (Array.isArray(raw.predictions) ? raw.predictions : []).slice(-100).filter((p: any) => p && ids.has(p.variantA) && ids.has(p.variantB) && p.variantA !== p.variantB && ['A', 'B', 'tie'].includes(p.recommendation) && ['manual', 'ai'].includes(p.source)).map((p: any) => {
    let comparison: Comparison | undefined; if (p.comparison) try { comparison = validateComparison(p.comparison); } catch { /* discard malformed result */ }
    return { id: clean(p.id, 80), variantA: p.variantA, variantB: p.variantB, createdAt: clean(p.createdAt, 40), context: clean(p.context), recommendation: p.recommendation, source: p.source, reason: clean(p.reason), comparison, jobId: clean(p.jobId, 80), model: clean(p.model, 100) };
  });
  base.epicRecords = (Array.isArray(raw.epicRecords) ? raw.epicRecords : []).slice(-100).filter((r: any) => r && ids.has(r.variantId) && ['clear', 'similarity', 'content', 'blocked'].includes(r.status)).map((r: any) => ({ id: clean(r.id, 80), variantId: r.variantId, status: r.status, checkedAt: clean(r.checkedAt, 40), createdAt: clean(r.createdAt, 40), island: clean(r.island, 120), notes: clean(r.notes) }));
  base.abRecords = (Array.isArray(raw.abRecords) ? raw.abRecords : []).slice(-100).filter((r: any) => r?.experiment && ids.has(r.experiment.variantA) && ids.has(r.experiment.variantB) && r.experiment.variantA !== r.experiment.variantB).map((r: any) => {
    const experiment = { ...initialExperiment }; for (const k of Object.keys(experiment) as (keyof Experiment)[]) experiment[k] = clean(r.experiment[k]);
    return { id: clean(r.id, 80), createdAt: clean(r.createdAt, 40), experiment, predictionId: clean(r.predictionId, 80) };
  });
  return base;
}

export function variantIsRecorded(p: Project, id: string) {
  return p.predictions.some(r => r.variantA === id || r.variantB === id) || p.epicRecords.some(r => r.variantId === id) || p.abRecords.some(r => r.experiment.variantA === id || r.experiment.variantB === id);
}

// A draft is local to this browser; it is never presented as a cloud save.
let dbPromise: Promise<IDBDatabase> | undefined;
function draftDb() {
  if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
    const r = indexedDB.open('thumbnail-insights-v2', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('drafts', { keyPath: 'id' }); r.result.createObjectStore('settings'); };
    r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
  }); return dbPromise;
}
export async function saveDraft(project: Project) {
  const db = await draftDb(); return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['drafts', 'settings'], 'readwrite');
    tx.objectStore('drafts').put({ id: project.id, name: project.name, updated: Date.now(), project }); tx.objectStore('settings').put(project.id, 'last');
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
  });
}
export async function listDrafts(): Promise<{ id: string; name: string; updated: number; project: Project }[]> {
  const db = await draftDb(); return new Promise((resolve, reject) => { const r = db.transaction('drafts').objectStore('drafts').getAll(); r.onsuccess = () => resolve(r.result.sort((a: any, b: any) => b.updated - a.updated)); r.onerror = () => reject(r.error); });
}
export async function lastDraft(): Promise<Project | null> {
  const db = await draftDb(); const id: string = await new Promise((resolve, reject) => { const r = db.transaction('settings').objectStore('settings').get('last'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
  if (!id) return null;
  return new Promise((resolve, reject) => { const r = db.transaction('drafts').objectStore('drafts').get(id); r.onsuccess = () => resolve(r.result ? normalizeProject(r.result.project) : null); r.onerror = () => reject(r.error); });
}
