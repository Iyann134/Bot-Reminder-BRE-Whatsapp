import cron from 'node-cron';
import { db } from '../config/db.js';

// Cache for sent reminders to avoid duplicate alerts (persisted in memory)
const sentReminders = new Set();

const daysIndoMap = {
  0: 'minggu',
  1: 'senin',
  2: 'selasa',
  3: 'rabu',
  4: 'kamis',
  5: 'jumat',
  6: 'sabtu'
};

/**
 * Initialize background cron runner to check schedules and task deadlines
 * @param {import('@whiskeysockets/baileys').WASocket} sock 
 */
export function startReminderScheduler(sock) {
  console.log('⏰ Proactive Reminder Scheduler initialized (Checking every 1 minute).');

  // Cron runs every minute
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];

      // --- 1. Check Class Schedule Reminders ---
      const allSchedules = await db.getAllSchedules();
      const currentDayName = daysIndoMap[now.getDay()];

      for (const item of allSchedules) {
        if (!item.user_phone || !item.day || !item.time) continue;

        const scheduleDay = item.day.trim().toLowerCase();
        if (scheduleDay !== currentDayName) continue;

        // Parse start time (e.g., "08:00 - 10:00" -> 08:00)
        const timeMatch = item.time.match(/(\d{1,2}):(\d{2})/);
        if (!timeMatch) continue;

        const classHours = parseInt(timeMatch[1], 10);
        const classMins = parseInt(timeMatch[2], 10);

        const classTime = new Date(now);
        classTime.setHours(classHours, classMins, 0, 0);

        const diffMs = classTime.getTime() - now.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));

        // Milestone A: 30 minutes before class (25-30 mins)
        if (diffMins >= 25 && diffMins <= 30) {
          const reminderKey = `sched_30m_${item.id}_${todayStr}`;
          if (!sentReminders.has(reminderKey)) {
            sentReminders.add(reminderKey);

            const msg = `🚨 *PENGINGAT JADWAL KULIAH* 🚨\n` +
              `━━━━━━━━━━━━━━━━━━━━━\n` +
              `📚 *${item.subject}*\n` +
              `⏰ *Waktu:* ${item.time} (30 Menit Lagi!)\n` +
              `📍 *Lokasi:* ${item.location}\n\n` +
              `_Persiapkan dirimu sekarang, bre!_ 🚀`;

            await sendWhatsAppNotification(sock, item.user_phone, msg);
          }
        }

        // Milestone B: 10 minutes before class (5-10 mins)
        if (diffMins >= 5 && diffMins <= 10) {
          const reminderKey = `sched_10m_${item.id}_${todayStr}`;
          if (!sentReminders.has(reminderKey)) {
            sentReminders.add(reminderKey);

            const msg = `🔔 *PENGINGAT: KULIAH BENTAR LAGI!* 🔔\n` +
              `━━━━━━━━━━━━━━━━━━━━━\n` +
              `📚 *${item.subject}*\n` +
              `⏰ *Waktu:* ${item.time} (~10 Menit Lagi!)\n` +
              `📍 *Lokasi:* ${item.location}\n\n` +
              `_Segera menuju kelas / siapkan device!_ 🏃💨`;

            await sendWhatsAppNotification(sock, item.user_phone, msg);
          }
        }
      }

      // --- 2. Check Task Deadline Reminders (Multi-tier milestones) ---
      const pendingTasks = await db.getAllPendingTasks();

      for (const task of pendingTasks) {
        if (!task.user_phone || !task.deadline_datetime) continue;

        const deadline = new Date(task.deadline_datetime);
        if (isNaN(deadline.getTime())) continue;

        const diffMs = deadline.getTime() - now.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = diffMs / (1000 * 60 * 60);

        // Milestone 1: H-1 Hari / 24 Jam (23 - 25 jam)
        if (diffHours >= 23 && diffHours <= 25) {
          const key = `task_${task.id}_24h`;
          if (!sentReminders.has(key)) {
            sentReminders.add(key);
            const msg = `📅 *PENGINGAT DEADLINE TUGAS (H-1)* 📅\n` +
              `━━━━━━━━━━━━━━━━━━━━━\n` +
              `📌 *${task.title}*\n` +
              `⏳ *Deadline:* ${task.deadline_text} (Besok / ~24 Jam lagi)\n\n` +
              `_Luangkan waktu untuk mencicilnya hari ini, bre!_ 💪`;
            await sendWhatsAppNotification(sock, task.user_phone, msg);
          }
        }

        // Milestone 2: H-3 Jam (2.5 - 3.5 jam)
        if (diffHours >= 2.5 && diffHours <= 3.5) {
          const key = `task_${task.id}_3h`;
          if (!sentReminders.has(key)) {
            sentReminders.add(key);
            const msg = `⏰ *PENGINGAT DEADLINE TUGAS (3 Jam Lagi)* ⏰\n` +
              `━━━━━━━━━━━━━━━━━━━━━\n` +
              `📌 *${task.title}*\n` +
              `⏳ *Deadline:* ${task.deadline_text}\n\n` +
              `_Fokus tuntaskan tugasmu sekarang, bre!_ 🚀`;
            await sendWhatsAppNotification(sock, task.user_phone, msg);
          }
        }

        // Milestone 3: H-1 Jam (45 - 65 menit)
        if (diffMins >= 45 && diffMins <= 65) {
          const key = `task_${task.id}_1h`;
          if (!sentReminders.has(key)) {
            sentReminders.add(key);
            const msg = `🔥 *PENGINGAT CRITICAL (1 Jam Lagi)* 🔥\n` +
              `━━━━━━━━━━━━━━━━━━━━━\n` +
              `📌 *${task.title}*\n` +
              `⏳ *Deadline:* ${task.deadline_text}\n\n` +
              `_Tinggal 1 jam lagi! Segera selesaikan dan submit!_ ⚡`;
            await sendWhatsAppNotification(sock, task.user_phone, msg);
          }
        }

        // Milestone 4: H-15 Menit / Near Deadline (1 - 15 menit)
        if (diffMins >= 1 && diffMins <= 15) {
          const key = `task_${task.id}_15m`;
          if (!sentReminders.has(key)) {
            sentReminders.add(key);
            const msg = `🚨 *WARNING: DEADLINE HAMPIR HABIS!* 🚨\n` +
              `━━━━━━━━━━━━━━━━━━━━━\n` +
              `📌 *${task.title}*\n` +
              `⏳ *Deadline:* ${task.deadline_text} (~${diffMins} Menit Lagi!)\n\n` +
              `_Ayo kirim/selesaikan sekarang juga, bre!_ 😱`;
            await sendWhatsAppNotification(sock, task.user_phone, msg);
          }
        }

        // Milestone 5: Saat Deadline Tiba / Overdue Baru (0 - -5 menit)
        if (diffMins <= 0 && diffMins >= -5) {
          const key = `task_${task.id}_due`;
          if (!sentReminders.has(key)) {
            sentReminders.add(key);
            const msg = `⚠️ *DEADLINE TUGAS TIBA!* ⚠️\n` +
              `━━━━━━━━━━━━━━━━━━━━━\n` +
              `📌 *${task.title}*\n` +
              `⏳ *Waktu Deadline:* ${task.deadline_text}\n\n` +
              `_Jika sudah dikerjakan, ketik \`!selesai\` untuk menyelesaikannya._`;
            await sendWhatsAppNotification(sock, task.user_phone, msg);
          }
        }
      }

    } catch (err) {
      console.error('❌ Error running reminder scheduler:', err);
    }
  });
}

async function sendWhatsAppNotification(sock, userPhone, text) {
  try {
    if (!sock) {
      console.error('❌ WhatsApp socket is not ready.');
      return;
    }

    let jid = userPhone;
    if (!jid.includes('@')) {
      jid = `${userPhone.replace(/\D/g, '')}@s.whatsapp.net`;
    }

    await sock.sendMessage(jid, { text });
    console.log(`✅ [REMINDER SENT] Automatic notification sent to ${jid}`);
  } catch (err) {
    console.error(`❌ Failed to send automated reminder to ${userPhone}:`, err.message || err);
  }
}
