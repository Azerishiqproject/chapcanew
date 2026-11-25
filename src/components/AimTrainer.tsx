'use client';

import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { Heart, Maximize, Play, RotateCcw, Settings2, Square, Target, Volume2, VolumeX, X } from 'lucide-react';
import { api, errorMessage } from '@/lib/api-client';
import { ARENA, AimGame, CHALLENGE, EASY, PROGRESSIVE, calculateMetrics, speedAt, targetPosition, targetRadius, targetOpacity, type AimMetrics, type AimSettings, type EndReason } from '@/lib/aim-game';
import { AimRecorder } from '@/lib/aim-recorder';
import { TRAINING_DURATION_MS, TRAINING_STAGES, trainingStage, type InputDevice, type TrainingEnvironment } from '@/lib/aim-training';
import { AimAudio, type AimSound } from '@/lib/aim-audio';
import { useAppSelector } from '@/store/hooks';

type Profile = 'progressive' | 'easy' | 'challenge' | 'custom' | 'doubleshot' | 'moving';
type Phase = 'idle' | 'starting' | 'playing' | 'finished';
const formatTime = (ms: number) => { const ticks = Math.round(ms / 100); return `${String(Math.floor(ticks / 600)).padStart(2, '0')}:${String(Math.floor(ticks / 10) % 60).padStart(2, '0')}.${ticks % 10}`; };
const milliseconds = (value: number | null | undefined) => value == null ? '—' : `${value.toFixed(0)} ms`;

function paint(canvas: HTMLCanvasElement, game: AimGame | null) {
  const box = canvas.getBoundingClientRect(), ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.round(box.width * ratio), height = Math.round(box.height * ratio);
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(width / ARENA.width, 0, 0, height / ARENA.height, 0, 0);
  ctx.fillStyle = '#0b2030'; ctx.fillRect(0, 0, ARENA.width, ARENA.height);
  ctx.strokeStyle = 'rgba(159,194,218,0.035)'; ctx.lineWidth = 1;
  for (let x = 0; x <= ARENA.width; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ARENA.height); ctx.stroke(); }
  for (let y = 0; y <= ARENA.height; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ARENA.width, y); ctx.stroke(); }
  if (!game) return;
  for (const target of game.targets) {
    const point = targetPosition(target, game.elapsedMs, game.settings);
    const radius = targetRadius(target, game.elapsedMs, game.settings);
    ctx.globalAlpha = targetOpacity(target, game.elapsedMs, game.settings);
    for (const [scale, color] of [[1, '#fb713f'], [0.74, '#fff5eb'], [0.49, '#fb713f'], [0.23, '#fff5eb']] as const) {
      ctx.beginPath(); ctx.arc(point.x, point.y, Math.max(0, radius * scale), 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

export default function AimTrainer() {
  const user = useAppSelector((state) => state.auth.user);
  const userId = user?.uid;
  const [profile, setProfile] = useState<Profile>('progressive');
  const [inputDevice, setInputDevice] = useState<InputDevice>('mouse');
  const [trainingHud, setTrainingHud] = useState({ level: 1, maxLevel: 1, hits: 0, resolved: 0, targetCount: 0 });
  const lastCanvasSize = useRef<{ width: number; height: number } | null>(null);
  const [custom, setCustom] = useState<AimSettings>({ ...EASY });
  const [phase, setPhase] = useState<Phase>('idle');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sound, setSound] = useState(() => {
    try { return typeof window === 'undefined' || localStorage.getItem('chapca_aim_sound') !== 'off'; }
    catch { return true; }
  });
  const [volume, setVolume] = useState(100);
  const [effects, setEffects] = useState({ hit: true, miss: true, expire: true });
  const [audioWarning, setAudioWarning] = useState<string | null>(null);
  const [crosshair, setCrosshair] = useState<'crosshair' | 'default'>('crosshair');
  const [hud, setHud] = useState({ elapsed: 0, hits: 0, misses: 0, lost: 0, speed: 2 });
  const [result, setResult] = useState<AimMetrics | null>(null);
  const [saveState, setSaveState] = useState<'ready' | 'saving' | 'saved' | 'error'>('ready');
  const [error, setError] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null), arenaRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<AimGame | null>(null), recorderRef = useRef<AimRecorder | null>(null);
  const startedAt = useRef(0), frame = useRef(0), lastHud = useRef(0), lastFlush = useRef(0);
  const finishing = useRef(false), starting = useRef(false);
  const soundPrefs = useRef({ enabled: sound, volume, effects });
  const audio = useRef<AimAudio | null>(null);
  const mounted = useRef(true);

  const playSound = useCallback((kind: AimSound) => {
    const prefs = soundPrefs.current;
    if (!prefs.enabled || !prefs.effects[kind] || prefs.volume === 0) return;
    audio.current ||= new AimAudio();
    audio.current.setVolume(prefs.volume / 100 * 0.8);
    void audio.current.play(kind).catch(() => {
      if (mounted.current) setAudioWarning('Səs açıla bilmədi. Səs düyməsinə yenidən tıklayın.');
    });
  }, []);
  function toggleSound() {
    const enabled = !soundPrefs.current.enabled;
    soundPrefs.current.enabled = enabled; setSound(enabled); setAudioWarning(null);
    try { localStorage.setItem('chapca_aim_sound', enabled ? 'on' : 'off'); } catch { /* optional preference */ }
    if (enabled) playSound('hit');
  }

  const upload = useCallback(async () => {
    if (!recorderRef.current) return;
    setSaveState('saving');
    try {
      await recorderRef.current.drain();
      if (mounted.current) { setSaveState(gameRef.current?.ended ? 'saved' : 'ready'); setError(null); }
    } catch (cause) {
      if (mounted.current) { setSaveState('error'); setError(errorMessage(cause)); }
    }
  }, []);
  const capture = useCallback(() => {
    if (!recorderRef.current || !gameRef.current) return;
    try { recorderRef.current.capture(gameRef.current); }
    catch { setError('Yerel kayıt alanı dolu. Sunucuya kayıt yeniden deneniyor.'); }
    void upload();
  }, [upload]);
  const finish = useCallback((reason?: Exclude<EndReason, 'lives'>) => {
    const game = gameRef.current;
    if (!game || finishing.current) return;
    finishing.current = true;
    const previousLost = game.lostLives;
    if (reason) game.finish(reason, performance.now() - startedAt.current);
    if (game.lostLives > previousLost) playSound('expire');
    cancelAnimationFrame(frame.current);
    if (mounted.current) {
      setTrainingHud({ level: game.progress.level, maxLevel: game.progress.maxLevel, hits: game.progress.hits, resolved: game.progress.resolved, targetCount: game.targets.length });
      setPhase('finished'); setResult(calculateMetrics(game.events, game.elapsedMs, game.settings));
      setHud({ elapsed: game.elapsedMs, hits: game.hits, misses: game.misses, lost: game.lostLives, speed: speedAt(game.settings, game.elapsedMs) });
    }
    if (canvasRef.current) paint(canvasRef.current, game);
    capture();
  }, [capture, playSound]);

  useEffect(() => { soundPrefs.current = { enabled: sound, volume, effects }; audio.current?.setVolume(volume / 100 * 0.8); }, [sound, volume, effects]);
  useEffect(() => {
    mounted.current = true;
    if (!userId) return;
    try {
      const pending = AimRecorder.restore(userId, localStorage);
      if (pending) {
        recorderRef.current = pending;
        pending.drain().then(() => { if (mounted.current) { setRecovering(false); setSaveState('ready'); } })
          .catch((cause) => { if (mounted.current) { setRecovering(false); setSaveState('error'); setError(errorMessage(cause)); } });
      } else Promise.resolve().then(() => setRecovering(false));
    } catch { Promise.resolve().then(() => setRecovering(false)); }
    const onKey = (event: KeyboardEvent) => {
      if (gameRef.current && !gameRef.current.ended && (event.key === 'Escape' || event.key.toLowerCase() === 's')) finish('manual');
    };
    const onHidden = () => { if (document.hidden && gameRef.current && !gameRef.current.ended) finish('hidden'); };
    const onLeave = () => { if (gameRef.current && !gameRef.current.ended) finish('navigation'); };
    document.addEventListener('keydown', onKey); document.addEventListener('visibilitychange', onHidden); window.addEventListener('pagehide', onLeave);
    return () => {
      onLeave(); mounted.current = false; cancelAnimationFrame(frame.current);
      document.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', onHidden); window.removeEventListener('pagehide', onLeave);
      void audio.current?.close().catch(() => {});
    };
  }, [userId, finish]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => {
      const box = canvas.getBoundingClientRect(), old = lastCanvasSize.current;
      const game = gameRef.current;
      if (game?.settings.training && !game.ended && old && (Math.abs(box.width - old.width) > 2 || Math.abs(box.height - old.height) > 2)) {
        game.resize(box.width, box.height, performance.now() - startedAt.current);
      }
      lastCanvasSize.current = { width: box.width, height: box.height };
      paint(canvas, game);
    });
    observer.observe(canvas);
    paint(canvas, null);
    return () => observer.disconnect();
  }, []);

  async function start() {
    if (!user || starting.current || recovering || saveState === 'error' || saveState === 'saving') return;
    starting.current = true; setPhase('starting'); setError(null); setSettingsOpen(false);
    const settings: AimSettings = profile === 'progressive' ? { ...PROGRESSIVE } : profile === 'easy' ? { ...EASY } : profile === 'challenge' ? { ...CHALLENGE } : {
      ...custom, mode: profile === 'doubleshot' ? 'dual-targets' : profile === 'moving' ? 'moving-targets' : 'normal',
    };
    if (soundPrefs.current.enabled) {
      audio.current ||= new AimAudio();
      audio.current.setVolume(soundPrefs.current.volume / 100 * 0.8);
      void audio.current.prepare().catch(() => setAudioWarning('Səs üçün yuxarıdakı səs düyməsinə tıklayın.'));
    }
    try {
      const box = canvasRef.current!.getBoundingClientRect();
      const environment: TrainingEnvironment = { inputDevice, arenaWidth: box.width, arenaHeight: box.height, devicePixelRatio: window.devicePixelRatio || 1 };
      lastCanvasSize.current = { width: box.width, height: box.height };
      const run = await api<{ id: string }>('aim/runs', 'POST', { clientRunId: crypto.randomUUID(), profile, settings, ...(settings.training ? { environment } : {}) });
      if (!mounted.current) return;
      gameRef.current = new AimGame(settings); recorderRef.current = new AimRecorder(run.id, user.uid, localStorage);
      finishing.current = false; startedAt.current = performance.now(); lastHud.current = 0; lastFlush.current = 0;
      setHud({ elapsed: 0, hits: 0, misses: 0, lost: 0, speed: settings.targetsPerSecond });
      setTrainingHud({ level: 1, maxLevel: 1, hits: 0, resolved: 0, targetCount: 0 });
      setPhase('playing'); setResult(null); setSaveState('ready');
      // Persist even an empty initial checkpoint, so a reload can close the run.
      capture();
      function animate(now: number) {
        const game = gameRef.current!;
        const previousLost = game.lostLives;
        game.advance(now - startedAt.current);
        if (game.lostLives > previousLost) playSound('expire');
        if (canvasRef.current) paint(canvasRef.current, game);
        if (game.ended) { finish(); return; }
        if (game.elapsedMs - lastHud.current >= 80) {
          lastHud.current = game.elapsedMs;
          setTrainingHud({ level: game.progress.level, maxLevel: game.progress.maxLevel, hits: game.progress.hits, resolved: game.progress.resolved, targetCount: game.targets.length });
          setHud({ elapsed: game.elapsedMs, hits: game.hits, misses: game.misses, lost: game.lostLives, speed: speedAt(game.settings, game.elapsedMs) });
        }
        if (game.elapsedMs - lastFlush.current >= 3000) { lastFlush.current = game.elapsedMs; capture(); }
        frame.current = requestAnimationFrame(animate);
      }
      frame.current = requestAnimationFrame(animate);
    } catch (cause) { setPhase('idle'); setError(errorMessage(cause)); }
    finally { starting.current = false; }
  }
  function shoot(event: PointerEvent<HTMLCanvasElement>) {
    const game = gameRef.current;
    if (!game || game.ended || event.button !== 0) return;
    event.preventDefault();
    const box = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(ARENA.width, (event.clientX - box.left) / box.width * ARENA.width));
    const y = Math.max(0, Math.min(ARENA.height, (event.clientY - box.top) / box.height * ARENA.height));
    const previousLost = game.lostLives;
    const now = performance.now() - startedAt.current;
    game.move(x, y, now, event.pointerType === 'touch' ? 'touch' : event.pointerType === 'pen' ? 'pen' : 'mouse', true);
    const shot = game.shoot(x, y, now);
    if (game.lostLives > previousLost) playSound('expire');
    if (game.ended) { finish(); return; }
    if (shot) playSound(shot.type === 'hit' ? 'hit' : 'miss');
  }
  function movePointer(event: PointerEvent<HTMLCanvasElement>) {
    const game = gameRef.current;
    if (!game?.settings.training || game.ended) return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(ARENA.width, (event.clientX - box.left) / box.width * ARENA.width));
    const y = Math.max(0, Math.min(ARENA.height, (event.clientY - box.top) / box.height * ARENA.height));
    const previousLost = game.lostLives;
    game.move(x, y, performance.now() - startedAt.current, event.pointerType === 'touch' ? 'touch' : event.pointerType === 'pen' ? 'pen' : 'mouse');
    if (game.lostLives > previousLost) playSound('expire');
    if (game.ended) finish();
  }
  const currentSettings = gameRef.current?.settings || (profile === 'progressive' ? PROGRESSIVE : profile === 'easy' ? EASY : profile === 'challenge' ? CHALLENGE : custom);
  const busy = phase === 'playing' || phase === 'starting';
  const progressive = profile === 'progressive';
  const stage = trainingStage(trainingHud.level);
  return (
    <section className="w-full text-[#e9f1f7]" aria-label="Direct Aim antrenmanı">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#839bad]">Hız · Dəqiqlik · Reaksiya</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Direct Aim<span className="ml-3 text-[#fb713f]">/</span></h2></div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-white/10 bg-[#102839] px-4 py-2 text-xs text-[#b1c5d4]">{progressive ? '3 dakika · 5 kademe · tek oyun' : 'Serbest antrenman'}</span>
          <label className="flex items-center gap-2 text-xs text-[#94acbd]">Aygıt
            <select aria-label="Giriş aygıtı" value={inputDevice} disabled={busy} onChange={(event) => setInputDevice(event.target.value as InputDevice)} className="rounded-lg border border-white/10 bg-[#102839] px-3 py-2 text-white disabled:opacity-50"><option value="mouse">Mouse</option><option value="touchpad">Touchpad</option><option value="touch">Dokunmatik</option></select>
          </label>
        </div>
      </div>
      {progressive && <div className="mx-auto mb-5 max-w-[800px] rounded-2xl border border-white/10 bg-[#0d2433] p-4" data-testid="training-progress">
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">Kademe {trainingHud.level}/5 · {stage.name}</p><p className="text-xs text-[#a4bbcb]">En fazla {stage.maxTargets} hedef · {stage.gapMs / 1000}–{(stage.gapMs + 400) / 1000} sn aralık</p></div>
        <div className="mt-3 grid grid-cols-5 gap-2">{TRAINING_STAGES.map((item) => <div key={item.level} className={`h-1.5 rounded-full ${item.level <= trainingHud.level ? 'bg-[#fb713f]' : 'bg-white/10'}`} />)}</div>
        <p className="mt-3 text-xs leading-5 text-[#8ca6b8]">{phase === 'playing' ? `Bu blok: ${trainingHud.hits} isabet / ${trainingHud.resolved} hedef. ` : ''}8 hedefte en az 7 isabet ve %85 tıklama doğruluğuyla kademe artar. Hatalar arttığında tempo hafifler.</p>
      </div>}
      <div ref={arenaRef} className="mx-auto max-w-[800px] overflow-hidden rounded-2xl border border-[#244052] bg-[#091a27] shadow-2xl">
        <div className="flex min-h-20 flex-wrap items-center justify-between gap-4 border-b border-white/[0.07] px-5 py-4 sm:px-7">
          <div className="flex flex-wrap gap-5 text-sm font-medium tabular-nums sm:gap-8">
            <span className="text-[#8ea3b3]">{progressive ? 'Kalan' : 'Vaxt'} <strong className="ml-2 text-lg font-semibold text-[#a28bfa]" data-testid="aim-time">{formatTime(progressive ? Math.max(0, TRAINING_DURATION_MS - hud.elapsed) : hud.elapsed)}</strong></span>
            <span className="text-[#8ea3b3]">İsabet <strong className="ml-2 text-lg font-semibold text-white" data-testid="aim-hits">{hud.hits}</strong></span>
            <span className="text-[#8ea3b3]">{progressive ? 'Kademe' : 'Sürət'} <strong className="ml-2 text-lg font-semibold text-[#a28bfa]">{progressive ? trainingHud.level : hud.speed.toFixed(2)}</strong> <small>{progressive ? '/ 5' : 'hədəf/s'}</small></span>
          </div>
          {progressive ? <span className="rounded-lg bg-white/5 px-3 py-2 text-xs text-[#adbfcd]">{trainingHud.targetCount}/{stage.maxTargets} hedef</span> : <div className="flex items-center gap-1.5" aria-label={`${Math.max(0, currentSettings.lives - hud.lost)} can qaldı`}>
            {Array.from({ length: currentSettings.lives }, (_, i) => <Heart key={i} size={21} className={i < currentSettings.lives - hud.lost ? 'fill-[#fb713f] text-[#fb713f]' : 'fill-[#294152] text-[#294152]'} />)}
          </div>}
        </div>
        <div className="relative aspect-[5/3] min-h-[280px] w-full">
          <canvas ref={canvasRef} data-testid="aim-arena" aria-label="Görünən hədəfləri tıklayın" onPointerDown={shoot} onPointerMove={movePointer} onContextMenu={(event) => event.preventDefault()} className="absolute inset-0 h-full w-full touch-none" style={{ cursor: phase === 'playing' ? crosshair : 'default' }} />
          <div className="absolute right-4 top-4 z-10 flex gap-2">
            {phase === 'playing' && <button aria-label="Turu bitir" onClick={() => finish('manual')} className="aim-icon-button"><Square size={15} /></button>}
            <button aria-label={sound ? 'Səsi bağla' : 'Səsi aç'} aria-pressed={sound} onClick={toggleSound} className="aim-icon-button">{sound ? <Volume2 size={17} /> : <VolumeX size={17} />}</button>
            <button aria-label="Oyun ayarları" disabled={busy} onClick={() => setSettingsOpen(true)} className="aim-icon-button disabled:opacity-30"><Settings2 size={17} /></button>
            <button aria-label="Tam ekran" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void arenaRef.current?.requestFullscreen().catch(() => setError('Tam ekran bu pəncərədə dəstəklənmir.')); }} className="aim-icon-button"><Maximize size={17} /></button>
          </div>
          {(phase === 'idle' || phase === 'starting') && (
            <div className="absolute inset-0 flex flex-col items-center justify-center px-5 text-center">
              <Target className="mb-5 text-[#fb713f]" size={46} strokeWidth={1.3} />
              <h3 className="text-2xl font-semibold">{profile === 'progressive' ? 'Kademe kademe geliş' : profile === 'easy' ? 'Easy Challenge' : profile === 'challenge' ? 'Challenge' : profile === 'custom' ? 'Custom Challenge' : profile === 'doubleshot' ? 'Doubleshot' : 'Moving Targets'}</h3>
              <p className="mt-3 max-w-sm text-sm leading-6 text-[#8ca2b3]">{progressive ? 'Tek ve büyük hedefle başla. Başarılı oldukça aynı oyun içinde tempo ve hedef sayısı artar. Hata yaptığında oyun bitmez; tempo sana uyum sağlar.' : 'Görünən hədəfləri vurun. Hər qaçırılan hədəf bir can aparır. Boş tıklamalar dəqiqliyi azaldır.'}</p>
              <button onClick={() => void start()} disabled={phase === 'starting' || recovering || saveState === 'error' || saveState === 'saving'} className="mt-7 inline-flex min-w-56 items-center justify-center gap-3 rounded-full border-4 border-[#ff9c7140] bg-[#f66c39] px-10 py-4 text-lg font-bold shadow-[0_8px_32px_#f66c3920] transition hover:bg-[#ff7c49] disabled:opacity-50"><Play size={19} fill="currentColor" />{recovering ? 'Kayıt yoxlanır…' : phase === 'starting' ? 'Hazırlanır…' : 'PLAY'}</button>
            </div>
          )}
          {phase === 'finished' && result && (
            <div className="absolute inset-0 flex flex-col items-center justify-center overflow-auto bg-[#071723]/95 px-5 py-8 text-center" data-testid="aim-result">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#8da3b4]">{gameRef.current?.ended === 'lives' || gameRef.current?.ended === 'practice-complete' ? 'Oyun tamamlandı' : 'Tur dayandırıldı'}</p>
              <h3 className="mt-2 text-3xl font-semibold">Tur nəticəsi</h3>
              <div className="mt-6 grid w-full max-w-lg grid-cols-3 gap-x-5 gap-y-5">
                {[
                  ['İsabet', String(result.score)], ['Dəqiqlik', `${result.accuracy.toFixed(1)}%`], ['Vaxt', formatTime(hud.elapsed)],
                  [progressive ? 'Hedefe erişim' : 'Orta reaksiya', milliseconds(result.averageReactionMs)], ['Atış aralığı', milliseconds(result.averageShotIntervalMs)], [progressive ? 'Ulaşılan kademe' : 'Vuruş / saniyə', progressive ? `${trainingHud.maxLevel}/5` : result.hitsPerSecond.toFixed(2)],
                ].map(([label, value]) => <div key={label}><p className="text-[11px] text-[#8ea4b5]">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums text-white">{value}</p></div>)}
              </div>
              <button onClick={() => void start()} disabled={saveState !== 'saved'} className="mt-7 inline-flex items-center gap-3 rounded-full bg-[#f66c39] px-8 py-3.5 font-bold transition hover:bg-[#ff7c49] disabled:opacity-40"><RotateCcw size={18} />PLAY AGAIN</button>
              <p className="mt-3 text-xs text-[#8da3b4]" role="status">{saveState === 'saved' ? 'Nəticə və atışlar qeydə alındı.' : saveState === 'error' ? 'Kayıt gözləyir. Yenidən cəhd edin.' : 'Nəticə qeydə alınır…'}</p>
            </div>
          )}
          {settingsOpen && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#04101b]/90 p-5" role="dialog" aria-modal="true" aria-label="Oyun ayarları">
              <div className="max-h-full w-full max-w-md overflow-auto rounded-2xl border border-white/10 bg-[#102839] p-6 text-left">
                <div className="mb-5 flex items-center justify-between"><h3 className="text-lg font-semibold">Oyun ayarları</h3><button aria-label="Ayarları bağla" onClick={() => setSettingsOpen(false)}><X size={20} /></button></div>
                <label className="mb-5 flex items-center justify-between gap-3 text-sm">Antrenman modu<select aria-label="Antrenman modu" value={profile} onChange={(event) => { setProfile(event.target.value as Profile); setPhase('idle'); setResult(null); setTrainingHud({level:1,maxLevel:1,hits:0,resolved:0,targetCount:0}); }} className="max-w-52 rounded-lg border border-white/10 bg-[#081a28] p-2"><option value="progressive">Kademeli antrenman</option><option value="easy">Easy</option><option value="challenge">Challenge</option><option value="custom">Custom</option><option value="doubleshot">Doubleshot</option><option value="moving">Moving Targets</option></select></label>
                <fieldset className="mb-6 space-y-3 border-b border-white/10 pb-5">
                  <legend className="mb-3 text-sm font-semibold">Səs ayarları</legend>
                  <label className="flex items-center justify-between text-sm">Səslər açıq<input type="checkbox" checked={sound} onChange={toggleSound} /></label>
                  <label className="flex items-center justify-between gap-4 text-sm">Səs səviyyəsi ({volume}%)<input aria-label="Səs səviyyəsi" type="range" min="0" max="100" value={volume} onChange={(event) => setVolume(Number(event.target.value))} className="w-32 accent-orange-400" /></label>
                  {([['hit', 'İsabet səsi'], ['miss', 'Boş tıklama səsi'], ['expire', 'Qaçan hədəf səsi']] as const).map(([kind, label]) => <label key={kind} className="flex items-center justify-between text-xs text-[#adc0ce]">{label}<input type="checkbox" checked={effects[kind]} onChange={(event) => setEffects({ ...effects, [kind]: event.target.checked })} /></label>)}
                  <button type="button" onClick={() => { playSound('hit'); }} disabled={!sound || !effects.hit} className="rounded-lg border border-white/10 px-3 py-2 text-xs disabled:opacity-40">Səsi yoxla</button>
                </fieldset>
                <label className="mb-5 flex items-center justify-between text-sm">Nişangah<select value={crosshair} onChange={(event) => setCrosshair(event.target.value as typeof crosshair)} className="rounded-lg border border-white/10 bg-[#081a28] p-2"><option value="crosshair">Çarpaz</option><option value="default">Standart</option></select></label>
                {profile === 'progressive' ? <p className="text-sm leading-6 text-[#a2b4c1]">İlk iki kademe tek hedefle ilerler. Kademe 3–4 en fazla 2, kademe 5 en fazla 3 hedef içerir. Karşılaştırma için aygıtını doğru seç ve oyun alanını tur sırasında değiştirme.</p> : profile === 'easy' || profile === 'challenge' ? <p className="text-sm leading-6 text-[#a2b4c1]">{profile === 'easy' ? 'Easy: 2 hədəf/s, saniyədə +0.003 hədəf/s, 5 can.' : 'Challenge: 2 hədəf/s, saniyədə +0.01 hədəf/s, 3 can.'} Sürəti dəyişmək üçün Custom rejimini seçin.</p> : <div className="space-y-4">{([
                  ['targetsPerSecond', 'Hədəf / saniyə', 0.5, 10, 0.1], ['acceleration', 'Saniyəlik sürət artımı', 0, 0.5, 0.001], ['lives', 'Can sayı', 1, 10, 1], ['diameter', 'Hədəf ölçüsü', 30, 100, 5],
                  ...(profile === 'moving' ? [['movementSpeed', 'Hərəkət sürəti', 20, 200, 10] as const] : []),
                ] as const).map(([key, label, min, max, step]) => <label key={key} className="flex items-center justify-between gap-4 text-sm">{label}<input type="number" min={min} max={max} step={step} value={custom[key]} onChange={(event) => setCustom({ ...custom, [key]: Number(event.target.value) })} className="w-24 rounded-lg border border-white/10 bg-[#081a28] p-2 text-right" /></label>)}</div>}
                <button onClick={() => setSettingsOpen(false)} className="mt-6 w-full rounded-xl bg-[#f66c39] py-3 text-sm font-semibold">Hazır</button>
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.07] px-5 py-3 text-[11px] text-[#8097aa]"><span>ESC / S — turu bitir</span><span>{phase === 'playing' ? `${hud.misses} boş tıklama · atışlar avtomatik qeydə alınır` : 'Hər tur və hər atış admin statistikasında görünür.'}</span></div>
      </div>
      {audioWarning && <p role="status" className="mt-4 text-sm text-orange-200">{audioWarning}</p>}
      {error && <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-orange-400/20 bg-orange-400/5 p-4 text-sm text-orange-200"><span>{error}</span>{saveState === 'error' && <button onClick={() => void upload()} className="rounded-lg bg-white/10 px-4 py-2 font-semibold">Qeydi yenidən göndər</button>}</div>}
      <div className="mt-6 grid grid-cols-3 gap-3 text-center text-xs text-[#91a7b8]"><p><span className="font-semibold text-[#dbe6ee]">01</span> Hədəfi gör</p><p><span className="font-semibold text-[#dbe6ee]">02</span> Nişan al və vur</p><p><span className="font-semibold text-[#dbe6ee]">03</span> Nəticəni yaxşılaşdır</p></div>
      <style jsx>{`.aim-icon-button { display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:8px;background:#07172388;color:#a6bac9;transition:background .15s; } .aim-icon-button:hover { background:#244356; color:white; }`}</style>
    </section>
  );
}
