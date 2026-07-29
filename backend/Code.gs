const SHEET_NAME = 'FireTVHomeMessages';
const EVENT_SHEET_NAME = 'FireTVHomeEvents';
const DAD_MESSAGE_SHEET_NAME = 'FireTVHomeDadMessages';
const SPREADSHEET_ID = '1fHph8O83oAL9wC-j8swiMLDo8uYWNb6aL-vSpMvoP-w';

const DAD_MESSAGE_HEADERS = [
  'id',
  'from_name',
  'body',
  'created_at'
];

/* AI narrowing (Talk / communicator "Something to say" mode). The Anthropic
   API key lives in Script Properties as ANTHROPIC_API_KEY, never in the page. */
const AI_MODEL = 'claude-haiku-4-5';
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
    const body = (e.parameter.body || '').trim();

    if (!body) {
      return json_({ ok: false, error: 'Missing body' });
    }

    return json_(addDadMessage_(fromName, body));
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

  return {
    ok: true,
    id,
    opened_at: formatDate_(openedCell.getValue()),
    read_at: formatDate_(readCell.getValue()),
    quick_response_at: formatDate_(responseAtCell.getValue()),
    quick_response: response
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

  return {
    ok: true,
    id,
    opened_at: formatDate_(openedCell.getValue()),
    read_at: formatDate_(readCell.getValue()),
    replied_at: formatDate_(repliedCell.getValue()),
    reply_body: replyBody
  };
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

function addDadMessage_(fromName, body) {
  const sheet = getDadMessageSheet_();
  const headers = getDadHeaderMap_(sheet);
  const row = new Array(sheet.getLastColumn()).fill('');
  const id = Utilities.getUuid();
  const now = new Date();

  row[headers.id - 1] = id;
  row[headers.from_name - 1] = fromName || 'Dad';
  row[headers.body - 1] = body;
  row[headers.created_at - 1] = now;

  sheet.appendRow(row);

  return {
    ok: true,
    id,
    created_at: formatDate_(now)
  };
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

  // Placeholder for personalization. Later: names, relationships, a few notes
  // on how he speaks, so the drafted messages sound like him.
  const PEOPLE_CONTEXT = '';

  const systemPrompt =
    'You are helping a man who cannot speak compose a message to his family, ' +
    'one choice at a time on a television remote (up, down, left, right, and a ' +
    'center button). You are given the choices he has made so far, from broad to ' +
    'specific. He, not you, decides when the message is finished and sends it with ' +
    'the center button. ALWAYS reply by calling the present tool with BOTH of these:\n\n' +
    '- options: up to 3 short next choices (2 to 6 words each) that take the message ' +
    'DEEPER and MORE SPECIFIC. They may narrow the topic, or add to the message (a ' +
    'reason, a memory, a feeling, a detail), or shift its tone. Make them distinct, ' +
    'warm, concrete, and easy to read on a TV.\n' +
    '- draft: a complete, natural first-person message he could send right now, ' +
    'capturing everything chosen so far, in his own plain and sincere voice (one or ' +
    'two sentences). It must read perfectly as-is: NEVER use placeholders, blanks, ' +
    'brackets, or fill-in-the-blank text like "[activity]" or "___". He cannot type, ' +
    'so nothing can be left for him to fill in. If a specific detail (a particular ' +
    'activity, place, or name) has not been chosen yet, keep that part general and ' +
    'natural (for example, "the things I love") instead of leaving a blank, and use ' +
    'the options to let him choose that detail.\n\n' +
    'There is no limit on how deep he can go. Even when the message already feels ' +
    'specific, keep offering finer, meaningful ways to refine or extend it. Never say ' +
    'the message is finished and never stop offering options. Keep it heartfelt and ' +
    'human; avoid flowery or generic filler.\n\n' +
    'Keep the message CUMULATIVE: build on the message so far and never make the draft ' +
    'shorter, more generic, or less detailed than it already is, unless he explicitly ' +
    'chose to shorten or simplify it. Change only what his newest choice calls for.\n\n' +
    'If his most recent choice asks to name, pick, choose, or specify something (for ' +
    'example "Name that favorite drink", "Which memory", "Choose the person"), then your ' +
    'options MUST be concrete, specific instances he can choose from (for a drink: coffee, ' +
    'a cold beer, red wine, iced tea, a favorite soda), never abstract aspects like "what ' +
    'it meant to me". He picks one, and only then does the message name it.' +
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
      ? ('\n\nHe asked for OTHER OPTIONS at this same step. Offer a different set of ' +
         'the SAME KIND as the ones already shown — more alternatives of the same type ' +
         '(for example, if they were specific activities, give MORE specific activities; ' +
         'if they were feelings, give more feelings). Do NOT switch to a different topic ' +
         'or a different kind of choice, and do not repeat or trivially reword these: ' +
         avoidList.join(' | '))
      : '') +
    '\n\nUpdate the draft to reflect his most recent choice, building on the message so ' +
    'far, and propose the next options by calling the present tool.';

  const payload = {
    model: AI_MODEL,
    max_tokens: 700,
    system: systemPrompt,
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

