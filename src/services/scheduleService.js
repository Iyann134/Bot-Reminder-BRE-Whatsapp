import { db } from '../config/db.js';

// ─── Validation Constants ────────────────────────────────────
const MAX_SUBJECT_LENGTH = 100;
const MAX_LOCATION_LENGTH = 100;
const MAX_TIME_LENGTH = 50;

// Valid Indonesian day names (lowercase)
const VALID_DAYS = new Set(['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu']);

/**
 * Capitalize the first letter of a string (e.g. "senin" → "Senin")
 */
function capitalizeFirst(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

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

    const trimmedDay = day.trim();
    const trimmedTime = time.trim();
    const trimmedSubject = subject.trim();
    const trimmedLocation = (location || 'Online / TBD').trim();

    // Bug 4 & Opt-2: Validate day name is a valid Indonesian day
    if (!VALID_DAYS.has(trimmedDay.toLowerCase())) {
      throw new Error(
        `Nama hari tidak valid: "${trimmedDay}". Gunakan: Senin, Selasa, Rabu, Kamis, Jumat, Sabtu, atau Minggu.`
      );
    }

    // Length validations
    if (trimmedSubject.length > MAX_SUBJECT_LENGTH) {
      throw new Error(`Nama mata kuliah terlalu panjang! Maksimal ${MAX_SUBJECT_LENGTH} karakter.`);
    }
    if (trimmedLocation.length > MAX_LOCATION_LENGTH) {
      throw new Error(`Nama lokasi terlalu panjang! Maksimal ${MAX_LOCATION_LENGTH} karakter.`);
    }
    if (trimmedTime.length > MAX_TIME_LENGTH) {
      throw new Error(`Format waktu terlalu panjang! Maksimal ${MAX_TIME_LENGTH} karakter.`);
    }

    const scheduleObj = {
      user_phone: userPhone,
      day: capitalizeFirst(trimmedDay),   // Opt-2: auto-capitalize "senin" → "Senin"
      time: trimmedTime,
      subject: trimmedSubject,
      location: trimmedLocation
    };
    return await db.addSchedule(scheduleObj);
  },

  async deleteSchedule(userPhone, idInput) {
    const userSchedules = await this.getUserSchedules(userPhone);
    const cleanInput = String(idInput).trim().toUpperCase();

    // Match display ID like [J01] or J01 or raw numeric database ID
    const target = userSchedules.find(s =>
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

    const target = userSchedules.find(s =>
      s.displayId === cleanInput ||
      s.displayId === `[${cleanInput}]` ||
      String(s.id) === cleanInput
    );

    if (!target) {
      return null;
    }

    const updateFields = {};

    if (day && day.trim()) {
      const trimmedDay = day.trim();
      // Opt-2: Validate and auto-capitalize day name
      if (!VALID_DAYS.has(trimmedDay.toLowerCase())) {
        throw new Error(
          `Nama hari tidak valid: "${trimmedDay}". Gunakan: Senin, Selasa, Rabu, Kamis, Jumat, Sabtu, atau Minggu.`
        );
      }
      updateFields.day = capitalizeFirst(trimmedDay);
    }
    if (time && time.trim()) {
      if (time.trim().length > MAX_TIME_LENGTH) {
        throw new Error(`Format waktu terlalu panjang! Maksimal ${MAX_TIME_LENGTH} karakter.`);
      }
      updateFields.time = time.trim();
    }
    if (subject && subject.trim()) {
      if (subject.trim().length > MAX_SUBJECT_LENGTH) {
        throw new Error(`Nama mata kuliah terlalu panjang! Maksimal ${MAX_SUBJECT_LENGTH} karakter.`);
      }
      updateFields.subject = subject.trim();
    }
    if (location && location.trim()) {
      if (location.trim().length > MAX_LOCATION_LENGTH) {
        throw new Error(`Nama lokasi terlalu panjang! Maksimal ${MAX_LOCATION_LENGTH} karakter.`);
      }
      updateFields.location = location.trim();
    }

    if (Object.keys(updateFields).length === 0) return target;

    return await db.updateScheduleDetails(userPhone, target.id, updateFields);
  }
};
