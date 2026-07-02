import { supabase } from '../supabaseClient';

const SHEETS = [
  {
    name: 'ETE 2026',
    url: 'https://docs.google.com/spreadsheets/d/1rbNh01WA4nHJL0RZjI-TnFjt2WBt9GiWjcq_tGhmH48/gviz/tq?tqx=out:json',
    startYear: 2026,
    startMonth: 5 // May (1st '1' in Col B)
  },
  {
    name: 'HIVER 2026/27',
    url: 'https://docs.google.com/spreadsheets/d/1qvv58oHR4Z8D9qp1TQJf7KS-wOG5GQizPx2VQWLeTPM/gviz/tq?tqx=out:json',
    startYear: 2026,
    startMonth: 11 // November (1st '1' in Col B)
  }
];

/**
 * Parses the horizontal calendar format.
 */
async function fetchSheetData(sheetInfo) {
  const response = await fetch(sheetInfo.url);
  const text = await response.text();
  const jsonStr = text.substring(text.indexOf('(') + 1, text.lastIndexOf(')'));
  const data = JSON.parse(jsonStr);

  const rows = data.table.rows;
  if (!rows || rows.length === 0) return [];

  // Map columns to actual dates
  const dateMap = []; // index -> Date object
  const headerRow = rows[0].c;

  let currentMonth = sheetInfo.startMonth;
  let currentYear = sheetInfo.startYear;

  for (let j = 1; j < headerRow.length; j++) {
    const dayVal = headerRow[j]?.v;
    if (dayVal === 1 && j > 1) {
      currentMonth++;
      if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
      }
    }

    if (dayVal) {
      dateMap[j] = new Date(currentYear, currentMonth - 1, dayVal);
    }
  }

  const bookings = [];

  // Iterate through rooms
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i].c;
    if (!row || !row[0]?.v) continue;

    const roomNumber = row[0].v.toString().trim();
    if (roomNumber.length > 10 || roomNumber === "1") continue; // Skip headers or weird rows

    let activeBooking = null;

    for (let j = 1; j < row.length; j++) {
      const cellValue = row[j]?.v;
      const currentDate = dateMap[j];
      if (!currentDate) continue;

      if (cellValue && typeof cellValue === 'string') {
        // If we have an active booking and text changes, close previous
        if (activeBooking && cellValue !== activeBooking.raw) {
          activeBooking.checkOut = currentDate;
          bookings.push(finalizeBooking(activeBooking, roomNumber, sheetInfo.name));
          activeBooking = null;
        }

        if (!activeBooking) {
          activeBooking = {
            guestName: cellValue,
            raw: cellValue,
            checkIn: currentDate,
            checkOut: null
          };
        }
      } else if (!cellValue && activeBooking) {
        // Stay ends
        activeBooking.checkOut = currentDate;
        bookings.push(finalizeBooking(activeBooking, roomNumber, sheetInfo.name));
        activeBooking = null;
      }
    }

    if (activeBooking) {
      // Last column checkOut
      const lastDate = dateMap[dateMap.length - 1];
      activeBooking.checkOut = new Date(lastDate);
      activeBooking.checkOut.setDate(activeBooking.checkOut.getDate() + 1);
      bookings.push(finalizeBooking(activeBooking, roomNumber, sheetInfo.name));
    }
  }

  return bookings;
}

function finalizeBooking(b, room, season) {
  // Parse name and persons
  let name = b.guestName.trim();
  let persons = null;
  let notes = null;

  // Handle ">DATE" prefixes
  name = name.replace(/^>[\d/]+\s*/, '');

  // Handle "<DATE" suffixes or mid-text
  name = name.replace(/<[\d/]+\s*/, '');

  // Extract persons "2P", "1P", "2+2"
  const pMatch = name.match(/(\d\+?\d?|[\d]+)P?\s*$/i);
  if (pMatch) {
    persons = pMatch[1];
    name = name.replace(pMatch[0], '').trim();
  }

  // If name contains specific notes like "email", "sp le", etc.
  if (name.toLowerCase().includes('email') || name.toLowerCase().includes('sp le') || name.toLowerCase().includes('tel')) {
     const parts = name.split(/email|sp le|tel/i);
     name = parts[0].trim();
     notes = name.slice(parts[0].length).trim();
  }

  return {
    room_number: room,
    guest_name: name || 'Inconnu',
    check_in: b.checkIn.toISOString().split('T')[0],
    check_out: b.checkOut.toISOString().split('T')[0],
    persons: persons,
    notes: notes,
    season: season
  };
}

export async function syncAllBookings() {
  let allBookings = [];

  for (const sheet of SHEETS) {
    try {
      const data = await fetchSheetData(sheet);
      allBookings = allBookings.concat(data);
    } catch (e) {
      console.error(`Error syncing ${sheet.name}:`, e);
    }
  }

  if (allBookings.length > 0) {
    // Deduplicate
    const uniqueBookings = [];
    const seen = new Set();
    for (const b of allBookings) {
      const key = `${b.room_number}|${b.guest_name}|${b.check_in}|${b.check_out}`;
      if (!seen.has(key)) {
        uniqueBookings.push(b);
        seen.add(key);
      }
    }

    const { error } = await supabase
      .from('bookings')
      .upsert(uniqueBookings, { onConflict: 'room_number, guest_name, check_in, check_out' });

    if (error) throw error;
    return uniqueBookings.length;
  }

  return 0;
}
