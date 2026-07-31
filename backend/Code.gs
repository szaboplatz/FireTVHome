// ============================================================================
//  FireTVHome backend — DEPLOYED VERSION MARKER
//  The string below is what you see here in the editor AND what the live web
//  app returns at  <web-app URL>?action=version  — so you can confirm the TV is
//  running this exact version. Bump it on every deploy-worthy change.
// ============================================================================
const BACKEND_VERSION = '2026-07-31-p19 (get_message for Reply with Talk)';
// ============================================================================

const SHEET_NAME = 'FireTVHomeMessages';
const EVENT_SHEET_NAME = 'FireTVHomeEvents';
const DAD_MESSAGE_SHEET_NAME = 'FireTVHomeDadMessages';
// Living personalization profile for "Something to say" mode (Say mode only).
// A two-column tab: Section | Detail, one true note per row. Read fresh on every
// AI call, so the family can add rows any time with no redeploy. Care mode never
// reads this.
const PROFILE_SHEET_NAME = 'FireTVHomeProfile';
// Family occasions (birthdays / anniversaries) that drive the Home-screen
// reminder. A simple tab: Date | Who | Occasion | Canned. Read fresh on every
// request, so the family can add dates any time with no redeploy. The optional
// Canned column holds ready-to-send lines (newline- or pipe-separated); if it is
// empty the backend supplies sensible defaults.
const DATES_SHEET_NAME = 'FireTVHomeDates';
const DATES_HEADERS = ['Date', 'Who', 'Occasion', 'Canned'];
// Email addresses for the people his messages can be sent to. A simple tab:
// Name | Email, where Name matches the recipient captured from the Talk tree
// (e.g. "Sharon", "Betty"). Email may hold several comma-separated addresses
// (e.g. a couple). "SEND BY EMAIL" looks the recipient up here.
const CONTACTS_SHEET_NAME = 'FireTVHomeContacts';
const CONTACTS_HEADERS = ['Name', 'Email'];
// If a message has no known recipient email, it falls back to this address.
// Leave '' to use the account that owns/deploys the script.
const FALLBACK_EMAIL = '';
// Inbound email -> Home Messages. A time trigger runs importGmailReplies(),
// which pulls notes sent to the dedicated Gmail from anyone in Contacts (a reply
// to one of his messages OR a fresh note) onto his Home screen. Imported threads
// get this Gmail label so nothing is pulled in twice; long notes are trimmed.
const IMPORT_LABEL = 'FireTVImported';
const INBOUND_MAX_CHARS = 1500;
// Default reminder window: show an occasion from a day before through this many
// days ahead. Overridable per request with ?lead=NN.
const OCCASION_LEAD_DAYS = 5;
const OCCASION_GRACE_DAYS = 1;
// How many choices deep he must be before Say mode brings in personal profile
// details. With the curated Say tree, the AI is only ever entered at an already-
// specific seeded intent (e.g. "ask Teagan how she is"), so the profile should
// inform it from the very first step. 1 = the first AI screen. Tune freely.
const PROFILE_MIN_DEPTH = 1;
const SPREADSHEET_ID = '1fHph8O83oAL9wC-j8swiMLDo8uYWNb6aL-vSpMvoP-w';

const DAD_MESSAGE_HEADERS = [
  'id',
  'from_name',
  'to_name',
  'body',
  'created_at'
];

const PROFILE_HEADERS = [
  'Section',
  'Detail'
];

/* AI narrowing (Talk / communicator "Something to say" mode). The Anthropic
   API key lives in Script Properties as ANTHROPIC_API_KEY, never in the page. */
// Sonnet follows the layered Say-mode rules far more reliably than Haiku did
// (fewer conflations, cleaner voice/wording). If you ever want to trade quality
// for lower cost/latency, 'claude-haiku-4-5' is the fallback.
const AI_MODEL = 'claude-sonnet-5';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

const MESSAGE_HEADERS = [
  'id',
  'from_name',
  'subject',
  'body',
  'created_at',
  'opened_at',
  'read_at',
  'liked_at',
  'archived_at',
  'replied_at',
  'reply_body',
  'quick_response_at',
  'quick_response'
];

function doGet(e) {
  const action = (e.parameter.action || '').toLowerCase();
  const callback = e.parameter.callback;

  if (action === 'list') {
    return output_(listMessages_(), callback);
  }

  if (action === 'list_status') {
    return output_(listStatus_(), callback);
  }

  if (action === 'log_event') {
    return output_(logEvent_(e.parameter || {}), callback);
  }

  if (action === 'list_events') {
    return output_(listEvents_(e.parameter || {}), callback);
  }

  if (action === 'list_dad_messages') {
    return output_(listDadMessages_(e.parameter || {}), callback);
  }

  if (action === 'narrow') {
    const mode = (e.parameter.mode || 'say').trim();
    let path = [];
    try { path = JSON.parse(e.parameter.path || '[]'); } catch (err) { path = []; }
    if (!Array.isArray(path)) path = [];
    let avoid = [];
    try { avoid = JSON.parse(e.parameter.avoid || '[]'); } catch (err) { avoid = []; }
    if (!Array.isArray(avoid)) avoid = [];
    const draft = String(e.parameter.draft || '');
    return output_(narrow_(mode, path, avoid, draft), callback);
  }

  if (action === 'version') {
    return output_({ ok: true, backend_version: BACKEND_VERSION }, callback);
  }

  if (action === 'occasions') {
    return output_(getOccasions_(e.parameter || {}), callback);
  }

  if (action === 'mark_read') {
    const id = (e.parameter.id || '').trim();
    if (!id) return output_({ ok: false, error: 'Missing id' }, callback);
    return output_(markRead_(id), callback);
  }

  if (action === 'mark_opened') {
    const id = (e.parameter.id || '').trim();
    if (!id) return output_({ ok: false, error: 'Missing id' }, callback);
    return output_(markOpened_(id), callback);
  }

  if (action === 'like_message') {
    const id = (e.parameter.id || '').trim();
    if (!id) return output_({ ok: false, error: 'Missing id' }, callback);
    return output_(likeMessage_(id), callback);
  }

  if (action === 'archive_message') {
    const id = (e.parameter.id || '').trim();
    if (!id) return output_({ ok: false, error: 'Missing id' }, callback);
    return output_(archiveMessage_(id), callback);
  }

  if (action === 'quick_response') {
    const id = (e.parameter.id || '').trim();
    const response = (e.parameter.quick_response || '').trim().toUpperCase();
    if (!id) return output_({ ok: false, error: 'Missing id' }, callback);
    if (response !== 'YES' && response !== 'NO') return output_({ ok: false, error: 'Invalid quick response' }, callback);
    return output_(quickResponse_(id, response), callback);
  }

  if (action === 'get_reply') {
    const id = (e.parameter.id || '').trim();
    if (!id) return output_({ ok: false, error: 'Missing id' }, callback);
    return output_(getReply_(id), callback);
  }

  if (action === 'get_message') {
    const id = (e.parameter.id || '').trim();
    if (!id) return output_({ ok: false, error: 'Missing id' }, callback);
    return output_(getMessage_(id), callback);
  }

  return output_({ ok: false, error: 'Unknown action' }, callback);
}

function doPost(e) {
  const action = ((e.parameter && e.parameter.action) || '').toLowerCase();

  if (action === 'log_event') {
    return json_(logEvent_(e.parameter || {}));
  }

  if (action === 'list_events') {
    return json_(listEvents_(e.parameter || {}));
  }

  if (action === 'mark_read') {
    const id = (e.parameter.id || '').trim();
    if (!id) return json_({ ok: false, error: 'Missing id' });
    return json_(markRead_(id));
  }

  if (action === 'mark_opened') {
    const id = (e.parameter.id || '').trim();
    if (!id) return json_({ ok: false, error: 'Missing id' });
    return json_(markOpened_(id));
  }

  if (action === 'like_message') {
    const id = (e.parameter.id || '').trim();
    if (!id) return json_({ ok: false, error: 'Missing id' });
    return json_(likeMessage_(id));
  }

  if (action === 'archive_message') {
    const id = (e.parameter.id || '').trim();
    if (!id) return json_({ ok: false, error: 'Missing id' });
    return json_(archiveMessage_(id));
  }

  if (action === 'quick_response') {
    const id = (e.parameter.id || '').trim();
    const response = (e.parameter.quick_response || '').trim().toUpperCase();
    if (!id) return json_({ ok: false, error: 'Missing id' });
    if (response !== 'YES' && response !== 'NO') return json_({ ok: false, error: 'Invalid quick response' });
    return json_(quickResponse_(id, response));
  }

  if (action === 'add_reply') {
    const id = (e.parameter.id || '').trim();
    const replyBody = (e.parameter.reply_body || '').trim();

    if (!id) return json_({ ok: false, error: 'Missing id' });
    if (!replyBody) return json_({ ok: false, error: 'Missing reply body' });

    return json_(addReply_(id, replyBody));
  }

  if (action === 'add_message') {
    const fromName = (e.parameter.from_name || '').trim();
    const subject = (e.parameter.subject || '').trim();
    const body = (e.parameter.body || '').trim();

    if (!subject || !body) {
      return json_({ ok: false, error: 'Missing subject or body' });
    }

    return json_(addMessage_(fromName, subject, body));
  }

  if (action === 'add_dad_message') {
    const fromName = (e.parameter.from_name || '').trim();
    const toName = (e.parameter.to_name || '').trim();
    const body = (e.parameter.body || '').trim();

    if (!body) {
      return json_({ ok: false, error: 'Missing body' });
    }

    return json_(addDadMessage_(fromName, body, toName));
  }

  if (action === 'send_dad_email') {
    const fromName = (e.parameter.from_name || '').trim();
    const toName = (e.parameter.to_name || '').trim();
    const body = (e.parameter.body || '').trim();

    if (!body) {
      return json_({ ok: false, error: 'Missing body' });
    }

    return json_(sendDadEmail_(fromName, body, toName));
  }

  if (action === 'narrow') {
    const mode = (e.parameter.mode || 'say').trim();
    let path = [];
    try { path = JSON.parse(e.parameter.path || '[]'); } catch (err) { path = []; }
    if (!Array.isArray(path)) path = [];
    let avoid = [];
    try { avoid = JSON.parse(e.parameter.avoid || '[]'); } catch (err) { avoid = []; }
    if (!Array.isArray(avoid)) avoid = [];
    const draft = String(e.parameter.draft || '');
    return json_(narrow_(mode, path, avoid, draft));
  }

  return json_({ ok: false, error: 'Unknown action' });
}

/* ---------- EVENT LOGGING ---------- */

function logEvent_(params) {
  const sheet = getEventSheet_();
  const now = new Date();

  sheet.appendRow([
    now,
    String(params.event_type || ''),
    String(params.event_label || ''),
    String(params.page_version || ''),
    String(params.public_ip || ''),
    String(params.url || ''),
    String(params.device_info || ''),
    String(params.extra || '')
  ]);

  return {
    ok: true,
    logged_at: formatDate_(now)
  };
}

function listEvents_(params) {
  const sheet = getEventSheet_();
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow < 2) {
    return { ok: true, events: [] };
  }

  const limit = Math.min(Math.max(parseInt(params.limit || '100', 10) || 100, 1), 1000);
  const eventTypeFilter = String(params.event_type || '').trim();

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const startRow = Math.max(2, lastRow - limit + 1);
  const numRows = lastRow - startRow + 1;
  const rows = sheet.getRange(startRow, 1, numRows, lastCol).getValues();

  let events = rows.map(row => {
    const obj = {};
    headers.forEach((header, i) => {
      obj[String(header || '').trim()] = row[i];
    });

    return {
      timestamp: formatDate_(obj.timestamp),
      event_type: String(obj.event_type || ''),
      event_label: String(obj.event_label || ''),
      page_version: String(obj.page_version || ''),
      public_ip: String(obj.public_ip || ''),
      url: String(obj.url || ''),
      device_info: String(obj.device_info || ''),
      extra: String(obj.extra || '')
    };
  });

  if (eventTypeFilter) {
    events = events.filter(event => event.event_type === eventTypeFilter);
  }

  events.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

  return {
    ok: true,
    events
  };
}

function getEventSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(EVENT_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(EVENT_SHEET_NAME);
  }

  ensureEventHeaders_(sheet);
  return sheet;
}

function ensureEventHeaders_(sheet) {
  const headers = [
    'timestamp',
    'event_type',
    'event_label',
    'page_version',
    'public_ip',
    'url',
    'device_info',
    'extra'
  ];

  const lastCol = sheet.getLastColumn();

  if (sheet.getLastRow() === 0 || lastCol === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return;
  }

  const current = sheet.getRange(1, 1, 1, Math.max(lastCol, headers.length)).getValues()[0];
  const hasAnyHeader = current.some(value => String(value || '').trim());

  if (!hasAnyHeader) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return;
  }

  headers.forEach((header, index) => {
    const currentValue = String(current[index] || '').trim();
    if (!currentValue) {
      sheet.getRange(1, index + 1).setValue(header);
    }
  });

  sheet.setFrozenRows(1);
}

/* ---------- MESSAGE FUNCTIONS ---------- */

function listMessages_() {
  const rows = getMessageObjects_();

  const messages = rows
    .filter(msg => msg.id && !msg.archived_at)
    .sort(sortMessages_);

  return { ok: true, messages };
}

function listStatus_() {
  const rows = getMessageObjects_();

  const messages = rows
    .filter(msg => msg.id)
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .map(msg => ({
      id: msg.id,
      from_name: msg.from_name,
      subject: msg.subject,
      created_at: msg.created_at,
      opened_at: msg.opened_at,
      read_at: msg.read_at,
      liked_at: msg.liked_at,
      archived_at: msg.archived_at,
      replied_at: msg.replied_at,
      reply_body: msg.reply_body,
      quick_response_at: msg.quick_response_at,
      quick_response: msg.quick_response
    }));

  return { ok: true, messages };
}

function getReply_(id) {
  const row = findRowById_(id);
  if (!row) return { ok: false, error: 'Message not found' };

  const headers = getHeaderMap_(row.sheet);
  const values = row.sheet.getRange(row.rowNumber, 1, 1, row.sheet.getLastColumn()).getValues()[0];
  const replyBody = String(values[(headers.reply_body || 0) - 1] || '');
  const repliedAt = values[(headers.replied_at || 0) - 1];

  return {
    ok: true,
    id,
    replied_at: formatDate_(repliedAt),
    reply_body: replyBody
  };
}

// One message's sender + text, for the Talk composer to seed a reply with the
// original note as context (reached via ?action=get_message&id=...).
function getMessage_(id) {
  const row = findRowById_(id);
  if (!row) return { ok: false, error: 'Message not found' };
  const headers = getHeaderMap_(row.sheet);
  const vals = row.sheet.getRange(row.rowNumber, 1, 1, row.sheet.getLastColumn()).getValues()[0];
  const get = function (name) { return headers[name] ? String(vals[headers[name] - 1] || '') : ''; };
  return {
    ok: true,
    id: id,
    from_name: get('from_name'),
    subject: get('subject'),
    body: get('body'),
    created_at: headers.created_at ? formatDate_(vals[headers.created_at - 1]) : ''
  };
}

function getMessageObjects_() {
  const sheet = getSheet_();
  ensureMessageHeaders_(sheet);

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow < 2) {
    return [];
  }

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  return rows.map(row => {
    const obj = {};
    headers.forEach((header, i) => {
      obj[String(header || '').trim()] = row[i];
    });

    return {
      id: String(obj.id || ''),
      from_name: String(obj.from_name || ''),
      subject: String(obj.subject || ''),
      body: String(obj.body || ''),
      created_at: formatDate_(obj.created_at),
      opened_at: formatDate_(obj.opened_at),
      read_at: formatDate_(obj.read_at),
      liked_at: formatDate_(obj.liked_at),
      archived_at: formatDate_(obj.archived_at),
      replied_at: formatDate_(obj.replied_at),
      reply_body: String(obj.reply_body || ''),
      quick_response_at: formatDate_(obj.quick_response_at),
      quick_response: String(obj.quick_response || '')
    };
  });
}

function sortMessages_(a, b) {
  const aUnread = !a.read_at;
  const bUnread = !b.read_at;
  if (aUnread !== bUnread) return aUnread ? -1 : 1;

  const aUnopened = !a.opened_at;
  const bUnopened = !b.opened_at;
  if (aUnopened !== bUnopened) return aUnopened ? -1 : 1;

  return new Date(b.created_at || 0) - new Date(a.created_at || 0);
}

function markRead_(id) {
  const row = findRowById_(id);
  if (!row) return { ok: false, error: 'Message not found' };

  const headers = getHeaderMap_(row.sheet);
  const readCol = headers.read_at;
  const readCell = row.sheet.getRange(row.rowNumber, readCol);

  if (!readCell.getValue()) {
    readCell.setValue(new Date());
  }

  return {
    ok: true,
    id,
    read_at: formatDate_(readCell.getValue())
  };
}

function markOpened_(id) {
  const row = findRowById_(id);
  if (!row) return { ok: false, error: 'Message not found' };

  const headers = getHeaderMap_(row.sheet);
  const openedCol = headers.opened_at;
  const openedCell = row.sheet.getRange(row.rowNumber, openedCol);

  if (!openedCell.getValue()) {
    openedCell.setValue(new Date());
  }

  return {
    ok: true,
    id,
    opened_at: formatDate_(openedCell.getValue())
  };
}

function likeMessage_(id) {
  const row = findRowById_(id);
  if (!row) return { ok: false, error: 'Message not found' };

  const headers = getHeaderMap_(row.sheet);
  const now = new Date();
  const openedCell = row.sheet.getRange(row.rowNumber, headers.opened_at);
  const readCell = row.sheet.getRange(row.rowNumber, headers.read_at);
  const likedCell = row.sheet.getRange(row.rowNumber, headers.liked_at);

  if (!openedCell.getValue()) openedCell.setValue(now);
  if (!readCell.getValue()) readCell.setValue(now);
  if (!likedCell.getValue()) likedCell.setValue(now);

  return {
    ok: true,
    id,
    opened_at: formatDate_(openedCell.getValue()),
    read_at: formatDate_(readCell.getValue()),
    liked_at: formatDate_(likedCell.getValue())
  };
}


function quickResponse_(id, response) {
  const row = findRowById_(id);
  if (!row) return { ok: false, error: 'Message not found' };

  const headers = getHeaderMap_(row.sheet);
  const now = new Date();
  const openedCell = row.sheet.getRange(row.rowNumber, headers.opened_at);
  const readCell = row.sheet.getRange(row.rowNumber, headers.read_at);
  const responseAtCell = row.sheet.getRange(row.rowNumber, headers.quick_response_at);
  const responseCell = row.sheet.getRange(row.rowNumber, headers.quick_response);

  if (!openedCell.getValue()) openedCell.setValue(now);
  if (!readCell.getValue()) readCell.setValue(now);
  responseAtCell.setValue(now);
  responseCell.setValue(response);

  // Phase 2: send the YES/NO back to a known sender, quoting their note so the
  // bare answer makes sense on its own.
  const fromName = String(row.sheet.getRange(row.rowNumber, headers.from_name).getValue() || '');
  const origBody = String(row.sheet.getRange(row.rowNumber, headers.body).getValue() || '');
  const replyText = (origBody ? ('In reply to your note:\n"' + snippet_(origBody, 200) + '"\n\n') : '') +
    'Dad\'s answer: ' + response;
  const sent = emailReplyToSender_(fromName, replyText, 'quick');

  return {
    ok: true,
    id,
    opened_at: formatDate_(openedCell.getValue()),
    read_at: formatDate_(readCell.getValue()),
    quick_response_at: formatDate_(responseAtCell.getValue()),
    quick_response: response,
    to_name: fromName,
    emailed: sent.emailed,
    matched: sent.matched
  };
}

function archiveMessage_(id) {
  const row = findRowById_(id);
  if (!row) return { ok: false, error: 'Message not found' };

  const headers = getHeaderMap_(row.sheet);
  const archivedCell = row.sheet.getRange(row.rowNumber, headers.archived_at);

  if (!archivedCell.getValue()) {
    archivedCell.setValue(new Date());
  }

  return {
    ok: true,
    id,
    archived_at: formatDate_(archivedCell.getValue())
  };
}

function addReply_(id, replyBody) {
  const row = findRowById_(id);
  if (!row) return { ok: false, error: 'Message not found' };

  const headers = getHeaderMap_(row.sheet);
  const now = new Date();
  const repliedCell = row.sheet.getRange(row.rowNumber, headers.replied_at);
  const replyBodyCell = row.sheet.getRange(row.rowNumber, headers.reply_body);
  const openedCell = row.sheet.getRange(row.rowNumber, headers.opened_at);
  const readCell = row.sheet.getRange(row.rowNumber, headers.read_at);

  if (!openedCell.getValue()) openedCell.setValue(now);
  if (!readCell.getValue()) readCell.setValue(now);
  repliedCell.setValue(now);
  replyBodyCell.setValue(replyBody);

  // Phase 2: send his reply back to whoever the message came from, if that
  // person is a known contact. The sheet write above is the record either way.
  const fromName = String(row.sheet.getRange(row.rowNumber, headers.from_name).getValue() || '');
  const sent = emailReplyToSender_(fromName, replyBody, 'reply');

  return {
    ok: true,
    id,
    opened_at: formatDate_(openedCell.getValue()),
    read_at: formatDate_(readCell.getValue()),
    replied_at: formatDate_(repliedCell.getValue()),
    reply_body: replyBody,
    to_name: fromName,
    emailed: sent.emailed,
    matched: sent.matched
  };
}

// Send Dad's reply back out to the person a Home message came from, when that
// person is a known contact (contacts-only). Reuses the mail path; best-effort,
// and never blocks the sheet record. Returns { emailed, matched, target }.
function emailReplyToSender_(fromName, replyText, kind) {
  const who = String(fromName || '').trim();
  const email = who ? firstAddress_(getContactEmail_(who)) : '';
  let emailed = false, error = '';

  if (email) {
    try {
      MailApp.sendEmail(
        email,
        'A reply from Dad (via his Fire TV)',
        String(replyText || '') + '\n\n—\nSent from Dad\'s Fire TV communicator.'
      );
      emailed = true;
    } catch (e) {
      error = String((e && e.message) || e);
    }
  } else {
    error = who ? ('No contact email for "' + who + '"') : 'No sender name on the message';
  }

  try {
    logEvent_({
      event_type: 'reply_email',
      event_label: (emailed
        ? 'REPLY SENT to ' + who + ' <' + email + '>'
        : 'REPLY NOT EMAILED to ' + (who || '(unknown)') + ' — ' + error) + (kind ? ' [' + kind + ']' : ''),
      page_version: 'backend ' + BACKEND_VERSION,
      extra: JSON.stringify({ to: who, matched: !!email, emailed: emailed, kind: kind || '', error: error })
    });
  } catch (e) { /* logging is best-effort */ }

  return { emailed: emailed, matched: !!email, target: email, error: error };
}

// Collapse whitespace and cap a string for use as a short quoted reference.
function snippet_(s, n) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? (t.slice(0, n).trim() + '…') : t;
}

function addMessage_(fromName, subject, body) {
  const sheet = getSheet_();
  ensureMessageHeaders_(sheet);

  const headers = getHeaderMap_(sheet);
  const row = new Array(sheet.getLastColumn()).fill('');
  const id = Utilities.getUuid();
  const now = new Date();

  row[headers.id - 1] = id;
  row[headers.from_name - 1] = fromName;
  row[headers.subject - 1] = subject;
  row[headers.body - 1] = body;
  row[headers.created_at - 1] = now;

  sheet.appendRow(row);

  return {
    ok: true,
    id,
    created_at: formatDate_(now)
  };
}

function findRowById_(id) {
  const sheet = getSheet_();
  ensureMessageHeaders_(sheet);

  const headers = getHeaderMap_(sheet);
  const idCol = headers.id;
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return null;

  const values = sheet.getRange(2, idCol, lastRow - 1, 1).getValues();

  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === id) {
      return {
        sheet,
        rowNumber: i + 2
      };
    }
  }

  return null;
}

function getSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    throw new Error(`Sheet "${SHEET_NAME}" not found`);
  }

  ensureMessageHeaders_(sheet);
  return sheet;
}

function ensureMessageHeaders_(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), MESSAGE_HEADERS.length);

  if (sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) {
    sheet.getRange(1, 1, 1, MESSAGE_HEADERS.length).setValues([MESSAGE_HEADERS]);
    sheet.setFrozenRows(1);
    return;
  }

  const current = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const currentNames = current.map(value => String(value || '').trim());

  MESSAGE_HEADERS.forEach(header => {
    if (!currentNames.includes(header)) {
      const appendCol = sheet.getLastColumn() + 1;
      sheet.getRange(1, appendCol).setValue(header);
      currentNames.push(header);
    }
  });

  sheet.setFrozenRows(1);
}

function getHeaderMap_(sheet) {
  ensureMessageHeaders_(sheet);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const map = {};

  headers.forEach((header, index) => {
    const name = String(header || '').trim();
    if (name) map[name] = index + 1;
  });

  return map;
}

/* ---------- DAD MESSAGE FUNCTIONS (composed on the TV, sent to family) ---------- */

function addDadMessage_(fromName, body, toName) {
  const sheet = getDadMessageSheet_();
  const headers = getDadHeaderMap_(sheet);
  const row = new Array(sheet.getLastColumn()).fill('');
  const id = Utilities.getUuid();
  const now = new Date();

  row[headers.id - 1] = id;
  row[headers.from_name - 1] = fromName || 'Dad';
  if (headers.to_name) row[headers.to_name - 1] = toName || '';
  row[headers.body - 1] = body;
  row[headers.created_at - 1] = now;

  sheet.appendRow(row);

  return {
    ok: true,
    id,
    created_at: formatDate_(now)
  };
}

// Record the message on the family page (durable copy) AND email it to the
// recipient looked up in the Contacts tab. Recording happens first so a message
// is never lost even if the email step fails.
function sendDadEmail_(fromName, body, toName) {
  const rec = addDadMessage_(fromName, body, toName);

  const email = getContactEmail_(toName);
  const target = email || fallbackEmail_();
  let emailed = false;
  let error = '';

  if (target) {
    try {
      MailApp.sendEmail(
        target,
        'A message from Dad (via his Fire TV)',
        body + '\n\n—\nSent from Dad\'s Fire TV communicator.'
      );
      emailed = true;
    } catch (e) {
      error = String((e && e.message) || e);
    }
  } else {
    error = 'No recipient email and no fallback';
  }

  // Record an event so the log shows an email went out and exactly who it went
  // to (or why it didn't). Never let a logging hiccup break the send.
  try {
    const who = String(toName || '').trim() || '(none)';
    const label = emailed
      ? (email ? ('EMAIL SENT to ' + who + ' <' + target + '>')
               : ('EMAIL SENT to fallback <' + target + '> — no contact for "' + who + '"'))
      : ('NOT EMAILED to ' + who + ' — ' + (error || 'unknown'));
    logEvent_({
      event_type: 'dad_email',
      event_label: label,
      page_version: 'backend ' + BACKEND_VERSION,
      extra: JSON.stringify({
        to_name: who, matched: !!email, emailed: emailed,
        target: target || '', message_id: rec.id, error: error || ''
      })
    });
  } catch (e) { /* logging is best-effort */ }

  return {
    ok: true,
    id: rec.id,
    created_at: rec.created_at,
    emailed: emailed,
    matched: !!email,
    error: error
  };
}

function fallbackEmail_() {
  if (FALLBACK_EMAIL) return FALLBACK_EMAIL;
  try { return Session.getEffectiveUser().getEmail() || ''; } catch (e) { return ''; }
}

// Look up an email for a recipient name (case-insensitive). The Email cell may
// hold several addresses separated by commas or semicolons (e.g. a couple).
function getContactEmail_(name) {
  const want = String(name || '').trim().toLowerCase();
  if (!want) return '';

  let sheet;
  try { sheet = getContactsSheet_(); } catch (e) { return ''; }

  const lastRow = sheet.getLastRow();
  const lastCol = Math.max(sheet.getLastColumn(), CONTACTS_HEADERS.length);
  if (lastRow < 2) return '';

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(function (h) { return String(h || '').trim().toLowerCase(); });
  let nameCol = headers.indexOf('name');
  let emailCol = headers.indexOf('email');
  if (nameCol === -1) nameCol = 0;
  if (emailCol === -1) emailCol = 1;

  const rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][nameCol] || '').trim().toLowerCase() === want) {
      return String(rows[i][emailCol] || '').trim().replace(/;/g, ',');
    }
  }
  return '';
}

function getContactsSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(CONTACTS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONTACTS_SHEET_NAME);
    sheet.getRange(1, 1, 1, CONTACTS_HEADERS.length).setValues([CONTACTS_HEADERS]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/* ---------- INBOUND EMAIL -> HOME MESSAGES (Phase 1) ----------
   People reply to (or freshly email) the dedicated Gmail; this pulls those notes
   onto his Home screen as ordinary Messages. Safety rail: ONLY addresses in the
   Contacts tab are ever ingested — spam, marketing, and strangers are ignored.
   Run manually from the editor to test, and on a time trigger (every ~10 min)
   in production. Needs the Gmail scope https://mail.google.com/ in the manifest. */
function importGmailReplies() {
  const emailToName = contactEmailToName_();
  if (!Object.keys(emailToName).length) {
    Logger.log('No contacts with emails on file — nothing can be matched yet.');
    return { ok: true, imported: 0 };
  }

  let label = GmailApp.getUserLabelByName(IMPORT_LABEL);
  if (!label) label = GmailApp.createLabel(IMPORT_LABEL);

  // Unread = not yet imported. Scope to the last two weeks so old mail is left
  // alone. Marking each imported message read is the per-message dedup.
  const threads = GmailApp.search('is:unread in:inbox newer_than:14d', 0, 50);
  let imported = 0;

  threads.forEach(function (thread) {
    let importedFromThread = 0;
    thread.getMessages().forEach(function (m) {
      if (!m.isUnread()) return;                       // already handled
      const addr = extractEmailAddress_(m.getFrom());
      const name = emailToName[addr];
      if (!name) return;                               // not a known contact -> leave it
      const body = cleanIncomingBody_(m.getPlainBody());
      m.markRead();                                    // don't reconsider this message
      if (!body) return;                               // nothing but quotes/signature
      // Friendly title: keep a real subject if the sender wrote one; otherwise
      // say who it's from and whether it's a reply or a fresh note.
      const rawSubject = m.getSubject();
      const isReply = /^\s*(re|fwd|fw)\s*:/i.test(String(rawSubject || ''));
      let subject = tidySubject_(rawSubject);
      if (subject === 'A note for you') subject = name + (isReply ? ' wrote back' : ' sent a note');
      addMessage_(name, subject, body);
      importedFromThread++;
      imported++;
      try {
        logEvent_({
          event_type: 'inbound_email',
          event_label: 'From ' + name + (subject ? (': ' + subject) : ''),
          page_version: 'backend ' + BACKEND_VERSION,
          extra: JSON.stringify({ from: name, address: addr })
        });
      } catch (e) { /* logging is best-effort */ }
    });
    if (importedFromThread) { try { thread.addLabel(label); } catch (e) {} }
  });

  Logger.log('Imported ' + imported + ' message(s) onto the Home screen.');
  return { ok: true, imported: imported };
}

// Reverse of the Contacts tab: every address (a row may list several) -> its
// display Name, lowercased for matching. First name wins on a duplicate address.
function contactEmailToName_() {
  const out = {};
  let sheet;
  try { sheet = getContactsSheet_(); } catch (e) { return out; }
  const lastRow = sheet.getLastRow();
  const lastCol = Math.max(sheet.getLastColumn(), CONTACTS_HEADERS.length);
  if (lastRow < 2) return out;

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(function (h) { return String(h || '').trim().toLowerCase(); });
  let nameCol = headers.indexOf('name');
  let emailCol = headers.indexOf('email');
  if (nameCol === -1) nameCol = 0;
  if (emailCol === -1) emailCol = 1;

  const rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  rows.forEach(function (r) {
    const name = String(r[nameCol] || '').trim();
    if (!name) return;
    String(r[emailCol] || '').replace(/;/g, ',').split(',').forEach(function (e) {
      const a = e.trim().toLowerCase();
      if (a && !out[a]) out[a] = name;
    });
  });
  return out;
}

// "Betty Sabo <bettysabo@gmail.com>" -> "bettysabo@gmail.com" (lowercased).
function extractEmailAddress_(from) {
  const s = String(from || '');
  const m = s.match(/<([^>]+)>/);
  return (m ? m[1] : s).trim().toLowerCase();
}

// Drop the "Re:"/"Fwd:" noise, and our own outbound subject (meaningless as a
// heading to him), so the card shows something friendly.
function tidySubject_(subject) {
  let s = String(subject || '').replace(/^\s*((re|fwd|fw)\s*:\s*)+/i, '').trim();
  if (!s || /message from dad/i.test(s)) s = 'A note for you';
  return s;
}

// Reduce a raw email to just the new text: stop at the quoted original / reply
// headers, drop quoted (">") lines and our own footer, and cap the length.
function cleanIncomingBody_(plain) {
  const lines = String(plain || '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*On .+wrote:\s*$/.test(line)) break;               // "On <date>, X wrote:"
    if (/^\s*-{2,}\s*Original Message\s*-{2,}/i.test(line)) break;
    if (/^\s*_{5,}\s*$/.test(line)) break;                     // Outlook divider
    if (i > 0 && /^\s*From:\s.+/.test(line)) break;            // forwarded header block
    if (/^\s*--\s*$/.test(line)) break;                        // signature delimiter
    if (/^\s*>/.test(line)) continue;                          // quoted line
    if (/Sent from Dad'?s Fire TV communicator/i.test(line)) continue;
    out.push(line);
  }
  let cleaned = out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  if (cleaned.length > INBOUND_MAX_CHARS) cleaned = cleaned.slice(0, INBOUND_MAX_CHARS).trim() + '…';
  return cleaned;
}

function listDadMessages_(params) {
  const sheet = getDadMessageSheet_();
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow < 2) {
    return { ok: true, messages: [] };
  }

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  let messages = rows.map(row => {
    const obj = {};
    headers.forEach((header, i) => {
      obj[String(header || '').trim()] = row[i];
    });

    return {
      id: String(obj.id || ''),
      from_name: String(obj.from_name || ''),
      to_name: String(obj.to_name || ''),
      body: String(obj.body || ''),
      created_at: formatDate_(obj.created_at)
    };
  }).filter(msg => msg.id);

  messages.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  const limit = Math.min(Math.max(parseInt(params.limit || '200', 10) || 200, 1), 1000);
  if (messages.length > limit) messages = messages.slice(0, limit);

  return { ok: true, messages };
}

function getDadMessageSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(DAD_MESSAGE_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(DAD_MESSAGE_SHEET_NAME);
  }

  ensureDadMessageHeaders_(sheet);
  return sheet;
}

function ensureDadMessageHeaders_(sheet) {
  if (sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) {
    sheet.getRange(1, 1, 1, DAD_MESSAGE_HEADERS.length).setValues([DAD_MESSAGE_HEADERS]);
    sheet.setFrozenRows(1);
    return;
  }

  const lastCol = Math.max(sheet.getLastColumn(), DAD_MESSAGE_HEADERS.length);
  const current = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const currentNames = current.map(value => String(value || '').trim());

  DAD_MESSAGE_HEADERS.forEach(header => {
    if (!currentNames.includes(header)) {
      const appendCol = sheet.getLastColumn() + 1;
      sheet.getRange(1, appendCol).setValue(header);
      currentNames.push(header);
    }
  });

  sheet.setFrozenRows(1);
}

function getDadHeaderMap_(sheet) {
  ensureDadMessageHeaders_(sheet);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const map = {};

  headers.forEach((header, index) => {
    const name = String(header || '').trim();
    if (name) map[name] = index + 1;
  });

  return map;
}

/* ---------- PERSONALIZATION PROFILE (Say mode only) ---------- */

// Reads the Profile tab (Section | Detail) live and turns it into a context
// block for the AI. Grouped by Section, in sheet order. Returns '' if the tab
// is missing or has no notes. Runs on every Say-mode call so edits take effect
// immediately with no redeploy.
function getProfileContext_() {
  let sheet;
  try {
    sheet = getProfileSheet_();
  } catch (e) {
    return '';
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 2) return '';

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(function (h) { return String(h || '').trim().toLowerCase(); });
  let sectionCol = headers.indexOf('section');
  let detailCol = headers.indexOf('detail');
  if (sectionCol === -1) sectionCol = 0;
  if (detailCol === -1) detailCol = 1;

  const rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  const order = [];
  const bySection = {};
  rows.forEach(function (row) {
    const section = String(row[sectionCol] || '').trim();
    const detail = String(row[detailCol] || '').trim();
    if (!detail) return;
    const key = section || 'Notes';
    if (!bySection[key]) {
      bySection[key] = [];
      order.push(key);
    }
    bySection[key].push(detail);
  });

  if (!order.length) return '';

  let block =
    'TRUE FACTS ABOUT THIS MAN, HIS FAMILY, AND HIS VOICE.\n' +
    'Use these real details to offer specific, personal OPTIONS and to word things the way ' +
    'he would. They are background, NOT choices he has made: do not weave these facts into ' +
    'the draft on your own - a fact belongs in the message only once HE has picked it as an ' +
    'option. Prefer real names, places, and things from this list ' +
    'over generic ones. NEVER invent a person, relationship, place, event, or detail that ' +
    'is not listed here, and never state anything about his current health or situation ' +
    'unless it appears here. If you are unsure, keep that part general rather than guessing.\n' +
    '\nSENSITIVE - handle with care. Some facts are included ONLY so you understand his ' +
    'situation and never offer false hope or a tone-deaf choice - especially anything under ' +
    'a section whose name mentions "private", "context only", or "do not repeat", and ' +
    'anything about his prognosis, that he may not improve or go home again, that he is DNR ' +
    'or receiving palliative or comfort care, or that his spirits are low. Let these quietly ' +
    'shape the options so they stay realistic and gentle, but NEVER state, quote, hint at, ' +
    'or ask him to confirm any of them, and NEVER put them into the options or the draft. If ' +
    'HE clearly chooses to bring such a thing up himself, help him say it in his own plain ' +
    'words - but you must never introduce or surface it on your own.\n';

  order.forEach(function (section) {
    block += '\n[' + section + ']\n';
    bySection[section].forEach(function (detail) {
      block += '- ' + detail + '\n';
    });
  });

  return block.trim();
}

function getProfileSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(PROFILE_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(PROFILE_SHEET_NAME);
    sheet.getRange(1, 1, 1, PROFILE_HEADERS.length).setValues([PROFILE_HEADERS]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

// Runnable from the Run dropdown: prints the profile block the AI will see, so
// you can confirm the tab is being read correctly.
function testProfile() {
  const context = getProfileContext_();
  Logger.log(context ? context : '(no profile found — tab missing or empty)');
  return context;
}

/* ---------- FAMILY OCCASIONS (Home-screen reminder) ---------- */

function getDatesSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(DATES_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(DATES_SHEET_NAME);
    sheet.getRange(1, 1, 1, DATES_HEADERS.length).setValues([DATES_HEADERS]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

// Return the family occasions falling inside the reminder window, soonest first.
// Each occasion carries its next date, how many days away it is, a human "when"
// label, how many years (for anniversaries with an origin year), and up to three
// ready-to-send lines. Never throws to the caller — an empty list on any trouble.
function getOccasions_(params) {
  let leadDays = OCCASION_LEAD_DAYS;
  const leadParam = params && params.lead ? parseInt(params.lead, 10) : NaN;
  if (!isNaN(leadParam) && leadParam >= 0 && leadParam <= 366) leadDays = leadParam;

  let sheet;
  try {
    sheet = getDatesSheet_();
  } catch (e) {
    return { ok: true, occasions: [] };
  }

  const lastRow = sheet.getLastRow();
  const lastCol = Math.max(sheet.getLastColumn(), DATES_HEADERS.length);
  if (lastRow < 2) return { ok: true, occasions: [] };

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(function (h) { return String(h || '').trim().toLowerCase(); });
  let dateCol = headers.indexOf('date');
  let whoCol = headers.indexOf('who');
  let occCol = headers.indexOf('occasion');
  let cannedCol = headers.indexOf('canned');
  if (dateCol === -1) dateCol = 0;
  if (whoCol === -1) whoCol = 1;
  if (occCol === -1) occCol = 2;
  if (cannedCol === -1) cannedCol = 3;

  const rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const tz = Session.getScriptTimeZone();
  const now = new Date();
  const todayY = Number(Utilities.formatDate(now, tz, 'yyyy'));
  const todayM = Number(Utilities.formatDate(now, tz, 'MM'));
  const todayD = Number(Utilities.formatDate(now, tz, 'dd'));
  const today = new Date(todayY, todayM - 1, todayD);

  const out = [];
  rows.forEach(function (row) {
    const parts = parseDateParts_(row[dateCol], tz);
    if (!parts) return;

    const parsedWho = splitWho_(row[whoCol]);
    const who = parsedWho.display;       // full name, shown in the reminder
    const greeting = parsedWho.greeting; // preferred name, used inside greetings
    const occ = String(row[occCol] || '').trim();
    if (!who && !occ) return;

    let occDate = new Date(todayY, parts.month - 1, parts.day);
    let daysUntil = Math.round((occDate.getTime() - today.getTime()) / 86400000);
    if (daysUntil < -OCCASION_GRACE_DAYS) {
      occDate = new Date(todayY + 1, parts.month - 1, parts.day);
      daysUntil = Math.round((occDate.getTime() - today.getTime()) / 86400000);
    }
    if (daysUntil < -OCCASION_GRACE_DAYS || daysUntil > leadDays) return;

    let yearsSince = 0;
    if (parts.year && parts.year > 1900 && parts.year < occDate.getFullYear()) {
      yearsSince = occDate.getFullYear() - parts.year;
    }

    let canned = parseCanned_(row[cannedCol]);
    if (!canned.length) canned = defaultOccasionCanned_(greeting, occ, yearsSince);

    out.push({
      id: makeOccasionId_(who, occ, parts.month, parts.day),
      who: who,
      greeting: greeting,
      occasion: occ,
      date: Utilities.formatDate(occDate, tz, 'yyyy-MM-dd'),
      month: parts.month,
      day: parts.day,
      daysUntil: daysUntil,
      yearsSince: yearsSince,
      when: humanWhen_(daysUntil, occDate, tz),
      canned: canned
    });
  });

  out.sort(function (a, b) { return a.daysUntil - b.daysUntil; });
  return { ok: true, occasions: out };
}

// Accept a real Date cell or common text forms (yyyy-mm-dd, mm/dd/yyyy, mm-dd,
// "Aug 15"). Returns { year, month, day } (year 0 when none given) or null.
function parseDateParts_(raw, tz) {
  if (Object.prototype.toString.call(raw) === '[object Date]' && !isNaN(raw.getTime())) {
    return {
      year: Number(Utilities.formatDate(raw, tz, 'yyyy')),
      month: Number(Utilities.formatDate(raw, tz, 'MM')),
      day: Number(Utilities.formatDate(raw, tz, 'dd'))
    };
  }

  const s = String(raw == null ? '' : raw).trim();
  if (!s) return null;

  let m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/);
  if (m) return validParts_(Number(m[1]), Number(m[2]), Number(m[3]));

  m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
  if (m) return validParts_(Number(m[3]), Number(m[1]), Number(m[2]));

  m = s.match(/^(\d{1,2})[-\/.](\d{1,2})$/);
  if (m) return validParts_(0, Number(m[1]), Number(m[2]));

  const d = new Date(s);
  if (!isNaN(d.getTime())) return validParts_(d.getFullYear(), d.getMonth() + 1, d.getDate());

  return null;
}

function validParts_(year, month, day) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year: year, month: month, day: day };
}

// A "Who" cell may carry a preferred greeting name in brackets, e.g.
// "Tom McGuinness [Tom]": the full name is shown in the reminder, but the
// bracketed name is what a generated greeting uses ("Happy birthday, Tom!").
// With no brackets, the greeting name is just the whole value.
function splitWho_(raw) {
  const s = String(raw == null ? '' : raw).trim();
  const m = s.match(/^(.*?)\s*\[([^\]]+)\]\s*$/);
  if (m) {
    const display = m[1].trim();
    const greeting = m[2].trim();
    return { display: display || greeting, greeting: greeting || display };
  }
  return { display: s, greeting: s };
}

function parseCanned_(raw) {
  const s = String(raw == null ? '' : raw).trim();
  if (!s) return [];
  return s.split(/\r?\n|\s*\|\s*/)
    .map(function (x) { return x.trim(); })
    .filter(function (x) { return x; })
    .slice(0, 3);
}

function defaultOccasionCanned_(who, occ, yearsSince) {
  const name = who || 'you';
  const o = String(occ || '').toLowerCase();
  if (o.indexOf('anniv') !== -1) {
    const yrs = yearsSince ? (yearsSince + ' years') : 'so many wonderful years';
    return [
      'Happy anniversary, ' + name + '! Congratulations on ' + yrs + ' together.',
      'Happy anniversary! I love you both and I am so proud of you.',
      'Thinking of you both today. Wishing you a very happy anniversary.'
    ];
  }
  if (o.indexOf('birth') !== -1) {
    return [
      'Happy birthday, ' + name + '! Wishing I could be there to celebrate with you.',
      'Happy birthday! I love you and I am so proud of the person you are.',
      'Have a wonderful birthday, ' + name + '. You mean the world to me.'
    ];
  }
  return [
    'Thinking of you, ' + name + '. Sending my love today.',
    'I love you, ' + name + ', and I am thinking of you.',
    'Wishing you all the best today, ' + name + '.'
  ];
}

function humanWhen_(daysUntil, occDate, tz) {
  if (daysUntil <= 0) return 'Today';
  if (daysUntil === 1) return 'Tomorrow';
  if (daysUntil <= 6) return 'This ' + Utilities.formatDate(occDate, tz, 'EEEE');
  return Utilities.formatDate(occDate, tz, 'EEEE, MMM d');
}

function makeOccasionId_(who, occ, month, day) {
  return (String(who) + '-' + String(occ) + '-' + month + '-' + day)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Runnable from the Run dropdown: prints the occasions the Home page will see.
function testOccasions() {
  const result = getOccasions_({});
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

// Run this from the editor (Run > testEmail) to prove the send actually works.
// It sends a note to a REAL address — your own Contacts row first (Dan), then
// Betty's — because the fallback is intentionally empty (no CC on real
// messages). If the note lands in that inbox, sending works end to end. If it
// throws, the error names exactly what's wrong. (If running it ever pops a
// Google consent screen, approve "Send email as you" — but if it doesn't, the
// permission is already granted.)
function testEmail() {
  const to = firstAddress_(getContactEmail_('Dan'))
          || firstAddress_(getContactEmail_('Betty'))
          || firstAddress_(fallbackEmail_());
  if (!to) {
    Logger.log('No address to test with — add a Dan or Betty row (with an email) to the Contacts tab.');
    return { ok: false, error: 'no address' };
  }
  MailApp.sendEmail(
    to,
    'Fire TV email test',
    'If you are reading this, Dad\'s Fire TV can send email. Backend ' + BACKEND_VERSION
  );
  Logger.log('Test email sent to ' + to);
  return { ok: true, to: to };
}

// First address from a cell that may hold several (comma/semicolon separated).
function firstAddress_(s) {
  return String(s || '').replace(/;/g, ',').split(',')[0].trim();
}

/* ---------- AI NARROWING (Anthropic) ---------- */

// Runnable from the Apps Script editor's Run dropdown (no trailing underscore).
// Calls the AI once and prints the result to the Execution log, so you can see
// exactly what happens without going through the web app.
function testNarrow() {
  const result = narrow_('say', ['About family'], [], '');
  Logger.log(JSON.stringify(result));
  return result;
}

function narrow_(mode, path, avoid, draft) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!apiKey) {
    return { ok: false, error: 'Missing ANTHROPIC_API_KEY' };
  }

  const steps = Array.isArray(path) ? path.map(function (s) { return String(s || ''); }) : [];
  const avoidList = Array.isArray(avoid) ? avoid.map(function (s) { return String(s || ''); }).filter(function (s) { return s; }) : [];
  const draftText = String(draft || '').trim();
  const depth = steps.length;

  // Personalization: real facts about him, his family, and his voice, read live
  // from the Profile tab. Say mode only, and only once he is a little way down the
  // path (depth >= PROFILE_MIN_DEPTH) so the first, broad choices stay general and
  // concrete instead of jumping straight to personal specifics. Empty otherwise.
  const PEOPLE_CONTEXT = (String(mode) === 'say' && depth >= PROFILE_MIN_DEPTH)
    ? getProfileContext_() : '';

  const systemPrompt =
    'You are helping a man who cannot speak BUILD a short message to his family, one ' +
    'choice at a time on a TV remote (up, down, left, right, and a center button). He ' +
    'picks only from the options you give. He decides when it is finished and sends it ' +
    'with the center button. ALWAYS reply by calling the present tool with BOTH:\n\n' +
    '- draft: the message SO FAR, in his own plain first-person voice.\n' +
    '  The draft is ALWAYS the actual message he would send, ready to go as-is - NEVER a ' +
    'description or announcement of what he wants to do. Write "Happy birthday, Betty. I love ' +
    'you." - never "I want to say something to Betty on her birthday." No meta openers like ' +
    '"I want to say...", "I would like to tell you...", or "Here is my message".\n' +
    '  CRITICAL: the draft may contain ONLY what he has actually chosen. Do NOT invent, ' +
    'assume, or add events, feelings, reasons, names, or details he has not picked, and ' +
    'do NOT pad it with extra sentences or emotional colour he did not choose. Start ' +
    'VERY short (even a few ' +
    'words) and let it grow ONLY when a choice adds something. It must read cleanly with ' +
    'no placeholders, blanks, or brackets like "[activity]"; if a detail has not been ' +
    'chosen yet, just leave it out rather than guessing. The personal facts you are given ' +
    'are BACKGROUND - to help you offer good, specific options and to word things the way ' +
    'he would - NOT choices he has made. Never put a specific fact from them (a person, a ' +
    'stock, a place, an amount, an event) into the draft on your own; such a fact belongs ' +
    'in the message only once he has actually picked it as an option. On the first step the ' +
    'draft is just a plain, general version of his intent (for example "How are my finances ' +
    'doing?" - not a breakdown of which stocks he owns).\n' +
    '  NATURAL WORDING: each round, REWRITE the whole draft so it reads as one clean, ' +
    'natural sentence (or two) in his plain voice, with a newly chosen detail folded ' +
    'smoothly in - never tacked on as a separate clause or an explanatory aside. A question ' +
    'stays a single clean question: if he is asking about particular stocks, write "How are ' +
    'my IBM and Tyler stocks doing?", NOT "How are my finances doing? Mostly IBM stock, but ' +
    'I also have Tyler stock." Rewording for natural flow is expected and good; just never ' +
    'drop meaning he has chosen or add meaning he has not.\n' +
    '- options: up to 3 next choices (2 to 6 words each). Each must be a genuinely ' +
    'DIFFERENT direction the message could go next - clearly distinct from one another ' +
    'AND from anything already shown - so that picking one truly narrows toward a single ' +
    'message. Never offer three rewordings of the same idea. Keep them concrete and easy ' +
    'to read on a TV. Every option must be about the CONTENT of the message - what he could ' +
    'SAY next. NEVER offer an option that is an instruction about what to DO with the ' +
    'message: not sending it ("Send this now", "Send now", "Keep it as is and send", "Stop ' +
    'here and send"), not starting over ("Start a new message", "Never mind"), not editing ' +
    'it ("Change this message", "Add something else"), and not picking who to send it to ' +
    '("Add who to send it to", "Send to Sharon too"). Those actions all have their own ' +
    'dedicated buttons and do nothing as options here. Word each option from HIS first-person ' +
    'point of view, the way he would ("my time at AristaCare", "my care", not "his time at ' +
    'AristaCare" or "for him").\n\n' +
    'Move him toward a complete, sendable message quickly and sensibly. Each round must ' +
    'follow naturally from his LAST choice and stay on that thread - never wander to an ' +
    'unrelated topic. Keep the MEANING he has already built: a new choice adds to or refines ' +
    'the message and never drops what he has chosen, unless he explicitly chose to change or ' +
    'shorten it - but you should freely reword the whole draft so it stays natural (keeping ' +
    'the meaning is the rule, not keeping the exact earlier words). He can send now or keep ' +
    'going deeper at any time, so do not pad - keep the message tight and honest to his ' +
    'actual choices.\n\n' +
    'PACING - broad to specific. On his first choice or two, keep the options broad and ' +
    'structural (the general kind of thing he might mean), with no specific personal ' +
    'names, places, or private facts, and keep the draft correspondingly short and ' +
    'general. Bring in specific, personal detail only once the direction is clear and ' +
    'only when it genuinely fits what he is building.\n\n' +
    'If his most recent choice asks to name, pick, choose, or specify something ("Name a ' +
    'favorite drink", "Which person", "Which memory"), your options MUST be concrete ' +
    'instances he can choose from (for a drink: a cold beer, iced tea, a favorite soda), ' +
    'never abstract aspects like "what it meant to me". He picks one, and only then does ' +
    'the draft name it.\n\n' +
    'A message can be something he wants to SAY or a QUESTION he wants to ASK (for ' +
    'example asking about his own recovery, what happens next, or whether something will ' +
    'change for him). When he is heading that way, offer question-shaped options and let ' +
    'the draft be that question in his own voice.\n\n' +
    'ASKING HOW SOMEONE IS. When he is choosing a person to ask after, offer ONLY people ' +
    'listed in his profile under the section "People he keeps up with now" - that is the ' +
    'complete set of people he currently keeps in touch with. Never offer anyone who is not ' +
    'on that list, even if they appear elsewhere in his profile: people from his childhood, ' +
    'old neighborhoods, former jobs, or who have died belong to his memories and stories, ' +
    'NOT to a present-tense "how are you". (If that roster section is not present, offer only ' +
    'his wife, his children, and his grandchildren.) When you offer people to pick from, ' +
    'label each option with JUST the person\'s name (first name, or first and last only if ' +
    'two people would otherwise be confused) - never add a parenthetical, a relationship, a ' +
    'description, or a location: write "Brenda", not "Brenda (Michael\'s wife)"; "Sharon and ' +
    'Terry", not "Sharon and Terry at the lake". And keep a simple greeting simple: ' +
    'do NOT bolt an incidental place, activity, or event onto it (for example "Sharon and ' +
    'Terry at the lake") unless that detail is the actual point of his message. Options for ' +
    'a greeting should be genuinely different DIRECTIONS - how they are, what is new with ' +
    'them, one specific thing to ask them about - not the same hello with a location or ' +
    'activity attached.\n\n' +
    'ONE PERSON AT A TIME. When the message is about one specific person, use ONLY what you ' +
    'know about THAT person. Never borrow another person\'s facts, activities, interests, or ' +
    'places and attach them to someone else. For instance, the Lake Temagami trips and the ' +
    'monthly newsletters belong to Bill Gordon - do NOT offer them when he is writing to Andy ' +
    'or anyone else. If you are running low on things specific to this person, offer plain ' +
    'warm options ("I have been thinking of you", "I hope you are well") rather than inventing ' +
    'details or pulling them from someone else.\n\n' +
    'THINGS HE CAN NO LONGER DO. He cannot eat or drink by mouth and is bedbound on a ' +
    'ventilator. Never offer an option or draft that treats a food, drink, trip, or physical ' +
    'activity he can no longer have as something current or possible - for example do NOT ' +
    'suggest thanking someone for "bringing me Diet Coke", or ask about doing such things now. ' +
    'These can be spoken of only as fond memories if HE steers there, never as the present.\n\n' +
    'MONEY AND HIS LEGACY - keep it in the background. Do NOT, on your own, offer options or ' +
    'a draft about his money running low, the cost of his care, or his savings or ' +
    'inheritance being eaten up by medical bills - not even when he is on a finances topic ' +
    'or a "what is ahead" topic. This worry is real for him but must not be put in front of ' +
    'him. A finances topic is simply about how his investments are doing - his stocks (IBM, ' +
    'Tyler) and the market - and a "my care and the future" topic is about his health, his ' +
    'days, and what to expect, NOT about affording it. Only if he EXPLICITLY steers into that ' +
    'money worry himself may you then help him say it in his own plain words.\n\n' +
    'VOICE AND ADDRESS. Every message is written BY HIM, in his own first-person voice, and ' +
    'spoken DIRECTLY to the person it is for, as if he were talking to them. NEVER phrase it ' +
    'as asking a bystander to relay or pass something along: no "Can you ask Dan...", "Tell ' +
    'Dan...", "Ask him...", "Let her know...". If he is asking Dan something, write it as if ' +
    'speaking straight to Dan - "Dan, how are you doing?" or "Dan, how are my IBM and Tyler ' +
    'stocks doing?" - not "can you ask Dan...". If the message is not aimed at one particular ' +
    'person, write it as his own plain question or statement ("How are my investments ' +
    'doing?") and do NOT invent someone to relay it through.\n\n' +
    'TODAY\'S DATE IS ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'EEEE, MMMM d, yyyy') +
    '. Treat this as the truth about what has and has not happened yet, and get every tense ' +
    'right accordingly. If something in his profile starts or happens on a date that is still ' +
    'in the FUTURE relative to today, it has NOT happened yet: speak of it as upcoming and ' +
    'NEVER ask how it is "going". For example, if a grandchild only begins college, or a ' +
    'sports season only starts, on a date later than today, do NOT ask how school or the ' +
    'season "is going" - ask whether they are excited or ready for it. Only ask how something ' +
    '"is going" once its start date has actually passed. Compare dates carefully before ' +
    'choosing the tense.' +
    (PEOPLE_CONTEXT ? ('\n\n' + PEOPLE_CONTEXT) : '');

  const tool = {
    name: 'present',
    description: 'Present the next options and the running draft to the user.',
    input_schema: {
      type: 'object',
      properties: {
        options: { type: 'array', items: { type: 'string' }, description: 'Up to 3 short next choices that go deeper / more specific.' },
        draft: { type: 'string', description: 'A complete first-person message he could send right now, capturing the choices so far.' }
      },
      required: ['options', 'draft']
    }
  };

  const userText = 'Mode: a message to family.\n' +
    'Message so far: ' + (draftText ? ('"' + draftText + '"') : '(nothing yet)') + '\n' +
    'His choices, broad to specific: ' + (steps.length ? steps.join(' > ') : '(none yet)') +
    (steps.length ? ('\nHis most recent choice: "' + steps[steps.length - 1] + '"') : '') +
    (avoidList.length
      ? ('\n\nHe pressed OTHER OPTIONS: he did not want any of the choices already ' +
         'shown and needs genuinely different ones. Every one of these has ALREADY ' +
         'been shown to him - do NOT include any of them again, and do NOT reword ' +
         'them: ' + avoidList.join(' | ') + '. Give a fresh set: first prefer more ' +
         'options of the same kind that are clearly distinct from every choice listed ' +
         'above; if you have genuinely run out of meaningfully different options of ' +
         'that kind, broaden to a nearby angle rather than repeat. Never output a ' +
         'choice that duplicates or barely rephrases anything in that list.')
      : '') +
    '\n\nUpdate the draft to reflect his most recent choice, building on the message so ' +
    'far, and propose the next options by calling the present tool.';

  // Send the system prompt as a cacheable block. Within one Say-mode session the
  // system prompt (instructions + profile) is byte-identical across rounds, so
  // after the first round the model reads it from cache (~0.1x cost) instead of
  // reprocessing it. Note: Haiku's minimum cacheable prefix is ~4096 tokens, so
  // this only takes effect once the instructions + profile exceed that size
  // (which the profile grows toward as rows are added); below it, it's a no-op.
  const payload = {
    model: AI_MODEL,
    max_tokens: 700,
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
    tools: [tool],
    tool_choice: { type: 'tool', name: 'present' },
    messages: [{ role: 'user', content: userText }]
  };

  let response;
  try {
    response = UrlFetchApp.fetch(ANTHROPIC_URL, {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  } catch (e) {
    return { ok: false, error: 'Request failed: ' + ((e && e.message) ? e.message : String(e)) };
  }

  const code = response.getResponseCode();
  if (code !== 200) {
    return { ok: false, error: 'API error ' + code + ': ' + String(response.getContentText() || '').slice(0, 300) };
  }

  let data;
  try {
    data = JSON.parse(response.getContentText());
  } catch (e) {
    return { ok: false, error: 'Bad response' };
  }

  const blocks = (data && data.content) || [];
  let input = null;
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i] && blocks[i].type === 'tool_use' && blocks[i].name === 'present') {
      input = blocks[i].input;
      break;
    }
  }
  if (!input) {
    return { ok: false, error: 'No structured output' };
  }

  let options = Array.isArray(input.options) ? input.options : [];
  options = options
    .map(function (o) { return String(o || '').trim(); })
    .filter(function (o) { return o; })
    .slice(0, 3);

  const outDraft = String(input.draft || '').trim();

  if (!options.length && !outDraft) {
    return { ok: false, error: 'Empty response' };
  }

  return { ok: true, options: options, draft: outDraft };
}

function formatDate_(value) {
  if (!value) return '';
  const date = new Date(value);
  if (isNaN(date.getTime())) return '';
  return date.toISOString();
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function output_(obj, callback) {
  const text = JSON.stringify(obj);

  if (callback) {
    return ContentService
      .createTextOutput(`${callback}(${text});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(text)
    .setMimeType(ContentService.MimeType.JSON);
}

