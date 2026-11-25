'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector } from '@/store/hooks';
import CaptchaSettingsPanel, { type SettingsStatus } from '@/components/CaptchaSettingsPanel';
import {
  LogOut,
  RefreshCw,
  Home,
  Bell,
  Users,
  FileCheck,
  ShoppingCart,
  HelpCircle,
  PlayCircle,
  FileText,
} from 'lucide-react';

// --- Types ---
interface UserInfo {
  fullName: string;
  fin: string;
  serial: string;
  birthDate: string;
  birthPlace: string;
  address: string;
  validity: string;
  familyStatus: string;
  category: string;
  cabinetNumber: string;
  issueDate: string;
}

interface CardData {
  title: string;
  description: string;
  icon: React.ReactNode;
  variant?: 'green' | 'white';
  badge?: number;
  footerBorderColor?: string;
}

// --- Internal Components ---

const Header: React.FC = () => (
  <header className="bg-white border-b border-gray-100 py-4 px-6 md:px-12 flex justify-between items-center sticky top-0 z-50">
    <div className="flex items-center">
      <div className="flex flex-col items-center mr-2">
        <div className="flex space-x-0.5">
          <div className="w-1 h-6 bg-[#00965e]"></div>
          <div className="w-1 h-5 bg-[#00965e] mt-1"></div>
          <div className="w-1 h-7 bg-[#00965e] -mt-1"></div>
          <div className="w-1 h-4 bg-[#00965e] mt-2"></div>
          <div className="w-1 h-6 bg-[#00965e]"></div>
        </div>
        <span className="text-[10px] font-bold tracking-widest text-[#004a32] mt-0.5">MİDA</span>
      </div>
    </div>
    <div className="flex items-center gap-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden border-2 border-gray-100">
          <img
            src="https://picsum.photos/seed/user/100/100"
            alt="User"
            className="w-full h-full object-cover grayscale"
          />
        </div>
        <span className="text-sm font-semibold text-gray-700 hidden sm:block">
          HÜSEYNOV İLKİN İSLAM OĞLU
        </span>
      </div>
      <button className="flex items-center gap-2 text-gray-500 hover:text-gray-800 transition-colors text-sm font-medium">
        <span>Çıxış et</span>
        <LogOut size={18} />
      </button>
    </div>
  </header>
);

const DashboardCard: React.FC<CardData> = ({
  title,
  description,
  icon,
  variant = 'white',
  badge,
  footerBorderColor,
}) => {
  const isGreen = variant === 'green';
  return (
    <div
      className={`relative rounded-sm shadow-sm flex flex-col min-h-[180px] transition-all hover:shadow-md cursor-pointer
        ${isGreen ? 'bg-[#00965e] text-white' : 'bg-white text-gray-800 border-b-4'}`}
      style={!isGreen && footerBorderColor ? { borderBottomColor: footerBorderColor } : {}}
    >
      <div className="p-6 flex-grow">
        <div className="flex justify-between items-start mb-4">
          <h3
            className={`text-lg font-bold leading-tight max-w-[150px] ${isGreen ? 'text-white' : 'text-gray-800'
              }`}
          >
            {title}
          </h3>
          <div className={`relative ${isGreen ? 'text-white/80' : 'text-[#00965e]/60'}`}>
            {icon}
            {badge !== undefined && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
                {badge}
              </span>
            )}
          </div>
        </div>
        <p
          className={`text-sm leading-relaxed ${isGreen ? 'text-white/90' : 'text-gray-500'
            }`}
        >
          {description}
        </p>
      </div>
    </div>
  );
};

const ProfileSection: React.FC<{ user: UserInfo }> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'personal' | 'contact'>('personal');
  const fields = [
    { label: 'Ş/V seriya, nömrəsi, FİN', value: `${user.serial}, ${user.fin}` },
    { label: 'Soyadı, adı, atasının adı', value: user.fullName },
    { label: 'Doğulduğu tarix və yer', value: `${user.birthDate}; ${user.birthPlace}` },
    { label: 'Ünvan', value: user.address },
    { label: 'Ş/V etibarlıq müddəti', value: user.validity },
    { label: 'Ailə vəziyyəti', value: user.familyStatus },
    { label: 'Kateqoriya', value: user.category },
    { label: 'Kabinetin nömrəsi', value: user.cabinetNumber },
    { label: 'Verilmə tarixi', value: user.issueDate },
  ];
  return (
    <div className="bg-white rounded-sm shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full">
      <div className="flex p-4 gap-4 border-b border-gray-50">
        <button
          onClick={() => setActiveTab('personal')}
          className={`flex-1 py-3 text-sm font-medium rounded-full transition-all ${activeTab === 'personal'
            ? 'bg-gray-50 text-gray-800 shadow-inner'
            : 'bg-white text-gray-400 border border-gray-50'
            }`}
        >
          Şəxsi məlumatlar
        </button>
        <button
          onClick={() => setActiveTab('contact')}
          className={`flex-1 py-3 text-sm font-medium rounded-full transition-all ${activeTab === 'contact'
            ? 'bg-gray-50 text-gray-800 shadow-inner'
            : 'bg-white text-gray-400 border border-gray-50'
            }`}
        >
          Əlaqə vasitələri
        </button>
      </div>
      <div className="p-6 space-y-4 flex-grow overflow-y-auto">
        {fields.map((field, idx) => (
          <div key={idx} className="flex justify-between items-start gap-4">
            <span className="text-[13px] text-gray-400 font-medium min-w-[140px] leading-tight">
              {field.label}
            </span>
            <span className="text-[13px] text-gray-500 font-semibold text-right leading-tight">
              {field.value}
            </span>
          </div>
        ))}
      </div>
      <div className="p-6 pt-2 flex justify-end">
        <button className="flex items-center gap-2 px-6 py-2 border border-[#00965e] text-[#00965e] rounded-sm hover:bg-[#00965e] hover:text-white transition-all text-sm font-medium">
          <span>Yenilə</span>
          <RefreshCw size={14} />
        </button>
      </div>
    </div>
  );
};

const InstructionRow: React.FC<{ label: string }> = ({ label }) => (
  // ... existing code ...
  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between py-4 border-b border-gray-100 last:border-0 gap-4">
    <span className="text-[15px] font-medium text-gray-700">{label}</span>
    <div className="flex flex-wrap items-center gap-4">
      <button className="flex items-center gap-3 px-6 py-2 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all">
        <span className="text-sm font-medium">Video təlimat</span>
        <PlayCircle size={22} className="text-[#00965e]" fill="#00965e10" />
      </button>
      <button className="flex items-center gap-3 px-6 py-2 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all">
        <div className="p-1 rounded bg-red-50">
          <FileText size={18} className="text-red-500" />
        </div>
        <span className="text-sm font-medium">İstifadə təlimatı</span>
      </button>
    </div>
  </div>
);

// --- Main App ---

const DemoContent: React.FC = () => {
  const router = useRouter();
  const [captchaStatus, setCaptchaStatus] = useState<SettingsStatus>({ blocked: true, reason: 'CAPTCHA ayarları yüklənir.' });
  const [launchError, setLaunchError] = useState('');
  const [salesCountdown, setSalesCountdown] = useState<number | null>(null);
  const [isSalesReady, setIsSalesReady] = useState(false);

  useEffect(() => {
    if (salesCountdown === null) return;

    const timeout = window.setTimeout(() => {
      if (salesCountdown <= 1) {
        setSalesCountdown(null);
        setIsSalesReady(true);
      } else {
        setSalesCountdown(salesCountdown - 1);
      }
    }, 1000);

    return () => window.clearTimeout(timeout);
  }, [salesCountdown]);

  const handleSalesCardClick = () => {
    if (captchaStatus.blocked) { setLaunchError(captchaStatus.reason); return; }
    setLaunchError('');
    if (isSalesReady) {
      router.push('/demo/sales');
      return;
    }

    if (salesCountdown === null) setSalesCountdown(3);
  };

  const mockUser: UserInfo = {
    fullName: 'HÜSEYNOV İLKİN İSLAM OĞLU',
    fin: '69SZNKO',
    serial: 'AA 4845540',
    birthDate: '06/01/1998',
    birthPlace: 'İMİŞLİ; QARALAR K',
    address:
      'BAKI ŞƏHƏRİ, NƏSİMİ RAYONU, , MƏMMƏDCƏFƏR CƏFƏROV KÜÇƏSİ, 3006-CI MƏHƏLLƏ, EV 10, MƏNZİL 266',
    validity: '17.02.2023 - 16.02.2033',
    familyStatus: 'Evli',
    category:
      'Ən azı 3 il dövlət qulluğunda qulluq edən, o cümlədən dövlət qulluğunun xüsusi növündə xidmət keçən şəxs',
    cabinetNumber: '2025111709162169SZNKO',
    issueDate: '24.11.2025',
  };

  const cards: CardData[] = [
    {
      title: 'Satış başlayıb',
      description:
        'Güzəştli mənzillərin satışı 12.12.2025-ci il saat 11:00-dək davam edəcəkdir.',
      icon: <Home size={28} />,
      variant: 'green',
    },
    {
      title: 'Bildirişlər',
      description: 'Bildirişlərlə tanış olmaq üçün bu bölməyə daxil olun.',
      icon: <Bell size={28} />,
      badge: 1,
      footerBorderColor: '#fb923c',
    },
    {
      title: 'Gözləmə / Mənzillər',
      description:
        'Gözləmə qaydasında mənzillərin seçimi 12.12.2025-ci il saat 11:00-dək davam edəcəkdir.',
      icon: <Users size={28} />,
      footerBorderColor: '#818cf8',
    },
    {
      title: 'İlkin razılıq qərarı',
      description:
        'İlkin razılıq qərarı ilə tanış olmaq üçün bu bölməyə daxil olun.',
      icon: <FileCheck size={28} />,
      footerBorderColor: '#3b82f6',
    },
    {
      title: 'Demo satış',
      description:
        'Sınaq (Demo) versiyaya keçmək üçün bu bölməyə daxil olun.',
      icon: <ShoppingCart size={28} />,
      footerBorderColor: '#facc15',
    },
    {
      title: 'Sorğular',
      description: 'Sorğularda iştirak etmək üçün bu bölməyə daxil olun.',
      icon: <HelpCircle size={28} />,
      footerBorderColor: '#4ade80',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-grow p-6 md:p-12">
        <div className="max-w-[1600px] mx-auto">
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="lg:w-2/3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {cards.map((card, idx) => {
                  const handleClick =
                    card.title === 'Satış başlayıb'
                      ? handleSalesCardClick
                      : undefined;
                  return (
                    <div key={idx} onClick={handleClick} className="relative">
                      <DashboardCard {...card} />
                      {card.title === 'Satış başlayıb' && (salesCountdown !== null || isSalesReady) && (
                        <div className="absolute inset-0 z-20 flex cursor-pointer flex-col items-center justify-center rounded-sm bg-[#006f47]/95 text-white backdrop-blur-[1px]">
                          {salesCountdown !== null ? (
                            <>
                              <span className="text-6xl font-black tabular-nums">{salesCountdown}</span>
                              <span className="mt-2 text-xs font-bold uppercase tracking-[0.2em]">Satış açılır</span>
                            </>
                          ) : (
                            <>
                              <PlayCircle size={38} />
                              <span className="mt-3 text-sm font-bold">Daxil olmaq üçün klikləyin</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-12 bg-white rounded-sm border border-gray-50 px-8 py-4">
                <InstructionRow label="Satış modulu üzrə" />
                <InstructionRow label="Gözləmə qaydasında mənzil seçiminə dair" />
              </div>
              {launchError && captchaStatus.blocked && <p role="alert" className="mt-6 text-sm text-red-600">{launchError}</p>}
              <CaptchaSettingsPanel onStatusChange={setCaptchaStatus} />
            </div>
            <div className="lg:w-1/3">
              <ProfileSection user={mockUser} />
            </div>
          </div>
        </div>
      </main>
      <footer className="py-6 px-12 text-center text-gray-400 text-xs">
        &copy; <span suppressHydrationWarning>{new Date().getFullYear()}</span> MİDA - Azərbaycan Respublikasının Prezidenti yanında Mənzil İnşaatı Dövlət Agentliyi
      </footer>
    </div>
  );
};

// --- Page wrapper with auth guard ---

export default function DemoPage() {
  const { user, isAuthenticated, isLoading } = useAppSelector(state => state.auth);
  const router = useRouter();
  useEffect(() => { if (!isAuthenticated && !isLoading) router.push('/login'); }, [isAuthenticated, isLoading, router]);
  if (isLoading || !isAuthenticated) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">Yüklənir...</div>;
  return <DemoContent key={user?.uid} />;
}
