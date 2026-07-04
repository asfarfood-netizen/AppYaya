import { supabase } from '../supabaseClient';
import { SEASONS_CONFIG } from '../constants';

const DATE_ROW_SCORE_MIN = 5;

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
  const match = value.match(/^(\d{1,2})/);
  if (!match) return null;
  const day = Number(match[1]);
  return day >= 1 && day <= 31 ? day : null;
}

function isRoomCode(value) {
  return /^\d{3,4}G?$|^A\d+$/i.test(value.trim());
}

function findWorksheetDateRowIndex(worksheet, range) {
  let best = { index: range.s.r, score: 0 };
  // Scan up to 25 rows for headers
  for (let row = range.s.r; row <= Math.min(range.e.r, range.s.r + 25); row++) {
    let score = 0;
    // Scan up to 100 columns for dates
    for (let col = range.s.c; col <= Math.min(range.e.c, range.s.c + 100); col++) {
      if (parseDayNumber({ v: sheetCellText(worksheet, row, col) })) score += 1;
    }
    if (score > best.score) {
      best = { index: row, score };
    }
  }
  return best.index;
}

function buildDateMapFromWorksheet(worksheet, dateRowIndex, range, seasonStart) {
  const dateMap = [];
  let cursor = new Date(seasonStart);

  for (let col = range.s.c + 1; col <= range.e.c; col++) {
    const dayNum = parseDayNumber({ v: sheetCellText(worksheet, dateRowIndex, col) });
    if (!dayNum) continue;

    let guard = 0;
    while (cursor.getDate() !== dayNum && guard < 45) { // Look ahead slightly more
      cursor = addDaysLocal(cursor, 1);
      guard += 1;
    }

    if (guard < 45) {
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
  // Filter out noise
  const noise = ['/', 'C', 'NC', 'RDC', 'X', '-', 'PAYÉ', 'PAYE', 'OFFERT', 'GRATUIT', 'BLOQUÉ', 'BLOQUE', 'RESERVÉ', 'RESERVE'];
  return !text || noise.includes(text) || text.length < 2;
}

function splitTransitionValue(activeBooking, value) {
  if (!activeBooking || (!value.includes(' / ') && !value.includes(' /'))) return null;
  const parts = value.split(/\s*\/\s*/).map(p => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const nameLeft = parts[0];
  const nameRight = parts.slice(1).join(' / ');
  if (nameLeft && nameRight && sameGuestPrefix(activeBooking.raw, nameLeft)) {
    return nameRight;
  }
  return null;
}

function finalizeBooking(b, room, season) {
  let name = b.guestName.toString();
  let persons = null;
  let notes = [];
  let checkIn = new Date(b.checkIn);
  let checkOut = new Date(b.checkOut);

  // Arrival/Departure markers extraction
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

  // Final cleanup of noise
  name = name
    .replace(/\b(TEL|PHONE|WHATSAPP|PAY[EÉ]|OFFERT|GRATUIT|BLOQU[EÉ]|RESERV[EÉ])\b/gi, '')
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

async function extractBookingsFromBuffer(buffer, seasonId) {
  const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs');
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

  let allBookings = [];
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet['!ref']) continue;
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    if (range.e.r < 5) continue;

    const season = SEASONS_CONFIG.find(s => s.id === seasonId);
    if (!season) continue;

    const dateRowIndex = findWorksheetDateRowIndex(worksheet, range);
    const dateMap = buildDateMapFromWorksheet(worksheet, dateRowIndex, range, season.start);
    const lastMappedDate = [...dateMap].reverse().find(Boolean);

    for (let row = dateRowIndex + 1; row <= range.e.r; row++) {
      const roomValue = sheetCellText(worksheet, row, 0);
      if (!isRoomCode(roomValue)) continue;

      const roomNumber = roomValue.trim().toUpperCase();
      let activeBooking = null;

      for (let col = range.s.c + 1; col <= range.e.c; col++) {
        const currentDate = dateMap[col];
        if (!currentDate) continue;

        const value = sheetCellText(worksheet, row, col);
        if (!value || shouldSkipValue(value)) {
          if (activeBooking) {
            activeBooking.checkOut = currentDate;
            allBookings.push(finalizeBooking(activeBooking, roomNumber, seasonId));
            activeBooking = null;
          }
          continue;
        }

        const transitionGuest = splitTransitionValue(activeBooking, value);
        if (transitionGuest) {
          activeBooking.checkOut = currentDate;
          allBookings.push(finalizeBooking(activeBooking, roomNumber, seasonId));
          activeBooking = { guestName: transitionGuest, raw: transitionGuest, checkIn: currentDate, checkOut: null };
          continue;
        }

        if (activeBooking && value !== activeBooking.raw) {
          activeBooking.checkOut = currentDate;
          allBookings.push(finalizeBooking(activeBooking, roomNumber, seasonId));
          activeBooking = { guestName: value, raw: value, checkIn: currentDate, checkOut: null };
        } else if (!activeBooking) {
          activeBooking = { guestName: value, raw: value, checkIn: currentDate, checkOut: null };
        }
      }

      if (activeBooking && lastMappedDate) {
        activeBooking.checkOut = addDaysLocal(lastMappedDate, 1);
        allBookings.push(finalizeBooking(activeBooking, roomNumber, seasonId));
      }
    }
  }

  return allBookings;
}

let isSyncInProgress = false;

export async function syncBookingsFromFiles(files, onProgress) {
  if (isSyncInProgress) return;
  isSyncInProgress = true;

  try {
    let allNewData = [];

    onProgress(10, "Lecture du fichier Été...");
    const summerBuffer = await files.summer.file.arrayBuffer();
    const summerData = await extractBookingsFromBuffer(summerBuffer, files.summer.seasonId);
    allNewData.push(...summerData);
    onProgress(30, `Extraction Été : ${summerData.length} réservations trouvées.`);

    onProgress(40, "Lecture du fichier Hiver...");
    const winterBuffer = await files.winter.file.arrayBuffer();
    const winterData = await extractBookingsFromBuffer(winterBuffer, files.winter.seasonId);
    allNewData.push(...winterData);
    onProgress(60, `Extraction Hiver : ${winterData.length} réservations trouvées.`);

    if (allNewData.length === 0) throw new Error("Aucune donnée trouvée.");

    onProgress(70, "Mise à jour de la base de données...");
    const { data: existingData } = await supabase.from('bookings').select('id, room_number, guest_name, check_in, check_out, season');

    // Deduplicate new data to avoid internal conflicts
    const uniqueMap = new Map();
    for (const b of allNewData) {
      const key = `${b.room_number}|${b.guest_name}|${b.check_in}|${b.check_out}|${b.season}`;
      uniqueMap.set(key, b);
    }
    const uniqueList = Array.from(uniqueMap.values());

    // Fix: Use the new unique constraint target
    const { error: upsertError } = await supabase
      .from('bookings')
      .upsert(uniqueList, { onConflict: 'room_number, guest_name, check_in, check_out, season' });

    if (upsertError) {
       console.error("[Sync] Upsert Error:", upsertError);
       throw new Error(`Erreur base de données: ${upsertError.message}`);
    }

    onProgress(90, "Nettoyage des anciennes réservations...");
    const newKeys = new Set(uniqueList.map(b => `${b.room_number}|${b.guest_name}|${b.check_in}|${b.check_out}|${b.season}`));
    const toDelete = existingData
      .filter(b => !newKeys.has(`${b.room_number}|${b.guest_name}|${b.check_in}|${b.check_out}|${b.season}`))
      .map(b => b.id);

    if (toDelete.length > 0) {
      await supabase.from('bookings').delete().in('id', toDelete);
    }

    onProgress(100, "Synchronisation réussie !");
    localStorage.setItem('last_booking_sync', new Date().toISOString());
    return { added: uniqueList.length, deleted: toDelete.length };
  } catch (error) {
    console.error("[Sync] Critical failure:", error);
    onProgress(0, `Erreur: ${error.message}`);
    throw error;
  } finally {
    isSyncInProgress = false;
  }
}
