'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, RefreshCw, Target } from 'lucide-react';
import { getAimOverview, getUserAimSessions, type AimOverview, type AimSession } from '@/lib/aimSessions';
import { errorMessage, type PageCursor } from '@/lib/api-client';
import AimSessionDetails, { aimDate, aimDuration, aimMs, aimStatus } from './AimSessionDetails';

export default function AimAnalyticsPanel({ email }: { email: string }) {
  const [overview, setOverview] = useState<AimOverview | null>(null);
  const [sessions, setSessions] = useState<(AimSession & { id: string })[]>([]);
  const [cursor, setCursor] = useState<PageCursor | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const initialized = useRef(false);
  const load = useCallback(async (reset = false) => {
    try {
      const [stats, page] = await Promise.all([getAimOverview(email), getUserAimSessions(email, 20)]);
      if (page.error) throw new Error(page.error);
      setOverview(stats);
      if (!initialized.current || reset) {
        setSessions(page.sessions); setCursor(page.lastDoc); setHasMore(page.sessions.length === 20); initialized.current = true;
      } else {
        setSessions((previous) => [...page.sessions, ...previous.filter((old) => !page.sessions.some((fresh) => fresh.id === old.id))]);
      }
      setError(null);
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setLoading(false); }
  }, [email]);
  useEffect(() => { initialized.current = false; void load(); const timer = setInterval(() => { if (!document.hidden) void load(); }, 30000); return () => clearInterval(timer); }, [load]);
  async function more() {
    setBusy(true);
    const page = await getUserAimSessions(email, 20, cursor);
    if (page.error) setError(page.error);
    else { setSessions((previous) => [...previous, ...page.sessions.filter((session) => !previous.some((old) => old.id === session.id))]); setCursor(page.lastDoc); setHasMore(page.sessions.length === 20); }
    setBusy(false);
  }
  return (
    <section aria-label="Direct Aim istifadəçi analitikası" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="flex items-center gap-2 text-xl font-semibold"><Target className="text-[#fb713f]" size={22} />Direct Aim analitikası</h3><p className="mt-1.5 text-xs text-[#8da5b7]">Ümumi göstəricilər bütün tarixçəni əhatə edir. Yarımçıq turlar da oyun sayına daxildir.</p></div><button onClick={() => void load(true)} className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-xs text-[#c0d0dc]"><RefreshCw size={14} />Yenilə</button></div>
      {error && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-200">{error}</p>}
      {overview && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ['Oyun sayı', overview.totalPlays], ['Cəmi isabet', overview.totalHits], ['Orta isabet / tur', overview.averageHits.toFixed(1)],
          ['Ən yaxşı tur', overview.bestScore], ['Ümumi dəqiqlik', `${overview.accuracy.toFixed(1)}%`], ['Orta reaksiya', aimMs(overview.averageReactionMs)],
          ['Orta atış aralığı', aimMs(overview.averageShotIntervalMs)], ['Cəmi boş tıklama', overview.totalMisses], ['Qaçırılan hədəf', overview.totalExpired],
          ['Tamamlanan', overview.completedPlays], ['Erkən bitirilən', overview.abortedPlays], ['Açıq / yarımçıq', overview.unfinishedPlays],
        ].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-white/10 bg-[#102634] p-4"><p className="text-[10px] text-[#91a7b7]">{label}</p><p className="mt-2 text-xl font-semibold tabular-nums text-white">{value}</p></div>)}
      </div>}
      {overview && <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-[#8da5b7]"><span>Cəmi məşq müddəti: <strong className="font-medium text-[#d0dde6]">{aimDuration(overview.totalDurationMs)}</strong></span><span>Ümumi isabet / saniyə: <strong className="font-medium text-[#d0dde6]">{overview.hitsPerSecond.toFixed(2)}</strong></span><span>Avtomatik yenilənmə: 30 saniyə</span></div>}
      <div className="space-y-3">
        {loading ? <p className="py-12 text-center text-sm text-[#8da5b7]">Oyun tarixçəsi yüklənir…</p> : !sessions.length && !error ? <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center text-sm text-[#8da5b7]">Bu istifadəçi hələ Direct Aim oynamayıb.</div> : sessions.map((session) => (
          <article key={session.id} className="overflow-hidden rounded-2xl border border-white/10 bg-[#0c1f2b]">
            <button onClick={() => setExpanded(expanded === session.id ? null : session.id)} aria-expanded={expanded === session.id} className="flex w-full flex-wrap items-center justify-between gap-5 p-5 text-left transition hover:bg-white/[0.03]">
              <div className="min-w-44"><p className="text-sm font-semibold text-white">{aimDate(session.startTime)}</p><p className="mt-1.5 text-[11px] text-[#90a5b5]">{session.profile || session.gameMode} · <span className={session.status === 'playing' ? 'text-amber-300' : ''}>{aimStatus(session)}</span></p></div>
              <div className="flex flex-wrap gap-5 text-right sm:gap-8">{[['İsabet', session.score], ['Boş', session.misses], ['Dəqiqlik', `${session.accuracy.toFixed(1)}%`], ['Orta reaksiya', aimMs(session.averageReactionMs)], ['Müddət', aimDuration(session.totalDuration)]].map(([label, value]) => <div key={String(label)}><p className="text-[10px] text-[#8198a9]">{label}</p><p className="mt-1 text-sm font-semibold tabular-nums text-[#dce6ed]">{value}</p></div>)}</div>
              <ChevronDown size={18} className={`text-[#8da5b7] transition ${expanded === session.id ? 'rotate-180' : ''}`} />
            </button>
            {expanded === session.id && <AimSessionDetails key={`${session.id}:${session.updatedAt?.toMillis() || 0}`} session={session} />}
          </article>
        ))}
      </div>
      {hasMore && <div className="text-center"><button disabled={busy} onClick={() => void more()} className="rounded-xl border border-white/10 bg-white/5 px-7 py-3 text-sm font-semibold disabled:opacity-40">{busy ? 'Yüklənir…' : 'Daha çox oyun göstər'}</button></div>}
    </section>
  );
}
