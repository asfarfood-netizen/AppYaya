import { supabase } from '../supabaseClient';
import { SEASONS_CONFIG } from '../constants';

const DATE_ROW_SCORE_MIN = 5; // Reduced slightly to be more inclusive

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
  // Matches 1-31, potentially with leading zeros or followed by noise
  const match = value.match(/^(\d{1,2})/);
  if (!match) return null;
  const day = Number(match[1]);
  return day >= 1 && day <= 31 ? day : null;
}

function isRoomCode(value) {
  // More inclusive room code detection: 3-4 digits, optional G, or Annexe codes
  return /^\d{3,4}G?$|^A\d+$/i.test(value.trim());
}

function findWorksheetDateRowIndex(worksheet, range) {
  let best = { index: range.s.r, score: 0 };
  console.log(`[Sync] Searching for date row in range ${range.s.r} to ${Math.min(range.e.r, range.s.r + 15)}...`);

  for (let row = range.s.r; row <= Math.min(range.e.r, range.s.r + 15); row++) {
    let score = 0;
    for (let col = range.s.c; col <= range.e.c; col++) {
      if (parseDayNumber({ v: sheetCellText(worksheet, row, col) })) score += 1;
    }
    if (score > best.score) {
      best = { index: row, score };
    }
  }

  console.log(`[Sync] Best date row found at index ${best.index} with score ${best.score}`);
  return best.index;
}

function buildDateMapFromWorksheet(worksheet, dateRowIndex, range, seasonStart) {
  const dateMap = [];
  let cursor = new Date(seasonStart);
  console.log(`[Sync] Building date map starting from ${seasonStart.toDateString()}...`);

  for (let col = range.s.c + 1; col <= range.e.c; col++) {
    const dayNum = parseDayNumber({ v: sheetCellText(worksheet, dateRowIndex, col) });
    if (!dayNum) continue;

    let guard = 0;
    while (cursor.getDate() !== dayNum && guard < 40) { // Look ahead up to 40 days
      cursor = addDaysLocal(cursor, 1);
      guard += 1;
    }

    if (guard < 40) {
      dateMap[col] = new Date(cursor);
      // Don't increment cursor here yet, as multiple columns might represent the same day (rare but possible in some layouts)
      // or we might want to stay on this day for the next column check.
      // Actually, standard layout is 1 column = 1 day.
      cursor = addDaysLocal(cursor, 1);
    }
  }

  const mappedCount = dateMap.filter(Boolean).length;
  console.log(`[Sync] Date map built: ${mappedCount} days mapped.`);
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
  // Skip common non-guest markers
  return !text || text === '/' || text === 'C' || text === 'NC' || text === 'RDC' || text === 'X' || text === '-';
}

function splitTransitionValue(activeBooking, value) {
  if (!activeBooking || !value.includes(' / ')) return null;

  const parts = value.split(' / ').map(p => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;

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

  // Find a worksheet that looks like it has data
  const sheetName = workbook.SheetNames.find(name => {
    const ws = workbook.Sheets[name];
    return ws['!ref'] && XLSX.utils.decode_range(ws['!ref']).e.r > 5;
  }) || workbook.SheetNames[0];

  console.log(`[Sync] Using sheet: ${sheetName}`);
  const worksheet = workbook.Sheets[sheetName];
  const range = XLSX.utils.decode_range(worksheet['!ref']);

  const season = SEASONS_CONFIG.find(s => s.id === seasonId);
  if (!season) throw new Error("Saison non configurée: " + seasonId);

  const dateRowIndex = findWorksheetDateRowIndex(worksheet, range);
  const dateMap = buildDateMapFromWorksheet(worksheet, dateRowIndex, range, season.start);
  const lastMappedDate = [...dateMap].reverse().find(Boolean);

  const bookings = [];
  let foundRooms = 0;

  for (let row = dateRowIndex + 1; row <= range.e.r; row++) {
    const roomValue = sheetCellText(worksheet, row, 0);
    if (!isRoomCode(roomValue)) continue;

    const roomNumber = roomValue.trim().toUpperCase();
    foundRooms++;
    let activeBooking = null;

    for (let col = range.s.c + 1; col <= range.e.c; col++) {
      const currentDate = dateMap[col];
      if (!currentDate) continue;

      const value = sheetCellText(worksheet, row, col);
      if (!value || shouldSkipValue(value)) {
        if (activeBooking) {
          activeBooking.checkOut = currentDate;
          bookings.push(finalizeBooking(activeBooking, roomNumber, seasonId));
          activeBooking = null;
        }
        continue;
      }

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
        activeBooking = {
          guestName: value,
          raw: value,
          checkIn: currentDate,
          checkOut: null
        };
      } else if (!activeBooking) {
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

  console.log(`[Sync] Extraction complete: Found ${foundRooms} rooms, ${bookings.length} total bookings.`);
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
    console.log(`[Sync] Starting sync for file: ${file.name}, season: ${seasonId}`);
    const buffer = await file.arrayBuffer();
    const newData = await extractBookingsFromBuffer(buffer, seasonId);

    if (newData.length === 0) {
      throw new Error("Aucune réservation trouvée. Vérifiez que le format du fichier Excel correspond (Numéro de chambre en colonne A, dates en ligne d'entête).");
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

    console.log(`[Sync] Upserting ${uniqueList.length} unique bookings...`);
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
      console.log(`[Sync] Deleting ${toDelete.length} obsolete bookings...`);
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
    console.log(`[Sync] Success! Added: ${stats.added}, Deleted: ${stats.deleted}`);
    return stats;
  } catch (error) {
    console.error("[Sync] Critical error during sync:", error);
    throw error;
  } finally {
    isSyncInProgress = false;
  }
}
