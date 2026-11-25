'use client';
import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
interface Props {
  simulationStartTime: number; simulationEndTime: number; step1Duration: number; step2Duration: number;
  captchaTotalDuration: number; correctCaptchas: number; incorrectCaptchas: number;
  captchaLogs: { type: string; duration: number }[]; onRestart: () => void;
}
export default function SalesCompletion({ simulationStartTime, simulationEndTime, step1Duration, step2Duration, captchaTotalDuration, correctCaptchas, incorrectCaptchas, captchaLogs, onRestart }: Props) {
  const [showDetailedLogs, setShowDetailedLogs] = useState(false);
  return (
          <div className="w-full min-h-[600px] flex items-center justify-center bg-gray-50/30 p-6">
            <div className="bg-white border border-gray-100 shadow-xl rounded-2xl p-10 max-w-2xl w-full animate-in zoom-in-95 duration-500">
              <div className="text-center mb-10">
                <div className="w-20 h-20 bg-[#e5f5ef] text-[#00965e] rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                </div>
                <h2 className="text-[32px] font-bold text-gray-800 mb-2">Simulyasiya Tamamlandı!</h2>
                <p className="text-gray-500 font-medium">Mənzil seçimi prosesi uğurla başa çatdırıldı.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                {/* Global Total */}
                <div className="md:col-span-2 bg-[#00965e] p-8 rounded-2xl border border-[#007a4d] shadow-lg transform hover:scale-[1.02] transition-all">
                  <div className="text-[13px] font-black text-white/70 uppercase tracking-[4px] mb-2">SİMULYASİYA CƏMİ</div>
                  <div className="text-[42px] font-black text-white tabular-nums leading-none">
                    {simulationEndTime && simulationStartTime ? ((simulationEndTime - simulationStartTime) / 1000).toFixed(1) : '0.0'}
                    <span className="text-xl font-bold ml-1 opacity-60">san</span>
                  </div>
                </div>

                <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 transition-all hover:shadow-md">
                  <div className="text-[13px] font-bold text-gray-400 uppercase tracking-widest mb-1">Step 1 (Seçimlər)</div>
                  <div className="text-[28px] font-black text-gray-800 tabular-nums">{step1Duration.toFixed(1)} <span className="text-lg font-bold text-gray-400">san</span></div>
                </div>
                <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 transition-all hover:shadow-md">
                  <div className="text-[13px] font-bold text-gray-400 uppercase tracking-widest mb-1">Step 2 (Axtarış)</div>
                  <div className="text-[28px] font-black text-gray-800 tabular-nums">{step2Duration.toFixed(1)} <span className="text-lg font-bold text-gray-400">san</span></div>
                </div>
                <div className="bg-green-50/50 p-6 rounded-xl border border-green-100 md:col-span-2 transition-all hover:shadow-md">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-[13px] font-bold text-[#00965e]/60 uppercase tracking-widest mb-1">Captcha Analizi</div>
                      <div className="text-[28px] font-black text-[#00965e] tabular-nums">
                        {captchaTotalDuration.toFixed(1)} <span className="text-lg font-bold">san</span>
                      </div>
                      <div className="flex gap-4 mt-2">
                        <div className="flex items-center gap-1.5 text-[13px] font-bold text-green-600">
                          <span className="w-2 h-2 rounded-full bg-green-500"></span>
                          {correctCaptchas} Doğru
                        </div>
                        <div className="flex items-center gap-1.5 text-[13px] font-bold text-red-500">
                          <span className="w-2 h-2 rounded-full bg-red-500"></span>
                          {incorrectCaptchas} Yanlış
                        </div>
                        <button
                          onClick={() => setShowDetailedLogs(!showDetailedLogs)}
                          className="ml-2 text-[11px] font-black text-indigo-500 underline uppercase tracking-widest hover:text-indigo-700"
                        >
                          {showDetailedLogs ? 'Detalları Gizlə' : 'Detalları Göstər'}
                        </button>
                      </div>
                    </div>
                    <div className="w-12 h-12 bg-[#00965e]/10 rounded-full flex items-center justify-center">
                      <RefreshCw size={24} className="text-[#00965e]" />
                    </div>
                  </div>

                  {/* Detailed Captcha Logs */}
                  {showDetailedLogs && (
                    <div className="mt-6 border-t border-green-100 pt-4 animate-in slide-in-from-top-2 duration-300">
                      <div className="space-y-2">
                        {captchaLogs.map((log, i) => (
                          <div key={i} className="flex justify-between items-center bg-white/50 px-4 py-2 rounded-lg border border-green-50">
                            <div className="flex items-center gap-3">
                              <span className="w-5 h-5 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-[10px] font-bold">{i + 1}</span>
                              <span className="text-[13px] font-bold text-gray-600 uppercase tracking-tight">{log.type} Captcha</span>
                            </div>
                            <span className="text-[14px] font-black text-gray-800">{log.duration.toFixed(2)} san</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <button
                  onClick={() => onRestart()}
                  className="w-full py-4 bg-[#00965e] text-white rounded-xl font-bold text-lg hover:bg-[#007a4d] transition-all shadow-lg hover:shadow-xl active:scale-[0.98]"
                >
                  Yenidən Başla
                </button>
                <div className="text-center text-gray-400 text-xs font-medium uppercase tracking-wider">
                  Bütün MƏLUMATLAR yalnız SİMULYASİYA ÜÇÜNDÜR
                </div>
              </div>
            </div>
          </div>
  );
}
