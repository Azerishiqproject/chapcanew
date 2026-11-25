'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, Users, TrendingUp } from 'lucide-react';
import { getTrainingComparison, type TrainingComparison } from '@/lib/aimSessions';
import { TRAINING_STAGES, TRAINING_PROTOCOL, REFERENCE_PROTOCOL, REFERENCE_PHASES } from '@/lib/aim-training';
import { aimMs } from './AimSessionDetails';
import { errorMessage } from '@/lib/api-client';

const deviceName = (name: string) => name === 'touch' ? 'Dokunmatik' : name === 'touchpad' ? 'Touchpad' : 'Mouse';
export default function AimComparisonPanel() {
  const [protocol, setProtocol] = useState<string>(REFERENCE_PROTOCOL);
  const stages = protocol === REFERENCE_PROTOCOL ? REFERENCE_PHASES : TRAINING_STAGES;
  const [stage, setStage] = useState(1), [condition, setCondition] = useState('');
  const [data, setData] = useState<TrainingComparison | null>(null);
  const [error, setError] = useState<string | null>(null), [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<'name' | 'response' | 'accuracy' | 'path'>('name');
  const requestVersion = useRef(0);
  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    try {
      const result = await getTrainingComparison(stage, condition, protocol);
      if (version === requestVersion.current) { setData(result); setError(null); }
    }
    catch (cause) { if (version === requestVersion.current) setError(errorMessage(cause)); }
    finally { if (version === requestVersion.current) setLoading(false); }
  }, [stage, condition, protocol]);
  const cancelPending = useCallback(() => { requestVersion.current++; }, []);
  useEffect(() => { void load(); const timer = setInterval(() => { if (!document.hidden) void load(); }, 30000); return () => { clearInterval(timer); cancelPending(); }; }, [load, cancelPending]);
  const rows = useMemo(() => [...(data?.rows || [])].sort((a, b) => sort === 'response'
    ? (a.averageResponseMs ?? Infinity) - (b.averageResponseMs ?? Infinity)
    : sort === 'accuracy' ? b.accuracy - a.accuracy : sort === 'path' ? (b.pathEfficiency ?? -1) - (a.pathEfficiency ?? -1) : a.name.localeCompare(b.name, 'tr')), [data, sort]);
  return (
    <section className="space-y-6" aria-label="Oyuncu kademe karşılaştırması">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#fb9c73]">Aynı oyun · Tempo bazında gelişim</p><h1 className="mt-2 flex items-center gap-3 text-3xl font-semibold tracking-tight"><Users className="text-[#fb713f]" />Oyuncu karşılaştırması</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-[#91aabc]">Aynı tempo bölümünü ve benzer koşulları seç. Hız, doğruluk ve mouse kontrolünü birlikte değerlendir. Tamamlanan Direct Aim turları bu tabloya eklenir; oyun sırasında kayıt otomatik tutulur.</p></div>
        <button onClick={() => { setLoading(true); void load(); }} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs"><RefreshCw size={15} />Yenile</button>
      </div>
      <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-white/10 bg-[#0d2535] p-5">
        <label className="flex min-w-44 flex-col gap-2 text-xs text-[#93adbe]">Oyun akışı<select aria-label="Karşılaştırma oyun akışı" value={protocol} onChange={(event) => { setLoading(true); setProtocol(event.target.value); setData(null); setStage(1); setCondition(''); }} className="rounded-lg border border-white/10 bg-[#071b29] p-3 text-white"><option value={REFERENCE_PROTOCOL}>Direct Aim · Referans tempo</option><option value={TRAINING_PROTOCOL}>Önceki kademeli kayıtlar</option></select></label>
        <label className="flex min-w-40 flex-col gap-2 text-xs text-[#93adbe]">{protocol === REFERENCE_PROTOCOL ? 'Tempo bölümü' : 'Kademe'}<select aria-label="Karşılaştırma kademesi" value={stage} onChange={(event) => { setLoading(true); setStage(Number(event.target.value)); }} className="rounded-lg border border-white/10 bg-[#071b29] p-3 text-white">{stages.map((item) => <option key={item.level} value={item.level}>{item.level} · {item.name}</option>)}</select></label>
        <label className="flex min-w-64 flex-1 flex-col gap-2 text-xs text-[#93adbe]">Aygıt ve oyun alanı<select aria-label="Karşılaştırma koşulu" value={condition || data?.condition || ''} onChange={(event) => { setLoading(true); setCondition(event.target.value); }} className="rounded-lg border border-white/10 bg-[#071b29] p-3 text-white">{!data?.conditions.length && <option value="">Henüz uygun kayıt yok</option>}{data?.conditions.map((item) => <option key={item.key} value={item.key}>{deviceName(item.inputDevice)} · {item.key.split(':')[1].replace('x', ' × ')} · {item.players} oyuncu</option>)}</select></label>
        <label className="flex min-w-44 flex-col gap-2 text-xs text-[#93adbe]">Sırala<select aria-label="Karşılaştırma sıralaması" value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} className="rounded-lg border border-white/10 bg-[#071b29] p-3 text-white"><option value="name">Oyuncu adı</option><option value="response">Hedefe erişim süresi</option><option value="accuracy">Tıklama doğruluğu</option><option value="path">Mouse yol verimi</option></select></label>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ['Bu koşuldaki oyuncu', String(rows.length)],
          ['Grup ortanca erişimi', aimMs(data?.groupMedianResponseMs)],
          [protocol === REFERENCE_PROTOCOL ? 'Seçili tempo bölümü' : 'Seçili kademe', `${stage} / ${stages.length} · ${stages[stage - 1].name}`],
        ].map(([label, value]) => <div key={label} className="rounded-2xl border border-white/10 bg-[#0d2535] p-5"><p className="text-xs text-[#91aabc]">{label}</p><p className="mt-2 text-xl font-semibold tabular-nums">{value}</p></div>)}
      </div>
      {error && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-200">{error}</p>}
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#0b202f]">
        <table className="w-full whitespace-nowrap text-left text-xs tabular-nums"><thead className="bg-white/5 text-[#96aebe]"><tr>{['Oyuncu', 'Oyun', 'Ulaştığı', 'Kademe örneği', 'Tıklama doğruluğu', 'Hedef yakalama', 'Hedefe erişim', 'Tutarlılık (SS)', 'Merkez doğruluğu', 'Mouse yol verimi', 'Gruba göre süre', 'Kişisel gelişim'].map((label) => <th key={label} className="px-4 py-4 font-medium">{label}</th>)}</tr></thead>
          <tbody>{rows.map((row) => <tr key={row.userId} className="border-t border-white/5 text-[#c4d4df]">
            <td className="px-4 py-4"><Link href={`/admin/users/${encodeURIComponent(row.email)}`} className="font-semibold text-white hover:text-orange-300">{row.name}</Link><p className="mt-1 text-[10px] text-[#7d99ae]">{row.email}</p></td>
            <td className="px-4 py-4">{row.completedPlays}</td><td className="px-4 py-4">{row.maxLevel}/{stages.length}</td>
            <td className="px-4 py-4">{row.hits} isabet / {row.comparableSamples} hedef{!row.comparisonReady && <p className="mt-1 text-[10px] text-amber-300">En az 8 isabet gerekli</p>}</td>
            <td className="px-4 py-4">{row.accuracy.toFixed(1)}%</td><td className="px-4 py-4">{row.hitRate.toFixed(1)}%</td>
            <td className="px-4 py-4">{aimMs(row.averageResponseMs)}</td><td className="px-4 py-4">{aimMs(row.deviationMs)}</td>
            <td className="px-4 py-4">{row.centerAccuracy === null ? '—' : row.centerAccuracy.toFixed(1) + '%'}</td>
            <td className="px-4 py-4">{row.pathEfficiency === null ? '—' : row.pathEfficiency.toFixed(1) + '%'}<p className="mt-1 text-[10px] text-[#7d99ae]">{row.pathSamples} ölçülen yol</p></td>
            <td className="px-4 py-4">{row.differenceFromGroupMs === null ? '—' : `${row.differenceFromGroupMs > 0 ? '+' : ''}${row.differenceFromGroupMs.toFixed(0)} ms`}</td>
            <td className="px-4 py-4">{row.improvementPercent === null ? <span className="text-[#7d99ae]">6 ayrı oyun bekleniyor</span> : <><span className={row.improvementPercent >= 0 ? 'text-emerald-300' : 'text-orange-300'}>{row.improvementPercent >= 0 ? '%' + row.improvementPercent.toFixed(1) + ' daha hızlı' : '%' + Math.abs(row.improvementPercent).toFixed(1) + ' daha yavaş'}</span><p className="mt-1 text-[10px] text-[#91aabc]">Doğruluk {row.accuracyChangePp! >= 0 ? '+' : ''}{row.accuracyChangePp!.toFixed(1)} puan</p></>}</td>
          </tr>)}</tbody></table>
        {!rows.length && <div className="p-12 text-center text-sm leading-6 text-[#8ba6b9]">{loading ? 'Kayıtlar yükleniyor…' : 'Bu koşulda tamamlanmış oyun yok. Oyuncular bir Direct Aim turunu tamamladığında burada görünür.'}</div>}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-[#0d2535] p-5"><h2 className="flex items-center gap-2 text-sm font-semibold"><TrendingUp size={17} className="text-orange-300" />Gelişim nasıl okunur?</h2><p className="mt-3 text-xs leading-6 text-[#91aabc]">Grup farkı için en az 2 oyuncuda, seçili kademede en az 8 isabet gerekir. İlk 3 tamamlanmış oyun ile onlarla örtüşmeyen son 3 oyun karşılaştırılır. Seçili kademede iki dönemde de en az 8 isabet gerekir. Süre azalırken doğruluğun korunması ve yol veriminin artması birlikte izlenir.</p></div>
        <div className="rounded-2xl border border-white/10 bg-[#0d2535] p-5"><h2 className="text-sm font-semibold">Koşullar ve ölçüm</h2><p className="mt-3 text-xs leading-6 text-[#91aabc]">Süre, hedefin görünmesinden tıklamaya kadardır; görme ve hareketi birlikte içerir. Aynı aygıt türü ve benzer oyun alanları gruplanır; ekranı değişen ve giriş türü uyuşmayan turlar dışarıda tutulur. Fare DPI ayarı ve donanım farkları sonucu etkileyebilir. Yol verimi alan içindeki örneklenmiş harekete dayanır.</p></div>
      </div>
    </section>
  );
}
