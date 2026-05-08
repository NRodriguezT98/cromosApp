const fs = require('fs');
const path = require('path');

const countryMap = {
  'Mexico': 'México',
  'South Africa': 'Sudáfrica',
  'South Korea': 'Corea del Sur',
  'Czechia': 'República Checa',
  'Canada': 'Canadá',
  'Bosnia and Herzegovina': 'Bosnia y Herzegovina',
  'Qatar': 'Catar',
  'Switzerland': 'Suiza',
  'Brazil': 'Brasil',
  'Morocco': 'Marruecos',
  'Haiti': 'Haití',
  'Scotland': 'Escocia',
  'USA': 'EE.UU.',
  'Paraguay': 'Paraguay',
  'Australia': 'Australia',
  'Türkiye': 'Turquía',
  'Germany': 'Alemania',
  'Curaçao': 'Curazao',
  'Ivory Coast': 'Costa de Marfil',
  'Ecuador': 'Ecuador',
  'Netherlands': 'Países Bajos',
  'Japan': 'Japón',
  'Sweden': 'Suecia',
  'Tunisia': 'Túnez',
  'Belgium': 'Bélgica',
  'Egypt': 'Egipto',
  'Iran': 'Irán',
  'New Zealand': 'Nueva Zelanda',
  'Spain': 'España',
  'Cape Verde': 'Cabo Verde',
  'Saudi Arabia': 'Arabia Saudita',
  'Uruguay': 'Uruguay',
  'France': 'Francia',
  'Senegal': 'Senegal',
  'Iraq': 'Irak',
  'Norway': 'Noruega',
  'Argentina': 'Argentina',
  'Algeria': 'Argelia',
  'Austria': 'Austria',
  'Jordan': 'Jordania',
  'Portugal': 'Portugal',
  'Congo DR': 'Rep. Dem. del Congo',
  'Uzbekistan': 'Uzbekistán',
  'Colombia': 'Colombia',
  'England': 'Inglaterra',
  'Croatia': 'Croacia',
  'Ghana': 'Ghana',
  'Panama': 'Panamá',
};

// ISO 3166-1 alpha-2 codes para flagcdn.com
const sectionIso = {
  MEX: 'mx', RSA: 'za', KOR: 'kr', CZE: 'cz', CAN: 'ca',
  BIH: 'ba', QAT: 'qa', SUI: 'ch', BRA: 'br', MAR: 'ma',
  HAI: 'ht', SCO: 'gb-sct', USA: 'us', PAR: 'py', AUS: 'au',
  TUR: 'tr', GER: 'de', CUW: 'cw', CIV: 'ci', ECU: 'ec',
  NED: 'nl', JPN: 'jp', SWE: 'se', TUN: 'tn', BEL: 'be',
  EGY: 'eg', IRN: 'ir', NZL: 'nz', ESP: 'es', CPV: 'cv',
  KSA: 'sa', URU: 'uy', FRA: 'fr', SEN: 'sn', IRQ: 'iq',
  NOR: 'no', ARG: 'ar', ALG: 'dz', AUT: 'at', JOR: 'jo',
  POR: 'pt', COD: 'cd', UZB: 'uz', COL: 'co', ENG: 'gb-eng',
  CRO: 'hr', GHA: 'gh', PAN: 'pa', FWC: null, CC: null,
};

function parseLine(line, albumNumber) {
  line = line.trim();
  if (!line) return null;

  const foil = line.endsWith('FOIL');
  const cleanLine = foil ? line.slice(0, -4).trim() : line;

  // Extract code (first token)
  const spaceIdx = cleanLine.indexOf(' ');
  let code = cleanLine.slice(0, spaceIdx);
  const rest = cleanLine.slice(spaceIdx + 1).trim();

  // Normalize known typos in codes
  if (code === 'SWI9') code = 'SUI9';
  if (code === 'SWI20') code = 'SUI20';
  if (code === 'KAS12') code = 'KSA12';

  // Extract section prefix (letters only)
  const sectionMatch = code.match(/^([A-Z]+)/);
  const section = sectionMatch ? sectionMatch[1] : 'FWC';

  // Parse name and country from "Name - Country" or just "Name"
  let name = rest;
  let teamNameEn = null;
  let teamNameEs = null;

  if (rest.includes(' - ')) {
    const dashIdx = rest.lastIndexOf(' - ');
    name = rest.slice(0, dashIdx).trim();
    teamNameEn = rest.slice(dashIdx + 3).trim();
    teamNameEs = countryMap[teamNameEn] || teamNameEn;
  }

  // Translate special name parts
  name = name
    .replace('Team Logo', 'Escudo del Equipo')
    .replace('Team Photo', 'Foto del Equipo')
    .replace('Official Emblem', 'Emblema Oficial')
    .replace('Official Mascots', 'Mascotas Oficiales')
    .replace('Official Slogan', 'Eslogan Oficial')
    .replace('Official Ball', 'Balón Oficial')
    .replace('Host Countries & Cities', 'Países y Ciudades Sede')
    .replace('FIFA Museum', 'Museo FIFA');

  // Also translate country name inside the name field if present
  if (teamNameEs && name.includes(teamNameEn)) {
    name = name.replace(teamNameEn, teamNameEs);
  }

  // Determine sticker type
  let type = 'player';
  if (name.includes('Escudo del Equipo')) type = 'team_logo';
  else if (name.includes('Foto del Equipo')) type = 'team_photo';
  else if (section === 'FWC' || section === 'CC') type = 'special';

  // Handle the "00" code for Panini logo
  const numPart = code === '00' ? 0 : parseInt(code.replace(/[A-Z]+/, ''), 10);

  const teamCode = section === 'FWC' ? 'FWC' : section;
  return {
    albumNumber,
    code,
    section,
    name,
    teamCode,
    teamName: section === 'CC' ? 'Coca-Cola' : (teamNameEs || (section === 'FWC' ? 'FIFA World Cup 2026' : section)),
    isoCode: sectionIso[teamCode] || null,
    type,
    foil,
    quantity: 0,
  };
}

const raw = fs.readFileSync(path.join(__dirname, '..', 'lista.txt'), 'utf8');
const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);

const stickers = lines.map((line, i) => parseLine(line, i + 1)).filter(Boolean);

// Build sections summary
const sectionsMap = {};
for (const s of stickers) {
  if (!sectionsMap[s.teamCode]) {
    sectionsMap[s.teamCode] = {
      code: s.teamCode,
      name: s.teamName,
      isoCode: s.isoCode,
      total: 0,
    };
  }
  sectionsMap[s.teamCode].total++;
}
const sections = Object.values(sectionsMap);

const output = { stickers, sections };

const outPath = path.join(__dirname, '..', 'constants', 'stickersData.json');
fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');

console.log(`✅ Generados ${stickers.length} cromos en ${sections.length} secciones`);
sections.forEach(s => console.log(`  [${s.isoCode || 'FIFA'}] ${s.code}: ${s.name} (${s.total} cromos)`));
