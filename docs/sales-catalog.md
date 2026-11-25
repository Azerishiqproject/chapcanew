# Satış demosunun adres kataloğu

Arayüz, kullanıcının sağladığı MİDA satış ekranlarının 1440 × 810 CSS piksel karşılığına göre hazırlanmıştır. Görsellerdeki kırmızı açıklama çizgileri arayüze dahil değildir. Daha küçük ekranlarda okunabilirlik için yerleşim uyarlanır.

Akış: layihə → ödəniş → ünvan üzrə seçim → bina/giriş/mərtəbə/mənzil → Axtar → sonuç satırına veya Növbəti düğmesine tıklayarak turu bitir. Harita/parametre kartları referanstaki gibi kilitli görsel seçeneklerdir; bu sürümde adres akışı uygulanır. Sayaçlar tur başlangıcından itibaren 15/30 dakika üzerinden ilerler; sıfıra inmeleri başka bir seçim yöntemi açmaz.

## Kaynaklar

- [MİDA satış kılavuzu (2025)](https://mida.gov.az/documents/Sat%C4%B1%C5%9F_t%C9%99limat_2025.pdf): adres alanlarının sırası ve arama akışı.
- [Lənkəran satış listesi](https://mida.gov.az/documents/satish/L%C9%99nk%C9%99ran%20YK%20-%20sat%C4%B1%C5%9F%2010%20m%C9%99nzil%20siyah%C4%B1.pdf): örnek adres için ayrıca plan API kaydı kullanılır.
- [Lənkəran projesi](https://mida.gov.az/layihe/300016).
- MİDA'nın herkese açık plan API'si: `https://api.mida.gov.az/api/front`. Proje bağlantıları veri dosyasında kayıtlıdır.

25 Kasım 2026 tarihinde `getProjectSectors/{projectId}` üzerinden 11 projenin 235 farklı bina numarası alınmıştır. Aynı binanın birden çok sektörü birleştirilir; aynı giriş için eski ve yeni sektör kayıtları varsa güncel olan kullanılır. Girişler keyfî 1–5 sayıları değildir. Katlar ve o kattaki daire numaraları, `getSectorFloors/{sectorId}` ve `getSectorFloorsApartments/{sectorId}/{floorId}` kayıtlarından gelir. Aynı sektörde aynı resmî `sector_floor_plan_id` bulunan katlar aynı yerleşimi kullanır. Konut bulunmayan katlar listelenmez; örneğin Lənkəran 2 numaralı binada konut katları 2–9'dur. Daire numarası seçilen giriş ve kata bağlıdır.

`src/data/sales-catalog.json` bina/izinli sektör listesini ve indirilmiş planları içerir. Veri servisi indirme sırasında erişilemez hâle geldiği için 7 binanın planları çevrimdışı hazırdır; diğer binalar seçildiğinde sunucu yalnızca bu dosyada izinli resmî sektörlerin planlarını yükler. Başarılı sonuçlar sunucuda 24 saat önbelleğe alınır. Başarısız yükleme uydurma kayıt veya yanlış giriş/kat seçeneği üretmez; yeniden deneme gösterir. Örnekteki Lənkəran 2 → 307 → 5 → 3 adresi tamamen çevrimdışı katalogdan çalışır: 9 kat, 4 oda, iç alan 114.60 m², dış alan 135.60 m².

Bunlar mimari plan verileridir; güncel satış stoğu veya fiyat değildir. `Satışdadır` ve `XXXXX` referanstaki eğitim görünümüdür. Gerçek rezervasyon, başvuru veya ödeme yapılmaz.

## Süre ve kayıtlar

Kullanıcı CAPTCHA ayarları yüklendikten sonra tur başlar. İlk üç ekran `step1Duration`, adres arama `step2Duration` içinde birikir. Geri dönüşler de ilgili aşamaya eklenir. CAPTCHA türleri, toplam sayısı ve iki aşamaya dağılımı korunur; kontroller modalda açılır. CAPTCHA çözüm süreleri aşama sürelerinin içindedir ve ayrıca raporlanır; üç süre birbirine toplanmaz. Yanlış cevapların harcadığı süre doğru çözüme kadar CAPTCHA süresine dahildir.

Sonuca ilk tıklamada saat durur. Süreler, CAPTCHA doğru/yanlış sayıları, proje ve seçilen adres/ödeme yöntemi mevcut `sessions/sales` API'sine yazılır. Kaydetme hatası tur ekranında açıkça gösterilir ve aynı dondurulmuş sonuçla yeniden denenebilir. İstek kaybolup cevabı alınamadığında mevcut otomatik kimlikli kayıt API'si tam idempotentlik garanti etmez. Eski satış kayıtları ek `selection` alanı olmadan okunmaya devam eder. Firestore kuralları/indeksleri değişmez.

Kontroller: `npm run test:sales`, `npm run test:auth`, Auth/Firestore emülatörleriyle `npm run test:integration`, TypeScript ve production build. Görsel kontrol 1440 × 810 boyutunda yerel emülatör hesabıyla yapılır; CAPTCHA yalnızca bu geçici test verisinde kapalıdır.
