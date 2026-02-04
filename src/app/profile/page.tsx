'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { logoutUser } from '@/store/slices/authSlice';
import { getUserChapcaSessions, ChapcaSession } from '@/lib/chapcaSessions';
import { getUserAimSessions, AimSession } from '@/lib/aimSessions';
import { getUserSalesSessions, SalesSession } from '@/lib/salesSessions';
import { Timestamp } from 'firebase/firestore';
import { ThemeToggle } from '@/components/ThemeToggle';
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import {
  ArrowLeft,
  LogOut,
  History,
  Filter,
  Calendar,
  Clock,
  ChevronRight,
  ChevronDown,
  ShieldCheck,
  Target,
  Search,
  RefreshCw,
  XCircle,
  Trophy,
  Activity,
  User,
  Plus,
  ShoppingCart,
  AlertCircle
} from 'lucide-react';

export default function ProfilePage() {
  const dispatch = useAppDispatch();
  const { user, isAuthenticated, isLoading } = useAppSelector((state) => state.auth);

  // Settings
  const captchaSettings = useAppSelector((state) => state.captcha);
  const router = useRouter();

  // Data State
  const [sessions, setSessions] = useState<(ChapcaSession & { id: string })[]>([]);
  const [aimSessions, setAimSessions] = useState<(AimSession & { id: string })[]>([]);
  // Pagination State
  const [lastDocChapca, setLastDocChapca] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMoreChapca, setHasMoreChapca] = useState(true);
  const [lastDocAim, setLastDocAim] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMoreAim, setHasMoreAim] = useState(true);

  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [activeTab, setActiveTab] = useState<'chapca' | 'aim' | 'sales'>('chapca');
  const [salesSessions, setSalesSessions] = useState<(SalesSession & { id: string })[]>([]);
  const [lastDocSales, setLastDocSales] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMoreSales, setHasMoreSales] = useState(true);

  // Filters (Note: Firestore pagination with complex filters requires indexes)
  // For now we'll keep simple pagination and filter locally if needed,
  // or fetch based on date once indexes are ready.
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('');

  const pageSize = 8;
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !isAuthenticated && !isLoading) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router, mounted]);

  useEffect(() => {
    if (mounted && user?.email) {
      resetAndLoadData();
    }
  }, [user?.email, activeTab, mounted]);

  const resetAndLoadData = async () => {
    setFetchError(null);
    if (activeTab === 'chapca') {
      setSessions([]);
      setLastDocChapca(null);
      setHasMoreChapca(true);
      await loadMoreChapca(true);
    } else if (activeTab === 'aim') {
      setAimSessions([]);
      setLastDocAim(null);
      setHasMoreAim(true);
      await loadMoreAim(true);
    } else {
      setSalesSessions([]);
      setLastDocSales(null);
      setHasMoreSales(true);
      await loadMoreSales(true);
    }
  };

  const loadMoreChapca = async (isInitial = false) => {
    if (!user?.email || (!isInitial && !hasMoreChapca)) return;

    setIsLoadingSessions(true);
    const cursor = isInitial ? null : lastDocChapca;
    const result = await getUserChapcaSessions(user.email, pageSize, cursor);

    if (!result.error) {
      if (isInitial) {
        setSessions(result.sessions);
      } else {
        setSessions(prev => [...prev, ...result.sessions]);
      }
      setLastDocChapca(result.lastDoc as any);
      setHasMoreChapca(result.sessions.length === pageSize);
    }
    setIsLoadingSessions(false);
  };

  const loadMoreAim = async (isInitial = false) => {
    if (!user?.email || (!isInitial && !hasMoreAim)) return;

    setIsLoadingSessions(true);
    const cursor = isInitial ? null : lastDocAim;
    const result = await getUserAimSessions(user.email, pageSize, cursor);

    if (!result.error) {
      if (isInitial) {
        setAimSessions(result.sessions);
      } else {
        setAimSessions(prev => [...prev, ...result.sessions]);
      }
      setLastDocAim(result.lastDoc as any);
      setHasMoreAim(result.sessions.length === pageSize);
    }
    setIsLoadingSessions(false);
  };

  const loadMoreSales = async (isInitial = false) => {
    if (!user?.email || (!isInitial && !hasMoreSales)) return;

    setIsLoadingSessions(true);
    const cursor = isInitial ? null : lastDocSales;
    const result = await getUserSalesSessions(user.email, pageSize, cursor);

    if (!result.error) {
      if (isInitial) {
        setSalesSessions(result.sessions);
      } else {
        setSalesSessions(prev => [...prev, ...result.sessions]);
      }
      setLastDocSales(result.lastDoc as any);
      setHasMoreSales(result.sessions.length === pageSize);
    } else {
      setFetchError(result.error);
    }
    setIsLoadingSessions(false);
  };

  const applyFilters = () => {
    resetAndLoadData();
  };

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setStartTime('');
    setEndTime('');
  };

  const formatDateTime = (timestamp: Timestamp): string => {
    const date = timestamp.toDate();
    return date.toLocaleString('az-AZ', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')} san`;
  };

  const currentSessions = activeTab === 'chapca' ? sessions : activeTab === 'aim' ? aimSessions : salesSessions;
  const hasMore = activeTab === 'chapca' ? hasMoreChapca : activeTab === 'aim' ? hasMoreAim : hasMoreSales;
  const loadMore = activeTab === 'chapca' ? loadMoreChapca : activeTab === 'aim' ? loadMoreAim : loadMoreSales;

  const handleLogout = async () => {
    await dispatch(logoutUser());
    router.push('/login');
  };

  const toggleSession = (sessionId: string) => {
    setExpandedSessions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sessionId)) newSet.delete(sessionId);
      else newSet.add(sessionId);
      return newSet;
    });
  };

  if (!mounted || isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 border-4 border-[#00965e]/20 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-t-[#00965e] rounded-full animate-spin"></div>
          </div>
          <p className="mt-6 text-white/50 font-medium tracking-widest uppercase text-[11px]">Tarixçə yüklənir...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden font-sans bg-[#0a0a0a] text-white">
      {/* Background */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/bgimage2.jpg')" }}
      >
        <div className="absolute inset-0 bg-black/85 backdrop-blur-[2px]"></div>
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header */}
        <header className="px-8 py-5 border-b border-white/5 backdrop-blur-md bg-white/5 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-6">
              <button
                onClick={() => router.push('/')}
                className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-[#00965e]/50 transition-all group"
              >
                <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
              </button>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gradient-to-tr from-[#00965e] to-[#4fbfa3] rounded-xl flex items-center justify-center shadow-lg">
                  <User className="text-white w-6 h-6" />
                </div>
                <h1 className="text-xl font-black uppercase tracking-tight">Profil Tarixçəsi</h1>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <ThemeToggle />
              <button
                onClick={handleLogout}
                className="h-10 px-4 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2 text-[13px] font-bold text-white/70 hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-400 transition-all"
              >
                <LogOut size={18} />
                <span className="hidden sm:inline">Çıxış</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto w-full px-8 py-12 flex flex-col md:flex-row gap-10">

          {/* Sidebar - Filters */}
          <aside className="w-full md:w-[320px] space-y-6">
            <div className="bg-white/5 backdrop-blur-xl rounded-[32px] border border-white/10 p-8 sticky top-32 shadow-2xl">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-[11px] font-black text-[#00965e] uppercase tracking-[3px]">Filtrlər</h3>
                <button
                  onClick={clearFilters}
                  className="p-2 rounded-lg hover:bg-white/5 text-white/30 hover:text-[#f07183] transition-all"
                  title="Sıfırla"
                >
                  <RefreshCw size={16} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest ml-1">Başlanğıc Tarixi</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/5 rounded-2xl outline-none focus:border-[#00965e]/50 focus:bg-white/10 transition-all text-sm font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest ml-1">Son Tarix</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/5 rounded-2xl outline-none focus:border-[#00965e]/50 focus:bg-white/10 transition-all text-sm font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest ml-1">Saat (Başlanğıc)</label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full px-4 py-3 bg-white/5 border border-white/5 rounded-2xl outline-none focus:border-[#00965e]/50 focus:bg-white/10 transition-all text-sm font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest ml-1">Saat (Son)</label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full px-4 py-3 bg-white/5 border border-white/5 rounded-2xl outline-none focus:border-[#00965e]/50 focus:bg-white/10 transition-all text-sm font-medium"
                    />
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* Content Area */}
          <section className="flex-1 space-y-8 animate-in fade-in slide-in-from-right-8 duration-700">
            {/* Tabs Panel */}
            <div className="bg-white/5 backdrop-blur-xl rounded-full p-1.5 border border-white/10 inline-flex flex-wrap shadow-xl">
              <button
                onClick={() => setActiveTab('chapca')}
                className={`flex items-center gap-2 px-8 py-3 rounded-full text-[13px] font-black uppercase tracking-wider transition-all ${activeTab === 'chapca' ? 'bg-[#00965e] text-white shadow-lg' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
              >
                <ShieldCheck size={18} />
                Security ({sessions.length})
              </button>
              <button
                onClick={() => setActiveTab('aim')}
                className={`flex items-center gap-2 px-8 py-3 rounded-full text-[13px] font-black uppercase tracking-wider transition-all ${activeTab === 'aim' ? 'bg-[#00965e] text-white shadow-lg' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
              >
                <Target size={18} />
                Simulation ({aimSessions.length})
              </button>
              <button
                onClick={() => setActiveTab('sales')}
                className={`flex items-center gap-2 px-8 py-3 rounded-full text-[13px] font-black uppercase tracking-wider transition-all ${activeTab === 'sales' ? 'bg-[#00965e] text-white shadow-lg' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
              >
                <ShoppingCart size={18} />
                Sales ({salesSessions.length})
              </button>
            </div>

            {/* List */}
            <div className="space-y-4">
              {isLoadingSessions ? (
                <div className="py-20 text-center text-white/20 uppercase font-black tracking-[4px]">Datalar alınır...</div>
              ) : fetchError ? (
                <div className="bg-red-500/10 backdrop-blur-xl rounded-[32px] border border-red-500/20 p-12 text-center max-w-2xl mx-auto">
                  <AlertCircle size={40} className="text-red-500 mx-auto mb-4" />
                  <h3 className="text-lg font-black text-white uppercase mb-2">Məlumat yüklənərkən xəta baş verdi</h3>
                  <p className="text-white/40 text-sm mb-6 leading-relaxed">
                    Firestore indeksləşdirmə tələb edə bilər. Əgər bu ilk istifadənizdirsə, zəhmət olmasa indeksin yaradılmasını gözləyin.
                  </p>
                  <div className="bg-black/40 p-3 rounded-xl border border-white/5 font-mono text-[10px] text-red-400 break-all mb-6">
                    {fetchError}
                  </div>
                  <button onClick={resetAndLoadData} className="px-8 py-3 bg-white/5 border border-white/10 rounded-full text-[12px] font-black uppercase hover:bg-white/10 transition-all">
                    Yenidən yoxla
                  </button>
                </div>
              ) : currentSessions.length === 0 ? (
                <div className="bg-white/5 backdrop-blur-xl rounded-[32px] border border-white/10 p-20 text-center">
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Search className="text-white/20" size={24} />
                  </div>
                  <p className="text-white/40 font-bold tracking-widest uppercase text-sm">Nəticə tapılmadı</p>
                </div>
              ) : (
                <>
                  {currentSessions.map((session: any) => {
                    const isExpanded = expandedSessions.has(session.id);
                    const isChapca = activeTab === 'chapca';

                    return (
                      <div key={session.id} className="group outline-none">
                        <div
                          onClick={() => toggleSession(session.id)}
                          className={`bg-white/5 backdrop-blur-md rounded-[24px] border border-white/10 p-6 flex items-center justify-between cursor-pointer hover:bg-white/10 hover:border-[#00965e]/30 transition-all duration-300 ${isExpanded ? 'bg-white/10 border-[#00965e]/40 rounded-b-none' : ''}`}
                        >
                          <div className="flex items-center gap-6">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${activeTab === 'chapca' ? 'bg-[#00965e]/20 text-[#00965e]' : activeTab === 'aim' ? 'bg-[#4fbfa3]/20 text-[#4fbfa3]' : 'bg-yellow-500/20 text-yellow-500'}`}>
                              {activeTab === 'chapca' ? <ShieldCheck size={24} /> : activeTab === 'aim' ? <Target size={24} /> : <ShoppingCart size={24} />}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[15px] font-black text-white">{formatDateTime(session.createdAt)}</span>
                              <div className="flex items-center gap-3 mt-1">
                                {activeTab === 'chapca' ? (
                                  <>
                                    <span className="text-[11px] font-black text-green-500 uppercase tracking-tighter">{(session as ChapcaSession).chapcas.filter(c => c.isCorrect).length} Uğurlu</span>
                                    <span className="w-1 h-1 bg-white/20 rounded-full"></span>
                                    <span className="text-[11px] font-black text-red-500 uppercase tracking-tighter">{(session as ChapcaSession).chapcas.filter(c => !c.isCorrect).length} Səhv</span>
                                  </>
                                ) : activeTab === 'aim' ? (
                                  <>
                                    <span className="text-[11px] font-black text-white/40 uppercase tracking-tighter">Score: {(session as AimSession).score}</span>
                                    <span className="w-1 h-1 bg-white/20 rounded-full"></span>
                                    <span className="text-[11px] font-black text-[#00965e] uppercase tracking-tighter">Level: {(session as AimSession).level}</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="text-[11px] font-black text-yellow-500 uppercase tracking-tighter">{(session as SalesSession).project}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-12 text-right">
                            <div className="hidden sm:flex flex-col">
                              <span className="text-[10px] font-black text-white/30 uppercase tracking-[2px] mb-1">Müddət</span>
                              <span className="text-[15px] font-black text-white tracking-tight">{formatDuration(session.totalDuration || session.totalDurationSeconds * 1000)}</span>
                            </div>
                            <div className={`p-2 rounded-xl bg-white/5 group-hover:bg-[#00965e]/20 transition-all ${isExpanded ? 'rotate-180 bg-[#00965e]/20' : ''}`}>
                              <ChevronDown size={20} className={isExpanded ? 'text-[#00965e]' : 'text-white/20'} />
                            </div>
                          </div>
                        </div>

                        {/* Details Grid */}
                        {isExpanded && (
                          <div className="bg-white/[0.07] backdrop-blur-md rounded-b-[24px] border-x border-b border-[#00965e]/20 p-8 animate-in slide-in-from-top-2 duration-300">
                            {isChapca ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {(session as ChapcaSession).chapcas.map((cap, idx) => (
                                  <div key={idx} className={`p-4 rounded-2xl border ${cap.isCorrect ? 'bg-green-500/5 border-green-500/10' : 'bg-red-500/5 border-red-500/10'}`}>
                                    <div className="flex justify-between items-start mb-3">
                                      <span className="text-[10px] font-black uppercase tracking-widest text-white/40">#{idx + 1} {cap.type}</span>
                                      {cap.isCorrect ? <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e]"></div> : <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]"></div>}
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-[13px] font-black text-white/90 mb-1">{cap.isCorrect ? 'Uğurlu Verifikasiya' : 'Uğursuz Cəhd'}</span>
                                      <span className="text-[11px] font-bold text-white/30">{formatDuration(cap.duration)} sərf olundu</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : activeTab === 'aim' ? (
                              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
                                <div className="flex flex-col gap-1 p-5 rounded-3xl bg-white/5 border border-white/10 hover:border-[#00965e]/40 transition-all">
                                  <Activity size={24} className="mx-auto mb-2 text-[#4fbfa3]" />
                                  <span className="text-[11px] font-black text-white/30 uppercase tracking-[2px]">Dəqiqlik</span>
                                  <span className="text-2xl font-black italic">{(session as AimSession).accuracy.toFixed(1)}%</span>
                                </div>
                                <div className="flex flex-col gap-1 p-5 rounded-3xl bg-white/5 border border-white/10 hover:border-[#00965e]/40 transition-all">
                                  <XCircle size={24} className="mx-auto mb-2 text-red-500" />
                                  <span className="text-[11px] font-black text-white/30 uppercase tracking-[2px]">Yalnış</span>
                                  <span className="text-2xl font-black italic">{(session as AimSession).misses}</span>
                                </div>
                                <div className="flex flex-col gap-1 p-5 rounded-3xl bg-white/5 border border-white/10 hover:border-[#00965e]/40 transition-all">
                                  <Trophy size={24} className="mx-auto mb-2 text-yellow-500" />
                                  <span className="text-[11px] font-black text-white/30 uppercase tracking-[2px]">Xal</span>
                                  <span className="text-2xl font-black italic">{(session as AimSession).score}</span>
                                </div>
                                <div className="flex flex-col gap-1 p-5 rounded-3xl bg-white/5 border border-white/10 hover:border-[#00965e]/40 transition-all">
                                  <RefreshCw size={24} className="mx-auto mb-2 text-blue-500" />
                                  <span className="text-[11px] font-black text-white/30 uppercase tracking-[2px]">Rejim</span>
                                  <span className="text-[14px] font-black uppercase tracking-tight">{(session as AimSession).gameMode}</span>
                                </div>
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
                                <div className="flex flex-col gap-1 p-5 rounded-3xl bg-white/5 border border-white/10 hover:border-[#00965e]/40 transition-all">
                                  <Clock size={24} className="mx-auto mb-2 text-yellow-500" />
                                  <span className="text-[11px] font-black text-white/30 uppercase tracking-[2px]">Step 1 (Seçimlər)</span>
                                  <span className="text-2xl font-black italic">{(session as SalesSession).step1Duration.toFixed(1)}s</span>
                                </div>
                                <div className="flex flex-col gap-1 p-5 rounded-3xl bg-white/5 border border-white/10 hover:border-[#00965e]/40 transition-all">
                                  <Search size={24} className="mx-auto mb-2 text-blue-400" />
                                  <span className="text-[11px] font-black text-white/30 uppercase tracking-[2px]">Step 2 (Axtarış)</span>
                                  <span className="text-2xl font-black italic">{(session as SalesSession).step2Duration.toFixed(1)}s</span>
                                </div>
                                <div className="flex flex-col gap-1 p-5 rounded-3xl bg-white/5 border border-white/10 hover:border-[#00965e]/40 transition-all">
                                  <ShieldCheck size={24} className="mx-auto mb-2 text-[#00965e]" />
                                  <span className="text-[11px] font-black text-white/30 uppercase tracking-[2px]">Captcha</span>
                                  <span className="text-2xl font-black italic">{(session as SalesSession).captchaDuration.toFixed(1)}s</span>
                                </div>
                                <div className="flex flex-col gap-1 p-5 rounded-3xl bg-white/5 border border-white/10 hover:border-[#00965e]/40 transition-all">
                                  <Activity size={24} className="mx-auto mb-2 text-green-400" />
                                  <span className="text-[11px] font-black text-white/30 uppercase tracking-[2px]">Düzgünlük</span>
                                  <span className="text-2xl font-black italic">{(session as SalesSession).correctCaptchas}/{(session as SalesSession).correctCaptchas + (session as SalesSession).incorrectCaptchas}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Load More Section */}
                  {hasMore && (
                    <div className="flex justify-center mt-12">
                      <button
                        onClick={() => loadMore()}
                        disabled={isLoadingSessions}
                        className="flex items-center gap-3 px-12 py-5 rounded-3xl bg-white/5 border border-white/10 text-[14px] font-black uppercase tracking-widest hover:bg-[#00965e]/20 hover:border-[#00965e]/40 hover:text-white transition-all disabled:opacity-30 group"
                      >
                        {isLoadingSessions ? (
                          <RefreshCw size={20} className="animate-spin text-[#00965e]" />
                        ) : (
                          <Plus size={20} className="group-hover:rotate-90 transition-transform text-[#00965e]" />
                        )}
                        {isLoadingSessions ? 'Yüklənir...' : 'Daha çox göstər'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="px-8 py-10 border-t border-white/5 flex justify-center items-center">
          <div className="flex flex-col items-center text-center">
            <span className="text-[11px] font-black text-white/20 uppercase tracking-[4px] mb-2">MİDA Systems Profile Hub</span>
            <span className="text-[10px] font-bold text-white/10 uppercase tracking-widest font-sans italic">Data Integrity and Simulation Services v2.1.0</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
