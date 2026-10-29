'use client';
import { useEffect, useRef, useState } from 'react';
import { Activity, ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpRight, Check, CheckCircle2, ChevronDown, Clipboard, Columns2, Download, ExternalLink, FileImage, Folder, History, Home as HomeIcon, ImagePlus, Info, Lightbulb, Loader2, Plus, Save, ScanLine, Search, ShieldCheck, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { compareRates, parseExperimentCsv } from '@/lib/core';
import { technicalChecks, visualDifference, predictionTiming } from '@/lib/comparison';
import { api, blobData, createProject, downloadFile, initialExperiment, lastDraft, listDrafts, makeVariant, newId, normalizeProject, pct, prettyDate, saveDraft, validDate, variantIsRecorded, type ABRecord, type EpicRecord, type Experiment, type Prediction, type Project, type Variant } from '@/lib/studio';
import { demoSvg, demoBSvg } from '@/lib/demo';
import { CompareCanvas, Dropzone, EmptyState, ImageStage, LocalReview, MetricsDetails, ZoomViewer } from './studio-ui';

const tasks = [
  { id: 'compare', title: 'Elegir entre dos', description: 'Compará variantes y decidí qué probar.', icon: Columns2, tag: 'A / B', verb: 'Comparar' },
  { id: 'analyze', title: 'Mejorar una miniatura', description: 'Encontrá el próximo cambio importante.', icon: ScanLine, tag: 'FOCO', verb: 'Revisar' },
  { id: 'check', title: 'Revisar antes de publicar', description: 'Formato, referencias y avisos de Epic.', icon: ShieldCheck, tag: 'PREVIO', verb: 'Comprobar' },
  { id: 'concept', title: 'Explorar una idea', description: 'Convertí tu mecánica en una composición.', icon: Lightbulb, tag: 'IDEAS', verb: 'Explorar' },
];
const epicLabels = { clear: 'Sin advertencia', similarity: 'Advertencia de similitud', content: 'Advertencia de contenido', blocked: 'Bloqueado' };
const sampleImage = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(demoSvg);
const sampleB = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(demoBSvg);

export default function Studio() {
  const [project, setProject] = useState<Project | null>(null);
  const [tab, setTab] = useState('home'), [selected, setSelected] = useState(0), [compareIndex, setCompareIndex] = useState(1);
  const [status, setStatus] = useState({ aiConfigured: false, storageConfigured: false }), [statusKnown, setStatusKnown] = useState(false);
  const [busy, setBusy] = useState(''), [toast, setToast] = useState(''), [modal, setModal] = useState('');
  const [draftState, setDraftState] = useState('loading'), [cloudSaved, setCloudSaved] = useState(false);
  const [locals, setLocals] = useState<any[]>([]), [cloud, setCloud] = useState<any[]>([]), [cloudError, setCloudError] = useState('');
  const [url, setUrl] = useState(''), [search, setSearch] = useState('');
  const [manualChoice, setManualChoice] = useState<'A' | 'B' | 'tie'>('tie'), [manualReason, setManualReason] = useState('');
  const [epicStatus, setEpicStatus] = useState<EpicRecord['status']>('similarity'), [epicNotes, setEpicNotes] = useState(''), [island, setIsland] = useState(''), [checkedDate, setCheckedDate] = useState('');
  const [concepts, setConcepts] = useState(false), [referenceIndex, setReferenceIndex] = useState(1), [predictionLink, setPredictionLink] = useState('');
  const operation = useRef(false), uploadTarget = useRef('any'), fileInput = useRef<HTMLInputElement>(null), importInput = useRef<HTMLInputElement>(null), csvInput = useRef<HTMLInputElement>(null), lastFocus = useRef<HTMLElement | null>(null);
  const variants = project?.variants || [], v = variants[selected], b = variants[compareIndex];
  const visibleAnalysis = v?.analysis && v.analysisContext === project?.context ? v.analysis : undefined;
  const pairReady = !!v && !!b && v.id !== b.id;
  const currentAI = project?.predictions.slice().reverse().find(p => p.source === 'ai' && p.variantA === v?.id && p.variantB === b?.id && p.context === project.context);
  const activeTask = tasks.find(t => t.id === tab);
  const notice = (message: string) => setToast(message);
  const edit = (patch: Partial<Project>) => { setProject(p => p ? { ...p, ...patch } : p); setCloudSaved(false); };

  useEffect(() => {
    let live = true;
    lastDraft().then(p => { if (live) { setProject(p || createProject()); setDraftState('saved'); } }).catch(() => { if (live) { setProject(createProject()); setDraftState('error'); } });
    api('/api/status').then(s => { if (live) setStatus(s); }).catch(() => {}).finally(() => { if (live) setStatusKnown(true); });
    setCheckedDate(new Date().toLocaleDateString('en-CA'));
    return () => { live = false; };
  }, []);
  useEffect(() => {
    if (!project) return;
    let current = true; setDraftState('saving');
    const t = setTimeout(() => { saveDraft(project).then(() => { if (current) setDraftState('saved'); }).catch(() => { if (current) setDraftState('error'); }); }, 300);
    return () => { current = false; clearTimeout(t); };
  }, [project]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 6500); return () => clearTimeout(t); }, [toast]);
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => { if (draftState === 'saving' || draftState === 'error' || busy) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', before); return () => window.removeEventListener('beforeunload', before);
  }, [draftState, busy]);
  useEffect(() => {
    const paste = (e: ClipboardEvent) => { if (modal || !['analyze', 'compare', 'check'].includes(tab) || operation.current) return; const f = Array.from(e.clipboardData?.files || []).find(x => x.type.startsWith('image/')); if (f) { e.preventDefault(); void addFile(f); } };
    window.addEventListener('paste', paste); return () => window.removeEventListener('paste', paste);
  });
  useEffect(() => {
    if (!modal) { lastFocus.current?.focus(); return; }
    lastFocus.current = document.activeElement as HTMLElement;
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape' && !operation.current) setModal(''); };
    document.addEventListener('keydown', close); return () => document.removeEventListener('keydown', close);
  }, [modal]);

  function navigate(next: string) { setTab(next); window.scrollTo({ top: 0, behavior: 'instant' }); }
  function pick(target = 'any') { uploadTarget.current = target; fileInput.current?.click(); }
  async function addFile(file: Blob, name?: string, target = uploadTarget.current) {
    if (operation.current) return;
    if (variants.length >= 6) return notice('Máximo seis versiones por proyecto. Podés crear otro proyecto.');
    if (file.size > 10 * 1024 * 1024) return notice('Elegí un archivo de hasta 10 MB.');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return notice('Elegí PNG, JPG o WebP.');
    operation.current = true; setBusy('Preparando imagen');
    try { const item = await makeVariant(file, name || (file as File).name || 'Miniatura'); edit({ variants: [...variants, item] });
      if (target === 'B') setCompareIndex(variants.length); else if (target === 'reference') setReferenceIndex(variants.length); else setSelected(variants.length);
      if (target === 'A' && variants.length === 0) setCompareIndex(1);
      setModal(''); notice('Imagen lista.');
    } catch (e) { notice((e as Error).message); } finally { operation.current = false; setBusy(''); uploadTarget.current = 'any'; }
  }
  async function demo(pair = false) {
    if (operation.current) return;
    if (variants.length + (pair ? 2 : 1) > 6) return notice('Creá otro proyecto para cargar los ejemplos.');
    operation.current = true; setBusy('Preparando ejemplo');
    try {
      const a = await makeVariant(new Blob([demoSvg], { type: 'image/svg+xml' }), 'VOLT RUN · original');
      const added = [a]; if (pair) added.push(await makeVariant(new Blob([demoBSvg], { type: 'image/svg+xml' }), 'VOLT RUN · variante'));
      edit({ variants: [...variants, ...added] }); setSelected(variants.length); if (pair) { setCompareIndex(variants.length + 1); setReferenceIndex(variants.length + 1); navigate('compare'); }
      notice('Ejemplo cargado. No contiene resultados ni recomendaciones simuladas.');
    } catch (e) { notice((e as Error).message); } finally { operation.current = false; setBusy(''); }
  }
  async function persisted(p: Project) {
    const out: Variant[] = [];
    for (const item of p.variants) {
      if (item.imageKey) { out.push(item); continue; }
      const blob = await (await fetch(item.src)).blob();
      const r = await api('/api/images/' + item.id, { method: 'POST', headers: { 'Content-Type': blob.type }, body: blob });
      out.push({ ...item, imageKey: r.imageKey });
    }
    const saved = { ...p, variants: out };
    await api('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...saved, variants: out.map(({ src, ...rest }) => rest) }) });
    return saved;
  }
  async function save() {
    if (!project || operation.current) return; operation.current = true; setBusy('Guardando proyecto');
    try { setProject(await persisted(project)); setCloudSaved(true); notice('Proyecto guardado en tu cuenta.'); } catch (e) { notice((e as Error).message + ' Tu borrador local sigue disponible.'); } finally { operation.current = false; setBusy(''); }
  }
  async function projectList() {
    setModal('projects'); setCloudError('');
    try { setLocals(await listDrafts()); } catch { setLocals([]); }
    try { const r = await api('/api/projects'); setCloud(r.projects); } catch (e) { setCloudError((e as Error).message); }
  }
  async function openProject(id: string, local: boolean) {
    if (operation.current) return; operation.current = true; setBusy('Abriendo proyecto');
    try {
      if (project) await saveDraft(project);
      let p: Project;
      if (local) { const item = (await listDrafts()).find(x => x.id === id); if (!item) throw new Error('No encontramos ese borrador.'); p = normalizeProject(item.project); }
      else {
        p = normalizeProject(await api('/api/projects?id=' + encodeURIComponent(id)));
        p.variants = await Promise.all(p.variants.map(async item => {
          const src = '/api/images/' + item.imageKey!.split('/').pop();
          const r = await fetch(src); if (!r.ok) throw new Error('No pudimos recuperar una imagen del proyecto.');
          const fresh = await makeVariant(await r.blob(), item.name);
          return { ...item, src: fresh.src, signature: fresh.signature, metrics: fresh.metrics };
        }));
      }
      setProject(p); setSelected(0); setCompareIndex(1); setReferenceIndex(1); setCloudSaved(!local); setModal(''); setConcepts(false); setPredictionLink(''); navigate('analyze'); notice('Proyecto abierto.');
    } catch (e) { notice((e as Error).message); } finally { operation.current = false; setBusy(''); }
  }
  async function newProject() {
    if (operation.current) return;
    try { if (project) await saveDraft(project); } catch { notice('No se pudo conservar el borrador. Exportá una copia antes de crear otro.'); return; }
    setProject(createProject()); setSelected(0); setCompareIndex(1); setReferenceIndex(1); setCloudSaved(false); setConcepts(false); setPredictionLink(''); navigate('home'); setModal('');
  }
  async function exportProject() {
    if (!project || operation.current) return; operation.current = true; setBusy('Preparando copia');
    try {
      const out = await Promise.all(variants.map(async item => ({ ...item, src: await blobData(await (await fetch(item.src)).blob()), imageKey: undefined })));
      downloadFile('thumbnail-insights-proyecto.json', JSON.stringify({ format: 'thumbnail-insights-v2', project: { ...project, variants: out } }, null, 2));
      notice('Copia exportada. Incluye imágenes de trabajo y registros.');
    } catch { notice('No pudimos exportar. Volvé a intentar.'); } finally { operation.current = false; setBusy(''); }
  }
  async function importProject(file?: File) {
    if (!file || operation.current) return; operation.current = true; setBusy('Importando copia');
    try {
      if (file.size > 16000000) throw new Error('La copia supera 16 MB.');
      const raw = JSON.parse(await file.text()); if (!['thumbnail-insights-v1', 'thumbnail-insights-v2'].includes(raw.format)) throw new Error('Esta copia no es compatible.');
      const p = normalizeProject(raw.project), mapping: Record<string, string> = {};
      const items: Variant[] = [];
      for (const item of p.variants) {
        if (!/^data:image\/(png|jpeg|webp);base64,/.test(item.src)) throw new Error('La copia debe incluir sus imágenes.');
        const fresh = await makeVariant(await (await fetch(item.src)).blob(), item.name); mapping[item.id] = fresh.id;
        items.push({ ...fresh, width: item.width, height: item.height, analysis: item.analysis, analysisContext: item.analysisContext, analysisCreatedAt: item.analysisCreatedAt, originalBytes: item.originalBytes, originalType: item.originalType });
      }
      const remapExp = (e: Experiment) => ({ ...e, variantA: mapping[e.variantA] || '', variantB: mapping[e.variantB] || '' });
      const copy: Project = { ...p, id: newId(), variants: items, experiment: remapExp(p.experiment), predictions: p.predictions.map(r => ({ ...r, variantA: mapping[r.variantA], variantB: mapping[r.variantB] })), epicRecords: p.epicRecords.map(r => ({ ...r, variantId: mapping[r.variantId] })), abRecords: p.abRecords.map(r => ({ ...r, experiment: remapExp(r.experiment) })) };
      if (project) await saveDraft(project); setProject(copy); setSelected(0); setCompareIndex(1); setReferenceIndex(1); setCloudSaved(false); setModal(''); navigate('analyze'); notice('Copia restaurada. Las métricas se recalcularon.');
    } catch (e) { notice((e as Error).message || 'No pudimos leer la copia.'); } finally { operation.current = false; setBusy(''); }
  }
  async function byUrl(e: React.FormEvent) {
    e.preventDefault();
    try { const parsed = new URL(url); if (parsed.protocol !== 'https:') throw new Error(); const r = await fetch(parsed.href, { credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(12000) }); if (!r.ok) throw new Error(); await addFile(await r.blob(), 'Imagen desde URL'); }
    catch { notice('El enlace no permite leer la imagen. Descargala y subila como archivo.'); }
  }
  async function runAI(pair: boolean) {
    if (!project || !v || operation.current || (pair && !pairReady)) return;
    operation.current = true; setBusy(pair ? 'Comparando las dos miniaturas' : 'Revisando tu miniatura');
    try {
      const p = await persisted(project); setProject(p); setCloudSaved(true);
      const r = await api(pair ? '/api/compare' : '/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pair ? { imageKeys: [p.variants[selected].imageKey, p.variants[compareIndex].imageKey], context: p.context } : { imageKey: p.variants[selected].imageKey, context: p.context }) });
      let done: Project;
      if (pair) {
        if (p.predictions.some(x => x.jobId === r.jobId)) { notice('Abrimos la comparación guardada, sin otra solicitud.'); return; }
        const prediction: Prediction = { id: newId(), createdAt: r.createdAt, variantA: v.id, variantB: b.id, context: p.context, recommendation: r.comparison.recommendation, source: 'ai', reason: r.comparison.summary, comparison: r.comparison, jobId: r.jobId, model: r.model };
        done = { ...p, predictions: [...p.predictions, prediction] };
      } else done = { ...p, variants: p.variants.map(item => item.id === v.id ? { ...item, analysis: r.analysis, analysisContext: p.context, analysisCreatedAt: r.createdAt, usage: r.usage } : item) };
      setProject(done); setCloudSaved(false); await saveDraft(done); await persisted(done); setCloudSaved(true);
      notice(r.cached ? 'Resultado recuperado, sin una nueva llamada.' : 'Resultado guardado. Podés revisarlo en tu historial.');
    } catch (e) { notice((e as Error).message); } finally { operation.current = false; setBusy(''); }
  }
  function removeVariant() {
    if (!project || !v) return;
    if (variantIsRecorded(project, v.id)) return notice('Esta imagen tiene registros asociados. Se conserva para no perder su historial.');
    edit({ variants: variants.filter(x => x.id !== v.id), experiment: { ...project.experiment, variantA: project.experiment.variantA === v.id ? '' : project.experiment.variantA, variantB: project.experiment.variantB === v.id ? '' : project.experiment.variantB } }); setSelected(0); setCompareIndex(1); setReferenceIndex(1);
  }
  function recordPreference() {
    if (!project || !pairReady || !manualReason.trim()) return;
    if (project.predictions.length >= 100) return notice('Este proyecto llegó a 100 decisiones. Exportalo y continuá en otro.');
    const r: Prediction = { id: newId(), createdAt: new Date().toISOString(), variantA: v.id, variantB: b.id, context: project.context, recommendation: manualChoice, source: 'manual', reason: manualReason.trim() };
    edit({ predictions: [...project.predictions, r] }); setManualReason(''); notice('Tu elección quedó registrada con fecha. No es una predicción de IA.');
  }
  function prepareExperiment(p?: Prediction) {
    if (!project || !pairReady) return;
    edit({ experiment: { ...initialExperiment, hypothesis: p?.comparison?.hypothesis || p?.reason || '', variantA: v.id, variantB: b.id } }); setPredictionLink(p?.id || ''); navigate('experiment');
  }
  function expChange(patch: Partial<Experiment>) { if (project) edit({ experiment: { ...project.experiment, ...patch } }); }
  async function importCsv(file?: File) {
    if (!file) return;
    try { if (file.size > 200000) throw new Error('El CSV supera el tamaño admitido.'); const rows = parseExperimentCsv(await file.text()); expChange({ aImpressions: String(rows[0].impressions), aClicks: String(rows[0].clicks), bImpressions: String(rows[1].impressions), bClicks: String(rows[1].clicks) }); notice('Conteos importados. Revisá la fuente y las fechas.'); } catch (e) { notice((e as Error).message); }
  }
  function recordEpic(e: React.FormEvent) {
    e.preventDefault(); if (!project || !v || !island.trim() || !validDate(checkedDate)) return;
    if (project.epicRecords.length >= 100) return notice('Máximo 100 chequeos por proyecto. Exportá y continuá en otro.');
    const r: EpicRecord = { id: newId(), variantId: v.id, status: epicStatus, checkedAt: checkedDate, createdAt: new Date().toISOString(), island: island.trim(), notes: epicNotes.trim() };
    edit({ epicRecords: [...project.epicRecords, r] }); setEpicNotes(''); notice('Resultado de Epic registrado como dato informado por vos.');
  }
  if (!project) return <div className="loading-screen"><span className="brand-mark">t<span>i</span></span><Loader2 className="spin" /><p>Abriendo tu estudio…</p></div>;

  const experiment = project.experiment;
  let result: ReturnType<typeof compareRates> | null = null, experimentError = '';
  const counts = [experiment.aClicks, experiment.aImpressions, experiment.bClicks, experiment.bImpressions];
  if (counts.some(Boolean)) try {
    if (counts.some(x => !/^\d+$/.test(x))) throw new Error('Completá los cuatro conteos con números enteros.');
    result = compareRates({ clicks: +experiment.aClicks, impressions: +experiment.aImpressions }, { clicks: +experiment.bClicks, impressions: +experiment.bImpressions });
  } catch (e) { experimentError = (e as Error).message; }
  const reportReady = !!result && !!experiment.hypothesis.trim() && !!experiment.source.trim() && validDate(experiment.start) && validDate(experiment.end) && experiment.start <= experiment.end && !!experiment.variantA && !!experiment.variantB && experiment.variantA !== experiment.variantB;
  const matchingPredictions = project.predictions.filter(p => p.variantA === experiment.variantA && p.variantB === experiment.variantB);
  const checks = v ? technicalChecks(v) : [];
  const ref = variants[referenceIndex];
  let diff: ReturnType<typeof visualDifference> | null = null;
  if (v?.signature && ref?.signature && v.id !== ref.id) try { diff = visualDifference(v.signature, ref.signature); } catch { /* Legacy image, no valid signature */ }
  const nameFor = (id: string) => variants.find(x => x.id === id)?.name || 'Imagen archivada';
  const totalRecords = project.predictions.length + project.epicRecords.length + project.abRecords.length;
  const aiNote = !statusKnown ? 'Comprobando disponibilidad…' : status.aiConfigured ? 'Una consulta con IA usa saldo. Se envían las imágenes al analizar.' : 'IA pendiente de conexión. Las herramientas visuales ya están disponibles.';
  function recordAB() {
    if (!reportReady || !project) return;
    if (project.abRecords.length >= 100) return notice('Máximo 100 resultados por proyecto.');
    const linked = matchingPredictions.find(p => p.id === predictionLink);
    const r: ABRecord = { id: newId(), createdAt: new Date().toISOString(), experiment: { ...experiment }, ...(linked ? { predictionId: linked.id } : {}) };
    edit({ abRecords: [...project.abRecords, r] }); notice('Resultado registrado. Se conserva la decisión original.'); navigate('history');
  }
  return <div className="app-shell">
    <header className="site-header"><button className="brand" disabled={!!busy} onClick={() => navigate('home')} aria-label="Thumbnail Insights, inicio"><span className="brand-mark">t<span>i</span></span><span>thumbnail<span className="brand-light">insights</span><i>STUDIO / 03</i></span></button>
      <nav className="top-nav" aria-label="Navegación principal"><a className="discover-nav-link" href="/discover">Discover Lab ↗</a><button aria-label="Inicio" disabled={!!busy} className={tab === 'home' ? 'active' : ''} onClick={() => navigate('home')}><HomeIcon size={16} /><span>Inicio</span></button><button aria-label="Proyectos" disabled={!!busy} onClick={projectList}><Folder size={16} /><span>Proyectos</span></button><button aria-label="Registro" disabled={!!busy} className={tab === 'history' ? 'active' : ''} onClick={() => navigate('history')}><History size={16} /><span>Registro</span>{totalRecords > 0 && <b>{totalRecords}</b>}</button></nav>
      <button aria-label="Nuevo proyecto" className="new-project" disabled={!!busy} onClick={newProject}><Plus size={17} /><span>Nuevo proyecto</span></button>
    </header>
    <main className={tab === 'home' ? 'home-main' : 'workspace-main'}>
      {tab === 'home' ? <div className="page-enter">
        <section className="hero"><div className="hero-copy"><span className="section-label"><i className="status-dot" /> TU ESTUDIO PARA MINIATURAS UEFN</span><h1>Tu próxima isla.<br />En <em>contexto.</em></h1><p>Probá tus diseños dentro de Discover.<br />Horizontal, portrait y ficha de isla.</p><a className="primary discover-hero-link" href="/discover">Abrir Discover Lab <ArrowRight size={19} /></a><button className="hero-demo" disabled={!!busy} onClick={() => demo(true)}>Explorar con un ejemplo <ArrowUpRight size={16} /></button></div>
          <div className="hero-art" aria-hidden="true"><div className="orbital-ring" /><div className="crosshair c-one" /><div className="crosshair c-two" /><span className="hero-coordinate">CREATOR VIEW / 16:9</span><div className="hero-thumb back"><img src={sampleImage} alt="" /><span>A</span></div><div className="hero-thumb front"><img src={sampleB} alt="" /><span>B</span></div><div className="art-caption"><span className="tiny-squares"><i /><i /><i /></span> EL CAMBIO ESTÁ EN LOS DETALLES <ArrowUpRight size={17} /></div></div>
        </section>
        <section className="task-section"><div className="section-heading"><h2>¿Qué querés resolver?</h2><span>Elegí una tarea para empezar.</span></div><div className="task-grid">{tasks.map((task, i) => <button key={task.id} disabled={!!busy} onClick={() => navigate(task.id)} className={'task-card task-' + i}><div className="task-card-top"><task.icon size={26} strokeWidth={1.5} /><span>{task.tag}</span></div><h3>{task.title}</h3><p>{task.description}</p><span className="task-card-action">{task.verb}<ArrowUpRight size={20} /></span></button>)}</div></section>
        {!!variants.length && <section className="resume-bar"><div className="resume-thumbnails">{variants.slice(0, 2).map(x => <img src={x.src} alt="" key={x.id} />)}</div><div><span>RETOMÁ DONDE QUEDASTE</span><strong>{project.name}</strong><p>{variants.length} {variants.length === 1 ? 'miniatura' : 'miniaturas'} · {totalRecords} registros</p></div><button className="secondary" disabled={!!busy} onClick={() => navigate('analyze')}>Continuar proyecto <ArrowRight size={17} /></button></section>}
        <div className="home-footnote"><span>Imágenes primero. Detalles cuando los necesitás.</span><button className="text-button" onClick={() => setModal('guide')}>Qué puede hacer el estudio <ArrowUpRight size={16} /></button></div>
      </div> : <>
        <div className="workspace-heading"><button className="back-button" disabled={!!busy} onClick={() => navigate('home')} aria-label="Volver al inicio"><ArrowLeft size={21} /></button><div><span className="section-label">{activeTask ? 'ESTUDIO / ' + activeTask.tag : 'ESTUDIO / EVIDENCIA'}</span><h1>{activeTask?.title || (tab === 'history' ? 'Cada prueba, en contexto.' : 'Registrar resultados A/B')}</h1></div><button aria-label="Ayuda" className="quiet-button help-button" onClick={() => setModal('guide')}><Info size={18} /><span>Ayuda</span></button></div>
        <div className="workspace-tabs" aria-label="Herramientas">{tasks.map(t => <button key={t.id} disabled={!!busy} onClick={() => navigate(t.id)} className={tab === t.id ? 'active' : ''}><t.icon size={17} /><span>{t.id === 'analyze' ? 'Mejorar' : t.id === 'compare' ? 'Comparar' : t.id === 'check' ? 'Prepublicación' : 'Ideas'}</span></button>)}<button disabled={!!busy} onClick={() => navigate('experiment')} className={tab === 'experiment' ? 'active' : ''}><Activity size={17} /><span>Resultados A/B</span></button></div>
        <div className="project-bar"><div className="project-identity"><Folder size={17} /><input aria-label="Nombre del proyecto" value={project.name} maxLength={120} disabled={!!busy} onChange={e => edit({ name: e.target.value })} /><span className={'draft-status ' + (draftState === 'error' ? 'warning' : '')}>{cloudSaved ? <><Check size={14} /> Guardado en tu cuenta</> : draftState === 'saving' ? 'Conservando borrador…' : draftState === 'error' ? 'Borrador sin guardar' : <><Check size={14} /> Borrador en este navegador</>}</span></div><div className="project-actions"><button className="quiet-button" disabled={!!busy} onClick={exportProject} title="Exportar copia del proyecto"><Download size={17} /><span>Exportar</span></button><button className="secondary small" disabled={!!busy || !project.name.trim()} onClick={save}><Save size={16} /><span>Guardar en mi cuenta</span></button></div></div>
        {draftState === 'error' && <div className="inline-alert">No pudimos conservar los cambios en este navegador. Exportá una copia o guardá en tu cuenta.</div>}
        <fieldset className="workspace-fieldset" disabled={!!busy}><div key={tab} className="page-enter">
        {tab === 'analyze' && <>
          {!v ? <div className="upload-start"><div><span className="section-label">01 / TU IMAGEN</span><h2>Mostranos en qué estás trabajando.</h2><p>Subí una miniatura para revisar su lectura y encontrar el próximo cambio.</p><Dropzone onPick={() => pick()} onFile={f => addFile(f)} /><div className="upload-extras"><button className="text-button" onClick={() => demo()}>Probar con un ejemplo <ArrowRight size={16} /></button><button className="text-button" onClick={() => setModal('url')}>Usar un enlace</button></div></div><div className="upload-poster"><img src={sampleImage} alt="Ejemplo geométrico de una miniatura de parkour" /><span>EL FOCO. LA ACCIÓN. EL PRÓXIMO CLIC.</span></div></div> : <>
            <div className="studio-grid"><div><ImageStage key={v.id} variant={v} onExpand={() => setModal('image')} /><div className="variant-strip">{variants.map((item, i) => <button key={item.id} className={selected === i ? 'selected' : ''} onClick={() => setSelected(i)} title={item.name}><img src={item.src} alt={item.name} /><span>{String.fromCharCode(65 + i)}</span></button>)}<button className="add-variant" onClick={() => pick()} disabled={variants.length >= 6}><Plus size={20} /><span>Agregar</span></button></div><div className="variant-name"><label>Nombre de esta versión<input value={v.name} maxLength={120} onChange={e => edit({ variants: variants.map(x => x.id === v.id ? { ...x, name: e.target.value } : x) })} /></label><button className="quiet-button" title="Quitar esta versión" aria-label="Quitar esta versión" onClick={removeVariant}><Trash2 size={18} /></button></div><MetricsDetails variant={v} onNotice={notice} /></div>
              <aside className="review-column"><div className="ai-card"><div className="section-label"><Sparkles size={15} /> SEGUNDA MIRADA</div><h2>¿Qué debería entender el jugador?</h2><label className="sr-only" htmlFor="image-context">Mecánica o intención del mapa</label><textarea id="image-context" rows={3} placeholder="Ej.: lanzar piedras y llegar cada vez más lejos." value={project.context} maxLength={1500} onChange={e => edit({ context: e.target.value })} /><button className="primary full" disabled={!status.aiConfigured} onClick={() => runAI(false)}><Sparkles size={17} /> Encontrar mejoras</button><p className="fine-print">{aiNote}</p></div>
              {visibleAnalysis ? <div className="analysis-result"><span className="section-label">LECTURA CON IA</span><h2>Lo que comunica</h2><p>{visibleAnalysis.understanding}</p><div className="result-improvements">{visibleAnalysis.improvements.map((r, i) => <article key={i}><span>{String(i + 1).padStart(2, '0')}</span><div><h3>{r.title}</h3><p>{r.action}</p><details className="text-details"><summary>Por qué</summary><p>{r.reason}</p></details></div></article>)}</div><details className="text-details"><summary>Fortalezas y límites</summary>{visibleAnalysis.strengths.map((s, i) => <p key={i}>{s}</p>)}<p className="fine-print">{visibleAnalysis.limitations}</p></details><details className="text-details"><summary>Descripción editable y texto detectado</summary><textarea aria-label="Descripción editable" value={visibleAnalysis.caption} onChange={e => edit({ variants: variants.map(x => x.id === v.id ? { ...x, analysis: { ...visibleAnalysis!, caption: e.target.value } } : x) })} /><button className="text-button" onClick={() => navigator.clipboard.writeText(visibleAnalysis!.caption).then(() => notice('Descripción copiada.')).catch(() => notice('Seleccioná el texto para copiarlo.'))}><Clipboard size={15} /> Copiar descripción</button><p>Texto detectado: {visibleAnalysis.detected_text || 'No se identificó texto.'}</p></details></div> : <LocalReview variant={v} />}
              <button className="next-task" onClick={() => navigate('compare')}><Columns2 size={21} /><span>¿Ya tenés una alternativa?<b>Comparar versiones</b></span><ArrowRight size={19} /></button></aside></div>
          </>}
        </>}
        {tab === 'compare' && <>
          <div className="flow-intro"><div><span className="step-number">01</span><h2>Elegí las dos versiones</h2></div><p>El mismo mapa. Dos formas de contarlo.</p></div>
          <div className="pair-selectors">{(['A', 'B'] as const).map((letter, i) => { const item = i ? b : v; return <div key={letter} className={'pair-slot slot-' + letter}>{item ? <><span className="slot-letter">{letter}</span><img src={item.src} alt="" /><label><span>Variante {letter}</span><select aria-label={'Elegir variante ' + letter} value={i ? compareIndex : selected} onChange={e => i ? setCompareIndex(+e.target.value) : setSelected(+e.target.value)}>{variants.map((x, n) => <option key={x.id} value={n}>{x.name}</option>)}</select></label><button className="quiet-button" title={'Subir otra variante ' + letter} aria-label={'Subir otra variante ' + letter} onClick={() => pick(letter)} disabled={variants.length >= 6}><Upload size={18} /></button></> : <Dropzone compact letter={letter} label={'Subir variante ' + letter} onPick={() => pick(letter)} onFile={f => addFile(f, undefined, letter)} />}</div>; })}</div>
          {!variants.length && <button className="text-button demo-pair" onClick={() => demo(true)}>Probar con dos ejemplos <ArrowRight size={16} /></button>}
          {v && b && !pairReady && <div className="inline-alert">Elegiste la misma imagen en A y B. Cambiá una de las versiones.</div>}
          {pairReady && <><CompareCanvas key={v.id + b.id} a={v} b={b} /><section className="comparison-decision"><div className="decision-input"><div className="flow-intro"><div><span className="step-number">02</span><h2>Una recomendación, con motivos.</h2></div></div><label>¿Qué tiene que comunicar el mapa?<textarea placeholder="Ej.: superar tu récord de distancia lanzando piedras." value={project.context} maxLength={1500} rows={2} onChange={e => edit({ context: e.target.value })} /></label><button className="primary" disabled={!status.aiConfigured} onClick={() => runAI(true)}><Sparkles size={18} /> {currentAI ? 'Abrir comparación guardada' : 'Comparar con IA'}</button><p className="fine-print">{aiNote}</p><details className="text-details"><summary>Qué significa esta recomendación</summary><p>Es una preferencia visual argumentada para decidir qué probar. El CTR y la probabilidad de ganar requieren resultados reales y un modelo validado. Aquí no se inventan porcentajes.</p></details></div>
            <div className={'decision-output ' + (currentAI?.comparison ? 'has-result' : '')}>{currentAI?.comparison ? <><span className="section-label">RECOMENDACIÓN VISUAL · IA</span><h2>{currentAI.recommendation === 'tie' ? 'No hay una preferencia clara.' : `Probaría ${currentAI.recommendation} primero.`}</h2><p>{currentAI.comparison.summary}</p><div className="reason-list">{currentAI.comparison.reasons.map((r, i) => <details key={i} open={i === 0}><summary>{r.title}<ChevronDown size={16} /></summary><p><b>A</b> {r.a}</p><p><b>B</b> {r.b}</p></details>)}</div>{currentAI.comparison.improvements.map((r, i) => <p className="action-tip" key={i}><span>{r.variant}</span>{r.action}</p>)}<button className="secondary" onClick={() => prepareExperiment(currentAI)}>Preparar prueba A/B <ArrowRight size={17} /></button><p className="fine-print">{currentAI.comparison.limitations}</p></> : <><div className="decision-symbol"><Columns2 size={36} strokeWidth={1.3} /></div><h3>{status.aiConfigured ? 'Tu decisión empieza con una comparación.' : 'La mirada de IA está pendiente.'}</h3><p>{status.aiConfigured ? 'Vas a ver una recomendación y hasta tres motivos concretos.' : 'Podés explorar las diferencias y registrar tu propia elección mientras se conecta.'}</p><span className="neutral-tag">Sin CTR estimado</span></>}</div>
          </section><details className="details-panel"><summary><span><Clipboard size={18} /> Registrar mi elección antes del test</span><ChevronDown size={18} /></summary><div className="details-body manual-choice"><p>Conservá tu criterio y contrastalo después con el resultado de Epic.</p><div className="choice-options">{(['A', 'B', 'tie'] as const).map(c => <button key={c} className={manualChoice === c ? 'active' : ''} aria-pressed={manualChoice === c} onClick={() => setManualChoice(c)}>{c === 'tie' ? 'Sin preferencia' : 'Elegiría ' + c}</button>)}</div><label>¿Por qué?<input value={manualReason} maxLength={1000} onChange={e => setManualReason(e.target.value)} placeholder="Ej.: en B la acción se entiende mejor en pequeño." /></label><button className="secondary" disabled={!manualReason.trim()} onClick={recordPreference}><Check size={17} /> Guardar mi elección</button></div></details><div className="next-row"><span>¿Ya tenés impresiones y clics?</span><button className="text-button" onClick={() => prepareExperiment(currentAI)}>Cargar resultados A/B <ArrowRight size={17} /></button></div></>}
        </>}
        {tab === 'check' && <>
          {!v ? <div className="center-upload"><span className="section-label">ANTES DE CREATOR PORTAL</span><h2>Revisá tu miniatura antes de subirla.</h2><p>Empezá por el archivo. Después compará referencias y registrá el chequeo de Epic.</p><Dropzone onPick={() => pick()} onFile={f => addFile(f)} /></div> : <div className="studio-grid check-layout"><div><label className="image-select-label">Miniatura a revisar<select value={selected} onChange={e => setSelected(+e.target.value)}>{variants.map((x, i) => <option key={x.id} value={i}>{x.name}</option>)}</select></label><ImageStage key={v.id} variant={v} onExpand={() => setModal('image')} />
            <section className="reference-panel"><div className="section-heading"><div><span className="section-label">REFERENCIAS CONOCIDAS</span><h2>Buscá qué se repite.</h2></div><button className="quiet-button" disabled={variants.length >= 6} onClick={() => pick('reference')}><Plus size={17} /> Referencia</button></div><p>Compará con una versión anterior o una imagen que ya conozcas.</p>
              {variants.length > 1 ? <><label>Comparar con<select value={referenceIndex} onChange={e => setReferenceIndex(+e.target.value)}>{variants.map((x, i) => <option key={x.id} value={i}>{x.name}{x.id === v.id ? ' (misma imagen)' : ''}</option>)}</select></label>{ref && ref.id === v.id ? <p className="inline-alert">Elegí otra imagen como referencia.</p> : ref && <><div className="reference-pair"><figure><img src={v.src} alt={'A revisar: ' + v.name} /><figcaption>A revisar</figcaption></figure><figure><img src={ref.src} alt={'Referencia: ' + ref.name} /><figcaption>Referencia</figcaption></figure></div>{diff && <details className="text-details"><summary>Ver diferencias de color por zona</summary><div className="difference-grid" role="img" aria-label="Mapa aproximado de diferencias de color por zonas. Mayor intensidad indica mayor diferencia.">{diff.cells.map((d, i) => <span key={i} style={{ background: `rgba(62, 203, 255, ${.08 + d * .92})` }} />)}</div><p className="fine-print">Más luz = más diferencia en el color medio de esa zona. Es una cuadrícula de 12 × 8: no reconoce personajes, texto ni el criterio de Epic.</p></details>}<button className="text-button" onClick={() => { setCompareIndex(referenceIndex); navigate('compare'); }}>Abrir comparación completa <ArrowRight size={17} /></button></> }</> : <button className="secondary" onClick={() => pick('reference')}><ImagePlus size={17} /> Agregar una referencia</button>}
              <div className="scope-note"><Info size={17} /><p>Solo compara las referencias que cargás. No consulta el catálogo completo de Epic ni predice su aprobación.</p></div>
            </section></div><aside><section className="checklist-panel"><span className="section-label">CHEQUEO TÉCNICO / HORIZONTAL</span><h2>El archivo, en orden.</h2>{checks.map(c => <div className={'check-row ' + c.state} key={c.title}>{c.state === 'ok' ? <CheckCircle2 size={20} /> : <Info size={20} />}<div><h3>{c.title}</h3><p>{c.detail}</p></div><span>{c.state === 'ok' ? 'Listo' : c.state === 'review' ? 'Revisar' : 'Sin dato'}</span></div>)}<p className="fine-print">Revisa el archivo original, no la copia reducida del estudio. No evalúa contenido ni aprobación.</p><a className="text-button" href="https://dev.epicgames.com/documentation/fortnite/thumbnail-image-policies" target="_blank" rel="noreferrer">Consultar políticas de Epic <ExternalLink size={14} /></a></section>
            <form className="epic-form" onSubmit={recordEpic}><div className="section-label">RESULTADO DE CREATOR PORTAL</div><h2>¿Qué indicó Epic?</h2><p>Conservá el resultado de cada versión.</p><label>Resultado informado<select value={epicStatus} onChange={e => setEpicStatus(e.target.value as EpicRecord['status'])}>{Object.entries(epicLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><div className="form-grid"><label>Isla o proyecto<input required maxLength={120} placeholder="Nombre o código" value={island} onChange={e => setIsland(e.target.value)} /></label><label>Fecha · AAAA-MM-DD<input required placeholder="AAAA-MM-DD" maxLength={10} value={checkedDate} onChange={e => setCheckedDate(e.target.value)} /></label></div><label>Qué cambiaste o qué aviso apareció<textarea rows={3} maxLength={1500} placeholder="Ej.: cambié el encuadre; sigue mostrando similitud." value={epicNotes} onChange={e => setEpicNotes(e.target.value)} /></label><button className="primary full" disabled={!island.trim() || !validDate(checkedDate)}><Clipboard size={17} /> Registrar chequeo</button><p className="fine-print">Dato informado por vos. «Sin advertencia» no equivale a aprobación de moderación.</p></form></aside></div>}
        </>}
        {tab === 'concept' && <section className="concept-studio"><div className="concept-input"><span className="section-label">DE LA MECÁNICA A LA IMAGEN</span><h2>Una acción.<br />Una idea que se entiende.</h2><p>Definí lo esencial. Explorá tres estructuras de composición.</p><label>¿Qué hace el jugador?<input maxLength={200} placeholder="Lanza piedras y gana distancia" value={project.brief.mechanic} onChange={e => { edit({ brief: { ...project.brief, mechanic: e.target.value } }); setConcepts(false); }} /></label><label>Personaje u objeto principal<input maxLength={160} placeholder="Fishstick con una piedra" value={project.brief.subject} onChange={e => { edit({ brief: { ...project.brief, subject: e.target.value } }); setConcepts(false); }} /></label><label>Dirección visual<select value={project.brief.style} onChange={e => edit({ brief: { ...project.brief, style: e.target.value } })}><option>Cartoon limpio</option><option>3D competitivo</option><option>Tipográfico</option></select></label><button className="primary full" disabled={!project.brief.mechanic.trim()} onClick={() => setConcepts(true)}>Explorar composiciones <ArrowRight size={18} /></button><p className="fine-print">Guías visuales sin IA. La generación de imágenes llegará en otra etapa.</p></div><div className="concept-output">{concepts ? <><div className="concept-options">{[
          { title: 'La acción primero', text: `Dale el primer plano a ${project.brief.subject || 'tu protagonista'} y conectá su gesto con «${project.brief.mechanic}».`, detail: 'Sujeto grande · una diagonal · objetivo visible' },
          { title: 'El momento decisivo', text: `Mostrá a ${project.brief.subject || 'tu personaje'} justo antes del resultado. Dejá visible lo que está por pasar.`, detail: 'Acción incompleta · distancia clara · espacio' },
          { title: 'Una elección clara', text: `Planteá dos caminos de «${project.brief.mechanic}», si esa elección existe dentro del mapa.`, detail: 'Dos alternativas · un foco · contraste' },
        ].map((c, i) => <article key={i}><div className={'composition-sketch sketch-' + i} aria-label={'Esquema de ' + c.title}><span className="sketch-subject" /><span className="sketch-target" /><span className="sketch-path" /><span className="sketch-label">ESQUEMA {String(i + 1).padStart(2, '0')}</span></div><h3>{c.title}</h3><p>{c.text}</p><span className="fine-print">{c.detail}</span><button className="text-button" onClick={() => { edit({ context: `${project.brief.mechanic}. ${c.text} Dirección visual: ${project.brief.style}.` }); navigate('analyze'); notice('Idea llevada al contexto de tu miniatura.'); }}>Trabajar esta idea <ArrowRight size={16} /></button></article>)}</div><div className="concept-footer"><span>{project.brief.style}</span><button className="secondary" onClick={() => downloadFile('brief-thumbnail-insights.txt', `${project.name}\nMecánica: ${project.brief.mechanic}\nProtagonista: ${project.brief.subject}\nDirección: ${project.brief.style}\n\nEstructuras sugeridas:\n1. La acción primero: sujeto grande, diagonal y objetivo visible.\n2. El momento decisivo: mostrar el instante previo al resultado.\n3. Una elección clara: dos alternativas, solo si existen en el mapa.\n\nGuías de composición deterministas, sin generación de imágenes.`, 'text/plain;charset=utf-8')}><Download size={16} /> Descargar brief</button></div></> : <div className="concept-waiting"><div className="abstract-frame"><span /><span /><span /></div><h3>Todo empieza con un foco.</h3><p>Completá la mecánica para explorar las tres composiciones.</p></div>}</div></section>}
        {tab === 'experiment' && <div className="experiment-layout"><section className="form-panel"><div className="section-heading"><div><span className="section-label">DATOS DE TU TEST</span><h2>Traé el resultado real.</h2></div><button className="quiet-button" onClick={() => csvInput.current?.click()}><Upload size={17} /> Importar CSV</button></div><p className="muted">Cargá los conteos de Creator Portal. Los cálculos se actualizan al escribir.</p><div className="ab-counts">{(['a', 'b'] as const).map((letter, i) => <div className={'ab-count-card count-' + letter} key={letter}><label><span className="count-variant">{letter.toUpperCase()} <span>Miniatura</span></span><select aria-label={'Imagen del resultado ' + letter.toUpperCase()} value={i ? experiment.variantB : experiment.variantA} onChange={e => expChange(i ? { variantB: e.target.value } : { variantA: e.target.value })}><option value="">Elegir una versión</option>{variants.map(x => <option value={x.id} key={x.id}>{x.name}</option>)}</select></label><label>Impresiones<input aria-label={'Impresiones ' + letter.toUpperCase()} inputMode="numeric" value={i ? experiment.bImpressions : experiment.aImpressions} onChange={e => expChange(i ? { bImpressions: e.target.value } : { aImpressions: e.target.value })} placeholder="10000" /></label><label>Clics<input aria-label={'Clics ' + letter.toUpperCase()} inputMode="numeric" value={i ? experiment.bClicks : experiment.aClicks} onChange={e => expChange(i ? { bClicks: e.target.value } : { aClicks: e.target.value })} placeholder="150" /></label></div>)}</div>{experimentError && <p className="error-text" role="alert">{experimentError}</p>}{experiment.variantA && experiment.variantA === experiment.variantB && <p className="error-text">Elegí dos versiones distintas.</p>}
          <details className="text-details"><summary>Plantilla de importación</summary><p>CSV propio de dos filas A/B; no hay conexión automática con Epic.</p><button className="text-button" onClick={() => downloadFile('plantilla-ab-ejemplo.csv', 'variante,impresiones,clics\nA,10000,150\nB,10000,180\n', 'text/csv;charset=utf-8')}><Download size={16} /> Descargar plantilla con datos de ejemplo</button></details>
          <div className="form-divider" /><h3>Contexto para guardar el resultado</h3><label>¿Qué estabas probando?<input maxLength={1500} placeholder="Ej.: agrandar el personaje mejora la lectura." value={experiment.hypothesis} onChange={e => expChange({ hypothesis: e.target.value })} /></label><div className="form-grid"><label>Fuente<input placeholder="Creator Portal · nombre del reporte" maxLength={200} value={experiment.source} onChange={e => expChange({ source: e.target.value })} /></label><label>Tipo de comparación<select value={experiment.design} onChange={e => expChange({ design: e.target.value })}><option value="randomized">A/B simultáneo informado</option><option value="observational">Períodos o audiencias diferentes</option></select></label><label>Desde · AAAA-MM-DD<input maxLength={10} placeholder="AAAA-MM-DD" value={experiment.start} onChange={e => expChange({ start: e.target.value })} /></label><label>Hasta · AAAA-MM-DD<input maxLength={10} placeholder="AAAA-MM-DD" value={experiment.end} onChange={e => expChange({ end: e.target.value })} /></label></div>{experiment.start && experiment.end && (!validDate(experiment.start) || !validDate(experiment.end) || experiment.start > experiment.end) && <p className="error-text">Revisá las fechas y su orden.</p>}<label>Vincular una elección previa<select value={matchingPredictions.some(p => p.id === predictionLink) ? predictionLink : ''} onChange={e => setPredictionLink(e.target.value)}><option value="">Sin elección vinculada</option>{matchingPredictions.map(p => <option key={p.id} value={p.id}>{p.source === 'ai' ? 'IA' : 'Mi elección'} · {p.recommendation === 'tie' ? 'Sin preferencia' : p.recommendation} · {prettyDate(p.createdAt)}</option>)}</select></label><p className="fine-print">La fecha guardada permite distinguir cuándo registraste cada decisión. Los datos importados no están verificados por Epic.</p>
        </section><aside className="results-panel"><span className="section-label">RESULTADO OBSERVADO</span>{result ? <><h2>{result.delta === 0 ? 'Mismo CTR observado.' : `${result.delta > 0 ? 'B' : 'A'} registró más clics por impresión.`}</h2><div className="rate-pair"><div><span>A</span><strong>{pct(result.a.ctr, 2)}</strong></div><div><span>B</span><strong>{pct(result.b.ctr, 2)}</strong></div></div><div className="rate-difference"><span>Diferencia B − A</span><strong>{result.delta > 0 ? '+' : ''}{result.delta.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<small>puntos porcentuales</small></strong></div><p>Es una diferencia observada. Todavía no demuestra que una miniatura vaya a rendir mejor en otra exposición.</p><details className="text-details"><summary>Detalle estadístico</summary><p>Intervalo Wilson 95 % de A: {pct(result.a.low, 2)}–{pct(result.a.high, 2)}.</p><p>Intervalo Wilson 95 % de B: {pct(result.b.low, 2)}–{pct(result.b.high, 2)}.</p><p>Cambio relativo: {result.uplift === null ? 'no definido: A tiene CTR cero' : pct(result.uplift, 1)}.</p><p className="fine-print">Los intervalos por variante suponen observaciones independientes. No constituyen una prueba de diferencia entre A y B ni reproducen el cálculo interno de Epic. {experiment.design === 'observational' ? 'Cambios de audiencia o período también pueden explicar el resultado.' : 'La asignación A/B fue informada por vos.'}</p></details><button className="primary full" disabled={!reportReady} onClick={recordAB}><Check size={17} /> Guardar resultado</button><button className="secondary full" disabled={!reportReady} onClick={() => downloadFile('resultado-ab-thumbnail-insights.json', JSON.stringify({ project: project.name, experiment, results: result, recordedAt: new Date().toISOString(), provenance: 'Datos informados por el usuario, sin verificación externa' }, null, 2))}><Download size={17} /> Exportar reporte</button>{!reportReady && <p className="fine-print">Para guardar, elegí las dos imágenes y completá hipótesis, fuente y fechas.</p>}</> : <EmptyState icon={<Activity size={34} />} title="De los clics a la evidencia." text="Completá impresiones y clics de A y B para ver sus resultados." />}</aside></div>}
        {tab === 'history' && <section className="history-panel"><div className="section-heading"><div><span className="section-label">{project.name}</span><h2>Decisiones, pruebas y chequeos.</h2></div><button className="secondary" onClick={() => navigate('experiment')}><Plus size={17} /> Resultado A/B</button></div><p className="muted">Cada registro conserva su fecha y la versión que usaste.</p>{!totalRecords ? <EmptyState icon={<History size={38} />} title="Tu próxima prueba empieza acá." text="Registrá una elección entre dos miniaturas o un aviso de Epic. Después vas a poder comparar lo que cambió." action={<button className="primary" onClick={() => navigate('compare')}>Comparar miniaturas <ArrowRight size={17} /></button>} /> : <div className="timeline">{[
          ...project.predictions.map(p => ({ type: 'prediction' as const, date: p.createdAt, item: p })),
          ...project.epicRecords.map(p => ({ type: 'epic' as const, date: p.createdAt, item: p })),
          ...project.abRecords.map(p => ({ type: 'ab' as const, date: p.createdAt, item: p })),
        ].sort((a, b) => b.date.localeCompare(a.date)).map(entry => <article className={'timeline-card ' + entry.type} key={entry.type + entry.item.id}><div className="timeline-head"><span>{entry.type === 'prediction' ? (entry.item.source === 'ai' ? 'RECOMENDACIÓN CON IA' : 'MI ELECCIÓN VISUAL') : entry.type === 'epic' ? 'CHEQUEO DE EPIC · INFORMADO' : 'RESULTADO A/B · INFORMADO'}</span><time>{prettyDate(entry.date)}</time></div>{entry.type === 'prediction' ? <><div className="history-pair">{[entry.item.variantA, entry.item.variantB].map((id, i) => <img key={i} src={variants.find(x => x.id === id)?.src} alt={nameFor(id)} />)}<div><h3>{entry.item.recommendation === 'tie' ? 'Sin preferencia clara' : `Elegida para probar: ${entry.item.recommendation}`}</h3><p>{entry.item.reason}</p></div></div><details className="text-details"><summary>Imágenes y contexto</summary><p>A: {nameFor(entry.item.variantA)} · B: {nameFor(entry.item.variantB)}</p><p>{entry.item.context || 'Sin contexto agregado.'}</p></details><button className="text-button" onClick={() => { expChange({ ...initialExperiment, variantA: entry.item.variantA, variantB: entry.item.variantB, hypothesis: entry.item.comparison?.hypothesis || entry.item.reason }); setPredictionLink(entry.item.id); navigate('experiment'); }}>Agregar resultado del test <ArrowRight size={16} /></button></> : entry.type === 'epic' ? <><div className="history-pair"><img src={variants.find(x => x.id === entry.item.variantId)?.src} alt={nameFor(entry.item.variantId)} /><div><h3>{epicLabels[entry.item.status]}</h3><p>{entry.item.island} · chequeado el {entry.item.checkedAt}</p><p>{entry.item.notes || 'Sin notas.'}</p></div></div><span className="fine-print">Versión: {nameFor(entry.item.variantId)}</span></> : (() => {
          let rates: ReturnType<typeof compareRates>; try { rates = compareRates({ clicks: +entry.item.experiment.aClicks, impressions: +entry.item.experiment.aImpressions }, { clicks: +entry.item.experiment.bClicks, impressions: +entry.item.experiment.bImpressions }); } catch { return <p>Este registro importado tiene conteos inválidos.</p>; }
          const linked = project.predictions.find(p => p.id === entry.item.predictionId);
          return <><h3>A: {pct(rates.a.ctr, 2)} <span className="versus">/</span> B: {pct(rates.b.ctr, 2)}</h3><p>{entry.item.experiment.hypothesis}</p><p className="fine-print">{entry.item.experiment.source} · {entry.item.experiment.start} al {entry.item.experiment.end}</p>{linked && <div className="linked-record"><History size={17} /><p>Elección vinculada: {linked.recommendation === 'tie' ? 'sin preferencia' : linked.recommendation} ({linked.source === 'ai' ? 'IA' : 'manual'}). Registrada el {prettyDate(linked.createdAt)}. {predictionTiming(linked.createdAt, entry.item.experiment.start)} La diferencia observada no confirma por sí sola la precisión del sistema.</p></div>}<details className="text-details"><summary>Versiones del test</summary><p>A: {nameFor(entry.item.experiment.variantA)} · B: {nameFor(entry.item.experiment.variantB)}</p></details></>;
        })()}</article>)}</div>}</section>}
        </div></fieldset>
      </>}
    </main>
    <footer className="site-footer"><span><span className="footer-cross">+</span> THUMBNAIL INSIGHTS <i>/</i> CREATOR STUDIO</span><span>Herramienta independiente para creadores UEFN.</span></footer>
    <input className="sr-only" ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { if (e.target.files?.[0]) void addFile(e.target.files[0]); e.target.value = ''; }} />
    <input className="sr-only" ref={importInput} type="file" accept="application/json,.json" onChange={e => { void importProject(e.target.files?.[0]); e.target.value = ''; }} />
    <input className="sr-only" ref={csvInput} type="file" accept="text/csv,.csv" onChange={e => { void importCsv(e.target.files?.[0]); e.target.value = ''; }} />
    {busy && <div className="progress-toast" role="status"><Loader2 size={19} className="spin" /><div><strong>{busy}…</strong><span>{busy.includes('Comparando') || busy.includes('Revisando') ? 'Puede demorar unos segundos.' : 'Conservamos tu trabajo.'}</span></div></div>}
    {toast && <div className="toast" role="status"><Info size={19} /><span>{toast}</span><button onClick={() => setToast('')} aria-label="Cerrar aviso"><X size={18} /></button></div>}
    {modal && <div className="modal-backdrop" onClick={() => { if (!busy) setModal(''); }}><section role="dialog" aria-modal="true" aria-label={modal === 'projects' ? 'Mis proyectos' : modal === 'guide' ? 'Guía del estudio' : modal === 'url' ? 'Cargar imagen desde URL' : 'Imagen ampliada'} className={'modal ' + (modal === 'image' ? 'large-modal' : '')} onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key !== 'Tab') return; const nodes = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href]')).filter(n => n.getClientRects().length > 0); const first = nodes[0], last = nodes[nodes.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); } }}>
      <button className="modal-close quiet-button" autoFocus disabled={!!busy} onClick={() => setModal('')} aria-label="Cerrar"><X size={23} /></button>
      {modal === 'image' && v && <ZoomViewer variant={v} onClose={() => setModal('')} />}
      {modal === 'url' && <form onSubmit={byUrl}><span className="section-label">CARGAR UNA IMAGEN</span><h2>Desde un enlace</h2><p>Usá una URL HTTPS directa. Algunos sitios no permiten importar sus imágenes.</p><label>URL de la imagen<input type="url" required value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…/miniatura.png" /></label><button className="primary full" disabled={!!busy}>Cargar imagen <ArrowRight size={17} /></button></form>}
      {modal === 'guide' && <div className="guide"><span className="section-label">EN UN MINUTO</span><h2>Tu imagen es el punto de partida.</h2><div className="guide-step"><Columns2 size={25} /><div><h3>Compará antes de elegir</h3><p>Subí dos versiones, revisalas y registrá tu criterio. La IA ofrece una preferencia visual cuando esté conectada.</p></div></div><div className="guide-step"><ShieldCheck size={25} /><div><h3>Revisá antes de publicar</h3><p>Comprobá el formato horizontal y compará referencias. Registrá lo que indique Epic. No conocemos su detector interno.</p></div></div><div className="guide-step"><Activity size={25} /><div><h3>Volvé con datos</h3><p>Cargá impresiones y clics del test A/B. El historial conserva la decisión y el resultado por separado.</p></div></div><details className="text-details"><summary>Guardado y límites</summary><p>El borrador se conserva en este navegador. «Guardar en mi cuenta» usa tu sesión de ChatGPT. Exportar permite llevarte una copia con imágenes de trabajo de hasta 1280 px; conservá los originales para entregar.</p><p>Los porcentajes de brillo o saturación describen la imagen. El estudio no estima CTR ni garantiza aprobación. Los esquemas de ideas no generan imágenes.</p><p>La IA usa saldo de la cuenta conectada, solo al solicitarla. Hasta 20 intentos diarios compartidos entre análisis y comparación, sin reintentos automáticos. El límite es de consultas, no de dinero.</p></details><a className="text-button" href="https://dev.epicgames.com/documentation/fortnite/how-discover-works-in-fortnite?lang=en-US" target="_blank" rel="noreferrer">Cómo funciona Discover <ExternalLink size={15} /></a></div>}
      {modal === 'projects' && <div className="projects-modal"><span className="section-label">TU TRABAJO</span><h2>Mis proyectos</h2><div className="projects-actions"><button className="secondary" disabled={!!busy} onClick={newProject}><Plus size={17} /> Nuevo</button><button className="secondary" disabled={!!busy} onClick={() => importInput.current?.click()}><Upload size={17} /> Importar copia</button></div><label className="search-input"><Search size={18} /><input aria-label="Buscar proyectos" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre" /></label><h3>En este navegador</h3><p className="fine-print">Borradores locales. No se sincronizan automáticamente.</p><div className="project-list">{locals.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).map(p => <button disabled={!!busy} key={p.id} onClick={() => openProject(p.id, true)}><Folder size={20} /><span><strong>{p.name}</strong><small>{prettyDate(new Date(p.updated).toISOString())}</small></span><ArrowRight size={18} /></button>)}{!locals.length && <p className="muted">Todavía no hay borradores.</p>}</div><h3>En tu cuenta</h3>{cloudError ? <p className="fine-print">{cloudError} Los borradores de este navegador siguen disponibles.</p> : <div className="project-list">{cloud.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).map(p => <button disabled={!!busy} key={p.id} onClick={() => openProject(p.id, false)}><Folder size={20} /><span><strong>{p.name}</strong><small>{prettyDate(new Date(p.updated).toISOString())}</small></span><ArrowRight size={18} /></button>)}{!cloud.length && <p className="muted">Todavía no guardaste proyectos en tu cuenta.</p>}</div>}</div>}
    </section></div>}
  </div>;
}
