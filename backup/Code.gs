/**
 * Hall Desk → Google Sheet backup.
 *
 * Copies leads, bookings, payments and attendance from the Hall Desk database into
 * this spreadsheet every hour, and once a day saves a dated copy of the whole
 * spreadsheet in Google Drive (the last 30 are kept). It only reads Hall Desk:
 * editing this sheet never changes the app.
 *
 * Setup: see backup/README.md. In short: paste this file and appsscript.json into
 * Extensions → Apps Script, run setup() once and allow access.
 */

const PROJECT_ID = 'hall-desk-crm';
const DATABASE = 'default';            // the Firestore database name shown in the Firebase console
const TIME_ZONE = 'Asia/Kolkata';
const DAILY_COPIES_TO_KEEP = 30;
const COPY_FOLDER = 'Hall Desk daily backups';

/* ---------- menu and setup ---------- */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Hall Desk')
    .addItem('Back up now', 'backupNow')
    .addItem('Turn on hourly backup', 'setup')
    .addToUi();
}

// Run once: makes the first copy and schedules the hourly copy and the daily snapshot.
function setup() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('backup').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('dailyCopy').timeBased().everyDays(1).atHour(2).inTimezone(TIME_ZONE).create();
  backup();
  try { SpreadsheetApp.getUi().alert('Hourly backup is on. A dated copy is also saved in Drive every night.'); } catch (e) {}
}

function backupNow() {
  backup();
  try { SpreadsheetApp.getActive().toast('Backup finished', 'Hall Desk', 5); } catch (e) {}
}

/* ---------- the hourly copy ---------- */

function backup() {
  const ss = SpreadsheetApp.getActive();
  ss.setSpreadsheetTimeZone(TIME_ZONE);
  const info = [];
  try {
    const leads = readAll('leads'), events = readAll('events'), payments = readAll('payments'),
          contacts = readAll('contacts'), attendance = readAll('attendance');
    const pay = byId(payments), ct = byId(contacts);

    // a booking covers one or more days; its days share `g` (older single days use their own id)
    const groups = {};
    events.forEach(x => (groups[x.g || x.id] = groups[x.g || x.id] || []).push(x));
    Object.values(groups).forEach(ds => ds.sort((a, b) => a.date < b.date ? -1 : 1));

    writeTab(ss, 'Leads',
      ['Name', 'Phone', 'Email', 'Enquiry date', 'Function', 'Wanted date', 'Guests', 'Budget ₹', 'Preferred hall',
       'Source', 'Status', 'Next follow-up', 'Notes', 'Note history', 'Added by', 'Added on'],
      leads.sort((a, b) => (a.at || 0) - (b.at || 0)).map(l => [
        l.name, l.phone, l.email, day(l.enq || dateOf(l.at)), l.type, day(l.date), l.guests || '', l.budget || '',
        l.hall, l.source, l.status, day(l.next), l.notes,
        (l.log || []).map(n => stamp(n.at) + ' ' + n.by + ': ' + n.t).join(' | '),
        l.byName, day(dateOf(l.at))]),
      [4, 6, 12, 16], [8]);

    writeTab(ss, 'Bookings',
      ['Date', 'Day', 'Function', 'Hall', 'Start', 'End', 'Host', 'Guests', 'Residence', 'Phone', 'Email', 'Facility notes', 'Booking ID'],
      events.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : (a.from < b.from ? -1 : 1)).map(x => {
        const g = x.g || x.id, ds = groups[g], c = ct[g] || {};
        return [day(x.date), ds.length > 1 ? (ds.indexOf(x) + 1) + ' of ' + ds.length : '', x.event, x.hall, x.from, x.to,
                x.host, x.guests || '', x.res, c.phone, c.email, x.fac, g];
      }),
      [1], []);

    writeTab(ss, 'Payments',
      ['First day', 'Last day', 'Days', 'Functions', 'Host', 'Phone', 'Total ₹', 'Paid ₹', 'Balance ₹', 'Status', 'Booking ID'],
      Object.keys(groups).map(g => {
        const ds = groups[g], p = pay[g] || {}, total = +p.total || 0, paid = +p.paid || 0, bal = total - paid;
        const st = total && bal <= 0 ? 'Paid' : paid > 0 ? 'Partial' : 'Unpaid';
        return [day(ds[0].date), day(ds[ds.length - 1].date), ds.length, unique(ds.map(d => d.event)).join(', '),
                ds[0].host, (ct[g] || {}).phone, total, paid, bal, st, g];
      }).sort((a, b) => a[0] - b[0]),
      [1, 2], [7, 8, 9]);

    writeTab(ss, 'Attendance',
      ['Date', 'Name', 'In', 'Out', 'Hours'],
      attendance.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : (a.name < b.name ? -1 : 1)).map(a => [
        day(a.date), a.name, time(a.in), time(a.out), a.in && a.out ? Math.round((a.out - a.in) / 36e5 * 10) / 10 : '']),
      [1], []);

    info.push(['Last backup', new Date()], ['Status', 'OK'],
      ['Leads', leads.length], ['Booking days', events.length], ['Bookings', Object.keys(groups).length], ['Attendance records', attendance.length]);
  } catch (e) {
    info.push(['Last attempt', new Date()], ['Status', 'FAILED: ' + e.message],
      ['Note', 'The tabs still hold the last good backup.']);
    console.error(e);
  }
  writeInfo(ss, info);
}

/* ---------- the nightly dated copy ---------- */

function dailyCopy() {
  backup();
  const file = DriveApp.getFileById(SpreadsheetApp.getActive().getId());
  const it = DriveApp.getFoldersByName(COPY_FOLDER);
  const folder = it.hasNext() ? it.next() : DriveApp.createFolder(COPY_FOLDER);
  file.makeCopy('Hall Desk backup ' + Utilities.formatDate(new Date(), TIME_ZONE, 'yyyy-MM-dd'), folder);
  // keep only the newest copies
  const copies = [];
  const files = folder.getFiles();
  while (files.hasNext()) copies.push(files.next());
  copies.sort((a, b) => b.getDateCreated() - a.getDateCreated())
    .slice(DAILY_COPIES_TO_KEEP).forEach(f => f.setTrashed(true));
}

/* ---------- reading the Hall Desk database ---------- */

// All documents of a top-level collection, as plain objects with their id.
function readAll(collection) {
  const base = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/' + DATABASE + '/documents/' + collection;
  const out = [];
  let token = '';
  do {
    const res = UrlFetchApp.fetch(base + '?pageSize=300' + (token ? '&pageToken=' + encodeURIComponent(token) : ''), {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'x-goog-user-project': PROJECT_ID },
      muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) throw new Error(collection + ': ' + res.getResponseCode() + ' ' + res.getContentText().slice(0, 300));
    const body = JSON.parse(res.getContentText());
    (body.documents || []).forEach(d => {
      const o = fromFields(d.fields || {});
      o.id = d.name.split('/').pop();
      out.push(o);
    });
    token = body.nextPageToken || '';
  } while (token);
  return out;
}

function fromFields(f) {
  const o = {};
  Object.keys(f).forEach(k => o[k] = fromValue(f[k]));
  return o;
}

function fromValue(v) {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return new Date(v.timestampValue).getTime();
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromValue);
  if ('mapValue' in v) return fromFields(v.mapValue.fields || {});
  return '';
}

/* ---------- writing the sheet ---------- */

// Replaces a tab's contents. dateCols / moneyCols are 1-based column numbers to format.
function writeTab(ss, name, header, rows, dateCols, moneyCols) {
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.clearContents();
  const data = [header].concat(rows.map(r => r.map(c => c === undefined || c === null ? '' : c)));
  sh.getRange(1, 1, data.length, header.length).setValues(data);
  sh.getRange(1, 1, 1, header.length).setFontWeight('bold');
  sh.setFrozenRows(1);
  if (rows.length) {
    dateCols.forEach(c => sh.getRange(2, c, rows.length, 1).setNumberFormat('dd/mm/yyyy'));
    moneyCols.forEach(c => sh.getRange(2, c, rows.length, 1).setNumberFormat('[$₹]#,##,##0'));
  }
}

function writeInfo(ss, info) {
  const sh = ss.getSheetByName('Backup info') || ss.insertSheet('Backup info', 0);
  sh.clearContents();
  sh.getRange(1, 1, 1, 2).setValues([['Hall Desk backup', 'Copied from the app every hour. Editing this sheet does not change the app.']]).setFontWeight('bold');
  if (info.length) sh.getRange(2, 1, info.length, 2).setValues(info);
  sh.getRange(2, 2).setNumberFormat('dd/mm/yyyy hh:mm am/pm');
  sh.autoResizeColumns(1, 2);
}

/* ---------- small helpers ---------- */

const byId = list => { const m = {}; list.forEach(x => m[x.id] = x); return m; };
const unique = a => a.filter((x, i) => x && a.indexOf(x) === i);
// 'YYYY-MM-DD' → a real date in the sheet (so it sorts and filters properly)
const day = k => { if (!k || typeof k !== 'string') return ''; const p = k.split('-'); return p.length === 3 ? new Date(+p[0], +p[1] - 1, +p[2]) : k; };
const dateOf = ms => ms ? Utilities.formatDate(new Date(ms), TIME_ZONE, 'yyyy-MM-dd') : '';
const time = ms => ms ? Utilities.formatDate(new Date(ms), TIME_ZONE, 'hh:mm a') : '';
const stamp = ms => ms ? Utilities.formatDate(new Date(ms), TIME_ZONE, 'dd/MM/yyyy hh:mm a') : '';
