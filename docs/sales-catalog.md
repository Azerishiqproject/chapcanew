# Satış demosunun adres kataloğu

Arayüz, kullanıcının sağladığı MİDA satış ekranlarının 1440 × 810 CSS piksel karşılığına göre hazırlanmıştır. Görsellerdeki kırmızı açıklama çizgileri arayüze dahil değildir. Daha küçük ekranlarda okunabilirlik için yerleşim uyarlanır.

Akış: layihə → ödəniş → ünvan üzrə seçim → bina/giriş/mərtəbə/mənzil → Axtar → sonuç satırına veya Növbəti düğmesine tıklayarak turu bitir. Harita/parametre kartları referanstaki gibi kilitli görsel seçeneklerdir; bu sürümde adres akışı uygulanır. Sayaçlar tur başlangıcından itibaren 15/30 dakika üzerinden ilerler; sıfıra inmeleri başka bir seçim yöntemi açmaz.

## Kaynaklar

- [MİDA satış kılavuzu (2025)](https://mida.gov.az/documents/Sat%C4%B1%C5%9F_t%C9%99limat_2025.pdf): adres alanlarının sırası ve arama akışı.
- [Lənkəran satış listesi](https://mida.gov.az/documents/satish/L%C9%99nk%C9%99ran%20YK%20-%20sat%C4%B1%C5%9F%2010%20m%C9%99nzil%20siyah%C4%B1.pdf): örnek adres için ayrıca plan API kaydı kullanılır.
- [Lənkəran projesi](https://mida.gov.az/layihe/300016).
- MİDA'nın herkese açık plan API'si: `https://api.mida.gov.az/api/front`. Proje bağlantıları veri dosyasında kayıtlıdır.

25 Kasım 2026 tarihinde `getProjectSectors/{projectId}` üzerinden 11 projenin 235 farklı bina numarası alınmıştır. Aynı binanın birden çok sektörü birleştirilir; aynı giriş için eski ve yeni sektör kayıtları varsa güncel olan kullanılır. Girişler keyfî 1–5 sayıları değildir. Katlar ve o kattaki daire numaraları, `getSectorFloors/{sectorId}` ve `getSectorFloorsApartments/{sectorId}/{floorId}` kayıtlarından gelir. Aynı sektörde aynı resmî `sector_floor_plan_id` bulunan katlar aynı yerleşimi kullanır. Konut bulunmayan katlar listelenmez; örneğin Lənkəran 2 numaralı binada konut katları 2–9'dur. Daire numarası seçilen giriş ve kata bağlıdır.

`src/data/sales-catalog.json` bina/izinli sektör listesini ve indirilmiş planları içerir. Veri servisi indirme sırasında erişilemez hâle geldiği için 30 binanın planları çevrimdışı hazırdır; diğer binalar seçildiğinde sunucu yalnızca bu dosyada izinli resmî sektörlerin planlarını yükler. Başarılı sonuçlar sunucuda 24 saat önbelleğe alınır. Başarısız yükleme uydurma kayıt veya yanlış giriş/kat seçeneği üretmez; yeniden deneme gösterir. Örnekteki Lənkəran 2 → 307 → 5 → 3 adresi tamamen çevrimdışı katalogdan çalışır: 9 kat, 4 oda, iç alan 114.60 m², dış alan 135.60 m².

Bunlar mimari plan verileridir; güncel satış stoğu veya fiyat değildir. `Satışdadır` ve `XXXXX` referanstaki eğitim görünümüdür. Gerçek rezervasyon, başvuru veya ödeme yapılmaz.

## Süre, geçmiş ve admin ortalamaları

Tur, ayarlar doğrulandıktan sonra `sales/runs` üzerinden sunucuda oluşturulur. Aynı istemci tur kimliği tekrar gönderilse de tek belge açılır. Seçimler, alan odakları, aşama geçişleri, aramalar, sıfırlamalar, katalog yükleme sonuçları, CAPTCHA açılış/kapanış/tekrar/doğru/yanlış olayları, sayfanın ön/arka plana gelmesi ve tur bitişi sıralı olaylar olarak tutulur. Yazılan CAPTCHA cevapları kaydedilmez. Tarihçe yalnızca uygulamanın anlamlı işlemlerini içerir; ham mouse hareketleri/tuş metinleri toplanmaz.

Her üç saniyede ve tur bitişinde en fazla 50 olaylık paketler gönderilir. Sunucu sıra, zaman, sahiplik, geçerli aşama/adres/CAPTCHA ilerlemesini doğrular ve süreleri/sayıları olaylardan hesaplar. Aynı paket tekrar gönderilirse ikinci kez sayılmaz; değişmiş paket içeriği reddedilir. `salesSessions/{runId}/batches` olayları, ana belgede özet ve küçük çalışma durumu saklanır. Çalışma durumu kullanıcıya/admin liste API'sine dönmez.

Paketler kullanıcı ve tur bazında localStorage kuyruğunda tutulur. Aynı sekmenin yeniden açılışında yarım tur son kontrol noktasında kapatılıp gönderilebilir; başka aktif sekmenin turu kapatılmaz. Bitmiş turların bekleyen paketleri de yeniden gönderilir. Sıradan sayfa ayrılışı/yenileme ve çıkış yarım tur kaydı oluşturur. Tarayıcının aniden kapanması, depolamanın engellenmesi veya son kontrol noktasından önceki olayların diske yazılamaması durumunda son olaylar kurtarılamayabilir. Bu durumda başlangıç/son kontrol noktası kaydı tamamlanmamış tur olarak görünür. Yerel saat değişimi sınırlanır; kayıt üst sınırı 12 saattir.

İlk üç ekran `step1Duration`, arama `step2Duration` içindedir. Proje/ödeme/yöntem/arama süreleri ayrıca tutulur; geri dönüşler ilgili aşamaya eklenir. CAPTCHA aktif çözüm süresi bu aşamaların içindedir ve ayrıca gösterilir; aşama süreleriyle tekrar toplanmaz. Kapalı pencere ve geri bildirim bekleme süreleri CAPTCHA aktif süresine dahil değildir. Sekme arka planda kaldığında tur süresi işlemeye devam eder.

Admin → kullanıcı → Sales, sayfa sayısından bağımsız bütün tur belgelerini kullanarak toplam başlatılan/tamamlanan/yarım/açık sayısını gösterir. Tur, aşama ve CAPTCHA süre ortalamaları yalnızca tamamlanmış turlardan hesaplanır. CAPTCHA türü ortalaması, tamamlanan turlardaki doğru çözümlerin süre toplamı / çözüm sayısıdır. Doğru/yanlış ve işlem toplamları bütün kayıtları içerir. Oturum listesi ve olay tablosu sayfalanır; tarihçe CSV'si bütün olay sayfalarını indirir. Önceki sürümlerin sonuç kayıtları korunur ve tamamlanmış kabul edilir; geçmişte kaydedilmemiş adımlar yeniden oluşturulmaz. Eski `sessions/sales` POST yolu uyumluluk için kalır; yeni simülasyon bunu kullanmaz.

Adres formundaki native select düğümleri memo ile sabit tutulur; yöntem sayaçları kendi bileşeninde güncellenir. Adres değişince eski katalog isteği iptal edilir; bina seçimi yükleme sırasında da kullanılabilir. Dış katalog yüklemesi sunucuda toplam 12, istemcide 15 saniye ile sınırlıdır. Bekleme/hata açıkça gösterilir ve yeniden deneme mümkündür. Firestore kuralları/indeksleri değişmez; `batches.events` mevcut alan indeks muafiyetini kullanır.

Kontroller: `npm run test:sales`, `npm run test:captcha`, `npm run test:auth`, Auth/Firestore emülatörleriyle `npm run test:integration`, TypeScript ve production build. Görsel testler yalnızca yerel emülatör verileriyle yapılır.

## CAPTCHA ayarlarının uygulanması

`Sequential Sayı` **tur boyunca toplam doğru çözüm sayısıdır**. 1 ise seçim ekranında bir kontrol açılır; 2–5 ise her iki aşamada en az bir kontrol olacak şekilde seçim ve arama aşamalarına dağıtılır. Yalnız seçilen türler kullanılır; seçilen türler bitmeden aynı tür tekrar seçilmez. Ayar sayısı tür sayısından küçükse seçilen türlerden rastgele bir alt küme gösterilir. Sistem kapalıysa kontrol açılmaz. Geri dönmek veya pencereyi kapatıp açmak çözülmüş kontrolleri tekrar istemez; yanlış cevap ilerlemeyi artırmaz.

Ayarlar kullanıcı kimliğiyle sunucudan yüklenir. Kayıt yoksa o güne ait yeni varsayılanlar kullanılır; önceki hesabın Redux ayarları devralınmaz. Kaydedilmemiş/geçersiz ayarlar satış başlatmayı engeller. Yeni tur ayarların sabit bir kopyasını kullanır; başka sekmede yapılan değişiklikler bir sonraki tura uygulanır. Etkin seçili tarih/kişisel cevap alanları istemci ve sunucuda aynı kurallarla doğrulanır. Geçersiz eski ayarlar ayar ekranından düzeltilebilir; bozuk cevapla tur başlatılmaz.

Sekiz CAPTCHA türünün bileşenleri hem doğru hem yanlış cevabı bildirir. Bir giriş yalnızca bir kez bildirilir; ebeveyn ekranın yeniden çizilmesi cevap üretmez. Yanlış cevapta 1.5 saniye sonra giriş yenilenir, doğru cevapta sıra bir kez ilerler. Aktif çözüm süreleri kapanışlar arasında birikir. Tarih biçimleri normalleştirilir ve gerçek takvim günü kontrol edilir. İngilizce metin kodları ile Azerice kişisel cevapların büyük/küçük harf karşılaştırmaları ayrı yapılır.

`npm run test:captcha` bileşenleri, ayar formunu, hesap değişimi yarışını ve sıra modelini test eder. Emülatör entegrasyon testi ayrıca ayar sahipliğini, kalıcılığı, geçersiz kaydın reddini ve tur toplamını doğrular.


## Hazır tarih alanları ve resim sürükleme

Tarih ve doğum tarihi CAPTCHA'larında her yeni kontrolde boş giriş, hazır gün, hazır ay veya hazır yıl varyantlarından biri eşit olasılıkla seçilir. Hazır alan kayıtlı doğru tarihten gelir, yeşil görünür ve kullanıcı girişi o alanı atlar. Geri sil/temizle yalnızca kullanıcı girdisini değiştirir. Tamamlanan tarih tüm alanlarla birlikte doğrulanır; yanlış cevap sonrası yeni bir varyant gelir.

`Şəkil sürüşdürmə Captcha` ayarlarda isteğe bağlı yeni bir türdür. Yerel bir SVG resmin 44 × 44 mantıksal piksel karesi, başlangıçta boşluğun solundadır. Alttaki ok tutamacı parçayı yatay taşır. Yalnızca bırakma anında konum kontrol edilir; tolerans 360 piksel resim koordinatında ±5 pikseldir. Farklı ekranlarda hareket bu koordinata ölçeklenir. İptal, ikinci pointer ve hareket etmeyen tıklama cevap sayılmaz. Yanlış bırakma tek hata sayılır, 1.5 saniye sonra yeni konumla tekrar denenir. Klavye ile oklar ve Enter/boşluk da desteklenir. Bu tür ayrı CAPTCHA antrenmanına ve o antrenmanın tekrar sayısı/kayıt akışına da dahildir. Resim uygulamayla gelir; harici resim servisi gerekmez.
