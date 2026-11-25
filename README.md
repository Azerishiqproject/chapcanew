# Chapca

Next.js 16, React 19, TypeScript, Redux ve Firebase ile CAPTCHA, hedef tıklama ve konut satış simülasyonu.

## Kimlik ve veri modeli

- **Admin:** yalnızca Firebase Authentication hesabıdır. `admin@admin.com` adresi ve sunucudaki `FIREBASE_ADMIN_UID` birlikte doğrulanır. Admin için `users` belgesi oluşturulmaz.
- **Normal kullanıcılar:** admin panelinden oluşturulur ve yalnızca Firestore `users` koleksiyonuna yazılır. Auth hesabı açılmaz. E-posta ve şifreyle giriş yaparlar; şifreler sunucuda salt içeren scrypt hash'i olarak tutulur ve tarayıcıya dönmez.
- **Oturumlar:** admin için Firebase session cookie, normal kullanıcı için sunucuda doğrulanan rastgele oturum belirteci kullanılır. Cookie'ler HttpOnly ve SameSite=Strict; production ortamında Secure olur. Süre bir saattir. localStorage yetkilendirme için kullanılmaz.
- **Veri erişimi:** bütün kullanıcı, alıştırma ve ayar işlemleri `/api/*` üzerinden geçer. Sunucu Firebase Admin SDK kullanır. Normal kullanıcı yalnızca kendi geçmişine ve ayarlarına erişir; kullanıcı yönetimi yalnızca admin içindir.

## Kurulum

Node.js 22 veya üstü kullanın. Bu sürüm koşulu `--env-file` ve `--import` kullanan kurulum komutları içindir.

```bash
npm ci
cp .env.example .env.local
```

`.env.local` içinde web uygulaması ayarlarını ve sunucu servis hesabı bilgilerini doldurun. Web ayarları `chapca-new` projesine göre örneklendirilmiştir. Servis hesabı özel anahtarı ve admin parolası kaynak koda veya `NEXT_PUBLIC_` değişkenlerine eklenmez. Anahtar tek satırda çift tırnak içinde `\n` ayraçlarıyla yazılabilir.

```env
FIREBASE_PROJECT_ID=chapca-new
FIREBASE_CLIENT_EMAIL=SERVIS_HESABI_EPOSTASI
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_ADMIN_UID=LyUa9Ueq9SNiP4NydsNqXFkxkKb2
APP_ORIGIN=http://localhost:3000
```

Firebase Console'da:

1. Authentication → Sign-in method → Email/Password açık olmalı.
2. `admin@admin.com` Auth hesabının UID'si `FIREBASE_ADMIN_UID` ile aynı olmalı. Şifre Firebase Auth'ta yönetilir; uygulamada sabit admin şifresi bulunmaz.
3. Firestore Database oluşturulmuş olmalı.
4. Rules sekmesine `firestore.rules` içeriğini yapıştırıp Publish seçin.
5. Oturum geçmişi sorguları için `firestore.indexes.json` içindeki üç bileşik indeksi oluşturun. CLI kullanıyorsanız:

```bash
firebase deploy --only firestore:rules,firestore:indexes --project chapca-new
```

Bu komut canlı kuralları değiştirir; hazırlık sırasında otomatik çalıştırılmaz. İndeksler hazır olana kadar geçmiş sorguları hata verebilir.

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) adresini açın. Admin panelinden eklenen normal kullanıcılar aynı giriş ekranını kullanır. Normal kullanıcı şifresi en az 8, en fazla 128 karakterdir. Firestore'dan admin rolü verme desteklenmez.

## Firestore kuralları neden bütün istemcileri reddediyor?

Normal kullanıcıların Firebase Auth hesabı olmadığı için `request.auth` ile onları doğrulamak mümkün değildir. Bu nedenle tarayıcıdan doğrudan Firestore erişimi kapalıdır. Next.js sunucusu Admin SDK ile erişir; her API isteğinde admin veya kullanıcı oturumunu ve kayıt sahipliğini kontrol eder. Bu model için Node.js sunucusu gerekir; statik export/yalnızca Firebase Hosting dosya barındırması yeterli değildir.

## Koleksiyonlar

- `users`: normal kullanıcı profili, e-posta, parola hash'i ve oturum sürümü. Belge kimliği normalize edilmiş e-postanın SHA-256 özetidir; e-posta değiştirilemez.
- `chapcaSessions`, `aimSessions`, `salesSessions`: eğitim sonuçları ve sunucunun eklediği kullanıcı kimliği/e-posta.
- `aimComparison`: tamamlanan kademeli oyunların kullanıcı/aygıt/alan/protokol bazında sınırlı karşılaştırma özetleri. Yalnızca admin API’sinden okunur.
- `captchaSettings`: kullanıcı ayarları.
- `serverSessions`: yalnızca normal kullanıcıların hash'lenmiş oturum belirteçleri; son kullanma zamanı sunucuda kontrol edilir.
- `loginAttempts`: 15 dakikalık giriş denemesi sayaçları; hesap başına 10, tüm uygulama için 300 deneme.

`serverSessions` ve `loginAttempts` için `expiresAt` alanına Firestore TTL politikası eklenebilir. TTL temizliği gecikse de süresi dolan oturum kabul edilmez. Silinen kullanıcının oturumları hemen geçersiz olur; geçmiş alıştırma sonuçları otomatik silinmez. Kullanıcı silinip aynı e-posta tekrar oluşturulduğunda eski oturumlar tekrar etkinleşmez. Normal kullanıcı parolası sunucu API'sinden değiştirildiğinde eski oturumlar iptal edilir.

Eski projenin düz metin parolalı kayıtları bu sürümle uyumlu değildir ve yeni projeye otomatik taşınmaz. `scripts/export-firestore.mjs` ve `scripts/import-firestore.mjs` eski istemci erişim modeline ait yardımcı betiklerdir; bu sunucu modelinde kullanılmaz.

## Mevcut admini doğrulama / yeni admin oluşturma

Mevcut Auth hesabı varsa yalnızca UID/e-posta kontrolü yapılır ve şifresi değiştirilmez. Hesap yoksa, sadece ilk oluşturma için `.env.local` içindeki `ADMIN_INITIAL_PASSWORD` kullanılır:

```bash
npm run setup:admin -- --confirm-project=chapca-new
```

Bu betik Auth dışında kayıt oluşturmaz. Yeni bir hesap oluşturulursa çıktısındaki UID'yi `FIREBASE_ADMIN_UID` alanına yazın. Eski `scripts/create-user.ts` aynı admin kurulum betiğine yönlendirilmiştir.

## Doğrulama

```bash
npm run test:auth
firebase emulators:exec --project demo-chapca-auth --only auth,firestore 'npm run test:integration'
npx tsc --noEmit --incremental false
npm run build -- --webpack
```

Entegrasyon testleri gerçek Firebase projesine karşı çalışmayı reddeder. Auth ve Firestore emülatörleri gerekir. Testler; admin/kullanıcı ayrımı, parola doğrulama, rol yükseltmenin engellenmesi, çapraz kullanıcı erişimi, kayıt sahipliği, sayfalama, cookie oturumları, parola değişimi/silme sonrası iptal ve kapalı Firestore kurallarını denetler.

## Yayınlama


Vercel’de Framework Preset **Next.js** ve Build Command **npm run build** kullanın. Build betiği doğrulanan webpack derlemesini çalıştırır. Project → Settings → Environment Variables bölümüne `.env.example` içindeki çalışma zamanı değişkenlerini gerçek değerleriyle ekleyin. `FIREBASE_PRIVATE_KEY` ve `FIREBASE_CLIENT_EMAIL` sunucu değişkenleridir; `NEXT_PUBLIC_` öneki eklenmez. `ADMIN_INITIAL_PASSWORD` mevcut adminle çalışan yayında gerekli değildir.

`APP_ORIGIN` değeri sitenin tam HTTPS origin’i olmalıdır (örnek: `https://projeniz.vercel.app`); sonunda `/` bulunmamalıdır. Preview adresi farklıysa o ortam için kendi origin’ini kullanın. Firebase Authentication → Settings → Authorized domains listesine de sitenin alan adını ekleyin. Değişkenler kaydedildikten sonra yeniden deploy edin. Servis hesabı JSON dosyasını veya gerçek değerli `.env` dosyasını repoya eklemeyin.


Uygulamayı Next.js Node.js çalışma ortamında barındırın. `.env.example` içindeki sunucu değişkenlerini barındırma ortamına ekleyin; `APP_ORIGIN` değerini sitenin tam HTTPS origin'i olarak ayarlayın. Web yapılandırması değiştiğinde Next.js production derlemesini yeniden alın. `.env.local`, servis hesabı JSON dosyası, `backups/` ve derleme çıktıları Git'e/kod paketine eklenmez.


## Direct Aim ve admin raporları

Varsayılan oyun, kullanıcının sağladığı 25 Kasım 2026 ekran kaydındaki Challenge akışına göre ayarlanmıştır. Hedefler tıklamadan bağımsız bir saatle kesintisiz çıkar; isabetten sonra bekleme veya başarı bloğu yoktur. Üç hedefin süresi dolduğunda tur biter; boş tıklama doğruluğu düşürür ama can götürmez.

- Başlangıç: **2 hedef/sn**, saniyede **+0,01 hedef/sn**. Videodaki yaklaşık 15 saniyede 2,00 → 2,15 davranışıyla eşleşir. 30 saniyede 2,30; 60 saniyede 2,60; 90 saniyede 2,90 olur. Ani hız çarpanı kullanılmaz.
- Hedefler yaklaşık **4 saniyede 0 → 60 → 0 mantıksal piksel** çap döngüsünü tamamlar. Videodaki tam döngülerde ölçülen yaklaşık 30 px/sn büyüme/küçülme esas alınır. İlk ve son anlarda hedef çok küçüktür.
- Doğuş zamanları artan hız eğrisinin integralinden hesaplanır; frame hızı, isabet veya boş tıklama hedef saatini sıfırlamaz. Aynı anda yalnızca tek hedefe kilitlenmez.
- Başlangıç/orta/yüksek tempo etiketleri 0–30, 30–90 ve 90+ saniye bölümlerini adlandırır. Bölüm sınırlarında hız veya hedef boyutu sıçramaz; bunlar aynı oyunun raporlama aralıklarıdır.
- Ses, nişangah, tam ekran, Easy, Custom, Doubleshot ve Moving Targets korunur. Orijinal Challenge/Easy ayarlarıyla başlamış eski kayıtların geometrisi ve kuralları geriye uyumlu doğrulanır.
- ESC/S, sekme değiştirme veya sayfadan ayrılma yarım tur kaydı oluşturur. Süre üst sınırı 30 dakikadır. Eski üç dakikalık başarı bloklu oyun varsayılan arayüzden kaldırılmıştır; onun kayıtları okunmaya devam eder.

Her PLAY başında `aimSessions` belgesi oluşturulur. Hedef doğuşu, her isabet/boş tıklama ve süre aşımı sıralı/idempotent paketlerle `aimSessions/{runId}/batches` altına yazılır. Üç saniyede bir ve tur sonunda en fazla 100 olaylık paket gönderilir; bekleyen paketler kullanıcıya ait localStorage kuyruğunda saklanır. Tarayıcı aniden kapanırsa son kontrol noktasından önce diske alınmamış en son olaylar kurtarılamayabilir. Sunucu sahiplik, sıra, süre, hedef geometrisi ve yeni Direct Aim için hedef çıkış saatini doğrular; sonuçları olaylardan yeniden hesaplar.

Admin → kullanıcı detayları → Direct Aim bütün başlatılan, tamamlanan ve yarım kalan turları sayar. Toplam/ortalama/en iyi isabet, ağırlıklı doğruluk, hedefe erişim ve atış/isabet aralıkları gösterilir. Bir tur açıldığında başlangıç/orta/yüksek tempo dökümü, grafikler, atış haritası, tek tek tıklamalar ve CSV bulunur. Toplamlar ilk 20 kayıt üzerinden hesaplanmaz. Haritada son 800 atış, grafikte örneklenmiş en fazla 350 nokta çizilir; tablo/CSV bütün atışları içerir.

Admin → Oyuncu karşılaştırması (`/admin/aim`) aynı oyundaki tempo bölümlerini, aygıtı ve benzer CSS oyun alanlarını karşılaştırır. `reference-video-v1` kayıtları, önceki `progressive-v1` kayıtlarından ayrı tutulur; eski kayıtlar akış filtresinden seçilebilir. Yeni indeks veya Firestore kural değişikliği gerekmez.

- Karşılaştırmaya tamamlanmış, alanı değişmemiş ve seçilen giriş türüyle uyuşan turlar alınır. Mouse/touchpad ayrımı oyuncu beyanıdır; pointer türü ayrıca kontrol edilir. Alan boyutları 20 px aralıklara yuvarlanır; gerçek boyut/DPR turda saklanır. DPI ve donanım farkları sonucu etkileyebilir.
- **Tıklama doğruluğu:** isabet / (isabet + boş tıklama). **Hedef yakalama:** isabet / (isabet + süresi dolan hedef). Tur bitince etkin kalan hedefler ikinci paydaya eklenmez.
- **Hedefe erişim:** hedef doğuşundan isabete kadar geçen süre; görsel tepki ve mouse hareketini birlikte içerir, saf refleks değildir. Ortalama, ortanca ve standart sapma bölüm bazında hesaplanır. Grup süre farkı için aynı bölümde en az sekizer isabeti olan en az iki oyuncu gerekir. Grup referansı, uygun oyuncuların ortalama sürelerinin ortancasıdır. Hız ve doğruluk birlikte değerlendirilir.
- **Merkez doğruluğu:** 100 × (1 − ortalama(merkez uzaklığı / atış anındaki yarıçap)). **Yol verimi:** doğrusal başlangıç–tıklama mesafesi / örneklenen yol × 100. Hedef doğarken imleç biliniyorsa ve en az üç anlamlı hareket segmenti varsa hesaplanır. Alan içindeki hareket en fazla 20 Hz örneklenir; yaklaşık bir kontrol ölçüsüdür.
- **Kişisel değişim:** ilk 3 tamamlanmış oyun ile onlarla örtüşmeyen son 3 oyun. Aynı bölümde iki dönemde de en az 8 isabet ve toplam en az 6 ayrı oyun gerekir. Süre değişimiyle doğruluk puan değişimi birlikte gösterilir.
- `aimComparison` özetlerinde sınırsız ham dizi biriktirilmez; ilk 3/son 3 turun bölüm örnekleri ve toplamlar saklanır. Paket tekrarları oyun sayısını artırmaz. Ham olaylar turun altında kalır. Bu tarayıcı tabanlı ölçüm bağımsız bir anti-cheat değildir.

Ses varsayılan açıktır; isabet, boş tıklama ve kaçan hedef için yerel sesler üretilir. Ses seviyesi ve efektler ayarlanabilir. Ses motoru PLAY hareketinde hazırlanır ve oyun sırasında açıldığında da devam ettirilir. Sesi kapatma tercihi localStorage’da tutulur.

```bash
npm run test:aim
npm run test:auth
firebase emulators:exec --project demo-chapca-auth --only auth,firestore 'npm run test:integration'
npm run build
```
