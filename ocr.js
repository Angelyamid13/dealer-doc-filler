/* DealerDoc Filler v2 — driver's license OCR text parser (pure, no DOM).
 * Input: raw text from Tesseract.js run over a US driver's license photo.
 * Output: { name, streetAddress, city, state, zip, dlNo, dob } — only the
 * fields found with reasonable confidence. The caller must still have the
 * user confirm every auto-filled field against the photo. */

const STOP_WORDS = new Set([
  'UTAH','DRIVER','LICENSE','LICENCE','DL','ID','IDENTIFICATION','CARD',
  'CLASS','ENDORSEMENTS','RESTRICTIONS','SEX','HEIGHT','WEIGHT','EYES','HAIR',
  'ISSUED','ISS','EXPIRES','EXP','DUPLICATE','UNDER','UNTIL','AGE',
]);

function cleanToken(s){
  return (s||'').toUpperCase().replace(/[^A-Z0-9 '\-.,#]/g,' ').replace(/\s+/g,' ').trim();
}

function titleCase(s){
  return s.toLowerCase().replace(/(^|[\s\-'])([a-z])/g, (m,p,c)=>p+c.toUpperCase());
}

function normDate(m, d, y){
  m = String(m).padStart(2,'0'); d = String(d).padStart(2,'0');
  if (y.length === 2) y = (Number(y) > 30 ? '19' : '20') + y;
  return `${m}/${d}/${y}`;
}

function plausibleDOB(y){
  y = Number(y.length === 2 ? (Number(y) > 30 ? '19'+y : '20'+y) : y);
  const now = new Date().getFullYear();
  return y >= 1900 && y <= now - 15;
}

function extractDOB(lines){
  const dateRe = /(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/;
  const dobLabel = /DOB|DATE OF BIRTH|BIRTH|BORN/i;
  const notDob = /EXP|ISSUED|ISS\b|UNTIL/i;
  // 1) date on a DOB-labeled line
  for (const ln of lines){
    if (dobLabel.test(ln) && !notDob.test(ln)){
      const m = ln.match(dateRe);
      if (m && plausibleDOB(m[3])) return normDate(m[1], m[2], m[3]);
    }
  }
  // 2) any date on a line that is not issue/expiry
  for (const ln of lines){
    if (notDob.test(ln)) continue;
    const m = ln.match(dateRe);
    if (m && plausibleDOB(m[3])) return normDate(m[1], m[2], m[3]);
  }
  return null;
}

function extractDLNo(lines){
  // AAMVA "4d" field or an explicit DL-number label line
  for (const ln of lines){
    const m4d = ln.match(/^4D\s*[:\-]?\s*([A-Z0-9]{4,12})/i);
    if (m4d) return m4d[1].toUpperCase();
    if (/D\s*L\s*(NO|NUMBER|#)|LICEN[SC]E\s*(NO|NUMBER)/i.test(ln)){
      // longest alphanumeric token on the line (skips labels)
      const toks = (ln.toUpperCase().match(/[A-Z0-9]{4,}/g) || [])
        .filter(t => !STOP_WORDS.has(t) && !/^(NO|NUMBER)$/.test(t));
      const digits = toks.filter(t => /^\d{5,12}$/.test(t));
      if (digits.length) return digits.sort((a,b)=>b.length-a.length)[0];
      if (toks.length) return toks.sort((a,b)=>b.length-a.length)[0];
    }
  }
  return null;
}

function extractName(lines){
  let family = null, given = null;
  for (const raw of lines){
    const ln = cleanToken(raw);
    let m = ln.match(/^1\s*[:\-]?\s+([A-Z '\-]{2,})$/);
    if (m && !STOP_WORDS.has(m[1].trim())) family = m[1].trim();
    m = ln.match(/^2\s*[:\-]?\s+([A-Z '\-]{2,})$/);
    if (m && !STOP_WORDS.has(m[1].trim())) given = m[1].trim();
    m = ln.match(/\b(?:LN|LAST|FAMILY|SURNAME)\b[:\s]+([A-Z '\-]{2,})/);
    if (m) family = m[1].trim();
    m = ln.match(/\b(?:FN|FIRST|GIVEN)\b[:\s]+([A-Z '\-]{2,})/);
    if (m) given = m[1].trim();
    // "DOE, JOHN" style line
    m = ln.match(/^([A-Z'\-]{2,}),\s*([A-Z][A-Z .'\-]{1,})$/);
    if (m && !family && !given && !STOP_WORDS.has(m[1])){
      family = m[1].trim(); given = m[2].trim();
    }
    // "NAME: DOE, JOHN" / "NAME: JOHN DOE" style line
    m = ln.match(/^NAME\s*[:\-]?\s*(.+)$/);
    if (m && !family && !given){
      const v = m[1].trim();
      const mc = v.match(/^([A-Z'\-]{2,}),\s*([A-Z][A-Z .'\-]{1,})$/);
      if (mc){ family = mc[1].trim(); given = mc[2].trim(); }
      else if (/^[A-Z][A-Z .'\-]{3,}$/.test(v) && !STOP_WORDS.has(v)) given = v;
    }
  }
  const clean = s => s ? titleCase(s.replace(/[^A-Z '\-]/gi,'').trim()) : null;
  family = clean(family); given = clean(given);
  if (given && family) return `${given} ${family}`;
  return given || family || null;
}

function extractAddress(lines){
  let street = null, city = null, state = null, zip = null;
  for (const raw of lines){
    const ln = cleanToken(raw);
    // AAMVA field 8 = address line
    const m8 = ln.match(/^8\s*[:\-]?\s+(.+)$/);
    if (m8 && /\d/.test(m8[1])) street = m8[1].trim();
    // city / state / zip on one line: "SALT LAKE CITY UT 84101"
    const m = ln.match(/^([A-Z][A-Z .'\-]*?)\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
    if (m && !/^(UT|UTAH)$/.test(m[1].trim())){
      city = titleCase(m[1].trim()); state = m[2]; zip = m[3];
    }
  }
  // fallback street: line starting with a house number, containing letters
  if (!street){
    for (const raw of lines){
      const ln = cleanToken(raw);
      if (/^\d{1,6}\s+[A-Z]/.test(ln) && /[A-Z]/.test(ln) && !/^4D\b/.test(ln)){
        street = titleCase(ln); break;
      }
    }
  }
  return { streetAddress: street, city, state, zip };
}

/* Main entry: raw OCR text -> customer fields. */
export function parseLicenseText(rawText){
  const out = {};
  if (!rawText || !rawText.trim()) return out;
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 1);

  const dob = extractDOB(lines);
  if (dob) out.dob = dob;

  const dlNo = extractDLNo(lines);
  if (dlNo) out.dlNo = dlNo;

  const name = extractName(lines);
  if (name) out.name = name;

  const addr = extractAddress(lines);
  if (addr.streetAddress) out.streetAddress = addr.streetAddress;
  if (addr.city) out.city = addr.city;
  if (addr.state) out.state = addr.state;
  if (addr.zip) out.zip = addr.zip;

  return out;
}
