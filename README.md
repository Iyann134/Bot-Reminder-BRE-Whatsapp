# 🔥 BRE - AI Personal Secretary & Operations Agent (WhatsApp Bot)

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Database](https://img.shields.io/badge/Database-Supabase%20%7C%20JSON-emerald.svg)](https://supabase.com/)
[![WhatsApp](https://img.shields.io/badge/API-Baileys%20Multi--Device-25D366.svg)](https://github.com/WhiskeySockets/Baileys)

**BRE** adalah AI Personal Secretary & Operations Agent otonom yang beroperasi di platform WhatsApp. Didesain khusus untuk mengelola jadwal perkuliahan, *to-do list* akademik, pencatatan tugas dengan parsing tanggal alami (Bahasa Indonesia & Inggris), serta pengirim notifikasi pengingat otomatis secara presisi.

---

## 🌟 Fitur Utama

- 👥 **Multi-User (Multi-Tenant) Data Isolation**: Setiap pengguna diidentifikasi berdasarkan **Nomor WhatsApp (`user_phone`)**. Tugas dan jadwal disimpan terpisah secara privat dan aman di database cloud maupun lokal.
- 📅 **Manajemen Jadwal Kuliah (`schedules`)**: Pencatatan jadwal matkul lengkap dengan hari, jam, mata kuliah, dan lokasi/ruangan.
- ⏳ **Manajemen Tugas (`tasks`) & Smart Date Parser**: Pemrosesan tenggat waktu berbasis bahasa alami (contoh: *"Besok jam 8 malam"*, *"Lusa jam 14:00"*, *"Senin jam 10:00"*) menggunakan `chrono-node` & custom Indonesian parser.
- ⏰ **Pengingat Otomatis Presisi (`node-cron`)**:
  - 🔔 **Pengingat Jadwal Kuliah**: Notifikasi WhatsApp **30 menit sebelum kelas dimulai**.
  - 🔔 **Pengingat Deadline Tugas**: Alert WhatsApp **3 jam sebelum tenggat waktu tugas**.
- 📱 **Format Output WhatsApp Mobile-Friendly**: Dashboard modern menggunakan Markdown WhatsApp (strikethrough `~tugas selesai~ ✅`, ID unik `[T01]`, `[J01]`, status emoji ⏳, ✅, 📌, ⏰).
- ☁️ **Dual-Mode Storage (Supabase Cloud + Local `db.json` Fallback)**: Langsung aktif tanpa konfigurasi dengan `db.json` lokal, atau terhubung ke Supabase PostgreSQL Cloud.
- 🌐 **Ready for 24/7 Cloud Deployment**: Dilengkapi HTTP Keep-Alive Server bawaan untuk deployment 24 jam di cloud hosting seperti **DOM Cloud**, **Render**, atau **Cloud VPS**.

---

## 🛠️ Tech Stack (100% Free & Open-Source)

- **Runtime**: Node.js (ES Modules)
- **WhatsApp API**: `@whiskeysockets/baileys` (Multi-Device Engine)
- **Cloud Database**: Supabase (PostgreSQL Cloud)
- **Local Fallback**: Atomic JSON Store (`db.json`)
- **Background Scheduler**: `node-cron`
- **Date Parser**: `chrono-node` + Custom Indonesian Natural Language Parser
- **Terminal QR Renderer**: `qrcode-terminal`

---

## 📖 Tabel Perintah (Command Recognition Matrix)

| Perintah | Format / Contoh | Deskripsi |
| :--- | :--- | :--- |
| **`!list` / `!tugas`** | `!list` | Menampilkan dashboard lengkap jadwal & daftar tugas terpisah per pengguna. |
| **`!tambah tugas`** | `!tambah tugas Laporan Lab \| Besok jam 8 malam` | Menambah tugas baru dengan parsing deadline alami. |
| **`!tambah jadwal`** | `!tambah jadwal Senin \| 08:00 - 10:30 \| Jaringan Komputer \| Lab 3` | Menambah jadwal kuliah baru. |
| **`!edit tugas`** | `!edit tugas T01 \| Judul Baru \| Besok 10 malam` | Mengubah judul atau deadline tugas yang sudah ada. |
| **`!edit jadwal`** | `!edit jadwal J01 \| Selasa \| 10:00 - 12:30 \| Matkul \| Lab 1` | Mengubah rincian jadwal kuliah yang sudah ada. |
| **`!selesai`** | `!selesai T01` | Menandai tugas selesai dengan format strikethrough. |
| **`!hapus`** | `!hapus T01` atau `!hapus J01` | Menghapus tugas / jadwal dari database. |
| **`!help`** | `!help` | Menampilkan bantuan perintah dan template sintaks. |

---

## 🗄️ Database Schemas (`supabase_schema.sql`)

Eksekusi script DDL berikut di **SQL Editor Supabase**:

```sql
-- 1. Schedules Table
CREATE TABLE IF NOT EXISTS schedules (
    id SERIAL PRIMARY KEY,
    user_phone VARCHAR(50) NOT NULL,
    day VARCHAR(20) NOT NULL,
    time VARCHAR(50) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    location VARCHAR(255) DEFAULT 'Online / TBD',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_schedules_user_phone ON schedules(user_phone);

-- 2. Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    user_phone VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    deadline_text VARCHAR(255),
    deadline_datetime TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_tasks_user_phone ON tasks(user_phone);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
```

---

## 🚀 Panduan Setup & Instalasi Lokal

### 1. Clone Repositori
```bash
git clone https://github.com/Iyann134/Bot-Reminder-BRE-Whatsapp.git
cd Bot-Reminder-BRE-Whatsapp
```

### 2. Install Dependensi
```bash
npm install
```

### 3. Konfigurasi Environment Variables (`.env`)
Buat file `.env` di root folder (bisa meniru `.env.example`):
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
BOT_NAME=BRE
TIMEZONE=Asia/Jakarta
```
*(Catatan: Jika `SUPABASE_URL` dibiarkan kosong, bot akan otomatis menggunakan database lokal `db.json`)*.

### 4. Jalankan Bot
```bash
npm start
```
Scan **QR Code** yang muncul di terminal menggunakan aplikasi WhatsApp di HP kamu (**Perangkat Tertaut / Linked Devices**).

---

## ☁️ Panduan Deploy Online 24/7 di DOM Cloud (`domcloud.id`)

1. Login ke **[domcloud.id](https://domcloud.id)** via Google/GitHub (Tanpa Kartu Kredit/Debit).
2. Tambahkan **Host / Domain Baru** ➡️ Pilih Runner **`Node app.js`**.
3. Hubungkan ke repositori GitHub kamu.
4. Masukkan Environment Variables (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `TIMEZONE`).
5. Klik **Deploy**.
6. Buka menu **Web SSH** di DOM Cloud dashboard, jalankan:
   ```bash
   cd public_html && npm install && npm start
   ```
7. Scan **QR Code** yang muncul di layar Web SSH dari WhatsApp di HP-mu.
8. Bot WA BRE kamu resmi online 24 jam nonstop!

---

## 🔄 Cara Mengganti / Reset Nomor WhatsApp Bot (Pindah ke Nomor Ke-2)

Jika kamu ingin memindahkan bot ini dari nomor pribadi ke **Nomor WhatsApp Ke-2 (Nomor Cadangan / WA Business)**:

1. Buka menu **Web SSH** di dashboard DOM Cloud (atau terminal lokal).
2. Jalankan perintah hapus sesi lama dan restart bot:
   ```bash
   cd public_html && rm -rf auth_info_baileys && npm start
   ```
3. Terminal akan menghasilkan **QR Code Baru**.
4. Scan QR Code baru tersebut menggunakan **Nomor WhatsApp Ke-2 / Cadangan** kamu.
5. Selesai! Sekarang nomor ke-2 tersebut menjadi mesin bot BRE, dan kamu bisa leluasa chat ke kontak bot tersebut dari nomor WA pribadimu tanpa khawatir tenggelam!

---

## 🔒 Keamanan & Public Repository Guideline

File `.gitignore` sudah dikonfigurasi untuk melindungi file sensitif:
- `.env` *(Kunci rahasia API)*
- `auth_info_baileys/` *(Sesi kredensial login WhatsApp)*
- `db.json` *(Data lokal)*
- `node_modules/`

*Aman untuk dipublish secara publik di GitHub!*

---

## 📄 Lisensi

Proyek ini dilesensikan di bawah [MIT License](LICENSE).
