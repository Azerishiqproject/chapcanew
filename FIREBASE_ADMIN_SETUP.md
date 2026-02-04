# Firebase Admin SDK Kurulumu

## Adımlar:

### 1. Firebase Console'a Git
https://console.firebase.google.com/

### 2. Projenizi Seçin
- "worktodemo" projesini seçin

### 3. Service Account Key Oluştur
1. Sol menüden **Project Settings** (⚙️ simgesi) → **Service Accounts** sekmesine gidin
2. **Generate New Private Key** butonuna tıklayın
3. JSON dosyasını indirin (örn: `worktodemo-firebase-adminsdk-xxxxx.json`)

### 4. .env.local Dosyasına Ekle
İndirdiğiniz JSON dosyasından şu bilgileri alın:

```json
{
  "project_id": "worktodemo",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@worktodemo.iam.gserviceaccount.com"
}
```

`.env.local` dosyanıza şu satırları ekleyin:

```bash
# Firebase Admin SDK (Backend)
FIREBASE_PROJECT_ID=worktodemo
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@worktodemo.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour-Private-Key-Here\n-----END PRIVATE KEY-----\n"
```

**ÖNEMLİ:** `FIREBASE_PRIVATE_KEY` değerini tırnak içinde yazın ve `\n` karakterlerini koruyun!

### 5. Sunucuyu Yeniden Başlat
```bash
npm run dev
```

## Test Et
Artık admin panelinden kullanıcı oluştururken:
- ✅ Admin şifrenizi girmenize gerek yok
- ✅ Oturumunuz korunuyor
- ✅ Liste otomatik yenileniyor
