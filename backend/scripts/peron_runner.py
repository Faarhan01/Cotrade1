#!/usr/bin/env python3
"""
Peron CLI Diagnostics & Connection Tester
Usage: python3 backend/scripts/peron_runner.py [check|account|symbols|ticks|order]
"""

import sys
import json
import urllib.request
import urllib.error

BRIDGE_URL = "http://127.0.0.1:8888"

def get(path):
    try:
        req = urllib.request.Request(f"{BRIDGE_URL}{path}")
        with urllib.request.urlopen(req, timeout=5) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.URLError as e:
        print(f"Failed to reach Peron Bridge at {BRIDGE_URL}: {e}")
        return None

def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "check"
    if cmd == "check":
        res = get("/health")
        print("Peron Bridge Health:", json.dumps(res, indent=2))
    elif cmd == "account":
        res = get("/account")
        print("Account Info:", json.dumps(res, indent=2))
    elif cmd == "symbols":
        res = get("/symbols")
        print("Discovered Symbols:", json.dumps(res, indent=2))
    elif cmd == "ticks":
        res = get("/ticks")
        print("Market Ticks:", json.dumps(res, indent=2))
    else:
        print(f"Unknown command: {cmd}. Available: check, account, symbols, ticks")

if __name__ == "__main__":
    main()
