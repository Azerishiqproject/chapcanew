'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { logoutUser } from '@/store/slices/authSlice';
import { ThemeToggle } from '@/components/ThemeToggle';
import AimTrainer from '@/components/AimTrainer';
import { ArrowLeft, LogOut, Target, User } from 'lucide-react';

export default function AimPage() {
  const dispatch = useAppDispatch();
  const { user, isAuthenticated, isLoading } = useAppSelector((state) => state.auth);
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !isAuthenticated && !isLoading) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router, mounted]);

  const handleLogout = async () => {
    await dispatch(logoutUser());
    router.push('/login');
  };

  const handleBack = () => {
    router.push('/');
  };

  if (!mounted || isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 border-4 border-[#00965e]/20 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-t-[#00965e] rounded-full animate-spin"></div>
          </div>
          <p className="mt-6 text-white/50 font-medium tracking-widest uppercase text-[11px]">Yüklənir...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

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
                onClick={handleBack}
                className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-[#00965e]/50 transition-all group"
              >
                <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
              </button>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gradient-to-tr from-[#00965e] to-[#4fbfa3] rounded-xl flex items-center justify-center shadow-lg">
                  <Target className="text-white w-6 h-6" />
                </div>
                <h1 className="text-xl font-black uppercase tracking-tight">Aim Trainer</h1>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <ThemeToggle />
              <div className="flex flex-col items-end mr-2 hidden sm:flex">
                <span className="text-[11px] font-black text-[#00965e] uppercase tracking-widest">Xoş Gəldiniz</span>
                <span className="text-[13px] font-bold text-white/70">{user.email}</span>
              </div>
              <button
                onClick={() => router.push('/profile')}
                className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-[#00965e]/30 transition-all"
              >
                <User size={18} className="text-white/70" />
              </button>
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
        <main className="max-w-7xl mx-auto w-full px-8 py-12 flex flex-col items-center">
          <div className="text-center mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 mb-6">
              <span className="w-2 h-2 rounded-full bg-[#00965e] animate-pulse"></span>
              <span className="text-[10px] font-black text-white/50 uppercase tracking-[3px]">Simulyasiya Rejimi</span>
            </div>
            <h2 className="text-[42px] font-black text-white mb-4 tracking-tighter uppercase">
              MİDA Aim Trainer <span className="text-[#00965e]">🎯</span>
            </h2>
            <p className="text-lg text-white/40 font-medium max-w-2xl mx-auto">
              Hədəflərə doğru tıklayaraq sürət və dəqiqliyinizi yoxlayın. 3 hədəfi qaçırtsanız oyun bitir.
            </p>
          </div>

          <div className="w-full animate-in fade-in zoom-in-95 duration-1000 delay-200">
            {/* Aim Trainer Component */}
            <AimTrainer userEmail={user?.email} />
          </div>
        </main>

        <footer className="mt-auto px-8 py-10 border-t border-white/5 flex justify-center items-center">
          <div className="flex flex-col items-center text-center">
            <span className="text-[11px] font-black text-white/20 uppercase tracking-[4px] mb-2">MİDA Simulation Engine</span>
            <span className="text-[10px] font-bold text-white/10 uppercase tracking-widest italic leading-tight">Advanced Reactive Target Acquisition Training v3.5.0</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
