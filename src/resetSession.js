import fs from 'fs';
import path from 'path';

const authDir = path.resolve(process.cwd(), 'auth_info_baileys');

console.log('🔄 Memulai proses reset sesi WhatsApp...');

if (fs.existsSync(authDir)) {
  try {
    fs.rmSync(authDir, { recursive: true, force: true });
    console.log('✅ Folder auth_info_baileys berhasil dihapus!');
  } catch (err) {
    console.error('❌ Gagal menghapus auth_info_baileys:', err.message);
  }
} else {
  console.log('ℹ️ Folder auth_info_baileys tidak ditemukan (sudah bersih).');
}

console.log('📲 Sesi telah direset. Silakan jalankan `npm start` untuk scan QR Code baru.');
