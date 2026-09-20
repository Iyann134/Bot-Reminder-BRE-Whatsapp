import { taskService } from '../services/taskService.js';
import { scheduleService } from '../services/scheduleService.js';

/**
 * Main command router for BRE WhatsApp agent
 * @param {string} senderJid 
 * @param {string} text 
 * @returns {Promise<string>}
 */
export async function handleCommand(senderJid, text) {
  if (!text || typeof text !== 'string') return null;

  const rawMessage = text.trim();
  const lowerMsg = rawMessage.toLowerCase();
  const userPhone = senderJid.split('@')[0];

  // Helper for help template output
  const renderHelpText = () => {
    return `🔥 *BRE COMMAND MATRIX & TEMPLATE* 🔥\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📍 *1. Lihat Semua (Dashboard)*\n` +
      `• \`!list\` atau \`!tugas\` atau \`!jadwal\`\n\n` +
      `➕ *2. Tambah Tugas Baru*\n` +
      `• \`!tambah tugas [Judul] | [Deadline]\`\n` +
      `  _Contoh:_ \`!tambah tugas Laporan Lab | Besok jam 8 malam\`\n\n` +
      `📅 *3. Tambah Jadwal Kuliah*\n` +
      `• \`!tambah jadwal [Hari] | [Jam] | [Matkul] | [Lokasi]\`\n` +
      `  _Contoh:_ \`!tambah jadwal Senin | 08:00 - 10:30 | Jaringan Komputer | Lab 3\`\n\n` +
      `✅ *4. Selesaikan Tugas*\n` +
      `• \`!selesai [ID_TUGAS]\`\n` +
      `  _Contoh:_ \`!selesai T01\`\n\n` +
      `🗑️ *5. Hapus Task / Jadwal*\n` +
      `• \`!hapus [ID]\`\n` +
      `  _Contoh:_ \`!hapus T01\` atau \`!hapus J01\`\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `💡 _Pastikan menggunakan karakter pemisah vertical bar (\`|\`) saat menambah item!_`;
  };

  // 1. HELP / MENU COMMAND
  if (lowerMsg === '!help' || lowerMsg === '!menu') {
    return renderHelpText();
  }

  // 2. VIEW DASHBOARD / LIST
  if (
    lowerMsg === '!list' || 
    lowerMsg === '!tugas' || 
    lowerMsg === '!jadwal' || 
    lowerMsg === 'status' || 
    lowerMsg === 'list all'
  ) {
    return await taskService.renderDashboard(userPhone);
  }

  // 3. TAMBAH TUGAS
  if (lowerMsg.startsWith('!tambah tugas') || lowerMsg.startsWith('tambah tugas')) {
    const payload = rawMessage.substring(rawMessage.indexOf('tugas') + 5).trim();
    const parts = payload.split('|').map(s => s.trim());

    if (!parts[0] || parts[0].length === 0) {
      return `⚠️ *FORMAT SALAH*, bre!\n\n` +
        `*Gunakan Format:* \`!tambah tugas [Judul] | [Deadline]\`\n` +
        `*Contoh:* \`!tambah tugas Laporan Lab Pemrograman | Besok jam 8 malam\``;
    }

    const title = parts[0];
    const deadline = parts[1] || 'Tidak ada deadline';

    const newTask = await taskService.addTask(userPhone, title, deadline);
    return `✅ *TUGAS BERHASIL DITAMBAHKAN!*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `📌 *Judul:* ${newTask.title}\n` +
      `⏰ *Deadline:* ${newTask.deadline_text}\n\n` +
      `_Ketik \`!list\` untuk melihat dashboard tugasmu._`;
  }

  // 4. TAMBAH JADWAL
  if (lowerMsg.startsWith('!tambah jadwal') || lowerMsg.startsWith('tambah jadwal')) {
    const payload = rawMessage.substring(rawMessage.indexOf('jadwal') + 6).trim();
    const parts = payload.split('|').map(s => s.trim());

    if (parts.length < 3) {
      return `⚠️ *FORMAT SALAH*, bre!\n\n` +
        `*Gunakan Format:* \`!tambah jadwal [Hari] | [Jam] | [Matkul] | [Lokasi]\`\n` +
        `*Contoh:* \`!tambah jadwal Senin | 08:00 - 10:30 | Pemrograman Web | Ruang 302\``;
    }

    const [day, time, subject, location] = parts;
    const newSchedule = await scheduleService.addSchedule(userPhone, day, time, subject, location || 'Online / TBD');

    return `✅ *JADWAL BERHASIL DITAMBAHKAN!*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `📚 *Matkul:* ${newSchedule.subject}\n` +
      `🕒 *Waktu:* ${newSchedule.day}, ${newSchedule.time}\n` +
      `📍 *Lokasi:* ${newSchedule.location}\n\n` +
      `_Ketik \`!list\` untuk melihat seluruh jadwalmu._`;
  }

  // 5. SELESAI TUGAS
  if (lowerMsg.startsWith('!selesai') || lowerMsg.startsWith('selesai')) {
    const idInput = rawMessage.replace(/^[!]?selesai/i, '').trim();

    if (!idInput) {
      return `⚠️ *FORMAT SALAH*, bre!\n\n` +
        `*Gunakan Format:* \`!selesai [ID_TUGAS]\`\n` +
        `*Contoh:* \`!selesai T01\``;
    }

    const updatedTask = await taskService.completeTask(userPhone, idInput);
    if (!updatedTask) {
      return `❌ *ID TUGAS TIDAK DITEMUKAN!*\nPastikan ID tugas benar (e.g., \`[T01]\`). Ketik \`!list\` untuk mengecek.`;
    }

    return `🎉 *TUGAS SELESAI!* ✅\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `~${updatedTask.title}~ *(Selesai)*\n\n` +
      `_Mantap bre, 1 beban selesai!_ 💪`;
  }

  // 6. HAPUS ITEM
  if (lowerMsg.startsWith('!hapus') || lowerMsg.startsWith('hapus')) {
    const idInput = rawMessage.replace(/^[!]?hapus/i, '').trim();

    if (!idInput) {
      return `⚠️ *FORMAT SALAH*, bre!\n\n` +
        `*Gunakan Format:* \`!hapus [ID]\`\n` +
        `*Contoh:* \`!hapus T01\` atau \`!hapus J01\``;
    }

    const cleanId = idInput.toUpperCase();
    let deleted = false;

    if (cleanId.includes('J') || cleanId.startsWith('J')) {
      deleted = await scheduleService.deleteSchedule(userPhone, cleanId);
    } else {
      // Try deleting task first, then schedule
      deleted = await taskService.deleteTask(userPhone, cleanId);
      if (!deleted) {
        deleted = await scheduleService.deleteSchedule(userPhone, cleanId);
      }
    }

    if (!deleted) {
      return `❌ *ID ITEM TIDAK DITEMUKAN!*\nPastikan ID item yang ingin dihapus benar (e.g. \`T01\` atau \`J01\`). Ketik \`!list\` untuk cek dashboard.`;
    }

    return `🗑️ *ITEM BERHASIL DIHAPUS!*\nItem \`${cleanId}\` telah dibersihkan dari database.`;
  }

  // Command not matched, return null unless explicitly triggered with exclamation mark !
  if (rawMessage.startsWith('!')) {
    return `❓ *PERINTAH TIDAK DIKENALI*\n\n${renderHelpText()}`;
  }

  return null;
}
