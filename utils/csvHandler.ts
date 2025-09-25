// src/utils/csvHandler.ts
import fs from "fs";
import { parse } from "csv-parse";
import db, { TABLE as DEFAULT_TABLE } from "../db/knex.js";

/**
 * Maps CSV headers (as they appear in your file) to database fields.
 */
const MAP: Record<string, string> = {
  // identifiers
  "pid": "pid",
  // "Call Number": "call_number",

  // names
  "Last Name": "last_name",
  "First Name": "first_name",
  "Name Variants": "name_variation",

  // demographics
  "Sex": "sex",
  "Age": "age",

  // dates
  "Date of Application": "date_of_application",
  "Date of Admission": "date_of_admission",
  "Date of Discharge": "date_of_discharge",
  "Date of Death": "date_of_death",

  // birth/origin
  "Birth City": "birth_city",
  "Birth State": "birth_state",
  "Place of Birth": "place_of_birth",
  "Arrival in US": "arrival_in_us",

  // address / location
  "Occupation": "occupation",
  "Address at Time of Application": "address_at_time_of_application",
  "City": "city",
  "State": "state",
  "Former Address": "former_address",
  "Former City": "former_city",
  "Former State": "former_state",

  // disease info
  "Disease Duration": "disease_duration",
  "Contracted City": "contracted_city",
  "Contracted State": "contracted_state",
  "Contracted Country": "contracted_country",

  // family
  "Marital Status": "marital_status",
  "Number of Children": "number_of_children",
  "Age of Children": "ages_of_children",

  // free text
  "Notes": "notes",
};

/** normalize string-ish fields: trim and convert "" to null */
function clean(val: unknown): unknown {
  if (val == null) return null;
  if (typeof val === "string") {
    const t = val.trim();
    return t === "" ? null : t;
  }
  return val;
}

/** Convert one CSV row (by header names) into your DB row */
function toDbRow(row: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [csvKey, dbKey] of Object.entries(MAP)) {
    if (csvKey in row) out[dbKey] = clean(row[csvKey]);
  }
  // ensure columns that exist in DB but might be missing in CSV
  if (!("handle" in out)) out["handle"] = null; // compute later if needed
  return out;
}

export async function parseCsvAndInsert(
  filePath: string,
  tableName = DEFAULT_TABLE || "records_02_13_2024",
  delimiter: string = ";"
): Promise<{ inserted: number; rows: number }> {
  const rows: Record<string, any>[] = [];

  // 1) parse CSV (streaming)
  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(
        parse({
          columns: true,       // header row present
          bom: true,           // handle UTF-8 BOM
          skip_empty_lines: true,
          trim: true,
          delimiter,           // your file uses semicolons
        })
      )
      .on("data", (rec: Record<string, any>) => rows.push(rec))
      .on("end", () => resolve())
      .on("error", reject);
  });

  // 2) map + clean
  const toInsert = rows.map(toDbRow);

  // 3) insert in small chunks (simple + safe)
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