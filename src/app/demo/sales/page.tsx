'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector } from '@/store/hooks';
import SalesSimulator from '@/components/sales/SalesSimulator';
export default function SalesPage() {
  const { user, isAuthenticated, isLoading } = useAppSelector(state => state.auth);
  const router = useRouter();
  useEffect(() => { if (!isAuthenticated && !isLoading) router.push('/login'); }, [isAuthenticated, isLoading, router]);
  if (isLoading || !isAuthenticated) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-400">Yüklənir...</div>;
  return <SalesSimulator key={user?.uid} />;
}
