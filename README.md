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


Varsayılan akış **tek bir 3 dakikalık kademeli oyundur**. Ayrı ölçüm turu veya yaşa göre çocuk profili yoktur; yetişkin oyuncular aynı oyunun içinde çalışır. İlk hedef 1,6–2 saniyede çıkar. Her isabet/kaçan hedeften sonra yeni hedef için tam kademe aralığı beklenir; birikmiş hedefler topluca çıkmaz. Hedeflerin çapı ömürleri boyunca %65 → %100 → %65 arasında yumuşakça değişir.

| Kademe | En fazla hedef | Bekleme aralığı | Tam çap | Hedef ömrü |
| --- | --- | --- | --- | --- |
| 1 · Alışma | 1 | 1,6–2,0 sn | 88 px | 4,5 sn |
| 2 · Kontrol | 1 | 1,35–1,75 sn | 80 px | 4,2 sn |
| 3 · Hız | 2 | 1,1–1,5 sn | 72 px | 3,8 sn |
| 4 · Geçiş | 2 | 0,9–1,3 sn | 64 px | 3,4 sn |
| 5 · İleri | 3 | 0,75–1,15 sn | 56 px | 3 sn |

Sekiz sonuçlanan hedefte en az yedi isabet ve en az %85 tıklama doğruluğu bir üst kademeye geçirir. Üç ardışık hata veya sekiz hedefte en fazla dört isabet bir kademe düşürür. Diğer bloklarda aynı kademe tekrarlanır. Üst/alt sınır 5/1'dir. Önceki kademeden kalan hedefler doğdukları kademenin boyutu/ömrüyle tamamlanır ve o kademede raporlanır. Hatalar oyunu bitirmez; 3 dakika sonunda tamamlanır. Manuel bitirme/sekme değiştirme yine yarım tur kaydı oluşturur.

**Admin → Oyuncu karşılaştırması** (`/admin/aim`), bu aynı oyunun kayıtlarından kademe bazında oyuncu farklarını gösterir. Kullanıcı detayında her turun kademe tablosu ve tek tek atış CSV’si vardır. Karşılaştırma için ayrı alıştırma yapılmaz.

- Başlatılan bütün oyunlar eski kullanıcı raporunda sayılır; karşılaştırma tablosuna yalnızca tamamlanmış, alanı değişmemiş ve seçilen giriş türüyle uyuşan kademeli oyunlar alınır.
- Mouse, touchpad ve dokunmatik ayrı tutulur. CSS oyun alanı 20 px aralıklara yuvarlanarak gruplanır; gerçek boyut ve DPR turda saklanır. Mouse/touchpad ayrımı oyuncunun beyanıdır; pointer türü ayrıca doğrulanır. DPI ve donanım farkları hâlâ sonucu etkiler.
- Tıklama doğruluğu = isabet / (isabet + boş tıklama). Hedef yakalama = isabet / (isabet + süresi dolan hedef). Bitince hâlâ etkin hedefler bu ikinci paydaya eklenmez.
- Hedefe erişim = görünmeden isabete kadar geçen süre; görsel tepki **ve mouse hareketini birlikte içerir**, saf refleks ölçümü değildir. Ortalama, ortanca ve standart sapma turdaki kademeye göre hesaplanır. Grup farkı için en az iki oyuncunun seçili kademede en az sekizer isabeti gerekir; fark, bu eşiği geçen oyuncuların ortalama sürelerinin ortancasına göredir. Düşük doğrulukla kısa süre birlikte değerlendirilmelidir; birleşik yetenek puanı üretilmez.
- Merkez doğruluğu = 100 × (1 − ortalama(isabetin merkezden uzaklığı / atış anındaki yarıçap)). Mouse yol verimi = başlangıç–tıklama doğrusal mesafesi / örneklenen toplam yol × 100. İmleç hedef doğarken biliniyorsa ve en az üç anlamlı hareket örneği varsa hesaplanır. Alan içindeki hareket en fazla 20 Hz örneklenir; bu yaklaşık bir kontrol ölçüsüdür.
- Kişisel değişim, ilk 3 tamamlanmış oyun ile onlarla örtüşmeyen son 3 oyunu karşılaştırır. Aynı kademede her iki dönemde de en az 8 isabet gerekir. En az 6 ayrı oyun olmadan gelişim yüzdesi gösterilmez; süre değişimiyle birlikte doğruluk puan değişimi verilir.
- `aimComparison` toplamları uzun vadede büyüyen ham dizi tutmaz. İlk 3/son 3 turun kademe örnekleri saklanır; ham olaylar ilgili `aimSessions` altındadır. Paket tekrarları tamamlanan oyun sayısını artırmaz. Bu sorgu için ek bileşik indeks gerekmez.

Eski serbest seçenekler ayarlarda korunur. Aşağıdaki Challenge/Easy kuralları bu seçeneklere aittir:


Ana Challenge modu, aimtrainer.io/challenge üzerinde gözlenen oyun akışına göre yeniden uygulanmıştır: 2 hedef/s başlangıç, saniyede +0.01 hedef/s hız artışı, süresi dolan hedef başına bir can ve toplam üç can. Boş tıklama can götürmez. Hedefler küçük ve görünür olarak doğar; referanstan 500 ms aralıklı ekran görüntüleriyle ölçülen yaklaşık sabit büyüme/küçülme temposunu izler. Son 250 ms içinde sönerek kaybolur; eski sinüs eğrisinin ortasındaki hızlı büyüme kullanılmaz. Hedef çıkış zamanları sürekli hız eğrisinin integralinden hesaplanır. Yerel motorun hedef ömrü 3500 ms, tam çapı 60 mantıksal piksel ve oyun sahası 800 × 480'dir. Challenge turu, hiç isabet olmadığında yaklaşık 5 saniye sürer; Easy turu yaklaşık 6 saniye sürer. Bu süreler özgün sitedeki gözlenen davranışa göre ayarlanmıştır; sitenin özel kaynak kodu kopyalanmamıştır.

Ayarlar içindeki eski Easy modu: 2 hedef/s başlangıç, saniyede +0.003 hedef/s artış ve 5 can. Referans Easy turunda gözlenen 6 saniyede 2.00 → 2.02 hedef/s davranışına göre ayarlanmıştır; 30 saniyede 2.09 hedef/s olur. Orijinal Challenge (2 hedef/s, +0.01/s, 3 can), Custom, Doubleshot ve Moving Targets seçenekleri de vardır. Doubleshot aynı anda yalnızca bir hedef çifti gösterir; üst üste yeni çiftler oluşturmaz. Custom ayarları: başlangıç hızı, saniyelik artış, can sayısı ve hedef boyutu; hareketli modda hareket hızı da değişir. ESC/S, sekme değiştirme veya sayfadan ayrılma turu sonlandırır. Tek tur üst sınırı 30 dakikadır.

Her PLAY sunucuda baştan bir `aimSessions` belgesi oluşturur. Her hedefin doğuşu, her isabet/boş tıklama ve süre aşımı sıra numarasıyla tutulur. Olaylar üç saniyede bir ve tur sonunda en fazla 100 olaylık idempotent paketlerle `aimSessions/{runId}/batches` alt koleksiyonuna yazılır. Bekleyen paketler kullanıcıya ait localStorage kuyruğunda korunur; sonraki açılışta aynı oturum sahibiyle tekrar gönderilir. Tarayıcının aniden kapatılmasında son kontrol noktasından önce henüz yerel diske alınmamış en son olaylar kurtarılamayabilir; başlangıç kaydı ve önceki paketler admin panelinde kalır.

Admin → kullanıcı detayları → Direct Aim sekmesi bütün tarihçe için toplam oyun sayısı, toplam/ortalama/en iyi isabet, ağırlıklı doğruluk, ortalama tepki süresi, tıklama aralığı, yarım kalan ve tamamlanan turları gösterir. Oturumlar sayfalanır; toplamlar ilk 20 kayıt üzerinden hesaplanmaz. Bir turu açınca bütün paketler yüklenir; zaman serisi, atış haritası, tek tek tıklama aralıkları ve CSV çıktısı gösterilir. Haritada uzun turların son 800 atışı, grafikte örneklenmiş en fazla 350 nokta çizilir; tablo ve CSV bütün atışları içerir.

- **Hedefe erişim (eski raporlarda reaksiyon):** hedef doğuşundan isabete kadar geçen süre; görme ve hareketi birlikte içerir.
- **Atış aralığı:** iki ardışık tıklama arasındaki süre; boş tıklamalar dahildir.
- **İsabet aralığı:** iki ardışık başarılı vuruş arasındaki süre.
- **Ortalama isabet/tur:** bütün isabetler / başlatılan bütün turlar.
- **Doğruluk:** isabet / (isabet + boş tıklama); süre aşımı tıklama değildir.

Ölçümler tarayıcının monoton performans saatine dayanır. Sunucu olay sırasını, hedefin varlığını/ömrünü, isabet geometrisini ve tur sahipliğini kontrol eder; özetleri olaylardan yeniden hesaplar. Eski özet kayıtlarında eksik atış zamanları uydurulmaz. Yeni raporlama sorguları için güncel `firestore.indexes.json` uygulanmalıdır. Grafikler, CSV ve normal kullanıcı geçmişi de aynı yetkilendirme katmanını kullanır.

```bash
npm run test:aim
```


Ses varsayılan olarak açıktır. İsabet, boş tıklama ve kaçan hedef için ayrı yerel sesler üretilir; dışarıdan ses dosyası indirilmez. Ses seviyesi ve üç efekt ayarlardan değiştirilebilir. Ses motoru PLAY hareketinde hazırlanır; oyun ortasında açıldığında da oluşturulup devam ettirilir. Sesi kapatma tercihi localStorage içinde saklanır. `Səsi yoxla` düğmesi sesi oyun başlamadan denemeyi sağlar.
