import fs from "fs";
import path from "path";

const root = process.cwd();
const years = Array.from({ length: 2026 - 2003 + 1 }, (_, i) => 2003 + i);

const approvedNames = [
  "Abdul-Akim",
  "Abdul-Hakeem",
  "Abdur-Rashid",
  "American Motor Club",
  "Angela VV",
  "Anthony Barnwell",
  "Apple Health",
  "Applied Card Sys",
  "Bac Tran",
  "Bacetty-Ortiz",
  "Baghai-Kermani",
  "Bernard Pitts",
  "Bongarzone-Suarrcy",
  "Bonilla-Lugo",
  "Brenda WW",
  "Burgos-Santos",
  "Cadman Williams",
  "Carol Elmer",
  "Carr-El",
  "Chi Fong Chen",
  "Christopher Martinez",
  "Chu-Joi",
  "Churchill Andrews",
  "Concert Connection",
  "Cortez-Moreno",
  "Coventry First LLC",
  "Craig Lewis",
  "Credit Suisse Sec",
  "Darrell Williams",
  "Dawn Maria",
  "De Aga",
  "De Bour",
  "De Chellis",
  "De George",
  "De Jesus",
  "De Lago",
  "De Renzzio",
  "De Santis",
  "De Tore",
  "De Vito",
  "Del Rio",
  "Del Rosario",
  "Del Vermo",
  "Del-Debbio",
  "Di Falco",
  "Di Napoli",
  "Di Pasquale",
  "Di Raffaele",
  "Di Stefano",
  "Dunbar Contr",
  "Dzemil Balic",
  "Edwin Rodriguez",
  "Efrain Hernandez",
  "Elbert Norris",
  "Ernest Brannon",
  "Federated Radio Corp",
  "First Am",
  "First Meridian Planning Corp",
  "Foster-Bey",
  "General Elec",
  "Gonzalez-Alvarez",
  "Gregory Hill",
  "Guevara-Lopez",
  "Hall-Wilson",
  "Hang Bin Li",
  "Hao Lin",
  "Hu Sin",
  "Jean-Baptiste",
  "Jean-Pierre",
  "Jian Jing Huang",
  "Jin Cheng Lin",
  "John BB",
  "Jose Fernandez",
  "Julian Silva",
  "Karl Chu-Joi",
  "Kerri Roberts",
  "Kevin Cooper",
  "Kevin Kruger",
  "Kin Kan",
  "La Belle",
  "La Carrubba",
  "La Marca",
  "La Pene",
  "Lam Lek Chong",
  "Lasso-Reina",
  "Le Mieux",
  "Lendof-Gonzalez",
  "Lewis-Bush",
  "Lexington Sixty-First Assoc",
  "Liberty Mut",
  "Lloyd-Douglas",
  "Lo Cicero",
  "Lo Verde",
  "Lopez-Mendoza",
  "Martinez-Fernandez",
  "McKenzie-Smith",
  "Min Chul Shin",
  "Ming Li",
  "Mobil Oil Corp",
  "Morel-Gomez",
  "Nathaniel Syville",
  "New York Trap Rock Corp",
  "Nieves-Andino",
  "North St",
  "On Sight Mobile Opticians",
  "Ortega-Flores",
  "Padilla-Zuniga",
  "Pamela Hanson",
  "Peguero-Sanchez",
  "Public Serv",
  "Puluc-Sique",
  "Quan Hong Ye",
  "Ramirez-Portoreal",
  "Rodriguez-Ortiz",
  "Rong He",
  "Sackey-El",
  "Santos-Sosa",
  "Selbin Martinez",
  "Sprint Nextel Corp",
  "Suarez-Montoya",
  "Superior Court",
  "Tineo-Morales",
  "Tony Council",
  "Trump Entrepreneur Initiative LLC",
  "Tyrell Norris",
  "Tyrone Mingo",
  "Van Akin",
  "Van Buren",
  "Van Deusen",
  "Van Dusen",
  "Van Every",
  "Van Gaasbeck",
  "Van Norstrand",
  "Van Pelt",
  "Van Sickle",
  "Vinod Patel",
  "Von Werne",
  "Warner-Lambert Co",
  "Wells Fargo Ins",
  "Western Express Intl",
  "William II",
  "Yavru-Sakuk",
  "Yong Yun Lee",
].sort((a, b) => b.length - a.length || a.localeCompare(b));

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const candidatePatterns = approvedNames.map((name) => ({
  name,
  partial: new RegExp(
    `\\*People v ${escapeRegExp(name)}\\*(?=[A-Za-z])`,
    "g"
  ),
  bare: new RegExp(
    `(?<!\\*)\\b(People v ${escapeRegExp(name)})\\b(?!\\*)`,
    "g"
  ),
}));

let filesChanged = 0;
let replacements = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    processFile(fullPath);
  }
}

function processFile(file) {
  const original = fs.readFileSync(file, "utf8");
  let updated = original;
  let fileReplacements = 0;

  for (const pattern of candidatePatterns) {
    updated = updated.replace(
      pattern.partial,
      () => `People v ${pattern.name}`
    );
    updated = updated.replace(pattern.bare, (_, citation) => {
      fileReplacements += 1;
      return `*${citation}*`;
    });
  }

  if (updated !== original) {
    fs.writeFileSync(file, updated);
    filesChanged += 1;
    replacements += fileReplacements;
  }
}

for (const year of years) {
  const yearDir = path.join(root, "coa", String(year));
  if (fs.existsSync(yearDir)) walk(yearDir);
}

console.log(JSON.stringify({ filesChanged, replacements }, null, 2));
