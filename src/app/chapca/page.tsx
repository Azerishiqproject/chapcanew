'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { logoutUser } from '@/store/slices/authSlice';
import DateCaptcha from '@/components/DateCaptcha';
import BirthDateCaptcha from '@/components/BirthDateCaptcha';
import TextCaptcha from '@/components/TextCaptcha';
import PuzzleCaptcha from '@/components/PuzzleCaptcha';
import { canonicalDate } from '@/lib/captcha-config';
import NumberCaptcha from '@/components/NumberCaptcha';
import { saveChapcaSession, ChapcaAttempt, type ChapcaType } from '@/lib/chapcaSessions';
import { Timestamp } from 'firebase/firestore';
import { ThemeToggle } from '@/components/ThemeToggle';
import { FaCheck, FaCalendarDay, FaBirthdayCake, FaFont, FaHashtag } from 'react-icons/fa';

export default function ChapcaPage() {
  const dispatch = useAppDispatch();
  const { user, isAuthenticated, isLoading } = useAppSelector((state) => state.auth);
  const router = useRouter();
  const [showSettings, setShowSettings] = useState(false);
  const [selectedChapcas, setSelectedChapcas] = useState<ChapcaType[]>([]);
  const [correctDate, setCorrectDate] = useState<string>('');
  const [correctBirthDate, setCorrectBirthDate] = useState<string>('');
  const [isStarted, setIsStarted] = useState(false);
  const [currentChapcaIndex, setCurrentChapcaIndex] = useState(0);

  // Chapca ayarları: her chapca için kaç kere oynanacak
  const [chapcaSettings, setChapcaSettings] = useState<{
    [key: string]: {
      count: number;
    }
  }>({
    tarih: { count: 1 },
    dogum: { count: 1 },
    text: { count: 1 },
    rakam: { count: 1 },
    puzzle: { count: 1 },
  });

  // Genel sıralama ayarı
  const [globalOrder, setGlobalOrder] = useState<'random' | 'sequential'>('sequential');

  // Gerçek oynanacak chapca listesi (ayarlara göre çoğaltılmış)
  const [playableChapcas, setPlayableChapcas] = useState<ChapcaType[]>([]);

  // Oturum takibi
  const [sessionStartTime, setSessionStartTime] = useState<Timestamp | null>(null);
  const [chapcaAttempts, setChapcaAttempts] = useState<ChapcaAttempt[]>([]);
  const [currentChapcaStartTime, setCurrentChapcaStartTime] = useState<Timestamp | null>(null);

  // Gerçek zamanlı timer
  const [currentTime, setCurrentTime] = useState<number>(0); // milisaniye cinsinden

  // Component refresh key'leri (yanlış yapıldığında yenilemek için)
  const [dateCaptchaKey, setDateCaptchaKey] = useState<number>(0);
  const [birthDateCaptchaKey, setBirthDateCaptchaKey] = useState<number>(0);
  const [textCaptchaKey, setTextCaptchaKey] = useState<number>(0);
  const [numberCaptchaKey, setNumberCaptchaKey] = useState<number>(0);

  // Session kayıt flag'i (çift kayıt önlemek için)
  const isSessionSavingRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  const handleLogout = async () => {
    await dispatch(logoutUser());
    router.push('/login');
  };

  const handleBack = () => {
    router.push('/');
  };

  // Zamanı formatla (MM:SS:SSS formatında - dakika:saniye:milisaniye)
  const formatTime = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const ms = milliseconds % 1000;

    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  const handleDateVerify = (isCorrect: boolean) => {
    console.log('Tarih doğrulama sonucu:', isCorrect);
    const isLastChapca = currentChapcaIndex === playableChapcas.length - 1;

    if (isCorrect) {
      // Doğru: kaydet ve sonraki chapcaya geç
      recordChapcaAttempt('tarih', isCorrect, isLastChapca);
      handleNextChapca();
    } else {
      // Yanlış: kaydet ama timer'ı sıfırlama, chapcayı yenile
      recordChapcaAttempt('tarih', isCorrect, false);
      // Component key'ini değiştirerek yenile
      setDateCaptchaKey(prev => prev + 1);
    }
  };

  const handleBirthDateVerify = (isCorrect: boolean) => {
    console.log('Doğum tarihi doğrulama sonucu:', isCorrect);
    const isLastChapca = currentChapcaIndex === playableChapcas.length - 1;

    if (isCorrect) {
      // Doğru: kaydet ve sonraki chapcaya geç
      recordChapcaAttempt('dogum', isCorrect, isLastChapca);
      handleNextChapca();
    } else {
      // Yanlış: kaydet ama timer'ı sıfırlama, chapcayı yenile
      recordChapcaAttempt('dogum', isCorrect, false);
      // Component key'ini değiştirerek yenile
      setBirthDateCaptchaKey(prev => prev + 1);
    }
  };

  const handleTextVerify = (isCorrect: boolean) => {
    console.log('Text captcha doğrulama sonucu:', isCorrect);
    const isLastChapca = currentChapcaIndex === playableChapcas.length - 1;

    if (isCorrect) {
      // Doğru: kaydet ve sonraki chapcaya geç
      recordChapcaAttempt('text', isCorrect, isLastChapca);
      handleNextChapca();
    } else {
      // Yanlış: kaydet ama timer'ı sıfırlama, chapcayı yenile
      recordChapcaAttempt('text', isCorrect, false);
      // Component key'ini değiştirerek yenile
      setTextCaptchaKey(prev => prev + 1);
    }
  };

  const handleNumberVerify = (isCorrect: boolean) => {
    console.log('Rakam captcha doğrulama sonucu:', isCorrect);
    const isLastChapca = currentChapcaIndex === playableChapcas.length - 1;

    if (isCorrect) {
      // Doğru: kaydet ve sonraki chapcaya geç
      recordChapcaAttempt('rakam', isCorrect, isLastChapca);
      handleNextChapca();
    } else {
      // Yanlış: kaydet ama timer'ı sıfırlama, chapcayı yenile
      recordChapcaAttempt('rakam', isCorrect, false);
      // Component key'ini değiştirerek yenile
      setNumberCaptchaKey(prev => prev + 1);
    }
  };

  const handlePuzzleVerify = (isCorrect: boolean) => {
    recordChapcaAttempt('puzzle', isCorrect, isCorrect && currentChapcaIndex === playableChapcas.length - 1);
    if (isCorrect) handleNextChapca();
  };

  // Chapca denemesini kaydet
  const recordChapcaAttempt = (type: ChapcaType, isCorrect: boolean, isLastChapca: boolean = false) => {
    if (!currentChapcaStartTime) return;

    const endTime = Timestamp.now();
    const duration = endTime.toMillis() - currentChapcaStartTime.toMillis();
    const durationInSeconds = Math.round(duration / 1000);

    const attempt: ChapcaAttempt = {
      type,
      startTime: currentChapcaStartTime,
      endTime,
      duration: duration, // milisaniye cinsinden
      durationSeconds: durationInSeconds, // saniye cinsinden (geriye dönük uyumluluk)
      isCorrect,
    };

    // State'i güncelle - callback ile güncel state'i al
    setChapcaAttempts(prev => {
      const newAttempts = [...prev, attempt];

      // Eğer bu son chapca ise ve doğru yapıldıysa, oturumu kaydet
      if (isLastChapca && isCorrect && sessionStartTime && user?.email && !isSessionSavingRef.current) {
        // Flag set et (çift kayıt önlemek için)
        isSessionSavingRef.current = true;

        // State güncellendikten sonra kaydet (setTimeout ile bir sonraki tick'te)
        setTimeout(() => {
          const endTime = Timestamp.now();
          const totalDuration = endTime.toMillis() - sessionStartTime.toMillis();
          const totalDurationSeconds = Math.round(totalDuration / 1000);

          const session = {
            email: user.email!,
            startTime: sessionStartTime,
            endTime,
            totalDuration,
            totalDurationSeconds,
            chapcas: newAttempts, // Yeni eklenen attempt dahil
          };

          // Async kaydet
          saveChapcaSession(session).then(result => {
            if (result.error) {
              console.error('Error saving session:', result.error);
              alert('An error occurred while saving the session');
              isSessionSavingRef.current = false; // Hata durumunda flag'i sıfırla
            } else {
              console.log('Session saved successfully:', result.id, 'with', session.chapcas.length, 'chapcas');

              // UI'ı temizle
              alert('Tüm chapcalar tamamlandı!');
              setIsStarted(false);
              setCurrentChapcaIndex(0);
              setPlayableChapcas([]);
              setSessionStartTime(null);
              setChapcaAttempts([]);
              setCurrentChapcaStartTime(null);
              isSessionSavingRef.current = false;
            }
          });
        }, 0);
      }

      return newAttempts;
    });

    // Yanlış yapıldığında timer'ı sıfırlama (devam etsin)
    if (isCorrect) {
      setCurrentChapcaStartTime(null);
      setCurrentTime(0); // Timer'ı sıfırla
    }
    // Yanlış yapıldığında timer devam edecek (sıfırlamıyoruz)
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, ''); // Sadece rakamları al

    // Format: DD/MM/YYYY
    if (value.length >= 2) {
      value = value.slice(0, 2) + '/' + value.slice(2);
    }
    if (value.length >= 5) {
      value = value.slice(0, 5) + '/' + value.slice(5, 9);
    }
    if (value.length > 10) {
      value = value.slice(0, 10);
    }

    setCorrectDate(value);
  };

  const handleBirthDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, ''); // Sadece rakamları al

    // Format: DD/MM/YYYY
    if (value.length >= 2) {
      value = value.slice(0, 2) + '/' + value.slice(2);
    }
    if (value.length >= 5) {
      value = value.slice(0, 5) + '/' + value.slice(5, 9);
    }
    if (value.length > 10) {
      value = value.slice(0, 10);
    }

    setCorrectBirthDate(value);
  };

  const toggleChapcaSelection = (type: ChapcaType) => {
    setSelectedChapcas(prev => {
      if (prev.includes(type)) {
        return prev.filter(t => t !== type);
      } else {
        return [...prev, type];
      }
    });
  };

  const handleStart = () => {
    if (selectedChapcas.length === 0) {
      alert('Please select at least one chapca');
      return;
    }

    if (selectedChapcas.includes('tarih') && !canonicalDate(correctDate)) {
      alert('Please set today\'s date in settings');
      return;
    }

    if (selectedChapcas.includes('dogum') && !canonicalDate(correctBirthDate)) {
      alert('Please set birth date in settings');
      return;
    }

    // Seçilen chapcaları ayarlara göre çoğalt
    const newPlayableChapcas: ChapcaType[] = [];

    if (globalOrder === 'sequential') {
      // Sıralı mod: Seçim sırasına göre, her chapca'nın tüm tekrarları peş peşe
      selectedChapcas.forEach(chapcaType => {
        const settings = chapcaSettings[chapcaType];
        const count = settings.count || 1;

        // Her chapca'yı belirtilen sayı kadar ekle
        for (let i = 0; i < count; i++) {
          newPlayableChapcas.push(chapcaType);
        }
      });
    } else {
      // Karışık mod: Tüm chapcaları ekle ve sonra karıştır
      selectedChapcas.forEach(chapcaType => {
        const settings = chapcaSettings[chapcaType];
        const count = settings.count || 1;

        // Her chapca'yı belirtilen sayı kadar ekle
        for (let i = 0; i < count; i++) {
          newPlayableChapcas.push(chapcaType);
        }
      });

      // Fisher-Yates shuffle algoritması - tüm listeyi tamamen karıştır
      for (let i = newPlayableChapcas.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newPlayableChapcas[i], newPlayableChapcas[j]] = [newPlayableChapcas[j], newPlayableChapcas[i]];
      }

      console.log('Karışık sıralama:', newPlayableChapcas);
    }

    setPlayableChapcas(newPlayableChapcas);
    setCurrentChapcaIndex(0);
    setIsStarted(true);

    // Component key'lerini sıfırla
    setDateCaptchaKey(0);
    setBirthDateCaptchaKey(0);
    setTextCaptchaKey(0);
    setNumberCaptchaKey(0);

    // Session kayıt flag'ini sıfırla
    isSessionSavingRef.current = false;

    // Oturum başlangıcını kaydet
    const startTime = Timestamp.now();
    setSessionStartTime(startTime);
    setChapcaAttempts([]);

    // İlk chapca başlangıcını kaydet
    setCurrentChapcaStartTime(startTime);
  };

  const handleNextChapca = () => {
    if (currentChapcaIndex < playableChapcas.length - 1) {
      setCurrentChapcaIndex(prev => prev + 1);
      // useEffect ile yeni chapca başlangıcı kaydedilecek
    } else {
      // Tüm chapcalar tamamlandı
      // Son chapca kaydı recordChapcaAttempt içinde yapıldı ve shouldSaveSession set edildi
      // Burada sadece flag set etme işlemi yapılmış olmalı (recordChapcaAttempt içinde)
    }
  };

  // Oturumu veritabanına kaydet
  const saveSessionToDatabase = async () => {
    if (!sessionStartTime || !user?.email) {
      console.warn('Cannot save session: missing data');
      return;
    }

    const endTime = Timestamp.now();
    const totalDuration = endTime.toMillis() - sessionStartTime.toMillis();
    const totalDurationSeconds = Math.round(totalDuration / 1000);

    const session = {
      email: user.email,
      startTime: sessionStartTime,
      endTime,
      totalDuration, // milisaniye cinsinden
      totalDurationSeconds, // saniye cinsinden (geriye dönük uyumluluk)
      chapcas: chapcaAttempts.length > 0 ? chapcaAttempts : [],
    };

    const result = await saveChapcaSession(session);
    if (result.error) {
      console.error('Error saving session:', result.error);
      alert('An error occurred while saving the session');
    } else {
      console.log('Session saved successfully:', result.id);
    }
  };

  // Oturumu veritabanına kaydet (attempts parametresi ile)
  const saveSessionToDatabaseWithAttempts = async (attempts: ChapcaAttempt[]) => {
    if (!sessionStartTime || !user?.email) {
      console.warn('Cannot save session: missing data');
      return;
    }

    const endTime = Timestamp.now();
    const totalDuration = endTime.toMillis() - sessionStartTime.toMillis();
    const totalDurationSeconds = Math.round(totalDuration / 1000);

    const session = {
      email: user.email,
      startTime: sessionStartTime,
      endTime,
      totalDuration, // milisaniye cinsinden
      totalDurationSeconds, // saniye cinsinden (geriye dönük uyumluluk)
      chapcas: attempts.length > 0 ? attempts : [],
    };

    const result = await saveChapcaSession(session);
    if (result.error) {
      console.error('Error saving session:', result.error);
      alert('An error occurred while saving the session');
    } else {
      console.log('Session saved successfully:', result.id);
    }
  };

  // currentChapcaIndex değiştiğinde yeni chapca başlangıcını kaydet
  useEffect(() => {
    if (isStarted && playableChapcas.length > 0 && currentChapcaIndex < playableChapcas.length) {
      setCurrentChapcaStartTime(Timestamp.now());
      setCurrentTime(0); // Timer'ı sıfırla
    }
  }, [currentChapcaIndex, isStarted, playableChapcas.length]);


  // Gerçek zamanlı timer
  useEffect(() => {
    if (!isStarted || !currentChapcaStartTime) {
      setCurrentTime(0);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const start = currentChapcaStartTime.toMillis();
      setCurrentTime(now - start);
    }, 10); // Her 10 milisaniyede bir güncelle (daha akıcı görünüm)

    return () => clearInterval(interval);
  }, [isStarted, currentChapcaStartTime]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] relative overflow-hidden flex items-center justify-center">
        {/* Background Image */}
        <div
          className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-25"
          style={{ backgroundImage: 'url(/bgimage2.jpg)' }}
        ></div>

        {/* Dark Overlay */}
        <div className="fixed inset-0 bg-gradient-to-br from-black/60 via-black/40 to-black/60"></div>

        {/* Animated Background */}
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#00965e]/10 rounded-full blur-[120px] animate-pulse"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#4fbfa3]/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>

        <div className="text-center relative z-10">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-[#00965e]"></div>
          <p className="mt-6 text-white/60 font-bold text-lg">Yüklənir...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] relative overflow-hidden">
      {/* Background Image */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-25"
        style={{ backgroundImage: 'url(/bgimage2.jpg)' }}
      ></div>

      {/* Dark Overlay */}
      <div className="fixed inset-0 bg-gradient-to-br from-black/60 via-black/40 to-black/60"></div>

      {/* Animated Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#00965e]/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#4fbfa3]/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      {/* Header */}
      <header className="relative z-10 bg-black/40 backdrop-blur-2xl border-b border-white/5 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleBack}
                className="p-3 text-white/40 hover:text-white hover:bg-white/5 rounded-xl transition-all duration-300"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
              </button>
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-[#00965e] to-[#4fbfa3] rounded-2xl flex items-center justify-center shadow-lg shadow-[#00965e]/20">
                  <span className="text-white font-black text-2xl italic">C</span>
                </div>
                <h1 className="text-2xl font-black uppercase tracking-tight text-white">
                  Chapca
                </h1>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <ThemeToggle />
              <span className="text-sm font-bold text-white/40 hidden sm:block">
                {user.email}
              </span>
              <button
                onClick={() => router.push('/profile')}
                className="px-4 py-2.5 text-sm font-black uppercase tracking-wider text-white/60 bg-white/5 hover:bg-white/10 hover:text-white rounded-xl transition-all duration-300 flex items-center space-x-2 border border-white/5"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                <span>Profil</span>
              </button>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="px-4 py-2.5 text-sm font-black uppercase tracking-wider text-white/60 bg-white/5 hover:bg-white/10 hover:text-white rounded-xl transition-all duration-300 flex items-center space-x-2 border border-white/5"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span>Ayarlar</span>
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2.5 text-sm font-black uppercase tracking-wider text-white/60 bg-white/5 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 rounded-xl transition-all duration-300 border border-white/5"
              >
                Çıxış
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {!isStarted ? (
          <>
            <div className="text-center mb-12">
              <h2 className="text-5xl font-black uppercase tracking-tighter text-white mb-4 bg-gradient-to-r from-[#00965e] to-[#4fbfa3] bg-clip-text text-transparent">
                Chapca Seçimi
              </h2>
              <p className="text-xl text-white/40 font-bold">
                İstədiyiniz chapca növlərini seçin (birdən çox seçə bilərsiniz)
              </p>
            </div>

            {/* Selected Chapcas Info */}
            {selectedChapcas.length > 0 && (
              <div className="max-w-4xl mx-auto mb-8 p-5 bg-[#00965e]/10 backdrop-blur-xl rounded-2xl border border-[#00965e]/20 shadow-2xl">
                <p className="text-center text-[#00965e] font-black uppercase tracking-wider">
                  Seçilmiş Chapcalar ({selectedChapcas.length}): {selectedChapcas.map(type => {
                    if (type === 'tarih') return '📅 Bugünkü Tarix';
                    if (type === 'dogum') return '🎂 Doğum Tarixi';
                    if (type === 'text') return '🔤 Mətn Chapca';
                    if (type === 'rakam') return '🔢 Rəqəm Chapca';
                    if (type === 'puzzle') return '🧩 Şəkil sürüşdürmə';
                    return '';
                  }).join(', ')}
                </p>
              </div>
            )}

            {/* Chapca Selection Boxes */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto mb-8">
              {/* Bugünkü Tarih Box */}
              <div
                onClick={() => toggleChapcaSelection('tarih')}
                className={`cursor-pointer bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 border-2 transition-all hover:shadow-xl relative ${selectedChapcas.includes('tarih')
                  ? 'border-indigo-500 dark:border-indigo-400 shadow-indigo-200 dark:shadow-indigo-900'
                  : 'border-gray-200 dark:border-gray-700'
                  }`}
              >
                {selectedChapcas.includes('tarih') && (
                  <div className="absolute top-4 right-4 w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center">
                    <FaCheck className="w-5 h-5 text-white" />
                  </div>
                )}
                <div className="text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <FaCalendarDay className="text-4xl text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    Today's Date
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Ask the user to enter today's date
                  </p>
                  {correctDate && (
                    <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                      ✓ Set: {correctDate}
                    </p>
                  )}
                  {!correctDate && (
                    <p className="text-sm text-orange-600 dark:text-orange-400">
                      ⚠ Set date in settings
                    </p>
                  )}
                </div>
              </div>

              {/* Doğum Tarihi Box */}
              <div
                onClick={() => toggleChapcaSelection('dogum')}
                className={`cursor-pointer bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 border-2 transition-all hover:shadow-xl relative ${selectedChapcas.includes('dogum')
                  ? 'border-indigo-500 dark:border-indigo-400 shadow-indigo-200 dark:shadow-indigo-900'
                  : 'border-gray-200 dark:border-gray-700'
                  }`}
              >
                {selectedChapcas.includes('dogum') && (
                  <div className="absolute top-4 right-4 w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center">
                    <FaCheck className="w-5 h-5 text-white" />
                  </div>
                )}
                <div className="text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <FaBirthdayCake className="text-4xl text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    Birth Date
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Ask the user to enter their birth date
                  </p>
                  {correctBirthDate && (
                    <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                      ✓ Set: {correctBirthDate}
                    </p>
                  )}
                  {!correctBirthDate && (
                    <p className="text-sm text-orange-600 dark:text-orange-400">
                      ⚠ Set date in settings
                    </p>
                  )}
                </div>
              </div>

              {/* Text Captcha Box */}
              <div
                onClick={() => toggleChapcaSelection('text')}
                className={`cursor-pointer bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 border-2 transition-all hover:shadow-xl relative ${selectedChapcas.includes('text')
                  ? 'border-indigo-500 dark:border-indigo-400 shadow-indigo-200 dark:shadow-indigo-900'
                  : 'border-gray-200 dark:border-gray-700'
                  }`}
              >
                {selectedChapcas.includes('text') && (
                  <div className="absolute top-4 right-4 w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center">
                    <FaCheck className="w-5 h-5 text-white" />
                  </div>
                )}
                <div className="text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <FaFont className="text-4xl text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    Text Chapca
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Ask the user to enter the text shown in the image
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                    ✓ Auto-generated
                  </p>
                </div>
              </div>

              {/* Number Captcha Box */}
              <div
                onClick={() => toggleChapcaSelection('rakam')}
                className={`cursor-pointer bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 border-2 transition-all hover:shadow-xl relative ${selectedChapcas.includes('rakam')
                  ? 'border-indigo-500 dark:border-indigo-400 shadow-indigo-200 dark:shadow-indigo-900'
                  : 'border-gray-200 dark:border-gray-700'
                  }`}
              >
                {selectedChapcas.includes('rakam') && (
                  <div className="absolute top-4 right-4 w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center">
                    <FaCheck className="w-5 h-5 text-white" />
                  </div>
                )}
                <div className="text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <FaHashtag className="text-4xl text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    Number Chapca
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Ask the user to select the numbers shown
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                    ✓ Auto-generated
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => toggleChapcaSelection('puzzle')} aria-pressed={selectedChapcas.includes('puzzle')}
                className={`relative rounded-xl border-2 bg-white p-8 text-center shadow-lg transition-all hover:shadow-xl dark:bg-gray-800 ${selectedChapcas.includes('puzzle') ? 'border-indigo-500 dark:border-indigo-400' : 'border-gray-200 dark:border-gray-700'}`}>
                {selectedChapcas.includes('puzzle') && <span className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500"><FaCheck className="h-5 w-5 text-white" /></span>}
                <span className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-4xl">🧩</span>
                <span className="mb-2 block text-2xl font-bold text-gray-900 dark:text-white">Şəkil sürüşdürmə</span>
                <span className="mb-4 block text-gray-600 dark:text-gray-400">Oxu mouse ilə çəkərək şəkil parçasını boşluğa yerləşdirin.</span>
                <span className="text-sm font-medium text-green-600 dark:text-green-400">✓ Hər cəhddə yeni boşluq</span>
              </button>
            </div>

            {/* Start Button */}
            <div className="flex justify-center">
              <button
                onClick={handleStart}
                disabled={selectedChapcas.length === 0 || (selectedChapcas.includes('tarih') && !canonicalDate(correctDate)) || (selectedChapcas.includes('dogum') && !canonicalDate(correctBirthDate))}
                className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed text-lg"
              >
                Start
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Back Button and Progress */}
            <div className="flex justify-between items-center mb-8">
              <button
                onClick={() => {
                  // Eğer oturum başlamışsa kaydet
                  if (sessionStartTime && chapcaAttempts.length > 0) {
                    saveSessionToDatabase();
                  }
                  setIsStarted(false);
                  setCurrentChapcaIndex(0);
                  setPlayableChapcas([]);
                  setSessionStartTime(null);
                  setChapcaAttempts([]);
                  setCurrentChapcaStartTime(null);
                }}
                className="flex items-center space-x-2 text-white/40 hover:text-white hover:bg-white/5 px-4 py-2 rounded-xl transition-all duration-300 font-bold"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                <span>Geri Dön</span>
              </button>

              {playableChapcas.length > 1 && (
                <div className="flex items-center space-x-3 bg-white/5 backdrop-blur-xl px-6 py-3 rounded-2xl border border-white/10">
                  <span className="text-sm text-white/60 font-black uppercase tracking-wider">
                    İrəliləyiş: {currentChapcaIndex + 1} / {playableChapcas.length}
                  </span>
                  <div className="flex space-x-1.5">
                    {playableChapcas.map((_, index) => (
                      <div
                        key={index}
                        className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${index === currentChapcaIndex
                          ? 'bg-[#00965e] scale-125 shadow-lg shadow-[#00965e]/50'
                          : index < currentChapcaIndex
                            ? 'bg-emerald-500'
                            : 'bg-white/20'
                          }`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Chapca Container */}
            <div className="max-w-[380px] mx-auto relative group">
              <div className="relative">
                {/* Header Information (Small & Professional) */}
                <div className="flex justify-between items-center mb-6 px-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#00965e] animate-pulse"></div>
                    <span className="text-[12px] font-black uppercase tracking-[3px] text-white/40">Sessiya Aktivdir</span>
                  </div>

                  {/* Gerçek Zamanlı Timer (Minimalist) */}
                  <div className="flex items-center gap-2 px-4 py-2 bg-white/5 backdrop-blur-md rounded-full border border-white/10">
                    <span className="text-[14px] font-mono font-bold text-[#00965e] tabular-nums">
                      {formatTime(currentTime)}
                    </span>
                  </div>
                </div>

                {/* Chapca Components */}
                {playableChapcas.length > 0 && playableChapcas[currentChapcaIndex] && (
                  <div className="animate-in fade-in zoom-in-95 duration-500">
                    {playableChapcas[currentChapcaIndex] === 'tarih' ? (
                      <DateCaptcha
                        key={`tarih-${currentChapcaIndex}-${dateCaptchaKey}`}
                        correctDate={correctDate}
                        onVerify={handleDateVerify}
                      />
                    ) : playableChapcas[currentChapcaIndex] === 'dogum' ? (
                      <BirthDateCaptcha
                        key={`dogum-${currentChapcaIndex}-${birthDateCaptchaKey}`}
                        correctDate={correctBirthDate}
                        onVerify={handleBirthDateVerify}
                      />
                    ) : playableChapcas[currentChapcaIndex] === 'text' ? (
                      <TextCaptcha
                        key={`text-${currentChapcaIndex}-${textCaptchaKey}`}
                        onVerify={handleTextVerify}
                      />
                    ) : playableChapcas[currentChapcaIndex] === 'puzzle' ? (
                      <PuzzleCaptcha key={`puzzle-${currentChapcaIndex}`} onVerify={handlePuzzleVerify} />
                    ) : (
                      <NumberCaptcha
                        key={`rakam-${currentChapcaIndex}-${numberCaptchaKey}`}
                        onVerify={handleNumberVerify}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}


        {/* Settings Panel */}
        {showSettings && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Chapca Settings</h3>
                  {selectedChapcas.length > 0 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Total {selectedChapcas.reduce((sum, type) => sum + (chapcaSettings[type]?.count || 1), 0)} chapcas will be played
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setShowSettings(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Hızlı Ayarlar */}
              {selectedChapcas.length > 1 && (
                <div className="mb-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
                  <h4 className="text-sm font-semibold text-indigo-900 dark:text-indigo-300 mb-3">
                    ⚡ Quick Settings (For All Selected Chapcas)
                  </h4>
                  <div>
                    <label className="block text-xs font-medium text-indigo-700 dark:text-indigo-400 mb-2">
                      Repeat Count for All
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      placeholder="1-10"
                      onChange={(e) => {
                        const count = parseInt(e.target.value) || 1;
                        const validCount = Math.max(1, Math.min(10, count));
                        setChapcaSettings(prev => {
                          const newSettings = { ...prev };
                          selectedChapcas.forEach(type => {
                            newSettings[type] = { count: validCount };
                          });
                          return newSettings;
                        });
                      }}
                      className="w-full px-3 py-2 text-sm border border-indigo-300 dark:border-indigo-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Bugünkü Tarih Ayarı */}
                {selectedChapcas.includes('tarih') && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <span className="text-2xl">📅</span>
                        <span>Today's Date Chapca</span>
                      </h4>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Correct Date (DD/MM/YYYY)
                        </label>
                        <input
                          type="text"
                          value={correctDate}
                          onChange={handleDateChange}
                          placeholder="e.g., 09/12/2024"
                          maxLength={10}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                        {correctDate && (
                          <p className="mt-2 text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            {correctDate}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Repeat Count
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={chapcaSettings.tarih.count}
                          onChange={(e) => {
                            const count = parseInt(e.target.value) || 1;
                            setChapcaSettings(prev => ({
                              ...prev,
                              tarih: { count: Math.max(1, Math.min(10, count)) }
                            }));
                          }}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Doğum Tarihi Ayarı */}
                {selectedChapcas.includes('dogum') && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <span className="text-2xl">🎂</span>
                        <span>Birth Date Chapca</span>
                      </h4>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Correct Birth Date (DD/MM/YYYY)
                        </label>
                        <input
                          type="text"
                          value={correctBirthDate}
                          onChange={handleBirthDateChange}
                          placeholder="e.g., 15/06/1990"
                          maxLength={10}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                        {correctBirthDate && (
                          <p className="mt-2 text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            {correctBirthDate}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Repeat Count
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={chapcaSettings.dogum.count}
                          onChange={(e) => {
                            const count = parseInt(e.target.value) || 1;
                            setChapcaSettings(prev => ({
                              ...prev,
                              dogum: { count: Math.max(1, Math.min(10, count)) }
                            }));
                          }}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Metin Chapca Ayarları */}
                {selectedChapcas.includes('text') && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <span className="text-2xl">🔤</span>
                        <span>Text Chapca</span>
                      </h4>
                    </div>
                    <div className="space-y-4">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Random text is automatically generated
                      </p>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Repeat Count
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={chapcaSettings.text.count}
                          onChange={(e) => {
                            const count = parseInt(e.target.value) || 1;
                            setChapcaSettings(prev => ({
                              ...prev,
                              text: { count: Math.max(1, Math.min(10, count)) }
                            }));
                          }}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Rakam Chapca Ayarları */}
                {selectedChapcas.includes('rakam') && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <span className="text-2xl">🔢</span>
                        <span>Number Chapca</span>
                      </h4>
                    </div>
                    <div className="space-y-4">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Random numbers are automatically generated
                      </p>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Repeat Count
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={chapcaSettings.rakam.count}
                          onChange={(e) => {
                            const count = parseInt(e.target.value) || 1;
                            setChapcaSettings(prev => ({
                              ...prev,
                              rakam: { count: Math.max(1, Math.min(10, count)) }
                            }));
                          }}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                )}
                {selectedChapcas.includes('puzzle') && <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-600 dark:bg-gray-700/50">
                  <h4 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">🧩 Şəkil sürüşdürmə</h4>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Repeat Count
                    <input type="number" min={1} max={10} value={chapcaSettings.puzzle.count} onChange={event => setChapcaSettings(previous => ({ ...previous, puzzle: { count: Math.max(1, Math.min(10, Number(event.target.value) || 1)) } }))} className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
                  </label>
                </div>}
              </div>

              {/* Genel Sıralama Ayarı */}
              {selectedChapcas.length > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    📋 General Order
                  </h4>
                  <div className="flex gap-4">
                    <button
                      onClick={() => setGlobalOrder('sequential')}
                      className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${globalOrder === 'sequential'
                        ? 'bg-indigo-600 text-white shadow-lg'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                        }`}
                    >
                      Sequential
                    </button>
                    <button
                      onClick={() => setGlobalOrder('random')}
                      className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${globalOrder === 'random'
                        ? 'bg-indigo-600 text-white shadow-lg'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                        }`}
                    >
                      Random
                    </button>
                  </div>
                  <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                    {globalOrder === 'sequential'
                      ? 'Chapcas will be played in selection order (e.g., Date-Date-Text-Text)'
                      : 'All chapcas will be played in completely random order (e.g., Date-Text-Date-Text)'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
