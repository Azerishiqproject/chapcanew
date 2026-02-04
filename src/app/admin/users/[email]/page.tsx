'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { logoutUser } from '@/store/slices/authSlice';
import { getUserByEmail, User as UserType } from '@/lib/users';
import { getUserChapcaSessions, ChapcaSession } from '@/lib/chapcaSessions';
import { getUserAimSessions, AimSession } from '@/lib/aimSessions';
import { getUserSalesSessions, SalesSession } from '@/lib/salesSessions';
import { Timestamp } from 'firebase/firestore';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  ArrowLeft,
  Mail,
  Phone,
  Shield,
  Calendar,
  Clock,
  Activity,
  ShoppingCart,
  Search,
  ShieldCheck,
  Target,
  ChevronDown,
  LogOut,
  User as UserIcon
} from 'lucide-react';

export default function UserDetailPage() {
  const dispatch = useAppDispatch();
  const { user: currentUser, isAuthenticated, isAdmin, isLoading: authLoading } = useAppSelector((state) => state.auth);
  const router = useRouter();
  const params = useParams();
  const userEmail = params.email as string;

  const [user, setUserData] = useState<UserType | null>(null);
  const [chapcaSessions, setChapcaSessions] = useState<(ChapcaSession & { id: string })[]>([]);
  const [aimSessions, setAimSessions] = useState<(AimSession & { id: string })[]>([]);
  const [salesSessions, setSalesSessions] = useState<(SalesSession & { id: string })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'info' | 'chapca' | 'aim' | 'sales'>('info');
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !isAuthenticated && !authLoading) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router, mounted]);

  useEffect(() => {
    if (mounted && isAuthenticated && !isAdmin) {
      router.push('/');
    }
  }, [isAuthenticated, isAdmin, router, mounted]);

  useEffect(() => {
    if (mounted && userEmail && isAuthenticated && isAdmin) {
      loadUserDetailData();
    }
  }, [userEmail, isAuthenticated, isAdmin, mounted]);

  const loadUserDetailData = async () => {
    if (!userEmail) return;

    setIsLoading(true);
    try {
      // Load user info
      const userResult = await getUserByEmail(decodeURIComponent(userEmail));
      if (userResult.error) {
        console.error('Error loading user:', userResult.error);
        alert('Error loading user data');
        router.push('/admin');
        return;
      }
      setUserData(userResult.user);

      // Load chapca sessions
      const chapcaResult = await getUserChapcaSessions(decodeURIComponent(userEmail));
      if (chapcaResult.error) {
        console.error('Error loading chapca sessions:', chapcaResult.error);
      } else {
        setChapcaSessions(chapcaResult.sessions);
      }

      // Load aim sessions
      const aimResult = await getUserAimSessions(decodeURIComponent(userEmail));
      if (aimResult.error) {
        console.error('Error loading aim sessions:', aimResult.error);
      } else {
        setAimSessions(aimResult.sessions);
      }

      // Load sales sessions
      const salesResult = await getUserSalesSessions(decodeURIComponent(userEmail));
      if (salesResult.error) {
        console.error('Error loading sales sessions:', salesResult.error);
      } else {
        setSalesSessions(salesResult.sessions);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Error loading user data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await dispatch(logoutUser());
    router.push('/login');
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
    const ms = milliseconds % 1000;
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(1, '0')}`;
  };

  // Calculate statistics
  const chapcaStats = {
    totalSessions: chapcaSessions.length,
    correctAttempts: chapcaSessions.reduce((sum, s) => sum + s.chapcas.filter(c => c.isCorrect).length, 0),
    wrongAttempts: chapcaSessions.reduce((sum, s) => sum + s.chapcas.filter(c => !c.isCorrect).length, 0),
    totalDuration: chapcaSessions.reduce((sum, s) => sum + (s.totalDuration || 0), 0),
  };

  const aimStats = {
    totalSessions: aimSessions.length,
    totalScore: aimSessions.reduce((sum, s) => sum + s.score, 0),
    totalMisses: aimSessions.reduce((sum, s) => sum + s.misses, 0),
    avgAccuracy: aimSessions.length > 0
      ? aimSessions.reduce((sum, s) => sum + s.accuracy, 0) / aimSessions.length
      : 0,
    avgLevel: aimSessions.length > 0
      ? aimSessions.reduce((sum, s) => sum + s.level, 0) / aimSessions.length
      : 0,
  };

  const salesStats = {
    totalSessions: salesSessions.length,
    avgStep1: salesSessions.length > 0
      ? salesSessions.reduce((sum, s) => sum + s.step1Duration, 0) / salesSessions.length
      : 0,
    avgStep2: salesSessions.length > 0
      ? salesSessions.reduce((sum, s) => sum + s.step2Duration, 0) / salesSessions.length
      : 0,
    avgCaptcha: salesSessions.length > 0
      ? salesSessions.reduce((sum, s) => sum + s.captchaDuration, 0) / salesSessions.length
      : 0,
    totalCorrect: salesSessions.reduce((sum, s) => sum + s.correctCaptchas, 0),
  };

  const toggleSession = (sessionId: string) => {
    setExpandedSessions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sessionId)) newSet.delete(sessionId);
      else newSet.add(sessionId);
      return newSet;
    });
  };

  if (!mounted || authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 border-4 border-[#00965e]/20 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-t-[#00965e] rounded-full animate-spin"></div>
          </div>
          <p className="mt-6 text-white/50 font-black uppercase tracking-widest text-[11px]">İstifadəçi detalları yüklənir...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin || !currentUser || !user) {
    return null;
  }

  return (
    <div className="min-h-screen relative overflow-hidden font-sans bg-[#0a0a0a] text-white">
      {/* Background Decor */}
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#00965e]/5 rounded-full blur-[120px] -mr-96 -mt-96"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[100px] -ml-48 -mb-48"></div>
      </div>

      <div className="relative z-10 flex flex-col min-h-screen pb-20">
        {/* Header */}
        <header className="px-8 py-5 border-b border-white/5 backdrop-blur-xl bg-white/5 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-6">
              <button
                onClick={() => router.push('/admin')}
                className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-[#00965e]/50 transition-all group"
              >
                <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
              </button>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gradient-to-tr from-[#00965e] to-[#4fbfa3] rounded-xl flex items-center justify-center shadow-lg">
                  <UserIcon size={24} className="text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-black uppercase tracking-tight">İstifadəçi Profili</h1>
                  <span className="text-[10px] font-black text-[#00965e] uppercase tracking-[2px] opacity-80">Məlumat Analitikası</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="hidden lg:flex flex-col text-right">
                <span className="text-[11px] font-black uppercase text-white/40 tracking-wider">Aktiv Seans</span>
                <span className="text-[13px] font-bold text-[#00965e]">{currentUser?.email}</span>
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
          </div>
        </header>

        <main className="max-w-7xl mx-auto w-full px-8 py-12 flex flex-col gap-12">
          {/* User Profile Overview */}
          <section className="bg-white/5 backdrop-blur-3xl rounded-[48px] border border-white/10 p-10 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#00965e]/10 rounded-full blur-[100px] -mr-48 -mt-48 transition-all group-hover:bg-[#00965e]/15"></div>

            <div className="flex flex-col lg:flex-row gap-12 items-start lg:items-center relative z-10">
              <div className="relative">
                <div className="w-32 h-32 rounded-[32px] bg-gradient-to-tr from-[#00965e] to-[#4fbfa3] flex items-center justify-center shadow-2xl shadow-[#00965e]/20 group-hover:scale-105 transition-transform duration-500">
                  <UserIcon size={64} className="text-white" />
                </div>
                <div className={`absolute -bottom-2 -right-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/10 shadow-xl ${user.status === 'admin' ? 'bg-purple-500 text-white' : 'bg-white/10 text-white backdrop-blur-md'}`}>
                  {user.status === 'admin' ? 'Administrator' : 'İstifadəçi'}
                </div>
              </div>

              <div className="flex-1 space-y-8">
                <div>
                  <h2 className="text-3xl font-black uppercase tracking-tighter italic mb-3 text-white group-hover:text-[#00965e] transition-colors">{user.name}</h2>
                  <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-[13px] font-bold text-white/60 hover:text-white hover:bg-white/10 transition-all">
                      <Mail size={14} className="text-[#00965e]" />
                      {user.email}
                    </div>
                    {user.phone && (
                      <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-[13px] font-bold text-white/60 hover:text-white hover:bg-white/10 transition-all">
                        <Phone size={14} className="text-[#00965e]" />
                        {user.phone}
                      </div>
                    )}
                    <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-[13px] font-bold text-white/60">
                      <Calendar size={14} className="text-[#00965e]" />
                      Qeydiyyat: {user.createdAt ? new Date(user.createdAt).toLocaleDateString('az-AZ') : '--.--.----'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Navigation Tabs */}
          <div className="flex flex-col gap-8">
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-1.5 border border-white/10 inline-flex flex-wrap shadow-xl self-start">
              {[
                { id: 'info', label: 'Statistika', icon: Activity },
                { id: 'chapca', label: `Security (${chapcaSessions.length})`, icon: ShieldCheck },
                { id: 'aim', label: `Aim Trainer (${aimSessions.length})`, icon: Target },
                { id: 'sales', label: `Sales (${salesSessions.length})`, icon: ShoppingCart }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2.5 px-6 py-3 rounded-xl text-[12px] font-black uppercase tracking-wider transition-all duration-300 ${activeTab === tab.id ? 'bg-[#00965e] text-white shadow-lg scale-[1.02]' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
                >
                  <tab.icon size={16} />
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              {activeTab === 'info' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Security Stats */}
                  <div className="bg-white/5 backdrop-blur-xl rounded-[40px] border border-white/10 p-8 hover:border-[#00965e]/30 transition-all">
                    <h3 className="text-lg font-black uppercase tracking-tight text-[#00965e] mb-6 flex items-center gap-2.5">
                      <ShieldCheck size={20} />
                      Captcha Analitikası
                    </h3>
                    <div className="grid grid-cols-2 gap-3.5">
                      <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                        <span className="text-[10px] font-black text-white/30 uppercase tracking-[2px]">Seans Sayı</span>
                        <p className="text-xl font-black italic mt-1">{chapcaStats.totalSessions}</p>
                      </div>
                      <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                        <span className="text-[10px] font-black text-white/30 uppercase tracking-[2px]">Düzgünlük</span>
                        <p className="text-xl font-black italic mt-1 text-green-500">{chapcaStats.correctAttempts}</p>
                      </div>
                      <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                        <span className="text-[10px] font-black text-white/30 uppercase tracking-[2px]">Səhv Cəhd</span>
                        <p className="text-xl font-black italic mt-1 text-red-500">{chapcaStats.wrongAttempts}</p>
                      </div>
                      <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                        <span className="text-[10px] font-black text-white/30 uppercase tracking-[2px]">Ümumi Müddət</span>
                        <p className="text-xl font-black italic mt-1">{formatDuration(chapcaStats.totalDuration)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Aim Stats */}
                  <div className="bg-white/5 backdrop-blur-xl rounded-[40px] border border-white/10 p-8 hover:border-[#4fbfa3]/30 transition-all">
                    <h3 className="text-lg font-black uppercase tracking-tight text-[#4fbfa3] mb-6 flex items-center gap-2.5">
                      <Target size={20} />
                      Aim Analitikası
                    </h3>
                    <div className="grid grid-cols-2 gap-3.5">
                      <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                        <span className="text-[10px] font-black text-white/30 uppercase tracking-[2px]">AVG Xal</span>
                        <p className="text-xl font-black italic mt-1">{(aimStats.totalScore / (aimStats.totalSessions || 1)).toFixed(0)}</p>
                      </div>
                      <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                        <span className="text-[10px] font-black text-white/30 uppercase tracking-[2px]">AVG Dəqiqlik</span>
                        <p className="text-xl font-black italic mt-1 text-[#4fbfa3]">{aimStats.avgAccuracy.toFixed(1)}%</p>
                      </div>
                      <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                        <span className="text-[10px] font-black text-white/30 uppercase tracking-[2px]">AVG Səviyyə</span>
                        <p className="text-xl font-black italic mt-1">{aimStats.avgLevel.toFixed(1)}</p>
                      </div>
                      <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                        <span className="text-[10px] font-black text-white/30 uppercase tracking-[2px]">Cəmi Miss</span>
                        <p className="text-xl font-black italic mt-1 text-red-500">{aimStats.totalMisses}</p>
                      </div>
                    </div>
                  </div>

                  {/* Sales Stats */}
                  <div className="bg-white/5 backdrop-blur-xl rounded-[40px] border border-white/10 p-8 hover:border-yellow-500/30 transition-all">
                    <h3 className="text-lg font-black uppercase tracking-tight text-yellow-500 mb-6 flex items-center gap-2.5">
                      <ShoppingCart size={20} />
                      Satış Analitikası
                    </h3>
                    <div className="grid grid-cols-2 gap-3.5">
                      <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                        <span className="text-[10px] font-black text-white/30 uppercase tracking-[2px]">Cəmi Satış</span>
                        <p className="text-xl font-black italic mt-1">{salesStats.totalSessions}</p>
                      </div>
                      <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                        <span className="text-[10px] font-black text-white/30 uppercase tracking-[2px]">AVG Proses</span>
                        <p className="text-xl font-black italic mt-1">{(salesStats.avgStep1 + salesStats.avgStep2).toFixed(1)}s</p>
                      </div>
                      <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                        <span className="text-[10px] font-black text-white/30 uppercase tracking-[2px]">AVG Captcha</span>
                        <p className="text-xl font-black italic mt-1 text-yellow-500">{salesStats.avgCaptcha.toFixed(1)}s</p>
                      </div>
                      <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                        <span className="text-[10px] font-black text-white/30 uppercase tracking-[2px]">Düzgünlük</span>
                        <p className="text-xl font-black italic mt-1 text-green-500">{salesStats.totalCorrect}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Chapca List */}
              {activeTab === 'chapca' && (
                <div className="space-y-4">
                  {chapcaSessions.length === 0 ? (
                    <div className="bg-white/5 rounded-[40px] p-32 text-center border border-dashed border-white/10">
                      <Search className="mx-auto mb-6 text-white/10" size={64} />
                      <p className="text-white/20 font-black uppercase tracking-[6px]">Seans tapılmadı</p>
                    </div>
                  ) : (
                    chapcaSessions.map((session) => {
                      const isExpanded = expandedSessions.has(session.id);
                      return (
                        <div key={session.id} className="group">
                          <div
                            onClick={() => toggleSession(session.id)}
                            className={`bg-white/5 border border-white/10 p-5 flex flex-col sm:flex-row items-center justify-between cursor-pointer transition-all duration-500 hover:bg-white/10 ${isExpanded ? 'rounded-t-[24px] border-[#00965e]/40 shadow-2xl bg-white/[0.08]' : 'rounded-[24px]'}`}
                          >
                            <div className="flex items-center gap-6 mb-4 sm:mb-0">
                              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 ${isExpanded ? 'bg-[#00965e] text-white' : 'bg-[#00965e]/10 text-[#00965e]'}`}>
                                <ShieldCheck size={24} />
                              </div>
                              <div>
                                <p className="text-white font-black text-lg tracking-tight">{formatDateTime(session.createdAt)}</p>
                                <p className="text-[10px] font-black text-white/30 uppercase tracking-[2px] mt-1">{session.chapcas.length} CAPTCHA Verifikasiyası</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-8">
                              <div className="text-right">
                                <p className="text-[9px] font-black text-white/20 uppercase tracking-[2px] mb-1 px-1">Müddət</p>
                                <p className="text-xl font-black text-white tabular-nums italic">{formatDuration(session.totalDuration || 0)}s</p>
                              </div>
                              <div className={`w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-[#00965e]/20 transition-all ${isExpanded ? 'rotate-180 bg-[#00965e]/20' : ''}`}>
                                <ChevronDown size={18} className={isExpanded ? 'text-[#00965e]' : 'text-white/20'} />
                              </div>
                            </div>
                          </div>
                          {isExpanded && (
                            <div className="bg-white/[0.04] rounded-b-[24px] border-x border-b border-[#00965e]/20 p-6 animate-in slide-in-from-top-4 duration-500">
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {session.chapcas.map((cap, idx) => (
                                  <div key={idx} className={`p-4 rounded-2xl border transition-all hover:scale-[1.02] ${cap.isCorrect ? 'bg-green-500/5 border-green-500/10' : 'bg-red-500/5 border-red-500/10'}`}>
                                    <div className="flex justify-between items-start mb-3">
                                      <span className="text-[9px] font-black uppercase tracking-[2px] text-white/30">{cap.type}</span>
                                      <div className={`w-2 h-2 rounded-full ${cap.isCorrect ? 'bg-green-500' : 'bg-red-500'}`} />
                                    </div>
                                    <p className="text-[15px] font-black mb-1">{cap.isCorrect ? 'Uğurlu' : 'Uğursuz'}</p>
                                    <p className="text-[11px] font-bold text-white/20 italic">{formatDuration(cap.duration)}s</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Aim Trainer List */}
              {activeTab === 'aim' && (
                <div className="space-y-4">
                  {aimSessions.length === 0 ? (
                    <div className="bg-white/5 rounded-[40px] p-32 text-center border border-dashed border-white/10">
                      <Search className="mx-auto mb-6 text-white/10" size={64} />
                      <p className="text-white/20 font-black uppercase tracking-[6px]">Seans tapılmadı</p>
                    </div>
                  ) : (
                    aimSessions.map((session) => (
                      <div key={session.id} className="bg-white/5 rounded-[24px] border border-white/10 p-6 hover:bg-white/[0.08] hover:border-[#4fbfa3]/40 transition-all group relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-48 h-48 bg-[#4fbfa3]/5 rounded-full blur-[60px] -mr-24 -mt-24"></div>
                        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative z-10">
                          <div className="flex items-center gap-6">
                            <div className="w-14 h-14 rounded-2xl bg-[#4fbfa3]/20 flex items-center justify-center text-[#4fbfa3] group-hover:scale-110 transition-transform duration-500">
                              <Target size={28} />
                            </div>
                            <div>
                              <p className="text-white font-black text-xl tracking-tight">{formatDateTime(session.createdAt)}</p>
                              <p className="text-[10px] font-black text-[#4fbfa3] uppercase tracking-[3px] mt-1 italic">{session.gameMode.toUpperCase()} REJİMİ</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 flex-1 max-w-xl">
                            <div className="text-center">
                              <span className="text-[9px] font-black text-white/20 uppercase tracking-[2px]">Xal</span>
                              <p className="text-xl font-black italic text-white mt-1">{session.score}</p>
                            </div>
                            <div className="text-center">
                              <span className="text-[9px] font-black text-white/20 uppercase tracking-[2px]">Dəqiqlik</span>
                              <p className="text-xl font-black italic text-[#4fbfa3] mt-1">{session.accuracy.toFixed(1)}%</p>
                            </div>
                            <div className="text-center">
                              <span className="text-[9px] font-black text-white/20 uppercase tracking-[2px]">Səviyyə</span>
                              <p className="text-xl font-black italic text-white mt-1">{session.level}</p>
                            </div>
                            <div className="text-center">
                              <span className="text-[9px] font-black text-white/20 uppercase tracking-[2px]">Səhv</span>
                              <p className="text-xl font-black italic text-red-500 mt-1">{session.misses}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Sales List */}
              {activeTab === 'sales' && (
                <div className="space-y-4">
                  {salesSessions.length === 0 ? (
                    <div className="bg-white/5 rounded-[40px] p-32 text-center border border-dashed border-white/10">
                      <Search className="mx-auto mb-6 text-white/10" size={64} />
                      <p className="text-white/20 font-black uppercase tracking-[6px]">Satış seansı tapılmadı</p>
                    </div>
                  ) : (
                    salesSessions.map((session) => {
                      const isExpanded = expandedSessions.has(session.id);
                      return (
                        <div key={session.id} className="group">
                          <div
                            onClick={() => toggleSession(session.id)}
                            className={`bg-white/5 border border-white/10 p-6 flex flex-col sm:flex-row items-center justify-between cursor-pointer transition-all duration-500 hover:bg-white/10 ${isExpanded ? 'rounded-t-[24px] border-yellow-500/40 border-b-0 shadow-2xl bg-white/[0.08]' : 'rounded-[24px]'}`}
                          >
                            <div className="flex items-center gap-6">
                              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 ${isExpanded ? 'bg-yellow-500 text-black' : 'bg-yellow-500/10 text-yellow-500'}`}>
                                <ShoppingCart size={28} />
                              </div>
                              <div>
                                <p className="text-white font-black text-xl tracking-tighter italic">{formatDateTime(session.createdAt)}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse"></span>
                                  <p className="text-[11px] font-black text-white/40 uppercase tracking-[3px]">{session.project}</p>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-10 mt-6 sm:mt-0">
                              <div className="text-right">
                                <p className="text-[9px] font-black text-white/20 uppercase tracking-[3px] mb-1 px-1 text-center">Cəmi Vaxt</p>
                                <p className="text-2xl font-black italic text-white tabular-nums drop-shadow-2xl">{formatDuration(session.totalDuration || session.totalDurationSeconds * 1000)}s</p>
                              </div>
                              <div className={`w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-yellow-500/20 transition-all ${isExpanded ? 'rotate-180 bg-yellow-500/20' : ''}`}>
                                <ChevronDown size={20} className={isExpanded ? 'text-yellow-500' : 'text-white/20'} />
                              </div>
                            </div>
                          </div>
                          {isExpanded && (
                            <div className="bg-white/[0.04] rounded-b-[24px] border-x border-b border-yellow-500/20 p-8 animate-in slide-in-from-top-6 duration-500">
                              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
                                <div className="bg-white/5 p-5 rounded-2xl border border-white/5 group/card hover:bg-white/10 transition-all">
                                  <Clock size={24} className="mx-auto mb-2 text-yellow-500 group-hover/card:scale-110 transition-transform" />
                                  <span className="text-[10px] font-black text-white/20 uppercase tracking-[2px]">Step 1 (Seçimlər)</span>
                                  <p className="text-xl font-black italic mt-1 text-white">{session.step1Duration.toFixed(1)}s</p>
                                </div>
                                <div className="bg-white/5 p-5 rounded-2xl border border-white/5 group/card hover:bg-white/10 transition-all">
                                  <Search size={24} className="mx-auto mb-2 text-blue-400 group-hover/card:scale-110 transition-transform" />
                                  <span className="text-[10px] font-black text-white/20 uppercase tracking-[2px]">Step 2 (Axtarış)</span>
                                  <p className="text-xl font-black italic mt-1 text-white">{session.step2Duration.toFixed(1)}s</p>
                                </div>
                                <div className="bg-white/5 p-5 rounded-2xl border border-white/5 group/card hover:bg-white/10 transition-all">
                                  <ShieldCheck size={24} className="mx-auto mb-2 text-[#00965e] group-hover/card:scale-110 transition-transform" />
                                  <span className="text-[10px] font-black text-white/20 uppercase tracking-[2px]">Captcha Müddəti</span>
                                  <p className="text-xl font-black italic mt-1 text-white">{session.captchaDuration.toFixed(1)}s</p>
                                </div>
                                <div className="bg-white/5 p-5 rounded-2xl border border-white/5 group/card hover:bg-white/10 transition-all">
                                  <Activity size={24} className="mx-auto mb-2 text-green-400 group-hover/card:scale-110 transition-transform" />
                                  <span className="text-[10px] font-black text-white/20 uppercase tracking-[2px]">Doğru Seanslar</span>
                                  <p className="text-xl font-black italic mt-1 text-white">{session.correctCaptchas} <span className="text-white/20 text-base">x</span></p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="px-8 py-12 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center mt-auto bg-black/40 backdrop-blur-3xl gap-6">
          <div className="flex flex-col gap-1 items-center sm:items-start text-center sm:text-left">
            <span className="text-[12px] font-black text-white/30 uppercase tracking-[6px]">MİDA Analysis Terminal</span>
            <span className="text-[10px] font-bold text-[#00965e] uppercase tracking-[2px]">Sistem Versiyası 4.2.0-Alpha</span>
          </div>
          <div className="flex gap-10 items-center">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#00965e] animate-pulse"></div>
              <span className="text-[10px] font-black text-white/20 uppercase tracking-[3px]">Server Online</span>
            </div>
            <span className="text-[10px] font-bold text-white/10 uppercase tracking-widest border border-white/5 px-4 py-2 rounded-full">Secure Admin Access Only</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
