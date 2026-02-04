# Chapca - Next.js Firebase Projesi

Bu proje Next.js ve Firebase kullanılarak geliştirilmiştir.

## Özellikler

- 🔐 Firebase Authentication ile admin girişi
- 👥 Admin paneli ile normal kullanıcı yönetimi
- 💾 Firestore database ile kullanıcı verileri
- 🎨 Modern ve şık UI tasarımı
- 🌙 Dark mode desteği

## Kurulum

### 1. Bağımlılıkları Yükle

```bash
npm install
```

### 2. Firebase Projesi Oluştur

1. [Firebase Console](https://console.firebase.google.com) adresine gidin
2. Yeni bir proje oluşturun
3. Authentication'ı etkinleştirin (Email/Password)
4. Firestore Database'i oluşturun (Test mode veya Production mode)

### 3. Firebase Yapılandırması

1. Firebase Console'da proje ayarlarına gidin
2. Web uygulaması ekleyin (</> ikonu)
3. Yapılandırma bilgilerini kopyalayın
4. Proje kök dizininde `.env.local` dosyası oluşturun:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### 4. Admin Kullanıcı Oluştur

1. Firebase Console > Authentication > Users
2. "Add user" butonuna tıklayın
3. Email ve şifre ile admin kullanıcı oluşturun
4. `src/lib/admin.ts` dosyasındaki `ADMIN_EMAILS` listesine admin email'ini ekleyin:

```typescript
const ADMIN_EMAILS = [
  'admin@chapca.com',
  'your-admin-email@example.com', // Buraya ekleyin
];
```

### 5. Firestore Kuralları

Firestore Database > Rules bölümünde şu kuralları ayarlayın (geliştirme için):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

**Not:** Production için daha güvenli kurallar kullanın!

## Kullanım

### Geliştirme Sunucusunu Başlat

```bash
npm run dev
```

Tarayıcıda [http://localhost:3000](http://localhost:3000) adresini açın.

### Giriş Yapma

1. Admin kullanıcısı ile `/login` sayfasından giriş yapın
2. Admin iseniz otomatik olarak `/admin` sayfasına yönlendirilirsiniz
3. Normal kullanıcı iseniz ana sayfaya yönlendirilirsiniz

### Admin Paneli

- Admin panelinde (`/admin`) normal kullanıcıları oluşturabilir, düzenleyebilir ve silebilirsiniz
- Normal kullanıcılar Firestore database'de saklanır
- Admin kullanıcıları Firebase Authentication'da tutulur

## Proje Yapısı

```
src/
├── app/
│   ├── admin/          # Admin paneli sayfası
│   ├── login/          # Login sayfası
│   ├── page.tsx        # Ana sayfa
│   └── layout.tsx      # Root layout
├── lib/
│   ├── firebase.ts     # Firebase yapılandırması
│   ├── auth.ts         # Authentication fonksiyonları
│   ├── admin.ts        # Admin kontrolü
│   └── users.ts        # Firestore kullanıcı işlemleri
```

## Teknolojiler

- **Next.js 16** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Firebase Authentication** - Admin authentication
- **Firestore** - Database (normal kullanıcılar)

## Lisans

MIT
