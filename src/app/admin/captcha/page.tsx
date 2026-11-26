'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import CaptchaAnalyticsPanel from '@/components/analytics/CaptchaAnalyticsPanel';
export default function CaptchaCoachPage() {
  const { isAuthenticated, isAdmin, isLoading } = useAppSelector(state => state.auth);
  const router = useRouter();
  useEffect(() => { if (!isLoading && !isAuthenticated) router.push('/login'); else if (!isLoading && !isAdmin) router.push('/'); }, [isLoading, isAuthenticated, isAdmin, router]);
  if (isLoading || !isAuthenticated || !isAdmin) return <main className="grid min-h-screen place-items-center bg-[#081317] text-slate-300">Yüklənir…</main>;
  return <main className="min-h-screen bg-[#081317] px-4 py-8 font-sans sm:px-8"><div className="mx-auto max-w-[1440px]"><Link href="/admin" className="mb-6 inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white"><ArrowLeft size={16} />İdarə paneli</Link><CaptchaAnalyticsPanel /></div></main>;
}
