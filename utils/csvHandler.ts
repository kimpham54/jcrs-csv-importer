// src/utils/csvHandler.ts
import fs from "fs";
import { parse } from "csv-parse";
import db, { TABLE as DEFAULT_TABLE } from "../db/knex.js";

function guessDelimiter(sample: string): string {
  // count candidate delimiters in the first non-empty line
  const line = sample.split(/\r?\n/).find(l => l.trim().length) ?? "";
  const counts = [
    [",", (line.match(/,/g) || []).length],
    [";", (line.match(/;/g) || []).length],
    ["\t", (line.match(/\t/g) || []).length],
  ] as const;
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ",";
}

async function readHead(path: string, bytes = 8192): Promise<string> {
  return await new Promise((resolve, reject) => {
    const s = fs.createReadStream(path, { encoding: "utf8", start: 0, end: bytes });
    let acc = "";
    s.on("data", chunk => (acc += chunk));
    s.on("end", () => resolve(acc));
    s.on("error", reject);
  });
}

/** normalize string-ish fields: trim and convert "" to null */
function clean(val: unknown): unknown {
  if (val == null) return null;
  if (typeof val === "string") {
    const t = val.trim();
    return t === "" ? null : t;
  }
  return val;
}

/** CSV header -> DB column map */
const MAP: Record<string, string> = {
  pid: "pid",
  "Last Name": "last_name",
  "First Name": "first_name",
  "Name Variants": "name_variation",
  Sex: "sex",
  Age: "age",
  "Date of Application": "date_of_application",
  "Date of Admission": "date_of_admission",
  "Date of Discharge": "date_of_discharge",
  "Date of Death": "date_of_death",
  "Birth City": "birth_city",
  "Birth State": "birth_state",
  "Place of Birth": "place_of_birth",
  "Arrival in US": "arrival_in_us",
  Occupation: "occupation",
  "Address at Time of Application": "address_at_time_of_application",
  City: "city",
  State: "state",
  "Former Address": "former_address",
  "Former City": "former_city",
  "Former State": "former_state",
  "Disease Duration": "disease_duration",
  "Contracted City": "contracted_city",
  "Contracted State": "contracted_state",
  "Contracted Country": "contracted_country",
  "Marital Status": "marital_status",
  "Number of Children": "number_of_children",
  "Age of Children": "ages_of_children",
  Notes: "notes",
};

function toDbRow(row: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [csvKey, dbKey] of Object.entries(MAP)) {
    if (csvKey in row) out[dbKey] = clean(row[csvKey]);
  }
  if (!("handle" in out)) out["handle"] = null;
  return out;
}

export async function parseCsvAndInsert(
  filePath: string,
  tableName = DEFAULT_TABLE || "records_02_13_2024",
  delimiter?: string // optional, auto if omitted
): Promise<{ inserted: number; rows: number }> {
  const head = await readHead(filePath);
  const delim = delimiter ?? guessDelimiter(head); // auto-detect , ; or \t

  const rows: Record<string, any>[] = [];

  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(
        parse({
          columns: true,
          bom: true,
          skip_empty_lines: true,
          trim: true,
          delimiter: delim,
          relax_quotes: false, // quotes are fine when delimiter matches
        })
      )
      .on("data", (rec: Record<string, any>) => rows.push(rec))
      .on("end", () => resolve())
      .on("error", (err) => {
        // Attach some helpful context
        err.message = `CSV parse failed (delimiter "${delim}"): ${err.message}`;
        reject(err);
      });
  });

  const toInsert = rows.map(toDbRow);

  const chunkSize = 500;
  let total = 0;
  await db.transaction(async (trx) => {
    for (let i = 0; i < toInsert.length; i += chunkSize) {
      const chunk = toInsert.slice(i, i + chunkSize);
      if (chunk.length) {
        await trx(tableName).insert(chunk);
        total += chunk.length;
      }
    }
  });

  return { inserted: total, rows: rows.length };
}