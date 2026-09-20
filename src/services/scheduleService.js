import { db } from '../config/db.js';

export const scheduleService = {
  async getUserSchedules(userPhone) {
    const list = await db.getSchedules(userPhone);
    return list.map((item, index) => ({
      ...item,
      displayId: `[J${String(index + 1).padStart(2, '0')}]`
    }));
  },

  async addSchedule(userPhone, day, time, subject, location = 'Online / TBD') {
    if (!day || !time || !subject) {
      throw new Error('Parameter jadwal tidak lengkap!');
    }
    const scheduleObj = {
      user_phone: userPhone,
      day: day.trim(),
      time: time.trim(),
      subject: subject.trim(),
      location: location ? location.trim() : 'Online / TBD'
    };
    return await db.addSchedule(scheduleObj);
  },

  async deleteSchedule(userPhone, idInput) {
    const userSchedules = await this.getUserSchedules(userPhone);
    const cleanInput = String(idInput).trim().toUpperCase();

    // Match display ID like [J01] or J01 or raw numeric database ID
    let target = userSchedules.find(s => 
      s.displayId === cleanInput || 
      s.displayId === `[${cleanInput}]` ||
      String(s.id) === cleanInput
    );

    if (!target) {
      return false;
    }

    return await db.deleteSchedule(userPhone, target.id);
  },

  async editSchedule(userPhone, idInput, day, time, subject, location) {
    const userSchedules = await this.getUserSchedules(userPhone);
    const cleanInput = String(idInput).trim().toUpperCase();

    let target = userSchedules.find(s => 
      s.displayId === cleanInput || 
      s.displayId === `[${cleanInput}]` ||
      String(s.id) === cleanInput
    );

    if (!target) {
      return null;
    }

    const updateFields = {};
    if (day && day.trim()) updateFields.day = day.trim();
    if (time && time.trim()) updateFields.time = time.trim();
    if (subject && subject.trim()) updateFields.subject = subject.trim();
    if (location && location.trim()) updateFields.location = location.trim();

    if (Object.keys(updateFields).length === 0) return target;

    return await db.updateScheduleDetails(userPhone, target.id, updateFields);
  }
};
