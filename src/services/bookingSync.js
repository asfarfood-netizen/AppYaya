import { supabase } from '../supabaseClient';

const SHEETS = [
  {
    name: 'ETE 2026',
    url: 'https://docs.google.com/spreadsheets/d/1rbNh01WA4nHJL0RZjI-TnFjt2WBt9GiWjcq_tGhmH48/gviz/tq?tqx=out:json',
    startYear: 2026,
    startMonth: 5
  },
  {
    name: 'HIVER 2026/27',
    url: 'https://docs.google.com/spreadsheets/d/1qvv58oHR4Z8D9qp1TQJf7KS-wOG5GQizPx2VQWLeTPM/gviz/tq?tqx=out:json',
    startYear: 2026,
    startMonth: 11
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

      if (typeof dayVal === 'string') dayVal = parseInt(dayVal);

      // Handle month transition when day is 1
      if (dayVal === 1 && j > 1) {
        currentMonth++;
        if (currentMonth > 12) {
          currentMonth = 1;
          currentYear++;
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
      // Skip headers or special rows
      if (roomNumber.toLowerCase().includes('chambre') || roomNumber === "1") continue;

      let activeBooking = null;

      for (let j = 1; j < rowCells.length; j++) {
        const cell = rowCells[j];
        const cellValue = cell?.v;
        const currentDate = dateMap[j];

        if (!currentDate) continue;

        if (cellValue && cellValue.toString().trim().length > 0) {
          const valStr = cellValue.toString().trim();

          // If cell contains '/', it might be a transition (Guest1 checkout / Guest2 checkin)
          // For now, we treat the whole string as the "guest name" and let finalizeBooking clean it up.
          // But if the value changed from the previous cell, we finalize the previous one.
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
        let lastDate = dateMap.filter(d => d).pop();
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

  // 1. Extract and fix arrival/departure dates if mentioned in name (e.g. ">9/4" or "15/6<")
  const arrivalMatch = name.match(/>(\d{1,2}\/\d{1,2}(\/\d{2,4})?)/);
  if (arrivalMatch) {
    const [d, m, y] = arrivalMatch[1].split('/');
    const year = y ? (y.length === 2 ? 2000 + parseInt(y) : parseInt(y)) : checkIn.getFullYear();
    const parsedArrival = new Date(year, parseInt(m) - 1, parseInt(d));
    if (!isNaN(parsedArrival)) checkIn = parsedArrival;
    name = name.replace(arrivalMatch[0], '').trim();
  }

  const departureMatch = name.match(/(\d{1,2}\/\d{1,2}(\/\d{2,4})?)< /);
  if (departureMatch) {
    const [d, m, y] = departureMatch[1].split('/');
    const year = y ? (y.length === 2 ? 2000 + parseInt(y) : parseInt(y)) : checkOut.getFullYear();
    const parsedDeparture = new Date(year, parseInt(m) - 1, parseInt(d));
    if (!isNaN(parsedDeparture)) checkOut = parsedDeparture;
    name = name.replace(departureMatch[0], '').trim();
  }

  // 2. Handle transitions like "GUEST1 / GUEST2"
  // If we are finalising a booking and it has a '/', it's usually the transition cell.
  // The current logic might have already split it if the next cell was different.
  // We'll just clean up the '/' and common debris.
  name = name.replace(/^[\s/]+|[\s/]+$/g, '');

  // 3. Extract persons (patterns like "2P", "2 pers", "2+1", "2+bb")
  const personMatch = name.match(/(\d\s?\+\s?\d|\d+)\s?(P|personnes|pers|pax|bb)?$/i);
  if (personMatch) {
    persons = personMatch[1].replace(/\s/g, '');
    name = name.replace(personMatch[0], '').trim();
  }

  // 4. Extract contact info (email, phone)
  const emailMatch = name.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
  if (emailMatch) {
    notes.push(...emailMatch);
    emailMatch.forEach(e => name = name.replace(e, ''));
  }

  const phoneMatch = name.match(/(\+?\d{1,3}[\s.-]?)?\d{2,4}[\s.-]?\d{2,4}[\s.-]?\d{2,4}/g);
  if (phoneMatch) {
    // Filter out strings that are likely not phones (e.g. room numbers or dates)
    const validPhones = phoneMatch.filter(p => p.replace(/\D/g, '').length >= 8);
    notes.push(...validPhones);
    validPhones.forEach(p => name = name.replace(p, ''));
  }

  // 5. Cleanup remaining debris
  name = name.replace(/sp le\s?\d{1,2}\/\d{1,2}(\/\d{2,4})?/gi, (match) => {
    notes.push(match);
    return '';
  });

  name = name.replace(/[,;/-]+$/, '').replace(/^[,;/-]+/, '').trim();
  if (!name || name === "/") name = "CLIENT";

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
