import { supabase } from '../supabaseClient';

const SHEETS = [
  {
    name: 'ETE 2026',
    id: '1rbNh01WA4nHJL0RZjI-TnFjt2WBt9GiWjcq_tGhmH48',
    exportUrl: 'https://docs.google.com/spreadsheets/d/1rbNh01WA4nHJL0RZjI-TnFjt2WBt9GiWjcq_tGhmH48/export?format=xlsx',
    url: 'https://docs.google.com/spreadsheets/d/1rbNh01WA4nHJL0RZjI-TnFjt2WBt9GiWjcq_tGhmH48/gviz/tq?tqx=out:json',
    startDate: new Date(2026, 4, 1) // May 1st 2026
  },
  {
    name: 'HIVER 2026/27',
    id: '1qvv58oHR4Z8D9qp1TQJf7KS-wOG5GQizPx2VQWLeTPM',
    exportUrl: 'https://docs.google.com/spreadsheets/d/1qvv58oHR4Z8D9qp1TQJf7KS-wOG5GQizPx2VQWLeTPM/export?format=xlsx',
    url: 'https://docs.google.com/spreadsheets/d/1qvv58oHR4Z8D9qp1TQJf7KS-wOG5GQizPx2VQWLeTPM/gviz/tq?tqx=out:json',
    startDate: new Date(2026, 10, 1) // Nov 1st 2026
  }
];

const ROOM_ROW_FALLBACKS = {
  'ETE 2026': [
    '101G', '102G', '103', '104', '105', '106', '109',
    '201G', '202G', '203', '204', '205', '206', '207', '208', '209', '210', '211', '212', '213', '214', '215', '216', 'A1',
    '301G', '302', '303', '304', '305', '306', '307', '308', '309', '310', '311', '312', '313', '314', '315', '316', 'A2',
    '401G', '402', '403', '404', '405', '406', '407', '408', '409', '410', '411', '412', '413', '414', '415', '416', 'A3',
    '501', '502', '503', '504', '505', '506', '507', '508', '509', '510', '511', '512', '513', '514', '515', '516', 'A4',
    '601', '602', '603', '604', '605', '606', '607', '608',
    '1101', '1102', '1103G', '1202', '1203',
    '1301G', '1302', '1303', '1304', '1305', '1306G',
    '1401', '1402', '1403', '1404', '1405', '1406',
    '1501', '1502', '1503', '1504', '1505', '1506',
    '1601', '1602', '1603', '1604', '1605'
  ],
  'HIVER 2026/27': [
    '101G', '102G', '103', '104', '105', '106', '109',
    '201G', '202G', '203', '204', '205', '206', '207', '208', '209', '210', '211', '212', '213', '214', '215', '216', 'A1',
    '301G', '302', '303', '304', '305', '306', '307', '308', '309', '310', '311', '312', '313', '314', '315', '316', 'A2',
    '401G', '402', '403', '404', '405', '406', '407', '408', '409', '410', '411', '412', '413', '414', '415', '416', 'A3',
    '501', '502', '503', '504', '505', '506', '507', '508', '509', '510', '511', '512', '513', '514', '515', 'A4',
    '601', '602', '603', '604', '605', '606', '607', '608',
    '1101', '1102', '1103G', '1202', '1203',
    '1301', '1302', '1303', '1304', '1305', '1306G',
    '1401G', '1402', '1403', '1404', '1405', '1406',
    '1501', '1502', '1503', '1504', '1505', '1506',
    '1601', '1602', '1603', '1604', '1605'
  ]
};

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

function findDateRowIndex(rows) {
  let best = { index: -1, score: 0 };
  rows.forEach((row, index) => {
    const score = (row.c || []).slice(1).reduce((count, cell) => count + (parseDayNumber(cell) ? 1 : 0), 0);
    if (score > best.score) best = { index, score };
  });
  return best.score >= DATE_ROW_SCORE_MIN ? best.index : 0;
}

function buildDateMap(dateRow, seasonStart) {
  const dateMap = [];
  let cursor = new Date(seasonStart);

  for (let j = 1; j < dateRow.length; j++) {
    const dayNum = parseDayNumber(dateRow[j]);
    if (!dayNum) continue;

    let guard = 0;
    while (cursor.getDate() !== dayNum && guard < 370) {
      cursor = addDaysLocal(cursor, 1);
      guard += 1;
    }

    if (guard < 370) {
      dateMap[j] = new Date(cursor);
      cursor = addDaysLocal(cursor, 1);
    }
  }

  return dateMap;
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

function resolveRoomForRow(row, roomOrder, cursor) {
  const explicitRoom = cellText(row.c?.[0]);
  if (isRoomCode(explicitRoom)) {
    const room = explicitRoom.toUpperCase();
    const explicitIndex = roomOrder.indexOf(room);
    return {
      room,
      nextCursor: explicitIndex >= 0 ? explicitIndex + 1 : cursor + 1
    };
  }

  return {
    room: roomOrder[cursor] || null,
    nextCursor: cursor + 1
  };
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

async function fetchSheetDataFromXlsx(sheetInfo) {
  const XLSX = await import('xlsx');
  const response = await fetch(sheetInfo.exportUrl);
  if (!response.ok) throw new Error(`XLSX HTTP status: ${response.status}`);

  const buffer = await response.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const range = XLSX.utils.decode_range(worksheet['!ref']);
  const dateRowIndex = findWorksheetDateRowIndex(worksheet, range);
  const dateMap = buildDateMapFromWorksheet(worksheet, dateRowIndex, range, sheetInfo.startDate);
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
        bookings.push(finalizeBooking(activeBooking, roomNumber, sheetInfo.name));
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
        bookings.push(finalizeBooking(activeBooking, roomNumber, sheetInfo.name));
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
      bookings.push(finalizeBooking(activeBooking, roomNumber, sheetInfo.name));
    }
  }

  return bookings;
}

/**
 * Parses the Google Sheets JSON and extracts bookings.
 */
async function fetchSheetData(sheetInfo) {
  try {
    try {
      return await fetchSheetDataFromXlsx(sheetInfo);
    } catch (xlsxError) {
      console.warn(`[Sync] XLSX extraction failed for ${sheetInfo.name}, falling back to JSON feed:`, xlsxError);
    }

    const response = await fetch(sheetInfo.url);
    if (!response.ok) throw new Error(`HTTP status: ${response.status}`);

    const text = await response.text();
    // Strip the JSONP wrapper
    const jsonStr = text.substring(text.indexOf('(') + 1, text.lastIndexOf(')'));
    const data = JSON.parse(jsonStr);

    const rows = data.table.rows;
    if (!rows || rows.length === 0) return [];

    const dateRowIndex = findDateRowIndex(rows);
    const dateMap = buildDateMap(rows[dateRowIndex].c || [], sheetInfo.startDate);
    const lastMappedDate = [...dateMap].reverse().find(Boolean);

    const bookings = [];
    const roomOrder = ROOM_ROW_FALLBACKS[sheetInfo.name] || [];
    let roomCursor = 0;

    // Process each room row
    for (let i = dateRowIndex + 1; i < rows.length; i++) {
      const rowCells = rows[i].c;
      if (!rowCells) continue;

      const resolvedRoom = resolveRoomForRow(rows[i], roomOrder, roomCursor);
      roomCursor = resolvedRoom.nextCursor;
      const roomNumber = resolvedRoom.room;
      if (!roomNumber) continue;

      let activeBooking = null;

      for (let j = 1; j < dateMap.length; j++) {
        const cell = rowCells[j];
        const cellValue = cellText(cell);
        const currentDate = dateMap[j];

        if (!currentDate) continue;

        if (cellValue) {
          const valStr = cellValue;

          // Handle Guest Transitions in a single cell (e.g. "NAME1 / NAME2")
          if (activeBooking && valStr.includes(' / ')) {
              const parts = valStr.split(' / ').map(p => p.trim()).filter(Boolean);
              const nameLeft = parts[0];
              const nameRight = parts.slice(1).join(' / ');

              if (nameLeft && nameRight && sameGuestPrefix(activeBooking.raw, nameLeft)) {
                  activeBooking.checkOut = currentDate;
                  bookings.push(finalizeBooking(activeBooking, roomNumber, sheetInfo.name));
                  activeBooking = {
                      guestName: nameRight,
                      raw: nameRight,
                      checkIn: currentDate,
                      checkOut: null
                  };
                  continue;
                }
          }

          // If the cell value is different from the active booking's raw value,
          // it means a new guest has arrived (standard transition).
          if (activeBooking && valStr !== activeBooking.raw) {
            activeBooking.checkOut = currentDate;
            bookings.push(finalizeBooking(activeBooking, roomNumber, sheetInfo.name));
            activeBooking = null;
          }

          if (!activeBooking) {
            activeBooking = {
              guestName: valStr,
              raw: valStr,
              checkIn: currentDate,
              checkOut: null
            };
          }
        }
      }

      // Handle booking that goes until the end of the sheet
      if (activeBooking) {
        if (lastMappedDate) {
          activeBooking.checkOut = addDaysLocal(lastMappedDate, 1);
          bookings.push(finalizeBooking(activeBooking, roomNumber, sheetInfo.name));
        }
      }
    }

    return bookings;
  } catch (error) {
    console.error(`[Sync] Error fetching ${sheetInfo.name}:`, error);
    return [];
  }
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

  // Extract Markers first as they are most specific
  // 1. Arrival/Departure markers: >DD/MM or DD/MM<
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

  // 2. Extract persons count (e.g., 2P, 2+1, 2 pers, 2+bb)
  const personMatch = name.match(/(\d+\s?\+\s?(?:\d+|bb)|\d+\s?\+\s?\d+|\d+)\s?(P|personnes|pers|pax)?$/i);
  if (personMatch) {
    persons = personMatch[1].replace(/\s/g, '');
    name = name.replace(personMatch[0], '').trim();
  }

  // 3. Extract contact info (email, phone)
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

  // 4. Cleanup remaining markers and debris
  name = name.replace(/sp le\s?\d{1,2}\/\d{1,2}(\/\d{2,4})?/gi, (match) => {
    notes.push(match);
    return '';
  });

  name = name.replace(/[<>]\d{3,4}/g, (match) => {
      notes.push("Ref: " + match);
      return '';
  });

  // Clean common noise
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

let isSyncInProgress = false;

/**
 * Main sync function.
 */
export async function syncAllBookings() {
  if (isSyncInProgress) {
    console.log("[Sync] Sync already in progress, skipping.");
    return { added: 0, updated: 0, deleted: 0 };
  }

  isSyncInProgress = true;
  try {
    let stats = { added: 0, updated: 0, deleted: 0 };

    for (const sheet of SHEETS) {
      console.log(`[Sync] Starting sync for ${sheet.name}...`);
      const newData = await fetchSheetData(sheet);

      if (newData.length === 0) {
        console.warn(`[Sync] No data found for ${sheet.name}.`);
        continue;
      }

      // Get existing bookings for this season to identify deletions
      const { data: existingData, error: fetchError } = await supabase
        .from('bookings')
        .select('id, room_number, guest_name, check_in, check_out')
        .eq('season', sheet.name);

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

      // Identify and delete records no longer in the sheet
      const newKeys = new Set(uniqueList.map(b => `${b.room_number}|${b.guest_name}|${b.check_in}|${b.check_out}`));
      const toDelete = existingData
        .filter(b => !newKeys.has(`${b.room_number}|${b.guest_name}|${b.check_in}|${b.check_out}`))
        .map(b => b.id);

      if (toDelete.length > 0) {
        console.log(`[Sync] Deleting ${toDelete.length} obsolete records for ${sheet.name}.`);
        const { error: deleteError } = await supabase
          .from('bookings')
          .delete()
          .in('id', toDelete);

        if (deleteError) console.error("[Sync] Error deleting obsolete records:", deleteError);
        stats.deleted += toDelete.length;
      }

      stats.added += uniqueList.length;
    }

    localStorage.setItem('last_booking_sync', new Date().toISOString());
    console.log(`[Sync] Completed. Stats:`, stats);
    return stats;
  } catch (error) {
    console.error("[Sync] Critical error during sync:", error);
    throw error;
  } finally {
    isSyncInProgress = false;
  }
}
