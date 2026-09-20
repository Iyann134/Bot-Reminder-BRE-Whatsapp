import { db } from '../config/db.js';
import { parseDeadline } from '../utils/dateParser.js';
import { scheduleService } from './scheduleService.js';

export const taskService = {
  async getUserTasks(userPhone) {
    const list = await db.getTasks(userPhone);
    return list.map((item, index) => ({
      ...item,
      displayId: `[T${String(index + 1).padStart(2, '0')}]`
    }));
  },

  async addTask(userPhone, title, deadlineText) {
    if (!title) {
      throw new Error('Judul tugas tidak boleh kosong!');
    }

    const { datetime, formattedText } = parseDeadline(deadlineText || 'Tidak ada deadline');

    const taskObj = {
      user_phone: userPhone,
      title: title.trim(),
      deadline_text: formattedText || (deadlineText ? deadlineText.trim() : 'Tidak ada deadline'),
      deadline_datetime: datetime ? datetime.toISOString() : null,
      status: 'pending'
    };

    return await db.addTask(taskObj);
  },

  async completeTask(userPhone, idInput) {
    const userTasks = await this.getUserTasks(userPhone);
    const cleanInput = String(idInput).trim().toUpperCase();

    const target = userTasks.find(t => 
      t.displayId === cleanInput || 
      t.displayId === `[${cleanInput}]` ||
      String(t.id) === cleanInput
    );

    if (!target) {
      return null;
    }

    return await db.updateTaskStatus(userPhone, target.id, 'completed');
  },

  async editTask(userPhone, idInput, newTitle, newDeadlineText) {
    const userTasks = await this.getUserTasks(userPhone);
    const cleanInput = String(idInput).trim().toUpperCase();

    const target = userTasks.find(t => 
      t.displayId === cleanInput || 
      t.displayId === `[${cleanInput}]` ||
      String(t.id) === cleanInput
    );

    if (!target) {
      return null;
    }

    const updateFields = {};
    if (newTitle && newTitle.trim()) {
      updateFields.title = newTitle.trim();
    }
    if (newDeadlineText && newDeadlineText.trim()) {
      const { datetime, formattedText } = parseDeadline(newDeadlineText);
      updateFields.deadline_text = formattedText || newDeadlineText.trim();
      updateFields.deadline_datetime = datetime ? datetime.toISOString() : null;
    }

    if (Object.keys(updateFields).length === 0) {
      return target;
    }

    return await db.updateTaskDetails(userPhone, target.id, updateFields);
  },

  async deleteTask(userPhone, idInput) {
    const userTasks = await this.getUserTasks(userPhone);
    const cleanInput = String(idInput).trim().toUpperCase();

    const target = userTasks.find(t => 
      t.displayId === cleanInput || 
      t.displayId === `[${cleanInput}]` ||
      String(t.id) === cleanInput
    );

    if (!target) {
      return false;
    }

    return await db.deleteTask(userPhone, target.id);
  },

  /**
   * Render complete scannable categorized dashboard output for WhatsApp
   */
  async renderDashboard(userPhone) {
    const schedules = await scheduleService.getUserSchedules(userPhone);
    const tasks = await this.getUserTasks(userPhone);

    let msg = `🔥 *BRE OPERATIONS DASHBOARD*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // 1. CLASS SCHEDULES SECTION
    msg += `📌 *JADWAL KULIAH*\n`;
    if (schedules.length === 0) {
      msg += `_(Belum ada jadwal terdaftar. Ketik \`!tambah jadwal\` untuk menambahkan.)_\n`;
    } else {
      schedules.forEach(s => {
        msg += `• *${s.displayId}* *${s.subject}*\n`;
        msg += `  🕒 ${s.day}, ${s.time}\n`;
        msg += `  📍 ${s.location}\n`;
      });
    }

    msg += `\n━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // 2. TO-DO LIST & TASKS SECTION
    msg += `⏳ *DAFTAR TUGAS*\n`;
    if (tasks.length === 0) {
      msg += `_(Belum ada tugas terdaftar. Ketik \`!tambah tugas\` untuk menambahkan.)_\n`;
    } else {
      const pendingTasks = tasks.filter(t => t.status === 'pending');
      const completedTasks = tasks.filter(t => t.status === 'completed');

      if (pendingTasks.length > 0) {
        msg += `*Tugas Aktif (Pending):*\n`;
        pendingTasks.forEach(t => {
          msg += `• *${t.displayId}* ${t.title}\n`;
          msg += `  ⏰ Deadline: ${t.deadline_text}\n`;
        });
      }

      if (completedTasks.length > 0) {
        if (pendingTasks.length > 0) msg += `\n`;
        msg += `*Tugas Selesai:* \n`;
        completedTasks.forEach(t => {
          msg += `• *${t.displayId}* ~${t.title}~ *(Selesai)* ✅\n`;
        });
      }
    }

    msg += `\n━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `💡 _Ketik \`!help\` untuk melihat daftar perintah._`;

    return msg;
  }
};
