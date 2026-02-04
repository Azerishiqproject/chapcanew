'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { logoutUser } from '@/store/slices/authSlice';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  LogOut,
  User,
  ShieldCheck,
  Target,
  LayoutDashboard,
  Settings,
  ChevronRight,
  Sparkles
} from 'lucide-react';

export default function Home() {
  const dispatch = useAppDispatch();
  const { user, isAuthenticated, isLoading, isAdmin } = useAppSelector((state) => state.auth);
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

  useEffect(() => {
    if (mounted && isAuthenticated && !isLoading) {
      if (isAdmin) {
        router.push('/admin');
      }
    }
  }, [isAuthenticated, isAdmin, isLoading, router, mounted]);

  const handleLogout = async () => {
    await dispatch(logoutUser());
    router.push('/login');
  };

  const handleBoxClick = (chapcaType: string) => {
    if (chapcaType === 'chapca') {
      router.push('/chapca');
    } else if (chapcaType === 'aim') {
      router.push('/aim');
    } else if (chapcaType === 'demo') {
      router.push('/demo');
    }
  };

  if (!mounted || isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 border-4 border-[#00965e]/20 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-t-[#00965e] rounded-full animate-spin"></div>
          </div>
          <p className="mt-6 text-white/50 font-medium tracking-widest uppercase text-[11px]">Sistem yüklənir...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen relative overflow-hidden font-sans bg-[#0a0a0a]">
      {/* Background with Image and Multi-layer Overlay */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/bgimage2.jpg')" }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/40 to-black/90 backdrop-blur-[1px]"></div>
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header */}
        <header className="px-8 py-5 border-b border-white/5 backdrop-blur-md bg-white/5 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-4 group cursor-default">
              <div className="w-12 h-12 bg-gradient-to-tr from-[#00965e] to-[#4fbfa3] rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(0,150,94,0.3)] group-hover:scale-105 transition-transform">
                <ShieldCheck className="text-white w-7 h-7" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-black text-white tracking-tight uppercase leading-none">Chapca</span>
                <span className="text-[10px] font-bold text-[#00965e] tracking-[4px] uppercase mt-1 leading-none">Security</span>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="hidden md:flex flex-col items-end mr-2">
                <span className="text-[13px] font-bold text-white leading-none mb-1">{user.email}</span>
                <span className="text-[10px] font-black text-[#00965e] uppercase tracking-wider leading-none">Aktiv Sessiya</span>
              </div>

              <div className="h-10 w-[1px] bg-white/10"></div>

              <div className="flex items-center gap-3">
                <ThemeToggle />
                <button
                  onClick={() => router.push('/profile')}
                  className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-white/10 hover:border-[#00965e]/50 transition-all group"
                  title="Profil"
                >
                  <User size={20} className="group-hover:text-[#00965e] transition-colors" />
                </button>
                <button
                  onClick={handleLogout}
                  className="h-10 px-4 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2 text-[13px] font-bold text-white/70 hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-400 transition-all group"
                >
                  <LogOut size={18} />
                  <span className="hidden sm:inline">Çıxış</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 max-w-7xl mx-auto w-full px-8 py-20 flex flex-col justify-center">
          {/* Selection Boxes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { id: 'chapca', title: 'Security', desc: 'Captcha mexanizmlərini tənzimləyin və yoxlayın.', icon: ShieldCheck, color: '#00965e' },
              { id: 'aim', title: 'Direct Aim', desc: 'Hədəf seçimi və sistem performansını izləyin.', icon: Target, color: '#4fbfa3' },
              { id: 'demo', title: 'Sales Demo', desc: 'Mənzil seçimi və satış simulyasiyasını başladın.', icon: LayoutDashboard, color: '#ffffff' }
            ].map((item, idx) => (
              <div
                key={item.id}
                onClick={() => handleBoxClick(item.id)}
                className="group relative bg-white/5 backdrop-blur-2xl rounded-[32px] p-8 border border-white/10 hover:border-white/20 transition-all cursor-pointer overflow-hidden shadow-2xl animate-in slide-in-from-bottom-8 duration-700 delay-[idx*150] fill-mode-both"
              >
                {/* Hover Glow */}
                <div
                  className="absolute -inset-1 opacity-0 group-hover:opacity-10 transition-opacity duration-500 blur-2xl"
                  style={{ backgroundColor: item.color }}
                ></div>

                <div className="relative z-10">
                  <div
                    className="w-16 h-16 rounded-[20px] flex items-center justify-center mb-10 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3"
                    style={{ backgroundColor: `${item.color}20`, border: `1px solid ${item.color}30` }}
                  >
                    <item.icon className="w-8 h-8" style={{ color: item.color }} />
                  </div>

                  <h3 className="text-2xl font-black text-white mb-3 tracking-tight flex items-center gap-2 group-hover:gap-4 transition-all">
                    {item.title}
                    <ChevronRight size={24} className="opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all" style={{ color: item.color }} />
                  </h3>
                  <p className="text-white/40 font-medium text-[15px] leading-relaxed mb-6">
                    {item.desc}
                  </p>

                  <div className="w-12 h-1 rounded-full bg-white/10 group-hover:w-full group-hover:bg-[#00965e] transition-all duration-700"></div>
                </div>
              </div>
            ))}
          </div>
        </main>

        {/* Decorative Footer */}
        <footer className="px-8 py-10 border-t border-white/5 flex justify-center items-center text-[11px] font-bold text-white/20 uppercase tracking-[4px]">
          <span>MİDA Systems &copy; 2026</span>
        </footer>
      </div>
    </div>
  );
}
