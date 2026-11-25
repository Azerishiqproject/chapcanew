'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Target } from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import AimComparisonPanel from '@/components/AimComparisonPanel';

export default function AimComparisonPage() {
  const { isLoading, isAuthenticated, isAdmin } = useAppSelector((state) => state.auth);
  const router = useRouter();
  useEffect(() => { if (!isLoading && (!isAuthenticated || !isAdmin)) router.replace(isAuthenticated ? '/' : '/login'); }, [isLoading, isAuthenticated, isAdmin, router]);
  if (isLoading || !isAuthenticated || !isAdmin) return <div className="flex min-h-screen items-center justify-center bg-[#071722] text-white/60">Yükleniyor…</div>;
  return <div className="min-h-screen bg-[#071722] text-[#e4edf4]"><header className="border-b border-white/10 bg-[#0b1d2b]"><div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-5 py-5 sm:px-8"><Link href="/admin" className="flex items-center gap-2 text-sm text-[#a0b7c8]"><ArrowLeft size={18} />Admin paneli</Link><Link href="/aim" className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-xs"><Target size={16} />Antrenmanı aç</Link></div></header><main className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8"><AimComparisonPanel /></main></div>;
}
