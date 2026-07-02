import { supabase } from '../supabaseClient';

const SHEETS = [
  {
    name: 'ETE 2026',
    url: 'https://docs.google.com/spreadsheets/d/1rbNh01WA4nHJL0RZjI-TnFjt2WBt9GiWjcq_tGhmH48/gviz/tq?tqx=out:json',
    startYear: 2026,
    startMonth: 5 // May
  },
  {
    name: 'HIVER 2026/27',
    url: 'https://docs.google.com/spreadsheets/d/1qvv58oHR4Z8D9qp1TQJf7KS-wOG5GQizPx2VQWLeTPM/gviz/tq?tqx=out:json',
    startYear: 2026,
    startMonth: 11 // November
  }
];

/**
 * Parses the Google Sheets JSON and extracts bookings.
 */
async function fetchSheetData(sheetInfo) {
  try {
    const response = await fetch(sheetInfo.url);
    if (!response.ok) throw new Error(`HTTP status: ${response.status}`);

    const text = await response.text();
    // Strip the JSONP wrapper
    const jsonStr = text.substring(text.indexOf('(') + 1, text.lastIndexOf(')'));
    const data = JSON.parse(jsonStr);

    const rows = data.table.rows;
    if (!rows || rows.length === 0) return [];

    const dateMap = [];
    const headerRow = rows[0].c;

    let currentMonth = sheetInfo.startMonth;
    let currentYear = sheetInfo.startYear;

    // Build the date map from the header row (row 0)
    for (let j = 1; j < headerRow.length; j++) {
      let cell = headerRow[j];
      let dayVal = cell?.v;

      if (dayVal === null || dayVal === undefined) continue;

      if (typeof dayVal === 'string') {
        const parsed = parseInt(dayVal);
        if (!isNaN(parsed)) dayVal = parsed;
        else continue;
      }

      // Handle month transition when day is 1
      if (dayVal === 1) {
          // Look back for the previous valid day
          let prevDay = null;
          for (let k = j - 1; k >= 1; k--) {
              if (dateMap[k]) {
                  prevDay = dateMap[k].getDate();
                  break;
              }
          }
          // If previous day was high (like 28-31), it's a new month
          if (prevDay !== null && prevDay > 20) {
              currentMonth++;
              if (currentMonth > 12) {
                  currentMonth = 1;
                  currentYear++;
              }
          }
      }

      if (dayVal && !isNaN(dayVal)) {
        dateMap[j] = new Date(currentYear, currentMonth - 1, dayVal);
      }
    }

    const bookings = [];

    // Process each room row
    for (let i = 1; i < rows.length; i++) {
      const rowCells = rows[i].c;
      if (!rowCells || !rowCells[0]?.v) continue;

      const roomNumber = rowCells[0].v.toString().trim();
      // Skip headers or special rows (if room number is not a number and doesn't look like one)
      if (isNaN(parseInt(roomNumber)) && !roomNumber.toLowerCase().includes('annexe')) continue;

      let activeBooking = null;

      for (let j = 1; j < rowCells.length; j++) {
        const cell = rowCells[j];
        const cellValue = cell?.v;
        const currentDate = dateMap[j];

        if (!currentDate) continue;

        if (cellValue && cellValue.toString().trim().length > 0) {
          const valStr = cellValue.toString().trim();

          // Handle Guest Transitions in a single cell (e.g. "NAME1 / NAME2")
          if (valStr.includes(' / ')) {
              const parts = valStr.split(' / ').map(p => p.trim());
              const nameLeft = parts[0];
              const nameRight = parts[1];

              // Finalize previous guest if they match the left side of the split
              if (activeBooking) {
                  activeBooking.checkOut = currentDate;
                  bookings.push(finalizeBooking(activeBooking, roomNumber, sheetInfo.name));
                  activeBooking = null;
              }

              // Start new guest from today
              activeBooking = {
                  guestName: nameRight,
                  raw: nameRight,
                  checkIn: currentDate,
                  checkOut: null
              };
              continue;
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
        } else if (!cellValue && activeBooking) {
          // Empty cell means the previous booking ended
          activeBooking.checkOut = currentDate;
          bookings.push(finalizeBooking(activeBooking, roomNumber, sheetInfo.name));
          activeBooking = null;
        }
      }

      // Handle booking that goes until the end of the sheet
      if (activeBooking) {
        let lastDate = [...dateMap].reverse().find(d => d);
        if (lastDate) {
          activeBooking.checkOut = new Date(lastDate);
          activeBooking.checkOut.setDate(activeBooking.checkOut.getDate() + 1);
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
    if (!isNaN(parsedArrival)) checkIn = parsedArrival;
    name = name.replace(arrivalMatch[0], '').trim();
  }

  const departureMatch = name.match(/(\d{1,2})\/(\d{1,2})(\/(\d{2,4}))?</);
  if (departureMatch) {
    const d = parseInt(departureMatch[1]);
    const m = parseInt(departureMatch[2]);
    const yStr = departureMatch[4];
    const year = yStr ? (yStr.length === 2 ? 2000 + parseInt(yStr) : parseInt(yStr)) : checkOut.getFullYear();
    const parsedDeparture = new Date(year, m - 1, d);
    if (!isNaN(parsedDeparture)) checkOut = parsedDeparture;
    name = name.replace(departureMatch[0], '').trim();
  }

  // 2. Extract persons count (e.g., 2P, 2+1, 2 pers)
  const personMatch = name.match(/(\d\s?\+\s?\d|\d+)\s?(P|personnes|pers|pax|bb)?$/i);
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
  name = name.replace(/[,;/-]+$/, '').replace(/^[,;/-]+/, '').trim();
  const upperName = name.toUpperCase();
  if (!name || name === "/" || upperName === "C" || upperName === "NC" || upperName === "RDC") name = "CLIENT";

  return {
    room_number: room,
    guest_name: name.toUpperCase(),
    check_in: checkIn.toISOString().split('T')[0],
    check_out: checkOut.toISOString().split('T')[0],
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
