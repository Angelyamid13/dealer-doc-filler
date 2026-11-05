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

/* Words that mark a line as a label/field line, never an address or a name. */
const LABEL_WORDS = new Set([
  ...STOP_WORDS,
  'DLN','END','REST','SEX','EYES','HGT','WGT','DOB','LIMITED','TERM','USA',
]);

const STREET_TOKENS = new Set([
  'N','S','E','W','NE','NW','SE','SW',
  'ST','STREET','AVE','AVENUE','BLVD','RD','ROAD','DR','DRIVE','LN','LANE',
  'WAY','CT','COURT','PL','PLACE','HWY','HIGHWAY','CIR','CIRCLE','TRL',
  'TRAIL','PKWY','PLZ','TER','TERRACE','ALLEY','ROW',
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

function extractDLNo(lines, exclude){
  const cleaned = lines.map(cleanToken);
  const skip = new Set(exclude || []);
  const pickToken = (ln)=>{
    const toks = (ln.match(/[A-Z0-9]+/g) || [])
      .filter(t => !/^(DLN|DL|NO|NUMBER|4D)$/.test(t) && !STOP_WORDS.has(t) && !skip.has(t));
    const good = toks.filter(t => t.length >= 6 && t.replace(/\D/g,'').length >= 5);
    return good.length ? good.sort((a,b)=>b.length-a.length)[0] : null;
  };
  // 1) labeled lines: AAMVA "4d", "DLN", "DL NO", "LICENSE NUMBER" — the
  //    number may share the line or sit alone on the next one.
  for (let i = 0; i < cleaned.length; i++){
    const ln = cleaned[i];
    if (/^4D\b/.test(ln) || /\bDLN\b/.test(ln) ||
        /D\s*L\s*(NO|NUMBER|#)/.test(ln) || /LICEN[SC]E\s*(NO|NUMBER)/.test(ln)){
      const t = pickToken(ln);
      if (t) return t;
      if (i + 1 < cleaned.length){
        const nx = cleaned[i + 1].match(/^\d{6,12}$/);
        if (nx && !skip.has(nx[0])) return nx[0];
      }
    }
  }
  // 2) fallback: a standalone digit string. Utah prints the number next to
  //    a small "4d DLN" label that OCR often mangles past recognition,
  //    while the number itself reads clean. Dates and ZIPs can't match:
  //    dates carry separators (multi-token after cleaning) and a ZIP is
  //    only 5 digits / never alone on its line here.
  for (const ln of cleaned){
    const m = ln.match(/^\d{6,12}$/);
    if (m && !skip.has(m[0])) return m[0];
  }
  return null;
}

function plainNameLine(ln){
  // A line that is only name words: 2-4 letter tokens, no digits, no
  // label/header words. Used to recover a name line whose AAMVA field
  // number OCR mangled (e.g. "1" read as punctuation).
  if (/\d/.test(ln) || /LIMITED|TERM/.test(ln)) return null;
  const toks = ln.replace(/[^A-Z '\-]/g,' ').split(' ').filter(t => t.length >= 2);
  if (toks.length < 2 || toks.length > 4) return null;
  if (toks.some(t => STOP_WORDS.has(t))) return null;
  return toks.join(' ');
}

function extractName(lines){
  let family = null, given = null, famIdx = -1, givIdx = -1;
  lines.forEach((raw, i)=>{
    const ln = cleanToken(raw);
    let m = ln.match(/^1\s*[:\-]?\s+([A-Z '\-]{2,})$/);
    if (m && !STOP_WORDS.has(m[1].trim())){ family = m[1].trim(); famIdx = i; }
    m = ln.match(/^2\s*[:\-]?\s+([A-Z '\-]{2,})$/);
    if (m && !STOP_WORDS.has(m[1].trim())){ given = m[1].trim(); givIdx = i; }
    m = ln.match(/\b(?:LN|LAST|FAMILY|SURNAME)\b[:\s]+([A-Z '\-]{2,})/);
    if (m){ family = m[1].trim(); famIdx = i; }
    m = ln.match(/\b(?:FN|FIRST|GIVEN)\b[:\s]+([A-Z '\-]{2,})/);
    if (m){ given = m[1].trim(); givIdx = i; }
    // "DOE, JOHN" style line
    m = ln.match(/^([A-Z'\-]{2,}),\s*([A-Z][A-Z .'\-]{1,})$/);
    if (m && !family && !given && !STOP_WORDS.has(m[1])){
      family = m[1].trim(); given = m[2].trim(); famIdx = givIdx = i;
    }
    // "NAME: DOE, JOHN" / "NAME: JOHN DOE" style line
    m = ln.match(/^NAME\s*[:\-]?\s*(.+)$/);
    if (m && !family && !given){
      const v = m[1].trim();
      const mc = v.match(/^([A-Z'\-]{2,}),\s*([A-Z][A-Z .'\-]{1,})$/);
      if (mc){ family = mc[1].trim(); given = mc[2].trim(); }
      else if (/^[A-Z][A-Z .'\-]{3,}$/.test(v) && !STOP_WORDS.has(v)) given = v;
      if (family || given){ famIdx = givIdx = i; }
    }
  });
  // One half missing: check the lines next to the half we found for a
  // plain name line (Utah prints family directly above given names).
  const cleaned = lines.map(cleanToken);
  const neighbor = (idx)=>{
    for (const j of [idx - 1, idx + 1]){
      if (j < 0 || j >= cleaned.length || j === famIdx || j === givIdx) continue;
      const v = plainNameLine(cleaned[j]);
      if (v) return v;
    }
    return null;
  };
  if (given && !family && givIdx >= 0) family = neighbor(givIdx);
  if (family && !given && famIdx >= 0) given = neighbor(famIdx);
  const clean = s => s ? titleCase(s.replace(/[^A-Z '\-]/gi,'').trim()) : null;
  family = clean(family); given = clean(given);
  if (given && family) return `${given} ${family}`;
  return given || family || null;
}

function looksLikeStreet(ln){
  // Cleaned line that reads as a street address: a house number followed
  // by at least two more tokens, one of which carries a digit or is a
  // directional / street-suffix token — and no label words anywhere.
  // ("9 CLASSD" fails twice: one trailing token, and CLASS is a label.)
  const toks = ln.split(' ').filter(Boolean);
  if (toks.some(t => LABEL_WORDS.has(t))) return false;
  let i = 0;
  if (toks.length > 2 && /^\d$/.test(toks[0]) && /^\d{1,6}$/.test(toks[1])) i = 1;
  if (!/^\d{1,6}$/.test(toks[i] || '')) return false;
  const rest = toks.slice(i + 1);
  if (rest.length < 2) return false;
  return rest.some(t => /\d/.test(t) || STREET_TOKENS.has(t));
}

function streetText(ln){
  // Drop a leading one-digit AAMVA field marker ("8 1595 ..." -> street).
  const toks = ln.split(' ').filter(Boolean);
  if (toks.length > 2 && /^\d$/.test(toks[0]) && /^\d{1,6}$/.test(toks[1])) toks.shift();
  return titleCase(toks.join(' '));
}

function extractAddress(lines){
  let street = null, city = null, state = null, zip = null, cityIdx = -1;
  const cleaned = lines.map(cleanToken);
  cleaned.forEach((ln, i)=>{
    // city / state / zip on one line: "LEHI, UT 84043" (comma optional)
    const m = ln.match(/^([A-Z][A-Z .'\-]*?),?\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
    if (m && !/^(UT|UTAH)$/.test(m[1].trim())){
      city = titleCase(m[1].trim()); state = m[2]; zip = m[3]; cityIdx = i;
    }
  });
  // 1) AAMVA field 8 = address line
  for (const ln of cleaned){
    const m8 = ln.match(/^8\s*[:\-]?\s+(.+)$/);
    if (m8 && /\d/.test(m8[1])){ street = streetText(ln); break; }
  }
  // 2) the line directly above the city/state/zip line — the layout on
  //    virtually every US license, and immune to a mangled field number
  if (!street && cityIdx > 0 && looksLikeStreet(cleaned[cityIdx - 1])){
    street = streetText(cleaned[cityIdx - 1]);
  }
  // 3) first line anywhere that reads as a street address
  if (!street){
    for (const ln of cleaned){
      if (looksLikeStreet(ln)){ street = streetText(ln); break; }
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

  const addr = extractAddress(lines);
  if (addr.streetAddress) out.streetAddress = addr.streetAddress;
  if (addr.city) out.city = addr.city;
  if (addr.state) out.state = addr.state;
  if (addr.zip) out.zip = addr.zip;

  const dlNo = extractDLNo(lines, addr.zip ? [addr.zip] : []);
  if (dlNo) out.dlNo = dlNo;

  const name = extractName(lines);
  if (name) out.name = name;

  return out;
}
