'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { logoutUser } from '@/store/slices/authSlice';
import { LogOut, Info, ChevronRight, AlertCircle, RefreshCw } from 'lucide-react';
import {
  CaptchaType
} from '@/store/slices/captchaSlice';
import DateCaptcha from '@/components/DateCaptcha';
import NumberCaptcha from '@/components/NumberCaptcha';
import TextCaptcha from '@/components/TextCaptcha';
import BirthDateCaptcha from '@/components/BirthDateCaptcha';
import { Timestamp } from 'firebase/firestore';
import { saveSalesSession } from '@/lib/salesSessions';

const projects = [
  'Yasamal Yaşayış Kompleksi',
  'Hövsan Yaşayış Kompleksi',
  'Sumqayıt şəhərində güzəştli mənzillər',
  'Gəncə Yaşayış Kompleksi',
  'Yasamal Yaşayış Kompleksinin ikinci mərhələsi',
  'Hövsan Yaşayış Kompleksinin ikinci mərhələsi',
  'Lənkəran Yaşayış Kompleksi',
  'Sumqayıt Yaşayış Kompleksi',
  'Binəqədi Yaşayış Kompleksi',
  'Şirvan Yaşayış Kompleksi',
  'Yevlax Yaşayış Kompleksi',
];

interface CaptchaEntry {
  type: CaptchaType;
  step: number;
  pos: 'sidebar' | 'modal';
}

const RadioButton = ({ label, value, currentValue, onChange, disabled = false, errorSetter }: any) => {
  const isSelected = currentValue === value;

  return (
    <div
      onClick={() => {
        if (!disabled) {
          onChange(value);
          if (errorSetter) errorSetter(false);
        }
      }}
      className={`flex items-center gap-2 cursor-pointer group transition-all duration-150 ${disabled ? 'opacity-40 cursor-not-allowed' : 'opacity-100 hover:opacity-80'}`}
    >
      <div className="relative flex items-center justify-center">
        <div className={`w-4 h-4 border rounded-full flex items-center justify-center transition-all duration-200 ${isSelected
          ? 'border-indigo-600 bg-white ring-2 ring-indigo-50'
          : 'border-gray-300 bg-white group-hover:border-gray-400'
          }`}>
          {isSelected && <div className="w-2 h-2 bg-indigo-600 rounded-full animate-in zoom-in-50 duration-200" />}
        </div>
      </div>
      <span className={`text-[14px] select-none transition-colors ${isSelected ? 'text-gray-900 font-bold' : 'text-gray-400 font-medium'
        }`}>
        {label}
      </span>
    </div>
  );
};

const SalesDemoContent: React.FC = () => {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);

  // Settings
  const captchaSettings = useAppSelector((state) => state.captcha);

  // Flow State
  const [timer, setTimer] = useState(10);
  const [activeStep, setActiveStep] = useState(1);
  const [selectedProject, setSelectedProject] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [selectionMethod, setSelectionMethod] = useState('');
  const [selectedRooms, setSelectedRooms] = useState<number[]>([]);
  const [showProjectError, setShowProjectError] = useState(false);
  const [showPaymentError, setShowPaymentError] = useState(false);
  const [showSelectionError, setShowSelectionError] = useState(false);

  // CAPTCHA Sequence Plan
  const [captchaPlan, setCaptchaPlan] = useState<CaptchaEntry[]>([]);
  const [globalProgress, setGlobalProgress] = useState(0); // Which captcha index we are solving
  const [isCurrentCaptchaVerified, setIsCurrentCaptchaVerified] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Metrics State
  const [simulationStartTime] = useState<number>(Date.now());
  const [simulationEndTime, setSimulationEndTime] = useState<number | null>(null);
  const [liveElapsed, setLiveElapsed] = useState<number>(0);
  const [step1Duration, setStep1Duration] = useState(0);
  const [step2Duration, setStep2Duration] = useState(0);
  const [captchaTotalDuration, setCaptchaTotalDuration] = useState(0);
  const [correctCaptchas, setCorrectCaptchas] = useState(0);
  const [incorrectCaptchas, setIncorrectCaptchas] = useState(0);
  const [captchaLogs, setCaptchaLogs] = useState<{ type: string; duration: number }[]>([]);
  const [showDetailedLogs, setShowDetailedLogs] = useState(false);
  const [captchaKey, setCaptchaKey] = useState(0); // Used to force refresh captcha component
  const [activeStepStart, setActiveStepStart] = useState<number>(Date.now());
  const [captchaStartTime, setCaptchaStartTime] = useState<number | null>(null);

  // Helper to pick a random type
  const pickType = (exclude?: CaptchaType) => {
    const allowed = captchaSettings.allowedTypes;
    if (allowed.length === 0) return 'text';
    const filtered = exclude ? allowed.filter(t => t !== exclude) : allowed;
    const finalAllowed = filtered.length > 0 ? filtered : allowed;
    return finalAllowed[Math.floor(Math.random() * finalAllowed.length)];
  };

  // Generate Plan on Mount or Settings change
  useEffect(() => {
    if (!captchaSettings.enabled) {
      setCaptchaPlan([]);
      setGlobalProgress(0);
      setIsCurrentCaptchaVerified(false);
      return;
    }

    const total = captchaSettings.requiredCount;
    const newPlan: CaptchaEntry[] = [];

    // Determine split between Step 1 and Step 2
    let step1Count = 0;

    if (total === 1) {
      // If only 1 is required, always show it in Step 1 to make it consistent for the user
      step1Count = 1;
    } else if (total === 2) {
      step1Count = 1; // Even split
    } else {
      // For larger numbers, random split but ensure at least 1 in each step for visibility
      const min = 1;
      const max = total - 1;
      step1Count = Math.floor(Math.random() * (max - min + 1)) + min;
    }

    const step2Count = total - step1Count;

    let lastType: CaptchaType | undefined;

    // Generate Step 1 Captchas
    for (let i = 0; i < step1Count; i++) {
      const type = pickType(lastType);
      lastType = type;
      newPlan.push({
        type,
        step: 1,
        pos: Math.random() > 0.4 ? 'modal' : 'sidebar' // Slightly favored towards modal
      });
    }

    // Generate Step 2 Captchas
    for (let i = 0; i < step2Count; i++) {
      const type = pickType(lastType);
      lastType = type;
      newPlan.push({
        type,
        step: 2,
        pos: Math.random() > 0.4 ? 'modal' : 'sidebar'
      });
    }

    setCaptchaPlan(newPlan);
    setGlobalProgress(0);
    setIsCurrentCaptchaVerified(false);
  }, [captchaSettings.requiredCount, captchaSettings.allowedTypes, captchaSettings.enabled]);

  // Live Simulation Timer
  useEffect(() => {
    if (activeStep >= 3) return;

    const interval = setInterval(() => {
      setLiveElapsed(Date.now() - simulationStartTime);
    }, 10); // Update every 10ms for smooth display

    return () => clearInterval(interval);
  }, [simulationStartTime, activeStep]);

  // Countdown timer for navigation
  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTimer = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatLiveTimer = (ms: number) => {
    const totalSeconds = ms / 1000;
    const seconds = Math.floor(totalSeconds);
    const dec = Math.floor((totalSeconds - seconds) * 10);
    return `${seconds}.${dec}`;
  };

  // Logic: Is there a captcha pending for CURRENT step?
  const currentStepCaptchas = captchaPlan.filter(c => c.step === activeStep);
  const solvedCountInCurrentStep = captchaPlan.slice(0, globalProgress).filter(c => c.step === activeStep).length;
  const isAllStepCaptchasSolved = solvedCountInCurrentStep >= currentStepCaptchas.length;

  const currentCaptcha = captchaPlan[globalProgress];
  const isCurrentCaptchaInThisStep = currentCaptcha && currentCaptcha.step === activeStep;

  // Track Captcha Start Time
  useEffect(() => {
    const isModalVisible = isModalOpen && currentCaptcha?.pos === 'modal';
    const isSidebarVisible = currentCaptcha?.pos === 'sidebar';
    const isVisibleInThisStep = isCurrentCaptchaInThisStep && (isModalVisible || isSidebarVisible);

    if (isVisibleInThisStep && !isCurrentCaptchaVerified) {
      if (!captchaStartTime) {
        setCaptchaStartTime(Date.now());
      }
    } else if (isCurrentCaptchaVerified) {
      // Keep timer until handleVerify captures it
    } else {
      setCaptchaStartTime(null);
    }
  }, [globalProgress, activeStep, isCurrentCaptchaInThisStep, isCurrentCaptchaVerified, isModalOpen, currentCaptcha]);

  const handleVerify = React.useCallback((isCorrect: boolean) => {
    if (isCurrentCaptchaVerified) return;

    if (isCorrect) {
      setCorrectCaptchas(prev => prev + 1);
      // Capture duration IMMEDIATELY
      if (captchaStartTime) {
        const duration = (Date.now() - captchaStartTime) / 1000;
        setCaptchaTotalDuration(prev => prev + duration);
        // Log individual captcha
        const capType = currentCaptcha?.type || 'unknown';
        setCaptchaLogs(prev => [...prev, { type: capType, duration }]);
      }

      setIsCurrentCaptchaVerified(true);

      // Auto-advance progress after success delay
      setTimeout(() => {
        const nextIdx = globalProgress + 1;
        setGlobalProgress(nextIdx);
        setIsCurrentCaptchaVerified(false);
        setCaptchaStartTime(null); // Reset for next captcha
        setCaptchaKey(prev => prev + 1); // Reset for next captcha type

        // Check if next captcha is ALSO a modal in this step
        const nextCap = captchaPlan[nextIdx];
        const shouldKeepOpen = nextCap && nextCap.step === activeStep && nextCap.pos === 'modal';

        if (!shouldKeepOpen) {
          setIsModalOpen(false);
        }
      }, 1000);
    } else {
      setIncorrectCaptchas(prev => prev + 1);
      // Optional: Visual shake or refresh the captcha on wrong answer
      setTimeout(() => {
        setCaptchaKey(prev => prev + 1); // Refresh the current captcha to show a new one/reset
      }, 500);
    }
  }, [globalProgress, captchaPlan, activeStep, captchaStartTime, isCurrentCaptchaVerified, setCorrectCaptchas, setIncorrectCaptchas, setCaptchaKey]);

  const handleNext = () => {
    if (activeStep === 1) {
      // Validate form
      let valid = true;
      if (!selectedProject || selectedProject === '') { setShowProjectError(true); valid = false; }
      if (paymentMethod !== 'mortgage') { setShowPaymentError(true); valid = false; }
      if (selectionMethod !== 'parameters') { setShowSelectionError(true); valid = false; }
      if (!valid) return;

      // Check captchas for Step 1
      if (!isAllStepCaptchasSolved) {
        if (currentCaptcha && currentCaptcha.pos === 'modal') {
          setIsModalOpen(true);
        } else {
          // Visual feedback for sidebar captcha
          const sidebarElement = document.getElementById('sidebar-captcha-container');
          if (sidebarElement) {
            sidebarElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            sidebarElement.classList.add('animate-shake');
            setTimeout(() => sidebarElement.classList.remove('animate-shake'), 500);
          }
          alert('Zəhmət olmasa təhlükəsizlik yoxlamasını tamamlayın.');
        }
        return;
      }

      const duration = (Date.now() - activeStepStart) / 1000;
      setStep1Duration(duration);
      setActiveStep(2);
      setActiveStepStart(Date.now());
    }
    // Step 2 Next button is removed
  };

  const handleSearch = () => {
    if (!isAllStepCaptchasSolved) {
      if (currentCaptcha.pos === 'sidebar') {
        alert('Zəhmət olmasa yan paneldəki təhlükəsizlik yoxlamasını tamamlayın.');
      } else {
        setIsModalOpen(true);
      }
      return;
    }

    setIsSearching(true);
    // Simulate real network delay for "pulling data"
    setTimeout(() => {
      const results = [];
      const count = Math.floor(Math.random() * 20) + 10;
      for (let i = 0; i < count; i++) {
        // Filter room logic if rooms selected
        const roomCount = selectedRooms.length > 0
          ? selectedRooms[Math.floor(Math.random() * selectedRooms.length)]
          : (Math.floor(Math.random() * 3) + 1);

        results.push({
          building: Math.floor(Math.random() * 20) + 1,
          entrance: Math.floor(Math.random() * 5) + 1,
          floor: `${Math.floor(Math.random() * 9) + 1}/9`,
          apartment: Math.floor(Math.random() * 100) + 1,
          rooms: roomCount,
          area: (45 + (Math.random() * 40)).toFixed(1),
          price: 45000 + (roomCount * 15000) + Math.floor(Math.random() * 5000)
        });
      }
      setSearchResults(results);
      setIsSearching(false);
      setShowResults(true);
    }, 800);
  };

  const handleSelectResult = async () => {
    const duration = (Date.now() - activeStepStart) / 1000;
    const finalStep2Duration = duration;
    setStep2Duration(finalStep2Duration);

    const endTime = Date.now();
    setSimulationEndTime(endTime);
    setActiveStep(3);

    // Save to Firestore
    if (user?.email) {
      const totalSessionDuration = (endTime - simulationStartTime);
      const sessionData = {
        email: user.email,
        startTime: Timestamp.fromMillis(simulationStartTime),
        endTime: Timestamp.fromMillis(endTime),
        totalDuration: totalSessionDuration,
        totalDurationSeconds: Math.round(totalSessionDuration / 1000),
        step1Duration: step1Duration,
        step2Duration: finalStep2Duration,
        captchaDuration: captchaTotalDuration,
        correctCaptchas: correctCaptchas,
        incorrectCaptchas: incorrectCaptchas,
        project: selectedProject
      };
      await saveSalesSession(sessionData);
    }
  };

  const toggleRoom = (room: number) => {
    setSelectedRooms(prev =>
      prev.includes(room)
        ? prev.filter(r => r !== room)
        : [...prev, room]
    );
  };

  const renderCaptcha = (type: CaptchaType, onVerify: (val: boolean) => void) => {
    const k = `cap-${globalProgress}-${captchaKey}`;
    switch (type) {
      case 'date': return <DateCaptcha key={k} correctDate={captchaSettings.dateConfig.todayDate} onVerify={onVerify} />;
      case 'number': return <NumberCaptcha key={k} onVerify={onVerify} />;
      case 'text': return <TextCaptcha key={k} onVerify={onVerify} />;
      case 'birthdate': return <BirthDateCaptcha key={k} correctDate={captchaSettings.dateConfig.birthDate} onVerify={onVerify} />;
      default: return null;
    }
  };


  return (
    <div className="min-h-screen bg-[#fcfcfc] flex flex-col font-sans">
      <header className="bg-white px-8 py-4 flex justify-between items-center border-b border-gray-100 h-16 sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-center">
            <svg width="40" height="30" viewBox="0 0 40 30" fill="none"><path d="M20 2L35 15H28V26H12V15H5L20 2Z" fill="#add8e6" stroke="#0092c4" /></svg>
            <span className="text-[12px] font-bold text-[#0092c4] tracking-wider -mt-1">MİDA</span>
          </div>

          {/* Live High-Precision Timer */}
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 px-4 py-1.5 rounded-full shadow-inner">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_5px_rgba(239,68,68,0.5)]"></div>
            <span className="text-[18px] font-black tabular-nums text-gray-800 min-w-[50px] tracking-tight">
              {formatLiveTimer(activeStep >= 3 && simulationEndTime ? (simulationEndTime - simulationStartTime) : liveElapsed)}
              <span className="text-[12px] font-bold text-gray-400 ml-1">san</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[14px] font-medium text-gray-700 uppercase">HÜSEYNOV İLKİN İSLAM OĞLU</span>
          <button className="flex items-center gap-2 text-gray-500 hover:text-gray-800 text-[14px]" onClick={() => dispatch(logoutUser()).then(() => router.push('/login'))}>
            <span>Çıxış et</span><LogOut size={16} />
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto w-full py-12 px-6">
        {/* Step Indicator */}
        <div className="flex justify-center items-start relative px-4 mx-auto max-w-5xl mb-12">
          <div className="absolute top-4 left-0 right-0 h-[1px] bg-gray-100 -z-0"></div>
          {[{ n: 1, l: 'Seçimlər' }, { n: 2, l: 'Axtarış' }, { n: 3, l: 'Mənzil' }, { n: 4, l: 'Ərizə' }].map((s, idx) => (
            <div key={s.n} className={`flex flex-col items-center z-10 ${idx === 0 ? 'mr-auto' : idx === 3 ? 'ml-auto' : 'mx-auto'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold mb-2 border ${activeStep === s.n ? 'bg-[#fff9c2] text-[#bca35a] border-[#bca35a]' : activeStep > s.n ? 'bg-[#e5f5ef] text-[#48b291] border-[#48b291]' : 'bg-white text-gray-200 border-gray-100'}`}>
                {activeStep > s.n ? '✓' : s.n}
              </div>
              <span className={`text-[12px] font-semibold ${activeStep >= s.n ? 'text-gray-900' : 'text-gray-300'}`}>{s.l}</span>
            </div>
          ))}
        </div>


        {/* Content Area */}
        {activeStep === 1 && (
          <div className="flex flex-col md:flex-row gap-8 items-start justify-center max-w-[1240px] mx-auto w-full">
            <div className="flex-1 flex flex-col relative min-h-[480px]">
              {/* Tab */}
              <div className="self-start bg-white border-t border-l border-r border-gray-100 px-6 py-2 rounded-t-lg shadow-sm -mb-px z-10 relative">
                <span className="text-[13px] font-bold text-gray-500 uppercase tracking-wide">Mənzil seçimi</span>
              </div>

              {/* Main Card */}
              <div className="w-full bg-white shadow-sm border border-gray-100 p-10 relative overflow-hidden rounded-b-lg rounded-tr-lg flex-1">
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#00965e]"></div>

                <h1 className="text-[28px] font-bold text-gray-800 mb-8 mt-2">Seçimlər</h1>
                <div className="w-full h-[1px] bg-gray-50 mb-8"></div>

                <div className="space-y-8">
                  {/* Project */}
                  <div className="flex flex-col gap-3">
                    <label className="text-[15px] font-bold text-gray-700">Layihə</label>
                    <select
                      value={selectedProject}
                      onChange={(e) => {
                        setSelectedProject(e.target.value);
                        setShowProjectError(false);
                      }}
                      className={`border ${showProjectError ? 'border-[#f07183]' : 'border-gray-200'} rounded-sm px-4 py-3 text-[15px] w-full max-w-xl appearance-none bg-white text-gray-600 outline-none focus:border-green-500 transition-colors`}
                    >
                      <option value="" disabled>Layihəni seçin</option>
                      {projects.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    {showProjectError && <div className="text-[#f07183] text-[13px] font-medium flex items-center gap-1 mt-1"><AlertCircle size={14} /> <span>Layihə seçilməlidir</span></div>}
                  </div>

                  {/* Payment Method */}
                  <div className="flex flex-col gap-3">
                    <label className="text-[15px] font-bold text-gray-700">Ödəniş üsulu</label>
                    <div className="flex gap-12 items-center">
                      <RadioButton label="Öz vəsaiti hesabına" value="own" currentValue={paymentMethod} onChange={setPaymentMethod} errorSetter={setShowPaymentError} />
                      <RadioButton label="İpoteka krediti hesabına" value="mortgage" currentValue={paymentMethod} onChange={setPaymentMethod} hasInfo={true} errorSetter={setShowPaymentError} />
                    </div>
                    {showPaymentError && <div className="text-[#f07183] text-[13px] font-medium flex items-center gap-1 mt-1"><AlertCircle size={14} /> <span>Ödəniş üsulu seçilməlidir</span></div>}
                  </div>

                  {/* Selection Method */}
                  <div className="flex flex-col gap-3">
                    <label className="text-[15px] font-bold text-gray-700">Mənzil seçimi üsulu</label>
                    <div className="flex gap-12 items-center">
                      <RadioButton label="Xəritə üzərində" value="map" currentValue={selectionMethod} onChange={setSelectionMethod} errorSetter={setShowSelectionError} />
                      <RadioButton label="Parametrlər üzrə" value="parameters" currentValue={selectionMethod} onChange={setSelectionMethod} errorSetter={setShowSelectionError} />
                      <RadioButton label="Ünvan üzrə" value="address" currentValue={selectionMethod} onChange={setSelectionMethod} errorSetter={setShowSelectionError} />
                    </div>
                    {showSelectionError && <div className="text-[#f07183] text-[13px] font-medium flex items-center gap-1 mt-1"><AlertCircle size={14} /> <span>Seçim üsulu seçilməlidir</span></div>}
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar Captcha Slot for Step 1 */}
            {isCurrentCaptchaInThisStep && currentCaptcha.pos === 'sidebar' && (
              <div
                id="sidebar-captcha-container"
                className="w-[380px] shrink-0 relative mt-10 transition-all flex items-start"
              >
                {renderCaptcha(currentCaptcha.type, handleVerify)}
                {isCurrentCaptchaVerified && (
                  <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center font-black text-[#00965e] z-50 animate-in fade-in zoom-in-95 duration-300 border-2 border-[#00965e]/20 rounded-xl">
                    <div className="w-12 h-12 bg-[#00965e] text-white rounded-full flex items-center justify-center mb-2 shadow-lg shadow-[#00965e]/20">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    </div>
                    <span className="uppercase tracking-[2px] text-sm">TAMAMLANDI ✓</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeStep === 2 && (
          <div className="flex gap-6 items-start max-w-[1280px] mx-auto w-full">
            {/* Left Column: Project Title & Filters */}
            <div className="w-[340px] shrink-0 flex flex-col gap-3">
              {/* Project Title Card */}
              <div className="bg-white border border-gray-100 p-4 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.05)] text-center font-bold text-gray-700 rounded-sm">
                {selectedProject}
              </div>

              {/* Filters Sidebar */}
              <div className="bg-white border border-gray-100 p-6 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.05)] min-h-[520px] rounded-sm flex flex-col">
                <h2 className="text-[16px] font-bold text-gray-800 mb-6">Parametrlər üzrə mənzil seçimi</h2>

                <div className="space-y-6 flex-1">
                  {/* Bina tipi */}
                  <div className="space-y-2">
                    <label className="text-[13px] font-medium text-gray-500">Bina tipi</label>
                    <select className="w-full py-3 px-4 bg-white text-gray-600 font-medium text-[14px] rounded-sm border border-gray-200 outline-none focus:border-[#4fbfa3] transition-colors">
                      <option value="9">9 mərtəbəli</option>
                      <option value="12">12 mərtəbəli</option>
                      <option value="5">5 mərtəbəli</option>
                    </select>
                  </div>

                  {/* Mərtəbə seçimi */}
                  <div className="space-y-2">
                    <label className="text-[13px] font-medium text-gray-500">Mərtəbə seçimi</label>
                    <div className="flex gap-3">
                      <select className="w-full border border-gray-200 rounded-sm p-2.5 text-sm bg-white text-gray-600 outline-none focus:border-gray-300" defaultValue={0}>
                        {Array.from({ length: 13 }, (_, i) => i).map(n => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                      <select className="w-full border border-gray-200 rounded-sm p-2.5 text-sm bg-white text-gray-600 outline-none focus:border-gray-300" defaultValue={0}>
                        {Array.from({ length: 13 }, (_, i) => i).map(n => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Otaq sayı */}
                  <div className="space-y-2">
                    <label className="text-[13px] font-medium text-gray-500">Otaq sayı</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[1, 2, 3].map(room => (
                        <button
                          key={room}
                          onClick={() => toggleRoom(room)}
                          className={`py-2.5 px-2 text-[13px] font-medium rounded-sm border transition-all
                                 ${selectedRooms.includes(room)
                              ? 'bg-[#e5f5ef] text-[#00965e] border-[#00965e]'
                              : 'bg-[#fcfcd] text-gray-600 border-gray-100 bg-gray-50 hover:border-gray-300'
                            }`}
                        >
                          {room} otaqlı
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => toggleRoom(4)}
                      className={`w-full py-2.5 px-2 text-[13px] font-medium rounded-sm border mt-2 transition-colors text-left pl-4
                        ${selectedRooms.includes(4)
                          ? 'bg-[#e5f5ef] text-[#00965e] border-[#00965e]'
                          : 'bg-gray-50 border-gray-100 text-gray-600 hover:border-gray-300'
                        }`}
                    >
                      4 otaqlı
                    </button>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="pt-8 mt-6 border-t border-gray-100 flex items-center justify-between">
                  <button className="text-gray-500 text-[14px] font-medium border-b border-gray-400 pb-0.5 hover:text-gray-800 transition-colors">
                    Sıfırla
                  </button>
                  <button
                    onClick={handleSearch}
                    className="px-10 py-3 bg-[#4fbfa3] text-white font-bold text-[14px] rounded-sm hover:bg-[#3da88e] transition-colors shadow-sm"
                  >
                    Axtar
                  </button>
                </div>
              </div>
            </div>

            {/* Right Content Area */}
            <div className="flex-1 bg-white border border-gray-100 min-h-[600px] shadow-[0_2px_15px_-3px_rgba(0,0,0,0.05)] flex flex-col relative rounded-sm">
              {!showResults ? (
                <div className="flex-1 flex items-center justify-center p-12">
                  <div className="border border-dashed border-gray-300 rounded-lg p-12 flex flex-col items-center justify-center w-full max-w-[400px] h-[300px]">
                    <div className="w-20 h-20 bg-[#e0f2fe] rounded-full flex items-center justify-center mb-6 relative shadow-sm">
                      {isSearching ? (
                        <RefreshCw size={32} className="text-[#00965e] animate-spin" />
                      ) : (
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#00965e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="11" cy="11" r="8"></circle>
                          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                      )}
                    </div>
                    <span className="text-gray-500 font-medium text-[15px]">
                      {isSearching ? "Məlumatlar gətirilir..." : "Parametrlər üzrə axtarış edin."}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col h-full bg-white animate-in fade-in zoom-in-95 duration-300">
                  {/* Table Header */}
                  <div className="flex items-center bg-[#f8f9fa] border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
                    <div className="w-[8%] text-[11px] font-bold text-gray-500 uppercase">BİNA</div>
                    <div className="w-[8%] text-[11px] font-bold text-gray-500 uppercase">GİRİŞ</div>
                    <div className="w-[12%] text-[11px] font-bold text-gray-500 uppercase">MƏRTƏBƏ</div>
                    <div className="w-[12%] text-[11px] font-bold text-gray-500 uppercase">MƏNZİL</div>
                    <div className="w-[15%] text-[11px] font-bold text-gray-500 uppercase">OTAQ SAYI</div>
                    <div className="w-[20%] text-[11px] font-bold text-gray-500 uppercase">SAHƏ, M²</div>
                    <div className="w-[25%] text-[11px] font-bold text-gray-500 uppercase text-right">QİYMƏT, AZN</div>
                  </div>

                  {/* Table Body */}
                  <div className="overflow-y-auto flex-1">
                    {searchResults.map((res, idx) => (
                      <div
                        key={idx}
                        onClick={handleSelectResult}
                        className="flex items-center px-4 py-3 border-b border-gray-100 hover:bg-[#e6f7f1] transition-colors cursor-pointer group"
                      >
                        <div className="w-[8%] text-[13px] font-medium text-gray-700">{res.building}</div>
                        <div className="w-[8%] text-[13px] font-medium text-gray-700">{res.entrance}</div>
                        <div className="w-[12%] text-[13px] font-medium text-gray-700">{res.floor}</div>
                        <div className="w-[12%] text-[13px] font-medium text-gray-700">{res.apartment}</div>
                        <div className="w-[15%] text-[13px] font-medium text-gray-700">{res.rooms}</div>
                        <div className="w-[20%] text-[13px] font-medium text-gray-700">{res.area}</div>
                        <div className="w-[25%] text-[13px] font-bold text-gray-900 text-right group-hover:text-[#00965e]">
                          {res.price.toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar Captcha Slot for Step 2 */}
            {isCurrentCaptchaInThisStep && currentCaptcha.pos === 'sidebar' && (
              <div
                id="sidebar-captcha-container"
                className="w-[380px] shrink-0 relative sticky top-20 transition-all flex items-start"
              >
                {renderCaptcha(currentCaptcha.type, handleVerify)}
                {isCurrentCaptchaVerified && (
                  <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center font-black text-[#00965e] z-50 animate-in fade-in zoom-in-95 duration-300 border-2 border-[#00965e]/20 rounded-xl">
                    <div className="w-12 h-12 bg-[#00965e] text-white rounded-full flex items-center justify-center mb-2 shadow-lg shadow-[#00965e]/20">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    </div>
                    <span className="uppercase tracking-[2px] text-sm">TAMAMLANDI ✓</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeStep === 3 && (
          <div className="w-full min-h-[600px] flex items-center justify-center bg-gray-50/30 p-6">
            <div className="bg-white border border-gray-100 shadow-xl rounded-2xl p-10 max-w-2xl w-full animate-in zoom-in-95 duration-500">
              <div className="text-center mb-10">
                <div className="w-20 h-20 bg-[#e5f5ef] text-[#00965e] rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                </div>
                <h2 className="text-[32px] font-bold text-gray-800 mb-2">Simulyasiya Tamamlandı!</h2>
                <p className="text-gray-500 font-medium">Mənzil seçimi prosesi uğurla başa çatdırıldı.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                {/* Global Total */}
                <div className="md:col-span-2 bg-[#00965e] p-8 rounded-2xl border border-[#007a4d] shadow-lg transform hover:scale-[1.02] transition-all">
                  <div className="text-[13px] font-black text-white/70 uppercase tracking-[4px] mb-2">SİMULYASİYA CƏMİ</div>
                  <div className="text-[42px] font-black text-white tabular-nums leading-none">
                    {simulationEndTime && simulationStartTime ? ((simulationEndTime - simulationStartTime) / 1000).toFixed(1) : '0.0'}
                    <span className="text-xl font-bold ml-1 opacity-60">san</span>
                  </div>
                </div>

                <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 transition-all hover:shadow-md">
                  <div className="text-[13px] font-bold text-gray-400 uppercase tracking-widest mb-1">Step 1 (Seçimlər)</div>
                  <div className="text-[28px] font-black text-gray-800 tabular-nums">{step1Duration.toFixed(1)} <span className="text-lg font-bold text-gray-400">san</span></div>
                </div>
                <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 transition-all hover:shadow-md">
                  <div className="text-[13px] font-bold text-gray-400 uppercase tracking-widest mb-1">Step 2 (Axtarış)</div>
                  <div className="text-[28px] font-black text-gray-800 tabular-nums">{step2Duration.toFixed(1)} <span className="text-lg font-bold text-gray-400">san</span></div>
                </div>
                <div className="bg-green-50/50 p-6 rounded-xl border border-green-100 md:col-span-2 transition-all hover:shadow-md">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-[13px] font-bold text-[#00965e]/60 uppercase tracking-widest mb-1">Captcha Analizi</div>
                      <div className="text-[28px] font-black text-[#00965e] tabular-nums">
                        {captchaTotalDuration.toFixed(1)} <span className="text-lg font-bold">san</span>
                      </div>
                      <div className="flex gap-4 mt-2">
                        <div className="flex items-center gap-1.5 text-[13px] font-bold text-green-600">
                          <span className="w-2 h-2 rounded-full bg-green-500"></span>
                          {correctCaptchas} Doğru
                        </div>
                        <div className="flex items-center gap-1.5 text-[13px] font-bold text-red-500">
                          <span className="w-2 h-2 rounded-full bg-red-500"></span>
                          {incorrectCaptchas} Yanlış
                        </div>
                        <button
                          onClick={() => setShowDetailedLogs(!showDetailedLogs)}
                          className="ml-2 text-[11px] font-black text-indigo-500 underline uppercase tracking-widest hover:text-indigo-700"
                        >
                          {showDetailedLogs ? 'Detalları Gizlə' : 'Detalları Göstər'}
                        </button>
                      </div>
                    </div>
                    <div className="w-12 h-12 bg-[#00965e]/10 rounded-full flex items-center justify-center">
                      <RefreshCw size={24} className="text-[#00965e]" />
                    </div>
                  </div>

                  {/* Detailed Captcha Logs */}
                  {showDetailedLogs && (
                    <div className="mt-6 border-t border-green-100 pt-4 animate-in slide-in-from-top-2 duration-300">
                      <div className="space-y-2">
                        {captchaLogs.map((log, i) => (
                          <div key={i} className="flex justify-between items-center bg-white/50 px-4 py-2 rounded-lg border border-green-50">
                            <div className="flex items-center gap-3">
                              <span className="w-5 h-5 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-[10px] font-bold">{i + 1}</span>
                              <span className="text-[13px] font-bold text-gray-600 uppercase tracking-tight">{log.type} Captcha</span>
                            </div>
                            <span className="text-[14px] font-black text-gray-800">{log.duration.toFixed(2)} san</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <button
                  onClick={() => window.location.reload()}
                  className="w-full py-4 bg-[#00965e] text-white rounded-xl font-bold text-lg hover:bg-[#007a4d] transition-all shadow-lg hover:shadow-xl active:scale-[0.98]"
                >
                  Yenidən Başla
                </button>
                <div className="text-center text-gray-400 text-xs font-medium uppercase tracking-wider">
                  Bütün MƏLUMATLAR yalnız SİMULYASİYA ÜÇÜNDÜR
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Unified Modal Component */}
        {isModalOpen && isCurrentCaptchaInThisStep && currentCaptcha.pos === 'modal' && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={() => setIsModalOpen(false)}></div>
            <div className="w-full max-w-[380px] relative">
              {renderCaptcha(currentCaptcha.type, handleVerify)}
              {isCurrentCaptchaVerified && (
                <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center font-black text-[#00965e] z-50 animate-in fade-in zoom-in-95 duration-300 border-2 border-[#00965e]/20 rounded-2xl">
                  <div className="w-12 h-12 bg-[#00965e] text-white rounded-full flex items-center justify-center mb-2 shadow-lg shadow-[#00965e]/20">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  </div>
                  <span className="uppercase tracking-[2px] text-sm">TƏSDİQLƏNDİ ✓</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer Navigation */}
        <div className="flex justify-between items-center mt-12 w-full max-w-[1240px] mx-auto">
          {activeStep < 3 && (
            <button onClick={() => activeStep > 1 && setActiveStep(activeStep - 1)} className="flex items-center gap-1.5 text-[#f07183] text-[15px] font-medium px-4 py-2 hover:bg-red-50 rounded-md transition-colors"><span>‹</span><span>Əvvəlki</span></button>
          )}

          {/* Show Next button ONLY on Step 1 */}
          {activeStep === 1 && (
            <button onClick={handleNext} className="flex items-center bg-[#f07183] text-white rounded-md h-[45px] px-6 shadow-md hover:bg-[#e06173] transition-all ml-auto">
              <div className="flex items-center gap-3">
                <span className="text-[16px] font-bold tabular-nums pr-3 border-r border-white/20">{formatTimer(timer)}</span>
                <span className="text-[16px] font-bold">Növbəti</span><span className="text-[22px] -mb-1">›</span>
              </div>
            </button>
          )}

          {/* On Step 2, show only timer */}
          {activeStep === 2 && (
            <div className="ml-auto bg-gray-50 px-4 py-2 rounded-md border border-gray-200 text-gray-600 font-mono font-bold">
              {formatTimer(timer)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default function SalesPage() {
  const { isAuthenticated, isLoading } = useAppSelector((state) => state.auth);
  const router = useRouter();
  useEffect(() => { if (!isAuthenticated && !isLoading) router.push('/login'); }, [isAuthenticated, isLoading, router]);
  if (isLoading || !isAuthenticated) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-400">Yüklənir...</div>;
  return <SalesDemoContent />;
}
