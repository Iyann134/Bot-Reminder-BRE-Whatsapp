import * as chrono from 'chrono-node';

/**
 * Smart natural language date parser supporting Indonesian and English
 * @param {string} text 
 * @param {Date} referenceDate 
 * @returns {{ datetime: Date | null, formattedText: string }}
 */
export function parseDeadline(text, referenceDate = new Date()) {
  if (!text || typeof text !== 'string') {
    return { datetime: null, formattedText: text || 'N/A' };
  }

  const rawInput = text.trim();
  const lowerInput = rawInput.toLowerCase();

  let targetDate = new Date(referenceDate);

  // 0. Check relative time phrases (e.g. "10 menit lagi", "2 jam lagi", "3 hari lagi")
  const relativeMatch = lowerInput.match(/(\d+)\s*(menit|jam|hari)\s*(lagi)?/i);
  if (relativeMatch) {
    const amount = parseInt(relativeMatch[1], 10);
    const unit = relativeMatch[2].toLowerCase();

    if (unit === 'menit') {
      targetDate.setMinutes(targetDate.getMinutes() + amount);
    } else if (unit === 'jam') {
      targetDate.setHours(targetDate.getHours() + amount);
    } else if (unit === 'hari') {
      targetDate.setDate(targetDate.getDate() + amount);
    }

    return {
      datetime: targetDate,
      formattedText: formatIndoDate(targetDate)
    };
  }

  // 1. Check custom Indonesian natural keywords
  let handled = false;

  // Time extraction helper
  const timeRegex = /(?:jam|pukul)?\s*(\d{1,2})(?::(\d{2}))?\s*(pagi|siang|sore|malam)?/i;

  // Day modifiers
  if (lowerInput.includes('hari ini')) {
    handled = true;
    // targetDate remains today
  } else if (lowerInput.includes('besok')) {
    handled = true;
    targetDate.setDate(targetDate.getDate() + 1);
  } else if (lowerInput.includes('lusa')) {
    handled = true;
    targetDate.setDate(targetDate.getDate() + 2);
  } else {
    // Days of week in Indonesian
    const daysIndo = {
      'minggu': 0, 'senin': 1, 'selasa': 2, 'rabu': 3,
      'kamis': 4, 'jumat': 5, 'sabtu': 6
    };
    for (const [dayName, dayNum] of Object.entries(daysIndo)) {
      if (lowerInput.includes(dayName)) {
        handled = true;
        const currentDay = targetDate.getDay();
        let distance = dayNum - currentDay;
        if (distance <= 0) distance += 7;
        targetDate.setDate(targetDate.getDate() + distance);
        break;
      }
    }
  }

  if (handled) {
    // Parse time portion (e.g. "jam 8 malam", "14:00", "pukul 9 pagi")
    const match = lowerInput.match(timeRegex);
    let hours = 23;
    let minutes = 59;

    if (match) {
      let parsedHour = parseInt(match[1], 10);
      let parsedMin = match[2] ? parseInt(match[2], 10) : 0;
      const period = match[3]?.toLowerCase();

      if (period) {
        if (period === 'malam') {
          // FIX: "jam 12 malam" = tengah malam = 00:00
          if (parsedHour === 12) {
            parsedHour = 0;
          } else if (parsedHour < 12) {
            parsedHour += 12;
          }
        } else if (period === 'sore') {
          // "jam 12 sore" = 12:00 (sudah benar), yang < 12 ditambah 12
          if (parsedHour < 12) {
            parsedHour += 12;
          }
        } else if (period === 'siang') {
          // "jam 12 siang" = 12:00 (benar), yang < 11 ditambah 12
          if (parsedHour < 11) {
            parsedHour += 12;
          }
        } else if (period === 'pagi') {
          // "jam 12 pagi" = tengah malam / 00:00
          if (parsedHour === 12) {
            parsedHour = 0;
          }
        }
      } else if (parsedHour < 7 && lowerInput.includes('malam')) {
        parsedHour += 12;
      }

      hours = parsedHour;
      minutes = parsedMin;
    }

    targetDate.setHours(hours, minutes, 0, 0);
    return {
      datetime: targetDate,
      formattedText: formatIndoDate(targetDate)
    };
  }

  // 2. Fallback to chrono-node
  const chronoParsed = chrono.parseDate(rawInput, referenceDate);
  if (chronoParsed) {
    return {
      datetime: chronoParsed,
      formattedText: formatIndoDate(chronoParsed)
    };
  }

  // 3. Fallback to direct JS Date parse
  const directDate = new Date(rawInput);
  if (!isNaN(directDate.getTime())) {
    return {
      datetime: directDate,
      formattedText: formatIndoDate(directDate)
    };
  }

  // Fallback if unable to parse exact date
  return {
    datetime: null,
    formattedText: rawInput
  };
}

/**
 * Format a Date object into a readable Indonesian string
 * e.g. "Senin, 25 Sep 2026 - 20:00 WIB"
 */
export function formatIndoDate(date) {
  if (!date || isNaN(date.getTime())) return 'N/A';

  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  const dayName = days[date.getDay()];
  const dayNum = String(date.getDate()).padStart(2, '0');
  const monthName = months[date.getMonth()];
  const year = date.getFullYear();

  const hours = String(date.getHours()).padStart(2, '0');
  const mins = String(date.getMinutes()).padStart(2, '0');

  return `${dayName}, ${dayNum} ${monthName} ${year} (${hours}:${mins} WIB)`;
}
