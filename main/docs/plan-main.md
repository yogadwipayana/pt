# Panduan Beta Tester

Halaman `/beta-tester` berisi panduan singkat untuk beta tester agar bisa mulai memakai Dwipa dan melaporkan hasil pengujian.

## Step 1: Register

Beta tester harus membuat akun terlebih dahulu.

- Buka halaman `/sign-up`.
- Isi data akun.
- Login ke Dwipa setelah akun berhasil dibuat.

## Step 2: Pilih Plans

Setelah login, beta tester perlu memilih atau mengecek plan yang tersedia.

- Buka halaman `/pricing`.
- Pilih plan yang ingin digunakan.
- Untuk awal pengujian, beta tester bisa memakai plan `Free`.
- Beberapa beta tester awal akan mendapat `$50 credit`.
- Beta tester bisa menggunakan plan `Pro` dengan menghubungi WA admin Dwipa.
- Jika butuh credit tambahan, beta tester bisa menghubungi WA admin Dwipa.

## Step 3: Buat API Keys

Beta tester perlu membuat API key untuk menghubungkan aplikasi dengan Dwipa.

- Buka halaman `/settings/keys`.
- Klik buat API key baru.
- Salin API key yang sudah dibuat.
- Simpan API key dengan aman.

## Step 4: Hubungkan ke Aplikasi

API key yang sudah dibuat digunakan untuk menghubungkan aplikasi beta tester ke Dwipa.

- Gunakan base URL Dwipa:

```text
https://ai.dwipa.my.id/v1
```

- Gunakan endpoint Dwipa:

```text
https://ai.dwipa.my.id/v1/chat/completions
```

- Masukkan API key ke environment aplikasi.
- Gunakan format request OpenAI-compatible.
- Jalankan test request dari aplikasi.
- Pastikan response berhasil diterima.

Contoh environment:

```text
DWIPA_API_KEY=your_api_key_here
```

## Step 5: Report ke WA

Setelah mencoba Dwipa, beta tester wajib mengirim laporan ke grup WhatsApp atau Telegram.

Link grup:

- WhatsApp: `https://chat.whatsapp.com/HPrp2KTt4Ta9pTVwRLGWLu?mode=hqctcli`
- Telegram: `https://t.me/+WA8J9FWMWpE0OWU1`

Isi report yang disarankan:

- Nama beta tester.
- Email akun Dwipa.
- Plan yang digunakan.
- Aplikasi atau project yang dihubungkan.
- Model yang dicoba.
- Apakah API key berhasil digunakan.
- Apakah request berhasil atau error.
- Kendala yang ditemukan.
- Screenshot jika ada.

Format report:

```text
Nama:
Email akun:
Plan:
Project/aplikasi:
Model yang dicoba:
Status API key:
Status request:
Kendala:
Screenshot:
```

Kirim report ke grup WA atau Telegram Dwipa.
