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
  console.log(`Starting sync for ${sheetInfo.name}...`);
  const response = await fetch(sheetInfo.url);
  const text = await response.text();
  const jsonStr = text.substring(text.indexOf('(') + 1, text.lastIndexOf(')'));
  const data = JSON.parse(jsonStr);

  const rows = data.table.rows;
  if (!rows || rows.length === 0) {
    console.warn(`No rows found in ${sheetInfo.name}`);
    return [];
  }

  // Debug: Log the first few cells of the header row to verify structure
  console.log(`Header row sample:`, rows[0].c.slice(0, 10).map(c => c?.v));

  const dateMap = [];
  const headerRow = rows[0].c;

  let currentMonth = sheetInfo.startMonth;
  let currentYear = sheetInfo.startYear;

  for (let j = 1; j < headerRow.length; j++) {
    let dayVal = headerRow[j]?.v;

    // Convert to number if it's a string
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
    const row = rows[i].c;
    if (!row || !row[0]?.v) continue;

    const roomNumber = row[0].v.toString().trim();
    // Improved room number filter: allow things like "101G" but skip headers
    if (roomNumber.toLowerCase().includes('chambre') || roomNumber === "1") continue;

    let activeBooking = null;

    for (let j = 1; j < row.length; j++) {
      const cellValue = row[j]?.v;
      const currentDate = dateMap[j];

      if (!currentDate) continue;

      if (cellValue && cellValue.toString().trim().length > 0) {
        const valStr = cellValue.toString().trim();

        // If we have an active booking and content is different, close it
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
      // Find the last available date in dateMap to set as checkOut
      let lastAvailableIdx = dateMap.length - 1;
      while (lastAvailableIdx >= 0 && !dateMap[lastAvailableIdx]) lastAvailableIdx--;

      if (lastAvailableIdx >= 0) {
        activeBooking.checkOut = new Date(dateMap[lastAvailableIdx]);
        activeBooking.checkOut.setDate(activeBooking.checkOut.getDate() + 1);
        bookings.push(finalizeBooking(activeBooking, roomNumber, sheetInfo.name));
      }
    }
  }

  console.log(`Found ${bookings.length} bookings in ${sheetInfo.name}`);
  return bookings;
}

function finalizeBooking(b, room, season) {
  let raw = b.guestName;
  let name = raw;
  let persons = null;
  let notes = [];

  // 1. Remove markers like ">30/4" or "<29/4" or "sp le 23/2"
  const datePattern = /[<>]\s?\d{1,2}\/\d{1,2}(\/\d{2,4})?/g;
  const spPattern = /sp le\s?\d{1,2}\/\d{1,2}(\/\d{2,4})?/gi;

  name = name.replace(datePattern, '').replace(spPattern, '').trim();

  // 2. Extract persons: look for "2P", "2+2", "3 Persons", etc.
  const personPattern = /(\d\s?\+\s?\d|\d+)\s?(P|personnes|pers|pax)?$/i;
  const pMatch = name.match(personPattern);
  if (pMatch) {
    persons = pMatch[1].replace(/\s/g, '');
    name = name.replace(pMatch[0], '').trim();
  }

  // 3. Extract emails or phone numbers into notes
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const phonePattern = /(\+\d{1,3}[- ]?)?\d{10,}/g;

  const emails = name.match(emailPattern);
  const phones = name.match(phonePattern);

  if (emails) {
    notes.push(...emails);
    emails.forEach(e => name = name.replace(e, ''));
  }
  if (phones) {
    notes.push(...phones);
    phones.forEach(p => name = name.replace(p, ''));
  }

  // 4. Final Cleanup
  name = name.replace(/[,;/-]$/, '').trim();
  if (!name) name = "Client";

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
    // Deduplicate precisely
    const uniqueMap = new Map();
    for (const b of allBookings) {
      const key = `${b.room_number}|${b.guest_name}|${b.check_in}|${b.check_out}`;
      uniqueMap.set(key, b);
    }

    const uniqueList = Array.from(uniqueMap.values());
    console.log(`Upserting ${uniqueList.length} unique bookings to Supabase...`);

    const { error } = await supabase
      .from('bookings')
      .upsert(uniqueList, { onConflict: 'room_number, guest_name, check_in, check_out' });

    if (error) {
      console.error('Supabase Upsert Error:', error);
      throw error;
    }
    return uniqueList.length;
  }

  return 0;
}
