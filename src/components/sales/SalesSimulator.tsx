'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { api, errorMessage } from '@/lib/api-client';
import { Timestamp } from 'firebase/firestore';
import { Check, ChevronLeft, ChevronRight, House, Info, LockKeyhole, LogOut, Map, SlidersHorizontal, X } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { logoutUser } from '@/store/slices/authSlice';
import { setCaptchaSettings, type CaptchaState, type CaptchaType } from '@/store/slices/captchaSlice';
import { getUserCaptchaSettings } from '@/lib/captchaSettings';
import { saveSalesSession, type SalesSession } from '@/lib/salesSessions';
import { addressOptions, changeAddress, emptyAddress, findApartment, projectFor, salesCatalog, type SalesAddress, type SalesApartment, type CatalogBuilding } from '@/lib/sales-catalog';
import { captchaPlan, SalesClock, type SalesPhase } from '@/lib/sales-flow';
import DateCaptcha from '@/components/DateCaptcha';
import NumberCaptcha from '@/components/NumberCaptcha';
import TextCaptcha from '@/components/TextCaptcha';
import BirthDateCaptcha from '@/components/BirthDateCaptcha';
import PersonalInfoCaptcha from '@/components/PersonalInfoCaptcha';
import SalesCompletion from './SalesCompletion';
import styles from './sales.module.css';

const paymentLabels = { own: 'Öz vəsaiti hesabına', mortgage: 'İpoteka krediti hesabına' };
type Payment = keyof typeof paymentLabels;
type SavedSession = Omit<SalesSession, 'createdAt'>;
interface Run { start: number; clock: SalesClock; settings: CaptchaState; plan: ReturnType<typeof captchaPlan> }
function countdown(seconds: number) { const left = Math.max(0, Math.ceil(seconds)); return `${Math.floor(left / 60).toString().padStart(2, '0')}:${(left % 60).toString().padStart(2, '0')}`; }

export default function SalesSimulator() {
  const router = useRouter(), dispatch = useAppDispatch();
  const { user, userData } = useAppSelector(state => state.auth);
  const defaults = useAppSelector(state => state.captcha);
  const initialSettings = useRef(defaults);
  const [run, setRun] = useState<Run | null>(null);
  const [settingsError, setSettingsError] = useState('');
  const [phase, setPhase] = useState<SalesPhase>('project');
  const [address, setAddress] = useState<SalesAddress>({ ...emptyAddress });
  const [loadedBuildings, setLoadedBuildings] = useState<Record<string, CatalogBuilding>>({});
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const catalogRequest = useRef(0);
  const [payment, setPayment] = useState<Payment | ''>('');
  const [method, setMethod] = useState(false);
  const [result, setResult] = useState<SalesApartment | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [progress, setProgress] = useState(0);
  const [captchaOpen, setCaptchaOpen] = useState(false);
  const [verified, setVerified] = useState(false);
  const [captchaKey, setCaptchaKey] = useState(0);
  const [incorrect, setIncorrect] = useState(0);
  const [logs, setLogs] = useState<{ type: string; duration: number }[]>([]);
  const [saved, setSaved] = useState<SavedSession | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');
  const busy = useRef(false), finished = useRef(false);
  const pendingAction = useRef<'method' | 'search'>('method');
  const captchaStart = useRef(0);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const project = projectFor(address.projectId);
  const loadedBuilding = loadedBuildings[`${address.projectId}/${address.building}`];
  const options = addressOptions(address, loadedBuilding);
  const apartment = findApartment(address, loadedBuilding);

  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    getUserCaptchaSettings(user.uid).then(({ settings, error }) => {
      if (cancelled) return;
      if (error) { setSettingsError(error); return; }
      const config = { ...initialSettings.current, ...settings,
        dateConfig: { ...initialSettings.current.dateConfig, ...settings?.dateConfig },
        personalConfig: { ...initialSettings.current.personalConfig, ...settings?.personalConfig } };
      dispatch(setCaptchaSettings(config));
      setRun({ start: Date.now(), clock: new SalesClock(), settings: config, plan: captchaPlan(config.enabled, config.requiredCount, config.allowedTypes) });
    });
    return () => { cancelled = true; };
  }, [dispatch, user?.uid]);
  useEffect(() => {
    if (!run || phase === 'complete') return;
    const timer = setInterval(() => setElapsed((Date.now() - run.start) / 1000), 1000);
    return () => clearInterval(timer);
  }, [run, phase]);
  useEffect(() => () => { if (feedbackTimer.current) clearTimeout(feedbackTimer.current); }, []);
  useEffect(() => {
    if (!captchaOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLElement>('input, button')?.focus();
    return () => previous?.focus();
  }, [captchaOpen]);

  function change(field: keyof SalesAddress, value: string) {
    setAddress(previous => changeAddress(previous, field, value)); setResult(null); setCatalogError('');
    if (field === 'projectId' || field === 'building') {
      catalogRequest.current++; setCatalogLoading(false);
      if (field === 'building' && value) void loadBuilding(address.projectId, value);
    }
  }
  async function loadBuilding(projectId: string, building: string) {
    const source = projectFor(projectId)?.buildings.find(item => item.number === building), key = `${projectId}/${building}`;
    if (!source || source.complete || loadedBuildings[key]) return;
    const request = ++catalogRequest.current; setCatalogLoading(true); setCatalogError('');
    try {
      const data = await api<{ building: CatalogBuilding }>(`sales/catalog/${encodeURIComponent(projectId)}/${encodeURIComponent(building)}`);
      setLoadedBuildings(previous => ({ ...previous, [key]: data.building }));
    } catch (error) { if (catalogRequest.current === request) setCatalogError(errorMessage(error)); }
    finally { if (catalogRequest.current === request) setCatalogLoading(false); }
  }
  function proceed(action: 'method' | 'search') {
    if (!run) return;
    if (action === 'method') { run.clock.enter(2); setPhase('search'); }
    else setResult(apartment);
  }
  function gated(action: 'method' | 'search') {
    if (!run) return;
    const step = action === 'method' ? 1 : 2;
    if (run.plan[progress]?.step === step) {
      pendingAction.current = action; captchaStart.current = Date.now(); setCaptchaOpen(true);
    } else proceed(action);
  }
  function verify(correct: boolean) {
    if (!run || busy.current) return;
    busy.current = true;
    if (!correct) {
      setIncorrect(count => count + 1);
      feedbackTimer.current = setTimeout(() => { setCaptchaKey(key => key + 1); busy.current = false; }, 500);
      return;
    }
    setLogs(previous => [...previous, { type: run.plan[progress].type, duration: (Date.now() - captchaStart.current) / 1000 }]);
    setVerified(true);
    feedbackTimer.current = setTimeout(() => {
      const next = progress + 1, action = pendingAction.current;
      setProgress(next); setVerified(false); setCaptchaKey(key => key + 1); busy.current = false;
      if (run.plan[next]?.step === (action === 'method' ? 1 : 2)) captchaStart.current = Date.now();
      else { setCaptchaOpen(false); proceed(action); }
    }, 1000);
  }
  async function persist(session: SavedSession) {
    setSaveState('saving');
    const response = await saveSalesSession(session);
    setSaveState(response.error ? 'error' : 'saved'); setSaveError(response.error || '');
  }
  function finish() {
    if (!run || !result || !user || finished.current) return;
    finished.current = true;
    const end = Date.now(), durations = run.clock.finish();
    const session: SavedSession = {
      email: user.email, startTime: Timestamp.fromMillis(run.start), endTime: Timestamp.fromMillis(end),
      totalDuration: end - run.start, totalDurationSeconds: Math.round((end - run.start) / 1000), ...durations,
      captchaDuration: logs.reduce((sum, log) => sum + log.duration, 0), correctCaptchas: logs.length, incorrectCaptchas: incorrect,
      project: project!.name, selection: { ...result, paymentMethod: payment as Payment, method: 'address', catalogVersion: salesCatalog.version },
    };
    setSaved(session); setPhase('complete'); void persist(session);
  }
  function back() {
    if (phase === 'project') router.push('/demo');
    else if (phase === 'payment') setPhase('project');
    else if (phase === 'method') setPhase('payment');
    else { run?.clock.enter(1); setPhase('method'); setResult(null); }
  }
  function next() {
    if (phase === 'project' && project) setPhase('payment');
    else if (phase === 'payment' && payment) setPhase('method');
    else if (phase === 'method' && method) gated('method');
    else if (phase === 'search' && result) finish();
  }
  function renderCaptcha(type: CaptchaType) {
    if (!run) return null;
    const config = run.settings, key = `${progress}-${captchaKey}`;
    if (type === 'date') return <DateCaptcha key={key} correctDate={config.dateConfig.todayDate} onVerify={verify} />;
    if (type === 'birthdate') return <BirthDateCaptcha key={key} correctDate={config.dateConfig.birthDate} onVerify={verify} />;
    if (type === 'number') return <NumberCaptcha key={key} onVerify={verify} />;
    if (type === 'text') return <TextCaptcha key={key} onVerify={verify} />;
    return <PersonalInfoCaptcha key={key} type={type} correctAnswer={config.personalConfig[type]} onVerify={verify} />;
  }
  if (!run) return <div className={styles.loading}>{settingsError ? <div role="alert">{settingsError}<button onClick={() => window.location.reload()}>Yenidən yoxla</button></div> : 'Yüklənir...'}</div>;
  const searching = phase === 'search', complete = phase === 'complete';
  const nextDisabled = phase === 'project' ? !project : phase === 'payment' ? !payment : phase === 'method' ? !method : !result;
  return <div className={styles.page} data-view={phase}>
    <header className={styles.header}>
      <Image src="/mida-logo.svg" alt="MİDA" width={45} height={43} priority />
      <div className={styles.account}><span>{(userData?.name || user?.email || '').toLocaleUpperCase('az')}</span><button onClick={async () => { const response = await dispatch(logoutUser()); if (logoutUser.fulfilled.match(response)) router.push('/login'); }}>Çıxış et <LogOut size={13} /></button></div>
    </header>
    {complete && saved ? <>
      <div className={styles.saveNotice} role="status">{saveState === 'saving' ? 'Nəticə yadda saxlanılır…' : saveState === 'saved' ? 'Nəticə yadda saxlanıldı.' : <span role="alert">Nəticə saxlanılmadı: {saveError} <button disabled={saveState !== 'error'} onClick={() => void persist(saved)}>Yenidən saxla</button></span>}</div>
      <SalesCompletion simulationStartTime={run.start} simulationEndTime={saved.endTime.toMillis()} step1Duration={saved.step1Duration} step2Duration={saved.step2Duration} captchaTotalDuration={saved.captchaDuration} correctCaptchas={saved.correctCaptchas} incorrectCaptchas={saved.incorrectCaptchas} captchaLogs={logs} onRestart={() => window.location.reload()} />
    </> : <main className={styles.main}>
      <ol className={`${styles.steps} ${searching ? styles.searchSteps : ''}`} aria-label="Mənzil sifarişi mərhələləri">
        {(searching ? ['Seçimlər', 'Axtarış', 'Mənzil', 'Ərizə'] : ['Seçimlər', 'Mənzil', 'Ərizə']).map((label, index) => <li key={label} className={searching && index === 0 ? styles.done : index === (searching ? 1 : 0) ? styles.current : ''} aria-current={index === (searching ? 1 : 0) ? 'step' : undefined}><span className={styles.stepDot}>{searching && index === 0 ? <Check size={13} /> : index + 1}</span><span>{label}</span></li>)}
      </ol>
      {!searching ? <section className={styles.selectionPanel}>
        <nav className={styles.breadcrumb} aria-label="Seçimlər"><span>Mənzil sifarişi</span>{phase !== 'project' && <><b>›</b><strong>{project?.name}</strong></>}{phase === 'method' && payment && <><b>›</b><strong>{paymentLabels[payment]}</strong></>}</nav>
        <div className={styles.selectionBody}>
          {phase === 'project' && <><h1>Layihə seçimi</h1><select className={styles.projectSelect} aria-label="Layihəni seçin" value={address.projectId} onChange={event => change('projectId', event.target.value)}><option value="">Layihəni seçin</option>{salesCatalog.projects.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></>}
          {phase === 'payment' && <><h1>Ödəniş üsulu seçimi</h1><fieldset className={styles.payments}><legend className={styles.srOnly}>Ödəniş üsulu</legend>{(Object.keys(paymentLabels) as Payment[]).map(value => <label key={value}><input type="radio" name="payment" checked={payment === value} onChange={() => setPayment(value)} /><span>{paymentLabels[value]}</span>{value === 'mortgage' && <span title="İpoteka krediti ilə ödəniş" className={styles.info}><Info size={13} fill="#4c97d7" color="white" /></span>}</label>)}</fieldset></>}
          {phase === 'method' && <><h1>Mənzil seçimi üsulu</h1><div className={styles.methods}>
            <label className={`${styles.method} ${styles.addressMethod}`}><input type="radio" name="method" checked={method} onChange={() => setMethod(true)} /><span className={styles.methodLabel}><span className={styles.iconBubble}><House size={14} /></span>Ünvan üzrə</span></label>
            {[{ text: 'Xəritə üzərində', Icon: Map, wait: 900 }, { text: 'Parametrlər üzrə', Icon: SlidersHorizontal, wait: 1800 }].map(({ text, Icon, wait }) => <div key={text} className={`${styles.method} ${styles.locked}`} aria-disabled="true"><div className={styles.lockPanel}><span>Seçim üsulunun<br />aktivləşməsinə<br />qalan vaxt:</span><div className={styles.lockBadge}><LockKeyhole size={18} fill="white" /><b>{countdown(wait - elapsed)}</b></div></div><span className={styles.methodLabel}><span className={styles.iconBubble}><Icon size={14} /></span>{text}</span></div>)}
          </div></>}
        </div>
      </section> : <div className={styles.searchGrid}>
        <aside className={styles.sidebar}>
          <div className={styles.projectTitle}>{project?.name}</div>
          <form className={styles.filters} onSubmit={event => { event.preventDefault(); if (apartment) gated('search'); }}>
            <h1>Ünvan üzrə mənzil seçimi</h1>
            {([{ field: 'building', label: 'Bina nömrəsi', values: options.buildings, enabled: true }, { field: 'entrance', label: 'Giriş nömrəsi', values: options.entrances, enabled: !!address.building }, { field: 'floor', label: 'Mərtəbə nömrəsi', values: options.floors, enabled: !!address.entrance }, { field: 'apartment', label: 'Mənzil nömrəsi', values: options.apartments, enabled: !!address.floor }] as const).map(({ field, label, values, enabled }) => <label className={styles.filterRow} key={field}><span>{label}</span><select aria-label={label} value={address[field]} disabled={!enabled || (field !== 'building' && (catalogLoading || !!catalogError))} onChange={event => change(field, event.target.value)}><option value="" aria-label="Seçin"></option>{values.map(value => <option key={value}>{value}</option>)}</select></label>)}
            <div className={styles.searchActions}><button type="button" onClick={() => { setAddress({ ...emptyAddress, projectId: address.projectId }); setResult(null); catalogRequest.current++; setCatalogError(''); setCatalogLoading(false); }}>Sıfırla</button><button type="submit" disabled={!apartment || catalogLoading}>Axtar</button></div>
          </form>
          {catalogLoading && <p className={styles.catalogNotice} role="status">Bina məlumatları yüklənir…</p>}
          {catalogError && <p className={styles.catalogNotice} role="alert">{catalogError} <button onClick={() => void loadBuilding(address.projectId, address.building)}>Yenidən yoxla</button></p>}
        </aside>
        <section className={styles.results} aria-label="Axtarış nəticəsi" aria-live="polite">
          {result ? <table><thead><tr><th>Giriş</th><th>Mərtəbə</th><th>Otaq sayı</th><th>Sahə, m<sup>2</sup></th><th>Qiymət, AZN</th><th>Status</th></tr></thead><tbody><tr tabIndex={0} role="button" aria-label="Mənzili seç və turu bitir" onClick={finish} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); finish(); } }}><td>{result.entrance}</td><td>{result.floor} / {result.floorCount}</td><td>{result.rooms}</td><td>{result.internalArea.toFixed(2)} - {result.externalArea.toFixed(2)}</td><td>XXXXX</td><td><button onClick={event => { event.stopPropagation(); finish(); }}><span>◆</span> Satışdadır</button></td></tr></tbody></table> : <div className={styles.emptySearch}>
            <svg width="130" height="91" viewBox="0 0 180 125" aria-hidden="true"><rect x="16" y="19" width="148" height="25" rx="13" fill="#f7f5fa" /><circle cx="30" cy="32" r="3" fill="none" stroke="#aaa" strokeWidth="1.5" /><path d="m32 34 3 3" stroke="#aaa" /><rect x="149" y="28" width="4" height="7" rx="2" fill="#999" /><path d="M147 33q0 7 8 0m-4 4v3" stroke="#999" fill="none" /><path d="m107 77 30 30" stroke="#333" strokeWidth="12" strokeLinecap="round" /><path d="m103 72 10 10" stroke="#aaa" strokeWidth="11" /><circle cx="86" cy="53" r="30" fill="#359f75" stroke="#c6e5e7" strokeWidth="4" /><path d="M72 36q-12 10-10 21" stroke="#9ff1c4" strokeWidth="7" strokeLinecap="round" fill="none" /></svg>
            <p>Ünvan üzrə axtarış edin.</p>
          </div>}
        </section>
      </div>}
      <div className={styles.navigation}><button className={styles.previous} onClick={back}><ChevronLeft size={15} />Əvvəlki</button>{(!searching || result) && <button className={styles.next} disabled={nextDisabled} onClick={next}>Növbəti<ChevronRight size={17} /></button>}</div>
    </main>}
    {phase === 'method' && <footer className={styles.footer}>{new Date().getFullYear()} © MİDA</footer>}
    {captchaOpen && run.plan[progress] && <div className={styles.modalBackdrop}><div ref={dialog} className={styles.dialog} role="dialog" aria-modal="true" aria-label="Təhlükəsizlik yoxlaması" onKeyDown={event => {
      if (event.key === 'Escape' && !busy.current) setCaptchaOpen(false);
      if (event.key === 'Tab') { const items = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]'); if (!items?.length) return; const first = items[0], last = items[items.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } }
    }}><button className={styles.closeDialog} aria-label="Bağla" disabled={busy.current} onClick={() => setCaptchaOpen(false)}><X size={18} /></button>{renderCaptcha(run.plan[progress].type)}{verified && <div className={styles.verified}><Check size={32} />TƏSDİQLƏNDİ ✓</div>}</div></div>}
  </div>;
}
