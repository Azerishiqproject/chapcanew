'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { logoutUser } from '@/store/slices/authSlice';
import { getUserByEmail, User as UserType } from '@/lib/users';
import { api } from '@/lib/api-client';
import type { CaptchaDataset } from '@/lib/captcha-analytics';
import CaptchaAnalyticsPanel from '@/components/analytics/CaptchaAnalyticsPanel';
import { getAimOverview, type AimOverview } from '@/lib/aimSessions';
import AimAnalyticsPanel from '@/components/AimAnalyticsPanel';
import { getSalesOverview, type SalesOverview } from '@/lib/salesSessions';
import SalesAnalyticsPanel from '@/components/SalesAnalyticsPanel';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  Activity,
  ShoppingCart,
  ShieldCheck,
  Target,
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
  const [chapcaStats, setChapcaStats] = useState({ totalSessions: 0, correctAttempts: 0, wrongAttempts: 0, totalDuration: 0 });
  const [aimOverview, setAimOverview] = useState<AimOverview | null>(null);
  const [salesOverview, setSalesOverview] = useState<SalesOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'info' | 'chapca' | 'aim' | 'sales'>('info');

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

      try {
        const data = await api<CaptchaDataset>(`captcha/analytics?${new URLSearchParams({ email: decodeURIComponent(userEmail) })}`);
        const runs = data.runs.filter(run => run.source === 'training');
        setChapcaStats({ totalSessions: runs.length, correctAttempts: runs.reduce((n, run) => n + run.correct, 0), wrongAttempts: runs.reduce((n, run) => n + run.incorrect, 0), totalDuration: runs.reduce((n, run) => n + run.durationMs, 0) });
      } catch (error) { console.error('CAPTCHA overview could not be loaded:', error); }

      try { setAimOverview(await getAimOverview(decodeURIComponent(userEmail))); }
      catch (error) { console.error('Aim overview could not be loaded:', error); }

      try { setSalesOverview(await getSalesOverview(decodeURIComponent(userEmail))); }
      catch (error) { console.error('Sales overview could not be loaded:', error); }
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

  const formatDuration = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const ms = milliseconds % 1000;
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(1, '0')}`;
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
                { id: 'chapca', label: `Security (${chapcaStats.totalSessions})`, icon: ShieldCheck },
                { id: 'aim', label: `Direct Aim (${aimOverview?.totalPlays ?? 0})`, icon: Target },
                { id: 'sales', label: `Sales (${salesOverview?.totalPlays ?? '—'})`, icon: ShoppingCart }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
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
                        <span className="text-[10px] font-black text-white/30 uppercase tracking-[2px]">Doğru CAPTCHA</span>
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
                        <p className="text-xl font-black italic mt-1">{aimOverview?.averageHits.toFixed(1) ?? '—'}</p>
                      </div>
                      <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                        <span className="text-[10px] font-black text-white/30 uppercase tracking-[2px]">AVG Dəqiqlik</span>
                        <p className="text-xl font-black italic mt-1 text-[#4fbfa3]">{aimOverview?.accuracy.toFixed(1) ?? '—'}%</p>
                      </div>
                      <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                        <span className="text-[10px] font-black text-white/30 uppercase tracking-[2px]">Oyun sayı</span>
                        <p className="text-xl font-black italic mt-1">{aimOverview?.totalPlays ?? '—'}</p>
                      </div>
                      <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                        <span className="text-[10px] font-black text-white/30 uppercase tracking-[2px]">Cəmi Miss</span>
                        <p className="text-xl font-black italic mt-1 text-red-500">{aimOverview?.totalMisses ?? '—'}</p>
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
                        <span className="text-[10px] font-black text-white/30 uppercase tracking-[2px]">Başladılan turlar</span>
                        <p className="text-xl font-black italic mt-1">{salesOverview?.totalPlays ?? '—'}</p>
                      </div>
                      <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                        <span className="text-[10px] font-black text-white/30 uppercase tracking-[2px]">Ortalama tamamlanan tur</span>
                        <p className="text-xl font-black italic mt-1">{salesOverview?.averageDurationMs != null ? (salesOverview.averageDurationMs / 1000).toFixed(1) + 's' : '—'}</p>
                      </div>
                      <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                        <span className="text-[10px] font-black text-white/30 uppercase tracking-[2px]">CAPTCHA / həll · yeni ölçüm</span>
                        <p className="text-xl font-black italic mt-1 text-yellow-500">{salesOverview?.averageCaptchaPerSolveMs != null ? (salesOverview.averageCaptchaPerSolveMs / 1000).toFixed(1) + 's' : '—'}</p>
                      </div>
                      <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                        <span className="text-[10px] font-black text-white/30 uppercase tracking-[2px]">Doğru CAPTCHA</span>
                        <p className="text-xl font-black italic mt-1 text-green-500">{salesOverview?.totalCorrect ?? '—'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'chapca' && <CaptchaAnalyticsPanel key={userEmail} email={decodeURIComponent(userEmail)} source="training" onDataset={data => { const runs = data.runs.filter(run => run.source === 'training'); setChapcaStats({ totalSessions: runs.length, correctAttempts: runs.reduce((n, run) => n + run.correct, 0), wrongAttempts: runs.reduce((n, run) => n + run.incorrect, 0), totalDuration: runs.reduce((n, run) => n + run.durationMs, 0) }); }} />}

              {activeTab === 'aim' && <AimAnalyticsPanel email={decodeURIComponent(userEmail)} />}

              {activeTab === 'sales' && <SalesAnalyticsPanel key={userEmail} email={decodeURIComponent(userEmail)} initialOverview={salesOverview} onOverviewChange={setSalesOverview} />}
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
