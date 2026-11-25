# Firebase Admin SDK ve admin hesabı

Bu proje `chapca-new` Firebase projesi için yapılandırılmıştır.

- Admin e-posta: `admin@admin.com`
- Beklenen UID: `LyUa9Ueq9SNiP4NydsNqXFkxkKb2`
- Admin profili yalnızca Firebase Authentication'da tutulur; Firestore `users` koleksiyonuna admin eklenmez.
- Admin şifresi Auth'ta yönetilir. Kaynak koda yazılmaz.

## Sunucu anahtarı

Firebase Console → Project settings → Service accounts → Generate new private key.

JSON dosyasındaki `project_id`, `client_email`, `private_key` alanlarını `.env.local` içinde sırasıyla `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` alanlarına girin. Anahtar çift tırnak içinde `\n` ayraçlarıyla tek satırda tutulabilir. Hiçbir servis hesabı alanını `NEXT_PUBLIC_` önekiyle tanımlamayın.

Web ve servis hesabı proje kimlikleri aynı olmalıdır. Sunucu uyuşmazlıkta bağlantıyı reddeder.

## Admin

Auth → Sign-in method → Email/Password etkin olmalı. Auth → Users bölümündeki admin UID'si `.env.local` içindeki `FIREBASE_ADMIN_UID` ile eşleşmeli.

Hesap zaten varsa kurulum betiği şifreyi değiştirmez:

```bash
npm run setup:admin -- --confirm-project=chapca-new
```

Hesap yoksa yalnızca bu işlem için `ADMIN_INITIAL_PASSWORD` değişkenini doldurun. Betik Auth hesabını oluşturur ve UID'yi gösterir. UID'yi yapılandırmaya ekleyin ve başlangıç şifresi değişkenini temizleyin.

## Firestore

`firestore.rules` ve `firestore.indexes.json` dosyalarını uygulayın. Kurallar bütün doğrudan istemci erişimini reddeder. Uygulamanın Next.js sunucusu Firebase Admin SDK ile çalışır ve kendi oturum/yetki kontrollerini uygular.

Ayrıntılı kurulum, test ve yayınlama adımları [README.md](README.md) içindedir.
