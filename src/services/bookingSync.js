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

async function fetchSheetData(sheetInfo) {
  try {
    const response = await fetch(sheetInfo.url);
    if (!response.ok) throw new Error(`HTTP status: ${response.status}`);

    const text = await response.text();
    const jsonStr = text.substring(text.indexOf('(') + 1, text.lastIndexOf(')'));
    const data = JSON.parse(jsonStr);

    const rows = data.table.rows;
    if (!rows || rows.length === 0) return [];

    const dateMap = [];
    const headerRow = rows[0].c;

    let currentMonth = sheetInfo.startMonth;
    let currentYear = sheetInfo.startYear;

    for (let j = 1; j < headerRow.length; j++) {
      let cell = headerRow[j];
      let dayVal = cell?.v;

      if (typeof dayVal === 'string') dayVal = parseInt(dayVal);

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

    for (let i = 1; i < rows.length; i++) {
      const rowCells = rows[i].c;
      if (!rowCells || !rowCells[0]?.v) continue;

      const roomNumber = rowCells[0].v.toString().trim();
      if (roomNumber.toLowerCase().includes('chambre') || roomNumber === "1") continue;

      let activeBooking = null;

      for (let j = 1; j < rowCells.length; j++) {
        const cell = rowCells[j];
        const cellValue = cell?.v;
        const currentDate = dateMap[j];

        if (!currentDate) continue;

        if (cellValue && cellValue.toString().trim().length > 0) {
          const valStr = cellValue.toString().trim();

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
          activeBooking.checkOut = currentDate;
          bookings.push(finalizeBooking(activeBooking, roomNumber, sheetInfo.name));
          activeBooking = null;
        }
      }

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

function finalizeBooking(b, room, season) {
  let name = b.guestName.toString();
  let persons = null;
  let notes = [];

  // Cleanup patterns
  name = name.replace(/[<>]\s?\d{1,2}\/\d{1,2}(\/\d{2,4})?/g, '');
  name = name.replace(/sp le\s?\d{1,2}\/\d{1,2}(\/\d{2,4})?/gi, '');

  // Extract persons
  const personMatch = name.match(/(\d\s?\+\s?\d|\d+)\s?(P|personnes|pers|pax)?$/i);
  if (personMatch) {
    persons = personMatch[1].replace(/\s/g, '');
    name = name.replace(personMatch[0], '').trim();
  }

  // Extract contact info
  const emailMatch = name.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
  if (emailMatch) {
    notes.push(...emailMatch);
    emailMatch.forEach(e => name = name.replace(e, ''));
  }

  name = name.replace(/[,;/-]$/, '').trim();
  if (!name) name = "CLIENT";

  return {
    room_number: room,
    guest_name: name.toUpperCase(),
    check_in: b.checkIn.toISOString().split('T')[0],
    check_out: b.checkOut.toISOString().split('T')[0],
    persons: persons,
    notes: notes.join(', ') || null,
    season: season
  };
}

// Global variable to prevent concurrent syncs
let isSyncInProgress = false;

export async function syncAllBookings() {
  if (isSyncInProgress) {
    console.log("[Sync] Sync already in progress, skipping.");
    return 0;
  }

  isSyncInProgress = true;
  try {
    let allBookings = [];

    for (const sheet of SHEETS) {
      const data = await fetchSheetData(sheet);
      allBookings = allBookings.concat(data);
    }

    if (allBookings.length === 0) {
      console.warn("[Sync] No bookings found to sync.");
      return 0;
    }

    // Deduplicate
    const uniqueMap = new Map();
    for (const b of allBookings) {
      const key = `${b.room_number}|${b.guest_name}|${b.check_in}|${b.check_out}`;
      uniqueMap.set(key, b);
    }

    const uniqueList = Array.from(uniqueMap.values());

    const { error } = await supabase
      .from('bookings')
      .upsert(uniqueList, { onConflict: 'room_number, guest_name, check_in, check_out' });

    if (error) throw error;

    console.log(`[Sync] Successfully synced ${uniqueList.length} records.`);
    return uniqueList.length;
  } finally {
    isSyncInProgress = false;
  }
}
