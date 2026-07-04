import { supabase } from '../supabaseClient';
import { SEASONS_CONFIG } from '../constants';

const DATE_ROW_SCORE_MIN = 8;

function addDaysLocal(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function toIsoDate(date) {
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return local.toISOString().split('T')[0];
}

function cellText(cell) {
  if (!cell) return '';
  const value = cell.f ?? cell.v;
  return value === null || value === undefined ? '' : value.toString().trim();
}

function encodeCell(rowIndex, colIndex) {
  let col = '';
  let current = colIndex + 1;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    col = String.fromCharCode(65 + remainder) + col;
    current = Math.floor((current - 1) / 26);
  }
  return `${col}${rowIndex + 1}`;
}

function sheetCellText(worksheet, rowIndex, colIndex) {
  const cell = worksheet[encodeCell(rowIndex, colIndex)];
  return cellText(cell);
}

function parseDayNumber(cell) {
  const value = cellText(cell);
  if (!/^\d{1,2}$/.test(value)) return null;
  const day = Number(value);
  return day >= 1 && day <= 31 ? day : null;
}

function isRoomCode(value) {
  return /^\d{3,4}G?$|^A\d+$/i.test(value);
}

function findWorksheetDateRowIndex(worksheet, range) {
  let best = { index: range.s.r, score: 0 };

  for (let row = range.s.r; row <= Math.min(range.e.r, range.s.r + 8); row++) {
    let score = 0;
    for (let col = 1; col <= range.e.c; col++) {
      if (parseDayNumber({ v: sheetCellText(worksheet, row, col) })) score += 1;
    }
    if (score > best.score) best = { index: row, score };
  }

  return best.score >= DATE_ROW_SCORE_MIN ? best.index : range.s.r;
}

function buildDateMapFromWorksheet(worksheet, dateRowIndex, range, seasonStart) {
  const dateMap = [];
  let cursor = new Date(seasonStart);

  for (let col = 1; col <= range.e.c; col++) {
    const dayNum = parseDayNumber({ v: sheetCellText(worksheet, dateRowIndex, col) });
    if (!dayNum) continue;

    let guard = 0;
    while (cursor.getDate() !== dayNum && guard < 370) {
      cursor = addDaysLocal(cursor, 1);
      guard += 1;
    }

    if (guard < 370) {
      dateMap[col] = new Date(cursor);
      cursor = addDaysLocal(cursor, 1);
    }
  }

  return dateMap;
}

function sameGuestPrefix(activeName, nextName) {
  const normalize = (value) => value.toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  const active = normalize(activeName);
  const next = normalize(nextName);
  return active && next && (active.startsWith(next) || next.startsWith(active));
}

function shouldSkipValue(value) {
  const text = value.trim().toUpperCase();
  return !text || text === '/' || text === 'C' || text === 'NC' || text === 'RDC';
}

function splitTransitionValue(activeBooking, value) {
  if (!activeBooking || !value.includes(' / ')) return null;

  const parts = value.split(' / ').map(p => p.trim()).filter(Boolean);
  const nameLeft = parts[0];
  const nameRight = parts.slice(1).join(' / ');

  if (nameLeft && nameRight && sameGuestPrefix(activeBooking.raw, nameLeft)) {
    return nameRight;
  }

  return null;
}

/**
 * Cleans up guest name and extracts persons/notes.
 */
function finalizeBooking(b, room, season) {
  let name = b.guestName.toString();
  let persons = null;
  let notes = [];
  let checkIn = new Date(b.checkIn);
  let checkOut = new Date(b.checkOut);

  const arrivalMatch = name.match(/>(\d{1,2})\/(\d{1,2})(\/(\d{2,4}))?/);
  if (arrivalMatch) {
    const d = parseInt(arrivalMatch[1]);
    const m = parseInt(arrivalMatch[2]);
    const yStr = arrivalMatch[4];
    const year = yStr ? (yStr.length === 2 ? 2000 + parseInt(yStr) : parseInt(yStr)) : checkIn.getFullYear();
    const parsedArrival = new Date(year, m - 1, d);
    if (!isNaN(parsedArrival.getTime())) checkIn = parsedArrival;
    name = name.replace(arrivalMatch[0], '').trim();
  }

  const departureMatch = name.match(/(\d{1,2})\/(\d{1,2})(\/(\d{2,4}))?</);
  if (departureMatch) {
    const d = parseInt(departureMatch[1]);
    const m = parseInt(departureMatch[2]);
    const yStr = departureMatch[4];
    const year = yStr ? (yStr.length === 2 ? 2000 + parseInt(yStr) : parseInt(yStr)) : checkOut.getFullYear();
    const parsedDeparture = new Date(year, m - 1, d);
    if (!isNaN(parsedDeparture.getTime())) checkOut = parsedDeparture;
    name = name.replace(departureMatch[0], '').trim();
  }

  const personMatch = name.match(/(\d+\s?\+\s?(?:\d+|bb)|\d+\s?\+\s?\d+|\d+)\s?(P|personnes|pers|pax)?$/i);
  if (personMatch) {
    persons = personMatch[1].replace(/\s/g, '');
    name = name.replace(personMatch[0], '').trim();
  }

  const emailMatch = name.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
  if (emailMatch) {
    notes.push(...emailMatch);
    emailMatch.forEach(e => name = name.replace(e, ''));
  }

  const phoneMatch = name.match(/(\+?\d{1,3}[\s.-]?)?(\d{2,4}[\s.-]?){2,4}\d{2,4}/g);
  if (phoneMatch) {
    const validPhones = phoneMatch.filter(p => p.replace(/\D/g, '').length >= 8);
    notes.push(...validPhones);
    validPhones.forEach(p => name = name.replace(p, ''));
  }

  name = name.replace(/sp le\s?\d{1,2}\/\d{1,2}(\/\d{2,4})?/gi, (match) => {
    notes.push(match);
    return '';
  });

  name = name.replace(/[<>]\d{3,4}/g, (match) => {
      notes.push("Ref: " + match);
      return '';
  });

  name = name
    .replace(/\b(TEL|PHONE|WHATSAPP)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[,;/-]+$/, '')
    .replace(/^[,;/-]+/, '')
    .trim();
  const upperName = name.toUpperCase();
  if (!name || name === "/" || upperName === "C" || upperName === "NC" || upperName === "RDC") name = "CLIENT";

  if (checkOut <= checkIn) {
    checkOut = addDaysLocal(checkIn, 1);
  }

  return {
    room_number: room,
    guest_name: name.toUpperCase(),
    check_in: toIsoDate(checkIn),
    check_out: toIsoDate(checkOut),
    persons: persons,
    notes: notes.join(', ') || null,
    season: season
  };
}

/**
 * Extracts bookings from an Excel file (ArrayBuffer)
 */
async function extractBookingsFromBuffer(buffer, seasonId) {
  const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs');
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const range = XLSX.utils.decode_range(worksheet['!ref']);

  const season = SEASONS_CONFIG.find(s => s.id === seasonId);
  if (!season) throw new Error("Saison non configurée: " + seasonId);

  const dateRowIndex = findWorksheetDateRowIndex(worksheet, range);
  const dateMap = buildDateMapFromWorksheet(worksheet, dateRowIndex, range, season.start);
  const lastMappedDate = [...dateMap].reverse().find(Boolean);

  const bookings = [];

  for (let row = dateRowIndex + 1; row <= range.e.r; row++) {
    const roomNumber = sheetCellText(worksheet, row, 0).toUpperCase();
    if (!isRoomCode(roomNumber)) continue;

    let activeBooking = null;

    for (let col = 1; col <= range.e.c; col++) {
      const currentDate = dateMap[col];
      if (!currentDate) continue;

      const value = sheetCellText(worksheet, row, col);
      if (!value || shouldSkipValue(value)) continue;

      const transitionGuest = splitTransitionValue(activeBooking, value);
      if (transitionGuest) {
        activeBooking.checkOut = currentDate;
        bookings.push(finalizeBooking(activeBooking, roomNumber, seasonId));
        activeBooking = {
          guestName: transitionGuest,
          raw: transitionGuest,
          checkIn: currentDate,
          checkOut: null
        };
        continue;
      }

      if (activeBooking && value !== activeBooking.raw) {
        activeBooking.checkOut = currentDate;
        bookings.push(finalizeBooking(activeBooking, roomNumber, seasonId));
        activeBooking = null;
      }

      if (!activeBooking) {
        activeBooking = {
          guestName: value,
          raw: value,
          checkIn: currentDate,
          checkOut: null
        };
      }
    }

    if (activeBooking && lastMappedDate) {
      activeBooking.checkOut = addDaysLocal(lastMappedDate, 1);
      bookings.push(finalizeBooking(activeBooking, roomNumber, seasonId));
    }
  }

  return bookings;
}

let isSyncInProgress = false;

/**
 * Main sync function for Excel upload.
 */
export async function syncBookingsFromExcel(file, seasonId) {
  if (isSyncInProgress) {
    console.log("[Sync] Sync already in progress, skipping.");
    return { added: 0, updated: 0, deleted: 0 };
  }

  isSyncInProgress = true;
  try {
    const buffer = await file.arrayBuffer();
    const newData = await extractBookingsFromBuffer(buffer, seasonId);

    if (newData.length === 0) {
      throw new Error("Aucune réservation trouvée dans le fichier.");
    }

    // Get existing bookings for this season to identify deletions
    const { data: existingData, error: fetchError } = await supabase
      .from('bookings')
      .select('id, room_number, guest_name, check_in, check_out')
      .eq('season', seasonId);

    if (fetchError) throw fetchError;

    // Deduplicate new data
    const uniqueMap = new Map();
    for (const b of newData) {
      const key = `${b.room_number}|${b.guest_name}|${b.check_in}|${b.check_out}`;
      uniqueMap.set(key, b);
    }
    const uniqueList = Array.from(uniqueMap.values());

    // Upsert
    const { error: upsertError } = await supabase
      .from('bookings')
      .upsert(uniqueList, { onConflict: 'room_number, guest_name, check_in, check_out' });

    if (upsertError) throw upsertError;

    // Identify and delete records no longer in the file
    const newKeys = new Set(uniqueList.map(b => `${b.room_number}|${b.guest_name}|${b.check_in}|${b.check_out}`));
    const toDelete = existingData
      .filter(b => !newKeys.has(`${b.room_number}|${b.guest_name}|${b.check_in}|${b.check_out}`))
      .map(b => b.id);

    if (toDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('bookings')
        .delete()
        .in('id', toDelete);
      if (deleteError) console.error("[Sync] Error deleting obsolete records:", deleteError);
    }

    const stats = {
      added: uniqueList.length,
      deleted: toDelete.length
    };

    localStorage.setItem('last_booking_sync', new Date().toISOString());
    return stats;
  } catch (error) {
    console.error("[Sync] Critical error during sync:", error);
    throw error;
  } finally {
    isSyncInProgress = false;
  }
}
