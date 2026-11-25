'use client';
import { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronRight, Layers, RefreshCw, Settings, ShieldCheck } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { replaceCaptchaSettings } from '@/store/slices/captchaSlice';
import { captchaSettingsErrors, defaultCaptchaSettings, normalizeCaptchaSettings, resolveCaptchaSettings, type CaptchaState, type CaptchaType } from '@/lib/captcha-config';
import { getUserCaptchaSettings, saveUserCaptchaSettings } from '@/lib/captchaSettings';
export interface SettingsStatus { blocked: boolean; reason: string }
export default function CaptchaSettingsPanel({ onStatusChange }: { onStatusChange?: (status: SettingsStatus) => void }) {
  const user = useAppSelector(state => state.auth.user);
  return user ? <SettingsForm key={user.uid} uid={user.uid} onStatusChange={onStatusChange} /> : null;
}
function SettingsForm({ uid, onStatusChange }: { uid: string; onStatusChange?: (status: SettingsStatus) => void }) {
  const dispatch = useAppDispatch();
  const [draft, setDraft] = useState(defaultCaptchaSettings);
  const [lastSaved, setLastSaved] = useState('');
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const saving = useRef(false), alive = useRef(true);
  const dirty = !!lastSaved && JSON.stringify(normalizeCaptchaSettings(draft)) !== lastSaved;
  const reason = isLoadingSettings ? 'CAPTCHA ayarları yüklənir.' : isSaving ? 'Ayarlar yadda saxlanılır.' : loadError ? 'CAPTCHA ayarlarını yenidən yükləyin.' : captchaSettingsErrors(draft).length ? 'CAPTCHA ayarlarını düzəldin və yadda saxlayın.' : dirty ? 'Simulyasiyadan əvvəl CAPTCHA ayarlarını yadda saxlayın.' : '';
  useEffect(() => { onStatusChange?.({ blocked: !!reason, reason }); }, [onStatusChange, reason]);
  useEffect(() => {
    let cancelled = false; alive.current = true;
    getUserCaptchaSettings(uid).then(({ settings, error }) => {
      if (cancelled) return;
      setLoadError(error); setSettingsError(error); setIsLoadingSettings(false);
      if (error) return;
      const config = normalizeCaptchaSettings(resolveCaptchaSettings(settings));
      setDraft(config); setLastSaved(JSON.stringify(config)); dispatch(replaceCaptchaSettings(config));
    });
    return () => { cancelled = true; alive.current = false; };
  }, [dispatch, uid, reload]);
  function edit(value: Partial<CaptchaState>) { setDraft(previous => ({ ...previous, ...value })); setShowSuccess(false); setSettingsError(null); }
  function toggleType(type: CaptchaType) {
    if (draft.allowedTypes.length === 1 && draft.allowedTypes.includes(type)) return;
    edit({ allowedTypes: draft.allowedTypes.includes(type) ? draft.allowedTypes.filter(item => item !== type) : [...draft.allowedTypes, type] });
  }
  async function handleSave() {
    if (saving.current || isLoadingSettings || loadError) return;
    const config = normalizeCaptchaSettings(draft), errors = captchaSettingsErrors(config);
    if (errors.length) { setSettingsError(errors.join(' ')); return; }
    saving.current = true; setIsSaving(true); setSettingsError(null); setShowSuccess(false);
    const { error } = await saveUserCaptchaSettings(uid, config);
    if (!alive.current) return;
    saving.current = false; setIsSaving(false); setSettingsError(error);
    if (error) return;
    setDraft(config); setLastSaved(JSON.stringify(config)); dispatch(replaceCaptchaSettings(config)); setShowSuccess(true);
  }
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
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${draft.enabled ? 'bg-[#00965e]/10 text-[#00965e]' : 'bg-gray-200 text-gray-400'}`}>
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-gray-800">Captcha Sistemi</h3>
              <p className="text-xs text-gray-500">Sistem aktiv olduqda təhlükəsizlik yoxlamaları aktivləşəcək.</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" role="switch" aria-label="Captcha Sistemi" disabled={isLoadingSettings || isSaving || !!loadError} checked={draft.enabled} onChange={(e) => edit({ enabled: e.target.checked })} className="sr-only peer" />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00965e]"></div>
          </label>
        </div>

        <fieldset disabled={!draft.enabled || isLoadingSettings || isSaving} className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 transition-opacity duration-300 ${draft.enabled ? 'opacity-100' : 'opacity-40'}`}>
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
                { id: 'birthdate' as CaptchaType, label: 'Doğum Tarixi Captcha' },
                { id: 'fin' as CaptchaType, label: 'FİN / İdentifikasiya Captcha' },
                { id: 'religion' as CaptchaType, label: 'Din Captcha' },
                { id: 'favoriteCar' as CaptchaType, label: 'Sevimli Maşın Captcha' },
                { id: 'puzzle' as CaptchaType, label: 'Şəkil sürüşdürmə Captcha' }
              ].map(item => (
                <label key={item.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-sm cursor-pointer hover:bg-gray-50 transition-colors group">
                  <input
                    type="checkbox"
                    checked={draft.allowedTypes.includes(item.id)}
                    onChange={() => toggleType(item.id)}
                    className="w-4 h-4 accent-[#00965e]"
                  />
                  <span className={`text-sm font-medium transition-colors ${draft.allowedTypes.includes(item.id) ? 'text-gray-900' : 'text-gray-400'}`}>
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
            <p className="text-xs text-gray-400 leading-relaxed">Tur boyunca həll ediləcək ümumi CAPTCHA sayını seçin. 2–5 olduqda seçim və axtarış mərhələlərinə bölünür; 1 olduqda seçimdə göstərilir.</p>
            <div className="flex items-center gap-4 pt-2">
              <input
                type="range"
                aria-label="Tur üzrə ümumi CAPTCHA sayı"
                min="1"
                max="5"
                value={draft.requiredCount}
                onChange={(e) => edit({ requiredCount: Number(e.target.value) })}
                className="flex-grow accent-[#00965e]"
              />
              <span className="w-10 h-10 bg-[#00965e] text-white rounded-full flex items-center justify-center font-bold text-lg shadow-sm">
                {draft.requiredCount}
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
                <label htmlFor="captcha-todayDate" className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Bugünkü Tarix (Tarix Captcha)</label>
                <input
                  type="text"
                  id="captcha-todayDate" disabled={!draft.allowedTypes.includes('date')}
                  placeholder="DD/MM/YYYY"
                  value={draft.dateConfig.todayDate}
                  onChange={(e) => edit({ dateConfig: { ...draft.dateConfig, todayDate: e.target.value } })}
                  className="text-gray-800 bg-white disabled:bg-gray-50 disabled:text-gray-400 w-full p-2.5 border border-gray-200 rounded-sm text-sm focus:ring-1 focus:ring-[#00965e] focus:border-[#00965e] outline-none transition-all font-mono"
                />
              </div>
              <div>
                <label htmlFor="captcha-birthDate" className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Doğum Tarixi (Doğum Captcha)</label>
                <input
                  type="text"
                  id="captcha-birthDate" disabled={!draft.allowedTypes.includes('birthdate')}
                  placeholder="DD/MM/YYYY"
                  value={draft.dateConfig.birthDate}
                  onChange={(e) => edit({ dateConfig: { ...draft.dateConfig, birthDate: e.target.value } })}
                  className="text-gray-800 bg-white disabled:bg-gray-50 disabled:text-gray-400 w-full p-2.5 border border-gray-200 rounded-sm text-sm focus:ring-1 focus:ring-[#00965e] focus:border-[#00965e] outline-none transition-all font-mono"
                />
              </div>
              <div>
                <label htmlFor="captcha-fin" className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">FİN (7 simvol)</label>
                <input
                  type="text"
                  id="captcha-fin" disabled={!draft.allowedTypes.includes('fin')}
                  maxLength={7}
                  placeholder="69SZNKO"
                  value={draft.personalConfig.fin}
                  onChange={(e) => edit({ personalConfig: { ...draft.personalConfig, fin: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7) } })}
                  className="text-gray-800 bg-white disabled:bg-gray-50 disabled:text-gray-400 w-full p-2.5 border border-gray-200 rounded-sm text-sm focus:ring-1 focus:ring-[#00965e] focus:border-[#00965e] outline-none transition-all font-mono uppercase tracking-widest"
                />
              </div>
              <div>
                <label htmlFor="captcha-religion" className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Din</label>
                <input
                  type="text"
                  id="captcha-religion" disabled={!draft.allowedTypes.includes('religion')}
                  maxLength={40}
                  value={draft.personalConfig.religion}
                  onChange={(e) => edit({ personalConfig: { ...draft.personalConfig, religion: e.target.value } })}
                  className="text-gray-800 bg-white disabled:bg-gray-50 disabled:text-gray-400 w-full p-2.5 border border-gray-200 rounded-sm text-sm focus:ring-1 focus:ring-[#00965e] focus:border-[#00965e] outline-none transition-all"
                />
              </div>
              <div>
                <label htmlFor="captcha-favoriteCar" className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Sevimli Maşın</label>
                <input
                  type="text"
                  id="captcha-favoriteCar" disabled={!draft.allowedTypes.includes('favoriteCar')}
                  maxLength={40}
                  value={draft.personalConfig.favoriteCar}
                  onChange={(e) => edit({ personalConfig: { ...draft.personalConfig, favoriteCar: e.target.value } })}
                  className="text-gray-800 bg-white disabled:bg-gray-50 disabled:text-gray-400 w-full p-2.5 border border-gray-200 rounded-sm text-sm focus:ring-1 focus:ring-[#00965e] focus:border-[#00965e] outline-none transition-all"
                />
              </div>
            </div>
          </div>
        </fieldset>
      </div>

      {/* Footer Save Button */}
      <div className="p-6 bg-gray-50/50 border-t border-gray-50 flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
        <div className="text-sm font-medium">
          {isLoadingSettings && <span className="text-gray-400">Ayarlar yüklənir...</span>}
          {settingsError && <span role="alert" className="text-red-500">{settingsError}</span>}{loadError && <button type="button" onClick={() => { setIsLoadingSettings(true); setReload(value => value + 1); }} className="ml-2 underline">Yenidən yüklə</button>}{dirty && !settingsError && <span className="text-gray-500">Dəyişiklikləri yeni turdan əvvəl yadda saxlayın.</span>}
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving || isLoadingSettings || !!loadError}
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
}
