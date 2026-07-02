import { supabase } from '../supabaseClient';

const SHEETS = [
  {
    name: 'ETE 2026',
    url: 'https://docs.google.com/spreadsheets/d/1rbNh01WA4nHJL0RZjI-TnFjt2WBt9GiWjcq_tGhmH48/gviz/tq?tqx=out:json',
    year: 2026
  },
  {
    name: 'HIVER 2026/27',
    url: 'https://docs.google.com/spreadsheets/d/1qvv58oHR4Z8D9qp1TQJf7KS-wOG5GQizPx2VQWLeTPM/gviz/tq?tqx=out:json',
    year: 2026 // Winter usually starts in current year
  }
];

/**
 * Fetches and parses a Google Sheet into structured bookings.
 */
async function fetchSheetData(sheetInfo) {
  const response = await fetch(sheetInfo.url);
  const text = await response.text();

  // Clean JSON from Google Wrapper
  const jsonStr = text.substring(text.indexOf('(') + 1, text.lastIndexOf(')'));
  const data = JSON.parse(jsonStr);

  const rows = data.table.rows;
  const cols = data.table.cols;

  // Find Date Header row (usually row with numbers 1, 2, 3...)
  // In your sheets, Row 0 (index 0) has the day numbers
  const dayNumbers = rows[0].c.map(cell => cell?.v);

  const bookings = [];

  // Iterate through rooms (starts after headers, e.g., index 1 or 2)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i].c;
    const roomNumber = row[0]?.v?.toString().trim();
    if (!roomNumber) continue;

    // Scan columns for names
    let currentGuest = null;
    let startDate = null;
    let persons = null;

    for (let j = 1; j < row.length; j++) {
      const cellValue = row[j]?.v;
      const day = dayNumbers[j];

      if (cellValue && typeof cellValue === 'string') {
        // New guest or continuation
        // If we were already tracking a guest, save it before starting new
        if (currentGuest && cellValue !== currentGuest) {
          bookings.push(createBookingObject(roomNumber, currentGuest, startDate, day - 1, sheetInfo));
        }

        // Parse "NAME 2P" or ">DATE NAME"
        const cleanValue = cellValue.replace(/^>[\d/]+/, '').trim();
        const pMatch = cleanValue.match(/(\d\+?\d?|[\d]+)P?$/i);

        currentGuest = cleanValue.replace(/(\d\+?\d?|[\d]+)P?$/i, '').trim();
        persons = pMatch ? pMatch[1] : null;
        startDate = day;
      } else if (!cellValue && currentGuest) {
        // End of a stay
        bookings.push(createBookingObject(roomNumber, currentGuest, startDate, day - 1, sheetInfo));
        currentGuest = null;
        startDate = null;
      }
    }

    // Catch last booking if it spans to end of sheet
    if (currentGuest) {
      bookings.push(createBookingObject(roomNumber, currentGuest, startDate, dayNumbers[dayNumbers.length-1], sheetInfo));
    }
  }

  return bookings;
}

function createBookingObject(room, name, startDay, endDay, sheet) {
  // Rough date estimation (needs refinement based on month detection)
  // Defaulting to April for ETE and Dec for HIVER for now as a placeholder
  const month = sheet.name.includes('ETE') ? 4 : 12;
  const year = sheet.year;

  const checkIn = new Date(year, month - 1, startDay).toISOString().split('T')[0];
  const checkOut = new Date(year, month - 1, endDay + 1).toISOString().split('T')[0];

  return {
    room_number: room,
    guest_name: name,
    check_in: checkIn,
    check_out: checkOut,
    season: sheet.name,
    persons: null // Extracted in future iteration
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
    const { error } = await supabase
      .from('bookings')
      .upsert(allBookings, { onConflict: 'room_number, guest_name, check_in, check_out' });

    if (error) throw error;
  }

  return allBookings.length;
}
