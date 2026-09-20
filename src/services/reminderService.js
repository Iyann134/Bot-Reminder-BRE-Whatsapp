import cron from 'node-cron';
import { db } from '../config/db.js';

// Cache for sent reminders to avoid duplicate alerts
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
  console.log('⏰ Proactive Reminder Scheduler started (Running every 1 minute).');

  // Cron runs every minute
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();

      // --- 1. Check Class Schedule Reminders (30 minutes before class) ---
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

        // Difference in minutes
        const diffMs = classTime.getTime() - now.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));

        // Trigger if class starts in 29-31 minutes
        if (diffMins >= 28 && diffMins <= 31) {
          const reminderKey = `schedule_${item.id}_${now.toDateString()}`;
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
      }

      // --- 2. Check Task Deadline Reminders (3 hours before deadline) ---
      const pendingTasks = await db.getAllPendingTasks();

      for (const task of pendingTasks) {
        if (!task.user_phone || !task.deadline_datetime) continue;

        const deadline = new Date(task.deadline_datetime);
        if (isNaN(deadline.getTime())) continue;

        const diffMs = deadline.getTime() - now.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        // Trigger if deadline is between 2.8 and 3.1 hours away
        if (diffHours >= 2.8 && diffHours <= 3.1) {
          const reminderKey = `task_${task.id}`;
          if (!sentReminders.has(reminderKey)) {
            sentReminders.add(reminderKey);

            const msg = `⏰ *PENGINGAT DEADLINE TUGAS* ⏰\n` +
              `━━━━━━━━━━━━━━━━━━━━━\n` +
              `📌 *${task.title}*\n` +
              `⏳ *Deadline:* ${task.deadline_text} (3 Jam Lagi!)\n\n` +
              `_Segera selesaikan sebelum terlambat!_ 💪`;

            await sendWhatsAppNotification(sock, task.user_phone, msg);
          }
        }
      }

    } catch (err) {
      console.error('Error running reminder scheduler:', err);
    }
  });
}

async function sendWhatsAppNotification(sock, userPhone, text) {
  try {
    let jid = userPhone;
    if (!jid.includes('@')) {
      jid = `${userPhone.replace(/\D/g, '')}@s.whatsapp.net`;
    }
    await sock.sendMessage(jid, { text });
    console.log(`✅ Sent automated reminder to ${jid}`);
  } catch (err) {
    console.error(`Failed to send reminder to ${userPhone}:`, err);
  }
}
