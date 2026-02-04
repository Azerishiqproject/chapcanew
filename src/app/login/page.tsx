'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { loginUser, clearError } from '@/store/slices/authSlice';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Mail, Lock, LogIn, AlertCircle, Loader2, ArrowRight, UserCheck } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const dispatch = useAppDispatch();
  const { isLoading, error, isAuthenticated, isAdmin } = useAppSelector((state) => state.auth);
  const router = useRouter();

  useEffect(() => {
    return () => {
      dispatch(clearError());
    };
  }, [dispatch]);

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      if (isAdmin) {
        router.push('/admin');
      } else {
        router.push('/');
      }
    }
  }, [isAuthenticated, isAdmin, isLoading, router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(clearError());
    dispatch(loginUser({ email, password }));
  };

  const getErrorMessage = (errorMsg: string | null) => {
    if (!errorMsg) return '';
    if (errorMsg.includes('auth/user-not-found')) return 'İstifadəçi tapılmadı';
    if (errorMsg.includes('auth/wrong-password')) return 'Şifrə yanlışdır';
    if (errorMsg.includes('auth/invalid-email')) return 'E-poçt formatı yanlışdır';
    return 'Giriş zamanı xəta baş verdi. Yenidən cəhd edin.';
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden font-sans bg-gray-900">
      {/* Background Image with Overlay */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat transition-transform duration-1000"
        style={{
          backgroundImage: "url('/bgimage.webp')",
        }}
      >
        {/* Darkened overlay for better readability */}
        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"></div>
      </div>

      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-[480px] px-6 relative z-10 animate-in fade-in zoom-in-95 duration-700">
        <div className="bg-white/10 backdrop-blur-2xl rounded-[40px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] border border-white/20 overflow-hidden ring-1 ring-white/10">

          {/* Top Decorative bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-transparent via-[#00965e]/50 to-transparent"></div>

          {/* Header Section */}
          <div className="pt-14 pb-8 px-12 text-center animate-in slide-in-from-top-4 duration-500 delay-150 fill-mode-both">
            <div className="inline-flex items-center justify-center mb-8">
              <div className="relative group">
                <div className="absolute inset-0 bg-[#00965e] blur-2xl opacity-30 group-hover:opacity-50 transition-opacity duration-500"></div>
                <div className="relative w-20 h-20 bg-white/5 backdrop-blur-md border border-white/20 rounded-3xl flex items-center justify-center shadow-2xl transform transition-transform duration-500 group-hover:scale-105 group-hover:rotate-6">
                  <UserCheck className="text-white w-10 h-10 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
                </div>
              </div>
            </div>
            <h1 className="text-[36px] font-black text-white tracking-tight mb-3">Xoş gəlmisiniz</h1>
            <p className="text-white/60 font-medium text-lg leading-relaxed">Simulyasiya daxil olmaq üçün hesab məlumatlarınızı daxil edin</p>
          </div>

          {/* Form Section */}
          <div className="px-12 pb-14 space-y-8 animate-in slide-in-from-bottom-4 duration-700 delay-300 fill-mode-both">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-500/10 backdrop-blur-md border border-red-500/20 text-red-200 px-5 py-4 rounded-2xl text-[14px] font-semibold flex items-center gap-3 animate-in shake-in duration-300">
                  <AlertCircle size={20} className="shrink-0" />
                  <span>{getErrorMessage(error)}</span>
                </div>
              )}

              <div className="space-y-2 group">
                <label className="text-[11px] font-black text-white/40 uppercase tracking-[3px] ml-1 transition-colors group-focus-within:text-[#00965e]">E-poçt Ünvanı</label>
                <div className="relative">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-[#00965e] transition-colors">
                    <Mail size={18} />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-14 pr-6 py-4.5 bg-white/5 border border-white/10 rounded-[20px] focus:bg-white/10 focus:ring-4 focus:ring-[#00965e]/10 focus:border-[#00965e]/50 outline-none transition-all font-medium text-white placeholder-white/20"
                    placeholder="mail@nümunə.com"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2 group">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-[11px] font-black text-white/40 uppercase tracking-[3px] transition-colors group-focus-within:text-[#00965e]">Şifrə</label>
                </div>
                <div className="relative">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-[#00965e] transition-colors">
                    <Lock size={18} />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-14 pr-6 py-4.5 bg-white/5 border border-white/10 rounded-[20px] focus:bg-white/10 focus:ring-4 focus:ring-[#00965e]/10 focus:border-[#00965e]/50 outline-none transition-all font-medium text-white placeholder-white/20"
                    placeholder="••••••••"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#00965e] hover:bg-[#00b371] text-white font-extrabold py-5 px-8 rounded-[22px] transition-all duration-300 shadow-[0_20px_40px_-10px_rgba(0,150,94,0.4)] hover:shadow-[0_25px_50px_-10px_rgba(0,150,94,0.5)] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out"></div>
                {isLoading ? (
                  <span className="flex items-center justify-center gap-3 relative z-10">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Giriş edilir...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2 text-[17px] tracking-wide relative z-10">
                    DAXİL OL
                    <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                  </span>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-8 text-center text-gray-400 text-[12px] font-medium uppercase tracking-[3px]">
          MİDA DASHBOARD &copy; 2026
        </div>
      </div>
    </div>
  );
}
