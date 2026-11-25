'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { getAimEvents, type AimSession } from '@/lib/aimSessions';
import { type RecordedAimEvent } from '@/lib/aim-game';
import { errorMessage } from '@/lib/api-client';

export const aimMs = (value: number | null | undefined) => value == null ? '—' : `${value.toFixed(0)} ms`;
export const aimDuration = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(Math.floor(ms % 1000)).padStart(3, '0')}`;
export function aimDate(time: AimSession['startTime']) { return time.toDate().toLocaleString('az-AZ', { timeZone: 'Asia/Baku' }); }
export function aimStatus(session: AimSession) {
  if (session.status === 'playing') return session.updatedAt && Date.now() - session.updatedAt.toMillis() > 20000 ? 'Bağlantı kəsilib / tamamlanmayıb' : 'Oynayır';
  if (session.status === 'aborted') return session.endReason === 'hidden' ? 'Sekmə dəyişdirildi' : session.endReason === 'navigation' ? 'Səhifədən ayrıldı' : 'Erkən bitirildi';
  if (session.endReason === 'practice-complete') return 'Antrenman tamamlandı';
  return session.endReason === 'time-limit' ? 'Süre sınırı' : 'Tamamlandı';
}
export default function AimSessionDetails({ session }: { session: AimSession & { id: string } }) {
  const [events, setEvents] = useState<RecordedAimEvent[]>([]);
  const [loading, setLoading] = useState(session.schemaVersion === 2);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<'all' | 'hit' | 'miss'>('all');
  useEffect(() => {
    if (session.schemaVersion !== 2) return;
    let active = true;
    getAimEvents(session.id).then((data) => { if (active) { setEvents(data); setLoading(false); } })
      .catch((cause) => { if (active) { setError(errorMessage(cause)); setLoading(false); } });
    return () => { active = false; };
  }, [session.id, session.schemaVersion]);
  const shots = useMemo(() => events.filter((event) => event.type === 'hit' || event.type === 'miss'), [events]);
  const shown = shots.filter((event) => filter === 'all' || event.type === filter);
  const reactions = shots.filter((event) => event.type === 'hit' && event.reactionMs != null);
  const maxReaction = Math.max(1, ...reactions.map((event) => event.reactionMs!));
  const points = reactions.filter((_, index) => index % Math.max(1, Math.ceil(reactions.length / 350)) === 0);
  const path = points.map((event, index) => `${index ? 'L' : 'M'} ${40 + event.atMs / Math.max(1, session.totalDuration) * 690} ${150 - event.reactionMs! / maxReaction * 120}`).join(' ');
  function download() {
    const header = 'shot,result,elapsed_ms,shot_interval_ms,hit_interval_ms,response_ms,target_id,x,y,target_x,target_y,center_distance_px,time_utc,stage,path_efficiency_percent,normalized_center_error';
    const rows = shots.map((event) => event.type === 'hit' || event.type === 'miss' ? [event.shotNumber, event.type, event.atMs, event.intervalMs ?? '', event.hitIntervalMs ?? '', event.reactionMs ?? '', event.targetId ?? '', event.x, event.y, event.targetX ?? '', event.targetY ?? '', event.distanceFromCenterPx ?? '', new Date(session.startTime.toMillis() + event.atMs).toISOString(), event.stage ?? '', event.pathEfficiency ?? '', event.normalizedCenterError ?? ''].join(',') : '');
    const url = URL.createObjectURL(new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `direct-aim-${session.id}.csv`; link.click(); URL.revokeObjectURL(url);
  }
  return (
    <div className="space-y-6 border-t border-white/10 p-5 sm:p-7">
      {session.trainingStages && <section className="space-y-3" aria-label="Kademe gelişimi">
        <div className="flex flex-wrap justify-between gap-2"><h4 className="font-semibold">Aynı oyun içindeki kademeler · En yüksek {session.maxLevel}/5</h4><p className="text-xs text-[#8ca6b8]">{session.environment?.inputDevice} · {session.environment?.arenaWidth.toFixed(0)}×{session.environment?.arenaHeight.toFixed(0)}</p></div>
        <div className="overflow-x-auto rounded-xl border border-white/10"><table className="w-full whitespace-nowrap text-left text-xs tabular-nums"><thead className="bg-white/5 text-[#8fa4b5]"><tr>{['Kademe', 'Hedef', 'İsabet', 'Tıklama doğruluğu', 'Hedef yakalama', 'Orta erişim', 'Medyan', 'Tutarlılık (SS)', 'Merkez doğruluğu', 'Yol verimi'].map((label) => <th key={label} className="px-3 py-3 font-medium">{label}</th>)}</tr></thead><tbody>{session.trainingStages.filter((item) => item.targets > 0).map((item) => <tr key={item.level} className="border-t border-white/5"><td className="px-3 py-3">{item.level}</td><td className="px-3 py-3">{item.targets}</td><td className="px-3 py-3">{item.hits}</td><td className="px-3 py-3">{item.accuracy.toFixed(1)}%</td><td className="px-3 py-3">{item.hitRate.toFixed(1)}%</td><td className="px-3 py-3">{aimMs(item.averageResponseMs)}</td><td className="px-3 py-3">{aimMs(item.medianResponseMs)}</td><td className="px-3 py-3">{aimMs(item.deviationMs)}</td><td className="px-3 py-3">{item.centerAccuracy === null ? '—' : item.centerAccuracy.toFixed(1) + '%'}</td><td className="px-3 py-3">{item.pathEfficiency === null ? '—' : item.pathEfficiency.toFixed(1) + '%'}</td></tr>)}</tbody></table></div>
        <p className="text-[11px] leading-5 text-[#8ca6b8]">Erişim süresi hedefin görünmesinden isabete kadardır; görme ve mouse hareketini birlikte içerir. Yol verimi, oyun alanında 50 ms aralıkla örneklenen yolun doğrudan yola yakınlığıdır. Karşılaştırma tamamlanan oyunlar için yapılır.{session.comparable === false ? ' Bu kaydın ekran/giriş koşulları değişmiş veya giriş verisi eksiktir; karşılaştırmaya eklenmez.' : ''}</p>
      </section>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {[
          ['İsabet', session.score], ['Boş tıklama', session.misses], ['Qaçan hədəf', session.expiredTargets],
          ['Dəqiqlik', `${session.accuracy.toFixed(1)}%`], ['Atış sayı', session.shotCount ?? session.score + session.misses], ['Ən uzun seri', session.bestStreak ?? '—'],
          [session.trainingProtocol ? 'Orta hedefe erişim' : 'Orta reaksiya', aimMs(session.averageReactionMs)], ['Ən sürətli', aimMs(session.fastestReactionMs)], ['Ən yavaş', aimMs(session.slowestReactionMs)],
          [session.trainingProtocol ? 'Erişim sapması' : 'Reaksiya sapması', aimMs(session.reactionDeviationMs)], ['Orta atış aralığı', aimMs(session.averageShotIntervalMs)], ['Orta isabet aralığı', aimMs(session.averageHitIntervalMs)],
          ['İsabet / saniyə', session.hitsPerSecond?.toFixed(2) ?? '—'], ['Tıklama / saniyə', session.clicksPerSecond?.toFixed(2) ?? '—'], [session.trainingProtocol ? 'Son kademe' : 'Son hədəf sürəti', session.trainingProtocol ? `${session.level}/5` : session.finalSpeed?.toFixed(2) ?? '—'],
          ['Yaranan hədəf', session.spawnedTargets ?? '—'], ['Tur müddəti', aimDuration(session.totalDuration)], ['Bitiş', aimStatus(session)],
        ].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-white/5 bg-white/[0.035] p-3"><p className="text-[10px] leading-4 text-[#889dab]">{label}</p><p className="mt-1.5 break-words text-sm font-semibold tabular-nums text-white">{value}</p></div>)}
      </div>
      {session.trainingProtocol ? <p className="text-xs leading-6 text-[#8ba1b1]">Kademeli antrenman · 3 dakika · 5 kademe · hatalarda tempo azalır · ayrı ölçüm turu yok</p> : session.settings && <p className="text-xs leading-6 text-[#8ba1b1]">Tur ayarları: {session.profile} · {session.settings.targetsPerSecond} hədəf/s · +{session.settings.acceleration}/s · {session.settings.lives} can · {session.settings.diameter}px · hədəf ömrü {session.settings.lifetimeMs} ms{session.settings.mode === 'moving-targets' ? ` · hərəkət ${session.settings.movementSpeed}px/s` : ''}</p>}
      {session.schemaVersion !== 2 ? <p className="text-sm text-[#93a9ba]">Bu köhnə oturum üçün atış zamanları qeydə alınmayıb.</p> : loading ? <p className="py-8 text-sm text-[#93a9ba]" role="status">Bütün atış qeydləri yüklənir…</p> : error ? <p role="alert" className="text-sm text-red-300">{error}</p> : <>
        <div className="grid gap-4 lg:grid-cols-2">
          <figure className="rounded-2xl border border-white/10 bg-[#091b28] p-4">
            <figcaption className="text-sm font-semibold">{session.trainingProtocol ? 'Hedefe erişim süresi' : 'Reaksiya müddəti'} <span className="ml-2 text-xs font-normal text-[#8ba1b1]">hədəf görünməsi → isabet</span></figcaption>
            {reactions.length ? <svg viewBox="0 0 760 190" role="img" aria-label="Tur boyunca hər isabetin reaksiya müddəti" className="mt-3 w-full">
              {[0, 1, 2].map((index) => <g key={index}><line x1="40" x2="730" y1={30 + index * 60} y2={30 + index * 60} stroke="#223b4c" /><text x="0" y={34 + index * 60} fill="#7e96a8" fontSize="10">{Math.round(maxReaction * (1 - index / 2))}</text></g>)}
              <path d={path} fill="none" stroke="#a58bfa" strokeWidth="2.5" />
              {points.length === 1 && <circle cx={40 + points[0].atMs / Math.max(1, session.totalDuration) * 690} cy="30" r="4" fill="#a58bfa" />}
              <text x="40" y="180" fill="#7e96a8" fontSize="11">0 s</text><text x="685" y="180" fill="#7e96a8" fontSize="11">{(session.totalDuration / 1000).toFixed(1)} s</text>
            </svg> : <p className="py-12 text-center text-xs text-[#8098aa]">Qeydə alınmış isabet yoxdur.</p>}
          </figure>
          <figure className="rounded-2xl border border-white/10 bg-[#091b28] p-4">
            <figcaption className="flex justify-between text-sm font-semibold"><span>Atış xəritəsi</span><span className="text-xs font-normal text-[#8ba1b1]">İsabet <span className="text-orange-400">●</span> / Boş <span className="text-red-400">×</span>{shots.length > 800 ? ' · son 800 atış' : ''}</span></figcaption>
            <svg viewBox="0 0 800 480" role="img" aria-label="İsabet və boş tıklamaların oyun sahəsində mövqeyi" className="mx-auto mt-3 max-h-44 w-full rounded-lg border border-white/5 bg-[#0b2030]">
              {shots.slice(-800).map((event) => event.type === 'hit' || event.type === 'miss' ? event.type === 'hit' ? <circle key={event.seq} cx={event.x} cy={event.y} r="5" fill="#fb713f" opacity="0.8" /> : <path key={event.seq} d={`M${event.x - 4},${event.y - 4}l8,8m0,-8l-8,8`} stroke="#f87171" strokeWidth="2" /> : null)}
            </svg>
          </figure>
        </div>
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h4 className="text-sm font-semibold">Atış zamanları <span className="ml-2 font-normal text-[#8ba1b1]">{shots.length} atış / {events.filter((event) => event.type === 'expire').length} qaçan hədəf</span></h4><div className="flex items-center gap-2"><select aria-label="Atış filtresi" value={filter} onChange={(event) => { setFilter(event.target.value as typeof filter); setPage(0); }} className="rounded-lg border border-white/10 bg-[#102839] px-3 py-2 text-xs"><option value="all">Bütün atışlar</option><option value="hit">Yalnız isabet</option><option value="miss">Yalnız boş</option></select><button onClick={download} disabled={!shots.length} className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs disabled:opacity-30"><Download size={14} />CSV</button></div></div>
          <div className="overflow-x-auto rounded-xl border border-white/10"><table className="w-full whitespace-nowrap text-left text-xs tabular-nums"><thead className="bg-white/5 text-[#8fa4b5]"><tr>{['#', 'Nəticə', 'Tur vaxtı', 'Öncəki atışdan', 'Öncəki isabetdən', session.trainingProtocol ? 'Hedefe erişim' : 'Reaksiya', 'Kademe', 'Hədəf', 'Mövqe (x, y)'].map((label) => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead><tbody>{shown.slice(page * 50, (page + 1) * 50).map((event) => event.type === 'hit' || event.type === 'miss' ? <tr key={event.seq} className="border-t border-white/5 text-[#c3d1db]"><td className="px-4 py-3">{event.shotNumber}</td><td className={`px-4 py-3 ${event.type === 'hit' ? 'text-orange-300' : 'text-red-300'}`}>{event.type === 'hit' ? 'İsabet' : 'Boş'}</td><td className="px-4 py-3">{aimDuration(event.atMs)}</td><td className="px-4 py-3">{aimMs(event.intervalMs)}</td><td className="px-4 py-3">{aimMs(event.hitIntervalMs)}</td><td className="px-4 py-3">{aimMs(event.reactionMs)}</td><td className="px-4 py-3">{event.stage ?? '—'}</td><td className="px-4 py-3">{event.targetId ?? '—'}</td><td className="px-4 py-3">{event.x.toFixed(0)}, {event.y.toFixed(0)}</td></tr> : null)}</tbody></table>{!shown.length && <p className="py-8 text-center text-sm text-[#8fa4b5]">Bu filtrdə atış yoxdur.</p>}</div>
          {shown.length > 50 && <div className="mt-3 flex items-center justify-between text-xs text-[#8fa4b5]"><span>{page * 50 + 1}–{Math.min((page + 1) * 50, shown.length)} / {shown.length}</span><div className="flex gap-2"><button aria-label="Öncəki atışlar" disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded-lg bg-white/5 p-2 disabled:opacity-20"><ChevronLeft size={15} /></button><button aria-label="Sonrakı atışlar" disabled={(page + 1) * 50 >= shown.length} onClick={() => setPage(page + 1)} className="rounded-lg bg-white/5 p-2 disabled:opacity-20"><ChevronRight size={15} /></button></div></div>}
          <p className="mt-3 text-[11px] leading-5 text-[#7e96a8]">İlk atışın aralığı yoxdur. Reaksiya hədəfin yaranmasından vurulduğu ana qədərdir. Aralıq ardıcıl tıklamalar arasındakı müddətdir. Mövqelər 800 × 480 oyun sahəsinə görədir.</p>
        </div>
      </>}
    </div>
  );
}
