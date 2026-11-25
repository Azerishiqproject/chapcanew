'use client';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, RefreshCw } from 'lucide-react';
import { getSalesEvents, getSalesOverview, getUserSalesSessions, type SalesOverview, type SalesSession } from '@/lib/salesSessions';
import { errorMessage } from '@/lib/api-client';
import { projectFor } from '@/lib/sales-catalog';
import { SALES_PHASES, type RecordedSalesEvent } from '@/lib/sales-telemetry';
const labels: Record<string, string> = { project: 'Layihə', payment: 'Ödəniş', method: 'Seçim üsulu', search: 'Axtarış', projectId: 'Layihə', building: 'Bina', entrance: 'Giriş', floor: 'Mərtəbə', apartment: 'Mənzil', date: 'Tarix', birthdate: 'Doğum tarixi', number: 'Rəqəm', text: 'Mətn', fin: 'FİN', religion: 'Din', favoriteCar: 'Sevimli maşın', puzzle: 'Şəkil sürüşdürmə', own: 'Öz vəsaiti', mortgage: 'İpoteka', address: 'Ünvan üzrə', selected: 'Mənzil seçildi', navigation: 'Səhifədən ayrıldı', logout: 'Çıxış etdi', recovered: 'Yarım tur bərpa olundu' };
const seconds = (ms: number | null | undefined) => ms == null || !Number.isFinite(ms) ? '—' : `${(ms / 1000).toFixed(2)} san`;
const date = (session: SalesSession) => session.startTime?.toDate().toLocaleString('az-AZ', { timeZone: 'Asia/Baku' }) ?? '—';
const status = (session: SalesSession) => !session.status || session.status === 'completed' ? 'Tamamlandı' : session.status === 'aborted' ? 'Yarım saxlanıldı' : 'Açıq / tamamlanmayıb';
const box = 'rounded-2xl border border-white/10 bg-white/5 p-4';
function Metric({ label, value }: { label: string; value: string | number }) { return <div className={box}><div className="text-xs text-white/50">{label}</div><div className="mt-2 text-xl font-bold tabular-nums text-white">{value}</div></div>; }
export function salesEventText(event: RecordedSalesEvent) {
  switch (event.type) {
    case 'phase': return `Mərhələ: ${labels[event.phase]}`;
    case 'focus': return `Alan seçildi: ${labels[event.field]}`;
    case 'select': return `${labels[event.field]}: ${event.field === 'projectId' ? projectFor(event.value)?.name ?? event.value : (labels[event.value] ?? event.value) || 'Sıfırlandı'}`;
    case 'search': return `Axtar: ${event.found ? 'mənzil tapıldı' : 'nəticə yoxdur'}`;
    case 'reset': return 'Ünvan seçimləri sıfırlandı';
    case 'catalog': return `Bina ${event.building}: ${event.status === 'loading' ? 'məlumat yüklənir' : event.status === 'ready' ? 'məlumat hazırdır' : 'yükləmə xətası'}`;
    case 'captcha-open': return `CAPTCHA ${event.index + 1}: ${labels[event.captchaType ?? ''] ?? ''} açıldı`;
    case 'captcha-close': return `CAPTCHA ${event.index + 1}: pəncərə bağlandı`;
    case 'captcha-retry': return `CAPTCHA ${event.index + 1}: yeni cəhd`;
    case 'captcha-result': return `CAPTCHA ${event.index + 1} (${labels[event.captchaType ?? ''] ?? ''}): ${event.correct ? 'doğru' : 'yanlış'} · cəhd ${seconds(event.durationMs)}${event.solveDurationMs != null ? ` · ümumi həll ${seconds(event.solveDurationMs)}` : ''}`;
    case 'visibility': return event.visible ? 'Səhifə ön plana gəldi' : 'Səhifə arxa plana keçdi';
    case 'finish': return labels[event.reason];
  }
}
function RunDetails({ session }: { session: SalesSession & { id: string } }) {
  const [events, setEvents] = useState<RecordedSalesEvent[]>([]), [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [exporting, setExporting] = useState(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; let cancelled = false; getSalesEvents(session.id).then(result => { if (!cancelled) { setEvents(result.events); setCursor(result.cursor); } }).catch(error => { if (!cancelled) setError(errorMessage(error)); }).finally(() => { if (!cancelled) setLoading(false); }); return () => { cancelled = true; alive.current = false; }; }, [session.id]);
  async function more() { if (loading) return; setLoading(true); setError(''); try { const result = await getSalesEvents(session.id, cursor); if (alive.current) { setEvents(previous => [...previous, ...result.events]); setCursor(result.cursor); } } catch (error) { if (alive.current) setError(errorMessage(error)); } finally { if (alive.current) setLoading(false); } }
  async function exportCsv() {
    setExporting(true); setError('');
    try {
      const all: RecordedSalesEvent[] = []; let next: string | null = null;
      do { const page = await getSalesEvents(session.id, next); all.push(...page.events); next = page.cursor; } while (next);
      const cell = (value: string | number) => `"${String(value).replace(/^[=+@-]/, "'$&").replaceAll('"', '""')}"`;
      const rows = [['Sıra', 'Vaxt (ms)', 'Mərhələ', 'Hadisə'], ...all.map(event => [event.seq + 1, event.atMs, labels[event.stage], salesEventText(event)])];
      const url = URL.createObjectURL(new Blob(['\ufeff' + rows.map(row => row.map(cell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = `sales-${session.id}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setError(errorMessage(error)); } finally { if (alive.current) setExporting(false); }
  }
  const address = session.selection ?? session.address;
  return <div className="border-t border-white/10 p-5 space-y-5">
    <div className="grid gap-3 sm:grid-cols-4"><Metric label="Seçimlər" value={seconds(session.step1Duration * 1000)} /><Metric label="Axtarış" value={seconds(session.step2Duration * 1000)} /><Metric label="CAPTCHA" value={seconds(session.captchaDuration * 1000)} /><Metric label="Doğru / yanlış" value={`${session.correctCaptchas} / ${session.incorrectCaptchas}`} /></div>
    <div className="text-sm text-white/70 space-y-2"><p>{session.project || 'Layihə seçilməyib'} · {labels[session.selection?.paymentMethod ?? session.paymentMethod ?? ''] ?? 'Ödəniş seçilməyib'}</p>{address && <p>Bina {address.building || '—'} · Giriş {address.entrance || '—'} · Mərtəbə {address.floor || '—'} · Mənzil {address.apartment || '—'}</p>}<p>Axtarış: {session.searches ?? '—'} · Sıfırlama: {session.resets ?? '—'} · Geri dönüş: {session.backCount ?? '—'} · Seçim dəyişməsi: {session.selectionChanges ?? '—'}</p>{session.captchaConfig && <p>Tur ayarı: {session.captchaConfig.enabled ? `${session.captchaConfig.requiredCount} CAPTCHA · ${session.captchaConfig.allowedTypes.map(type => labels[type]).join(', ')}` : 'CAPTCHA bağlıdır'}</p>}{session.endReason && <p>Bitiş: {labels[session.endReason] ?? session.endReason}</p>}</div>
    {session.schemaVersion !== 2 ? <p className="text-sm text-white/50">Bu əvvəlki turda yalnız yekun göstəricilər saxlanılıb; addım tarixçəsi mövcud deyil.</p> : <>
      <div className="flex items-center justify-between"><h4 className="font-bold">Addım-addım tarixçə ({session.eventCount ?? events.length})</h4><button onClick={() => void exportCsv()} disabled={exporting} className="flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm"><Download size={15} />{exporting ? 'Hazırlanır…' : 'CSV'}</button></div>
      <div className="overflow-x-auto rounded-xl border border-white/10"><table className="w-full text-left text-sm"><thead className="bg-white/5 text-white/50"><tr><th className="p-3">Vaxt</th><th>Mərhələ</th><th>Hadisə</th></tr></thead><tbody>{events.map(event => <tr key={event.seq} className="border-t border-white/5"><td className="whitespace-nowrap p-3 tabular-nums">{seconds(event.atMs)}</td><td className="pr-4 text-white/50">{labels[event.stage]}</td><td className="min-w-64 pr-3">{salesEventText(event)}</td></tr>)}</tbody></table></div>
      {loading && <p role="status" className="text-sm text-white/50">Tarixçə yüklənir…</p>}{cursor && <button disabled={loading} onClick={() => void more()} className="rounded-lg border border-white/15 px-4 py-2 text-sm">Daha çox hadisə</button>}
    </>}{error && <p role="alert" className="text-sm text-red-300">{error}</p>}
  </div>;
}
export default function SalesAnalyticsPanel({ email, initialOverview, onOverviewChange }: { email: string; initialOverview: SalesOverview | null; onOverviewChange: (value: SalesOverview) => void }) {
  const [overview, setOverview] = useState(initialOverview), [sessions, setSessions] = useState<(SalesSession & { id: string })[]>([]);
  const [cursor, setCursor] = useState<string | null>(null), [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''); const alive = useRef(true);
  useEffect(() => {
    let cancelled = false; alive.current = true;
    Promise.all([getSalesOverview(email), getUserSalesSessions(email, 20)]).then(([stats, page]) => {
      if (cancelled) return; if (page.error) throw new Error(page.error); setOverview(stats); onOverviewChange(stats); setSessions(page.sessions); setCursor(page.sessions.length === 20 ? page.lastDoc : null);
    }).catch(error => { if (!cancelled) setError(errorMessage(error)); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; alive.current = false; };
  }, [email, onOverviewChange]);
  async function load(reset: boolean) {
    if (loading) return; setLoading(true); setError('');
    try {
      const [stats, page] = await Promise.all([getSalesOverview(email), getUserSalesSessions(email, 20, reset ? null : cursor)]);
      if (!alive.current) return; if (page.error) throw new Error(page.error);
      setOverview(stats); onOverviewChange(stats); setSessions(previous => reset ? page.sessions : [...previous, ...page.sessions.filter(item => !previous.some(old => old.id === item.id))]); setCursor(page.sessions.length === 20 ? page.lastDoc : null); if (reset) setExpanded(null);
    } catch (error) { if (alive.current) setError(errorMessage(error)); } finally { if (alive.current) setLoading(false); }
  }
  return <section className="space-y-6 text-white" aria-label="Satış demosu analitikası">
    <div className="flex items-center justify-between gap-3"><h3 className="text-xl font-bold">Satış demosu · bütün turlar</h3><button disabled={loading} onClick={() => void load(true)} className="flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm"><RefreshCw size={15} />Yenilə</button></div>
    {error && <p role="alert" className="rounded-xl bg-red-500/10 p-4 text-red-300">{error}</p>}
    {overview && <>
      <div className="grid gap-3 sm:grid-cols-4"><Metric label="Bütün başladılan turlar" value={overview.totalPlays} /><Metric label="Tamamlanan" value={overview.completedPlays} /><Metric label="Yarım saxlanılan" value={overview.abortedPlays} /><Metric label="Açıq / tamamlanmayan" value={overview.unfinishedPlays} /></div>
      <p className="text-sm text-white/50">Tur ortalaması bütün tamamlanmış qeydlərdən hesablanır. Mərhələ detalları yalnız yeni turlarda mövcuddur. CAPTCHA müddəti mərhələ vaxtlarının içindədir.</p>
      <div className="grid gap-3 sm:grid-cols-3"><Metric label="Ortalama tur" value={seconds(overview.averageDurationMs)} /><Metric label="Ən sürətli tur" value={seconds(overview.bestDurationMs)} /><Metric label="Ortalama CAPTCHA vaxtı / tur" value={seconds(overview.averageCaptchaMs)} /></div>
      <div className="grid gap-3 sm:grid-cols-4">{SALES_PHASES.map(phase => <Metric key={phase} label={`${labels[phase]} ortalaması`} value={seconds(overview.phaseAverages[phase])} />)}</div>
      <div className="grid gap-3 sm:grid-cols-4"><Metric label="CAPTCHA doğru / yanlış" value={`${overview.totalCorrect} / ${overview.totalIncorrect}`} /><Metric label="Doğruluq" value={overview.accuracy == null ? '—' : `${overview.accuracy.toFixed(1)}%`} /><Metric label="Axtarış / sıfırlama" value={`${overview.totalSearches} / ${overview.totalResets}`} /><Metric label="Geri dönüş / məlumat xətası" value={`${overview.totalBack} / ${overview.totalCatalogErrors}`} /></div>
      {!!Object.keys(overview.captchaTypes).length && <div className={`${box} overflow-x-auto`}><h4 className="mb-3 font-bold">CAPTCHA növləri</h4><table className="w-full text-left text-sm"><thead className="text-white/50"><tr><th className="pb-2">Növ</th><th>Doğru</th><th>Yanlış</th><th>Ortalama həll</th></tr></thead><tbody>{Object.entries(overview.captchaTypes).map(([type, stats]) => <tr key={type} className="border-t border-white/5"><td className="py-2">{labels[type]}</td><td>{stats.correct}</td><td>{stats.incorrect}</td><td>{seconds(stats.averageSolveMs)}</td></tr>)}</tbody></table></div>}
    </>}
    <div className="space-y-3">{sessions.map(session => <article key={session.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/5"><button onClick={() => setExpanded(value => value === session.id ? null : session.id)} aria-expanded={expanded === session.id} className="flex w-full items-center justify-between gap-3 p-5 text-left"><div><div className="font-bold">{date(session)}</div><div className="mt-1 text-sm text-white/50">{session.project || 'Layihə seçilməyib'} · {status(session)}</div></div><div className="flex items-center gap-3"><span className="tabular-nums text-[#4fbfa3]">{seconds(session.totalDuration)}</span><ChevronDown size={18} className={expanded === session.id ? 'rotate-180' : ''} /></div></button>{expanded === session.id && <RunDetails session={session} />}</article>)}</div>
    {loading && <p role="status" className="text-sm text-white/50">Satış turları yüklənir…</p>}{!loading && !sessions.length && !error && <p className={box}>Satış turu tapılmadı.</p>}{cursor && <button disabled={loading} onClick={() => void load(false)} className="rounded-xl border border-white/15 px-5 py-3 text-sm">Daha çox tur</button>}
  </section>;
}
