'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { logoutUser } from '@/store/slices/authSlice';
import {
  setAllowedTypes,
  setRequiredCount,
  updateDateConfig,
  setCaptchaEnabled,
  CaptchaType
} from '@/store/slices/captchaSlice';
import { ThemeToggle } from '@/components/ThemeToggle';
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
  Settings,
  ShieldCheck,
  Calendar,
  Layers,
  ChevronRight
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

const CaptchaSettings: React.FC = () => {
  const dispatch = useAppDispatch();
  const captchaStore = useAppSelector((state) => state.captcha);

  // Local state for form inputs
  const [localTypes, setLocalTypes] = useState<CaptchaType[]>(captchaStore.allowedTypes);
  const [localCount, setLocalCount] = useState<number>(captchaStore.requiredCount);
  const [localToday, setLocalToday] = useState<string>(captchaStore.dateConfig.todayDate);
  const [localBirth, setLocalBirth] = useState<string>(captchaStore.dateConfig.birthDate);
  const [localEnabled, setLocalEnabled] = useState<boolean>(captchaStore.enabled);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Keep local state in sync if store changes elsewhere (optional but good)
  useEffect(() => {
    setLocalTypes(captchaStore.allowedTypes);
    setLocalCount(captchaStore.requiredCount);
    setLocalToday(captchaStore.dateConfig.todayDate);
    setLocalBirth(captchaStore.dateConfig.birthDate);
    setLocalEnabled(captchaStore.enabled);
  }, [captchaStore]);

  const toggleType = (type: CaptchaType) => {
    if (localTypes.includes(type)) {
      if (localTypes.length === 1) return;
      setLocalTypes(localTypes.filter(t => t !== type));
    } else {
      setLocalTypes([...localTypes, type]);
    }
  };

  const handleSave = () => {
    setIsSaving(true);

    // Simulate slight delay for premium feel
    setTimeout(() => {
      dispatch(setAllowedTypes(localTypes));
      dispatch(setRequiredCount(localCount));
      dispatch(updateDateConfig({ todayDate: localToday, birthDate: localBirth }));
      dispatch(setCaptchaEnabled(localEnabled));

      setIsSaving(false);
      setShowSuccess(true);

      // Hide success message after 3 seconds
      setTimeout(() => setShowSuccess(false), 3000);
    }, 600);
  };

  return (
    <div className="bg-white rounded-sm shadow-sm border border-gray-100 overflow-hidden mt-8">
      <div className="p-6 border-b border-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#00965e]/10 rounded-sm">
            <Settings size={20} className="text-[#00965e]" />
          </div>
          <h2 className="text-lg font-bold text-gray-800">Captcha Tənzimləmələri</h2>
        </div>

        {showSuccess && (
          <div className="flex items-center gap-2 text-[#00965e] animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="w-5 h-5 bg-[#00965e] rounded-full flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <span className="text-sm font-bold tracking-tight">Ayarlar yadda saxlanıldı</span>
          </div>
        )}
      </div>

      <div className="p-8">
        {/* Master Toggle */}
        <div className="flex items-center justify-between bg-gray-50 border border-gray-100 p-4 rounded-sm mb-8">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${localEnabled ? 'bg-[#00965e]/10 text-[#00965e]' : 'bg-gray-200 text-gray-400'}`}>
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-gray-800">Captcha Sistemi</h3>
              <p className="text-xs text-gray-500">Sistem aktiv olduqda təhlükəsizlik yoxlamaları aktivləşəcək.</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={localEnabled} onChange={(e) => setLocalEnabled(e.target.checked)} className="sr-only peer" />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00965e]"></div>
          </label>
        </div>

        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 transition-opacity duration-300 ${localEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
          {/* Step 1: Types */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck size={18} className="text-[#00965e]" />
              <h3 className="text-[15px] font-bold text-gray-700 uppercase tracking-wider">Captcha Növləri</h3>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {[
                { id: 'date' as CaptchaType, label: 'Tarix Captcha' },
                { id: 'number' as CaptchaType, label: 'Rəqəm Captcha' },
                { id: 'text' as CaptchaType, label: 'Mətn Captcha' },
                { id: 'birthdate' as CaptchaType, label: 'Doğum Tarixi Captcha' }
              ].map(item => (
                <label key={item.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-sm cursor-pointer hover:bg-gray-50 transition-colors group">
                  <input
                    type="checkbox"
                    checked={localTypes.includes(item.id)}
                    onChange={() => toggleType(item.id)}
                    className="w-4 h-4 accent-[#00965e]"
                  />
                  <span className={`text-sm font-medium transition-colors ${localTypes.includes(item.id) ? 'text-gray-900' : 'text-gray-400'}`}>
                    {item.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Step 2: Count */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <Layers size={18} className="text-[#00965e]" />
              <h3 className="text-[15px] font-bold text-gray-700 uppercase tracking-wider">Sequential Sayı</h3>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">Ardı-arda həll edilməli olan captcha sayını təyin edin.</p>
            <div className="flex items-center gap-4 pt-2">
              <input
                type="range"
                min="1"
                max="5"
                value={localCount}
                onChange={(e) => setLocalCount(parseInt(e.target.value))}
                className="flex-grow accent-[#00965e]"
              />
              <span className="w-10 h-10 bg-[#00965e] text-white rounded-full flex items-center justify-center font-bold text-lg shadow-sm">
                {localCount}
              </span>
            </div>
          </div>

          {/* Step 3: Specific Config */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <Calendar size={18} className="text-[#00965e]" />
              <h3 className="text-[15px] font-bold text-gray-700 uppercase tracking-wider">Tarix Ayarları</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Bugünkü Tarix (Tarix Captcha)</label>
                <input
                  type="text"
                  placeholder="DD/MM/YYYY"
                  value={localToday}
                  onChange={(e) => setLocalToday(e.target.value)}
                  className="w-full p-2.5 border border-gray-200 rounded-sm text-sm focus:ring-1 focus:ring-[#00965e] focus:border-[#00965e] outline-none transition-all font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Doğum Tarixi (Doğum Captcha)</label>
                <input
                  type="text"
                  placeholder="DD/MM/YYYY"
                  value={localBirth}
                  onChange={(e) => setLocalBirth(e.target.value)}
                  className="w-full p-2.5 border border-gray-200 rounded-sm text-sm focus:ring-1 focus:ring-[#00965e] focus:border-[#00965e] outline-none transition-all font-mono"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Save Button */}
      <div className="p-6 bg-gray-50/50 border-t border-gray-50 flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`flex items-center gap-3 px-10 py-3 bg-[#00965e] text-white rounded-sm font-bold text-[14px] shadow-sm hover:shadow-md hover:bg-[#007a4d] transition-all disabled:opacity-70 disabled:cursor-not-allowed`}
        >
          {isSaving ? (
            <>
              <RefreshCw size={18} className="animate-spin" />
              <span>Yadda saxlanılır...</span>
            </>
          ) : (
            <>
              <span>Yadda saxla</span>
              <ChevronRight size={18} />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

// --- Main App ---

const DemoContent: React.FC = () => {
  const router = useRouter();

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
                      ? () => router.push('/demo/sales')
                      : undefined;
                  return (
                    <div key={idx} onClick={handleClick}>
                      <DashboardCard {...card} />
                    </div>
                  );
                })}
              </div>
              <div className="mt-12 bg-white rounded-sm border border-gray-50 px-8 py-4">
                <InstructionRow label="Satış modulu üzrə" />
                <InstructionRow label="Gözləmə qaydasında mənzil seçiminə dair" />
              </div>
              <CaptchaSettings />
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
  const dispatch = useAppDispatch();
  const { isAuthenticated, isLoading } = useAppSelector((state) => state.auth);
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

  if (!mounted || isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-400"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Not: Verdiğin layout'u birebir göstermek için, buraya ThemeToggle / gerçek logout bağlamadım.
  // Logout'a basınca bir şey olmasını istersen, Header'ı prop ile handleLogout alacak şekilde genişletebiliriz.

  return <DemoContent />;
}
