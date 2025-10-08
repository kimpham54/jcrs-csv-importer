// src/utils/getHandles.ts
'use strict';

import axios from "axios";
import db, { TABLE as DEFAULT_TABLE } from "../db/knex.js";

const REPO_ENDPOINT   = process.env.REPO_ENDPOINT   || "http://localhost:8000/repo/api/v1/records";
const REPO_API_KEY    = process.env.REPO_API_KEY    || "";
const REPO_HANDLE_URL = process.env.REPO_HANDLE_URL || "http://hdl.handle.net/10176/";
const REPO_SIP_UUID   = process.env.REPO_SIP_UUID   || "a5efb5d1-0484-429c-95a5-15c12ff40ca0";

interface RepoRecord {
  sip_uuid: string;
  mods: string;
}

async function _fetchAndUpdateHandles(
  tableName: string,
  sipUUID: string | undefined,
  type: string,
  onlyCallNumbers?: Set<string>
): Promise<{ requested: number; updated: number; missing: number }> {
  const params: Record<string, string> = { type };
  if (sipUUID) params["sip_uuid"] = sipUUID;
  if (REPO_API_KEY) params["api_key"] = REPO_API_KEY;

  const { data } = await axios.get<RepoRecord[]>(REPO_ENDPOINT, {
    params,
    timeout: 10000,
    validateStatus: (s) => s >= 200 && s < 300,
  });

  if (!Array.isArray(data)) {
    throw new Error("Unexpected repo API response (expected an array)");
  }

  // Reverse to match legacy order
  const records = [...data].reverse();

  // filter when targeting specific call_numbers
  let toProcess = records;
  if (onlyCallNumbers && onlyCallNumbers.size > 0) {
    toProcess = records.filter((rec) => {
      try {
        const json = rec?.mods ? JSON.parse(rec.mods) : null;
        const id = json?.identifiers?.[0]?.identifier;
        return id && onlyCallNumbers.has(id);
      } catch {
        return false;
      }
    });
  }

  let updated = 0;
  let missing = 0;
  let remainingTargets = onlyCallNumbers ? onlyCallNumbers.size : undefined;

  for (const record of toProcess) {
    try {
      if (!record?.mods) continue;
      const json = JSON.parse(record.mods);
      const call_number: string | undefined = json?.identifiers?.[0]?.identifier;
      if (!call_number) continue;

      if (onlyCallNumbers && !onlyCallNumbers.has(call_number)) continue;

      const handle = `${REPO_HANDLE_URL}${record.sip_uuid}`;

      const q = db(tableName).where({ call_number });
      if (onlyCallNumbers) q.whereNull("handle"); // do not overwrite when targeting
      const count = await q.update({ handle });

      if (count === 1) {
        updated += 1;
        if (remainingTargets !== undefined) {
          remainingTargets -= 1;
          if (remainingTargets <= 0) break; // exits when all targets updated
        }
      } else {
        missing += 1; // not found or already had handle (when whereNull applied)
      }
    } catch {
      // process per-row errors to keep other rows going
      missing += 1;
    }
  }

  return { requested: toProcess.length, updated, missing };
}

export async function getRecordUuidsAndUpdateHandlesForCallNumbers(
  tableName: string = DEFAULT_TABLE as string,
  callNumbers: string[] = [],
  sipUUID: string = REPO_SIP_UUID,
  type: string = "collection"
): Promise<{ requested: number; updated: number; missing: number }> {
  const set = new Set((callNumbers || []).filter(Boolean));
  if (set.size === 0) return { requested: 0, updated: 0, missing: 0 };
  return _fetchAndUpdateHandles(tableName, sipUUID, type, set);
}