#!/usr/bin/env python3
"""
Lookup one or more call_numbers in the JCRS repo API and print all matching
sip_uuids + handles + titles for each call_number.

Example:
  python get_handles.py B002.01.0097.0022 B002.01.0097.0016 \
    --repo-endpoint URL \
    --api-key KEY \
    --sip-uuid IDGOESHERE \
    --handle-prefix http://hdl.handle.net/10176/

Environment variable fallbacks:
  REPO_ENDPOINT, REPO_API_KEY, REPO_SIP_UUID, REPO_HANDLE_URL
"""

import os
import sys
import json
import argparse
from typing import Any, Dict, List, Optional
import requests


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Fetch record(s) from the repo API and print sip_uuid + handle + title for given call_number(s)."
    )
    p.add_argument(
        "call_numbers",
        nargs="+",
        help="One or more call numbers (e.g., B002.01.0097.0022 B002.01.0097.0016)"
    )
    p.add_argument(
        "--repo-endpoint",
        default=os.environ.get("REPO_ENDPOINT", ""),
        help="Records endpoint URL (default from REPO_ENDPOINT)"
    )
    p.add_argument(
        "--api-key",
        default=os.environ.get("REPO_API_KEY", ""),
        help="Repo API key (default from REPO_API_KEY)"
    )
    p.add_argument(
        "--sip-uuid",
        default=os.environ.get("REPO_SIP_UUID", "a5efb5d1-0484-429c-95a5-15c12ff40ca0"),
        help="Collection sip_uuid (default from REPO_SIP_UUID)"
    )
    p.add_argument(
        "--handle-prefix",
        default=os.environ.get("REPO_HANDLE_URL", "http://hdl.handle.net/10176/"),
        help="Prefix used to build handle URLs from sip_uuid (default from REPO_HANDLE_URL)"
    )
    p.add_argument(
        "--timeout",
        type=float,
        default=15.0,
        help="HTTP timeout in seconds (default: 15)"
    )
    return p.parse_args()


def fetch_records(endpoint: str, sip_uuid: str, api_key: str, timeout: float) -> List[Dict[str, Any]]:
    params = {"sip_uuid": sip_uuid, "type": "collection"}
    if api_key:
        params["api_key"] = api_key
    r = requests.get(endpoint, params=params, timeout=timeout)
    r.raise_for_status()
    data = r.json()
    if not isinstance(data, list):
        raise ValueError(f"Unexpected API response (expected JSON array), got {type(data).__name__}")
    return data


def extract_identifier_from_mods(mods_json_str: str) -> Optional[str]:
    if not isinstance(mods_json_str, str):
        return None
    try:
        mods = json.loads(mods_json_str)
    except Exception:
        return None
    try:
        return mods.get("identifiers", [{}])[0].get("identifier")
    except Exception:
        return None


def extract_title_from_mods(mods_json_str: str) -> Optional[str]:
    """
    Extract a human-readable title from the record's MODS JSON.
    Tries common MODS patterns like titleInfo.title, title, etc.
    """
    if not isinstance(mods_json_str, str):
        return None
    try:
        mods = json.loads(mods_json_str)
    except Exception:
        return None

    # Try several common MODS key paths
    candidates = [
        (mods.get("titleInfo", {}) or {}).get("title"),
        mods.get("title"),
        ((mods.get("mods", {}) or {}).get("titleInfo", {}) or {}).get("title"),
    ]
    for t in candidates:
        if isinstance(t, str) and t.strip():
            return t.strip()
    return None


def index_records_by_identifier(records: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    """
    Build an index: identifier -> list of repo records that claim that identifier.
    """
    idx: Dict[str, List[Dict[str, Any]]] = {}
    for rec in records:
        ident = extract_identifier_from_mods(rec.get("mods"))
        if not ident:
            continue
        idx.setdefault(ident, []).append(rec)
    return idx


def main() -> int:
    args = parse_args()

    print("=== Repository API lookup ===")
    print(f"Endpoint      : {args.repo_endpoint}")
    print(f"SIP UUID      : {args.sip_uuid}")
    print(f"API key set   : {'yes' if args.api_key else 'no'}")
    print(f"Handle prefix : {args.handle_prefix}")
    print(f"Call numbers  : {', '.join(args.call_numbers)}")
    print("Fetching collection records from the API...")

    try:
        records = fetch_records(args.repo_endpoint, args.sip_uuid, args.api_key, args.timeout)
    except requests.HTTPError as e:
        print(f"[HTTP ERROR] {e.response.status_code}: {e.response.text[:400]}", file=sys.stderr)
        return 2
    except Exception as e:
        print(f"[ERROR] Failed to fetch records: {e}", file=sys.stderr)
        return 2

    print(f"API returned  : {len(records)} record(s) in the collection scope).")

    # Build an index from identifier -> [records]
    idx = index_records_by_identifier(records)
    print(f"Indexed       : {len(idx)} unique identifier(s) from API response.\n")

    overall_found = 0
    for call_number in args.call_numbers:
        print(f"--- Lookup for call_number: {call_number} ---")
        matches = idx.get(call_number, [])

        if not matches:
            print("Result        : Not found in API response.\n")
            continue

        print(f"Matches found : {len(matches)}")
        for i, rec in enumerate(matches, start=1):
            sip_uuid = rec.get("sip_uuid")
            title = extract_title_from_mods(rec.get("mods"))
            if not isinstance(sip_uuid, str) or not sip_uuid.strip():
                print(f"  [{i}] sip_uuid: (missing)")
                print(f"      handle:  (cannot build, missing sip_uuid)")
                print(f"      title :  {title or '(no title found)'}")
                continue

            handle_url = f"{args.handle_prefix}{sip_uuid}"
            print(f"  [{i}] sip_uuid: {sip_uuid}")
            print(f"      handle:  {handle_url}")
            print(f"      title :  {title or '(no title found)'}")
        print()  # blank line
        overall_found += len(matches)

    if overall_found == 0:
        print("Summary       : No matching call_numbers found.")
    else:
        print(f"Summary       : Printed {overall_found} matching record(s) across {len(args.call_numbers)} call_number(s).")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
