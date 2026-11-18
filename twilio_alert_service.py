"""
HiveTwinAI - Twilio Farmer SMS Alert Service (Python)
=====================================================
Sends transactional SMS alerts to beekeepers/farmers via Twilio REST API.
Uses standard library urllib (no external dependencies required).

Endpoint: https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Messages.json
"""

import os
import json
import base64
import urllib.request
import urllib.parse
import urllib.error
from typing import List, Dict, Any, Optional

# ==============================================================================
# CONFIGURATION & CREDENTIALS
TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")
TWILIO_PHONE_NUMBER = os.environ.get("TWILIO_PHONE_NUMBER", "")

DEFAULT_FARMER_CONTACTS = [
    "+918639707203",  # Primary Apiary Manager
    "+919390864498",  # Field Technician
    "+918978015426",  # Apiary Inspector
]


def send_twilio_alert_sms(
    phone_number: str,
    alert_message: str,
    account_sid: Optional[str] = None,
    auth_token: Optional[str] = None,
    from_number: Optional[str] = None
) -> Dict[str, Any]:
    """
    Sends a single transactional SMS alert via Twilio REST API.
    """
    sid = (account_sid or TWILIO_ACCOUNT_SID).strip()
    token = (auth_token or TWILIO_AUTH_TOKEN).strip()
    sender = (from_number or TWILIO_PHONE_NUMBER).strip()
    clean_number = phone_number.strip().replace(" ", "").replace("-", "")

    if not clean_number:
        return {"success": False, "recipient": phone_number, "error": "Empty phone number"}

    if "YOUR_TWILIO_ACCOUNT_SID" in sid or not sid:
        print(f"[Twilio Warning] Placeholder credentials active for {clean_number}. SMS skipped.")
        return {
            "success": False,
            "recipient": clean_number,
            "error": "Twilio Account SID / Auth Token not configured."
        }

    url = f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"
    payload = urllib.parse.urlencode({
        "To": clean_number,
        "From": sender,
        "Body": alert_message
    }).encode("utf-8")

    credentials = f"{sid}:{token}"
    b64_auth = base64.b64encode(credentials.encode("utf-8")).decode("ascii")

    headers = {
        "Authorization": f"Basic {b64_auth}",
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json"
    }

    try:
        req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=15) as res:
            res_body = res.read().decode("utf-8")
            data = json.loads(res_body)
            print(f"[Twilio SUCCESS] SMS sent to {clean_number} (SID: {data.get('sid')})")
            return {
                "success": True,
                "recipient": clean_number,
                "sid": data.get("sid"),
                "status": data.get("status"),
                "response": data
            }
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            err_json = json.loads(err_body)
            err_msg = f"[{err_json.get('code')}] {err_json.get('message')}"
        except Exception:
            err_msg = f"HTTP {e.code}: {err_body}"
        print(f"[Twilio FAILED] SMS to {clean_number} failed: {err_msg}")
        return {
            "success": False,
            "recipient": clean_number,
            "error": err_msg
        }
    except Exception as e:
        print(f"[Twilio ERROR] Exception sending to {clean_number}: {e}")
        return {
            "success": False,
            "recipient": clean_number,
            "error": str(e)
        }


def send_to_multiple_farmers(
    phone_numbers_list: List[str],
    alert_message: str,
    account_sid: Optional[str] = None,
    auth_token: Optional[str] = None,
    from_number: Optional[str] = None
) -> Dict[str, Any]:
    """
    Sends emergency alerts to multiple farmers.
    """
    print(f"\n========================================================")
    print(f" HiveTwinAI Twilio Service: Dispatching to {len(phone_numbers_list)} Farmer(s)")
    print(f" Message: \"{alert_message}\"")
    print(f"========================================================")

    results = []
    for phone in phone_numbers_list:
        res = send_twilio_alert_sms(phone, alert_message, account_sid, auth_token, from_number)
        results.push(res) if hasattr(results, 'push') else results.append(res)

    successful = len([r for r in results if r.get("success")])
    failed = len(results) - successful

    print(f"\n========================================================")
    print(f" Dispatch Summary: {successful} Succeeded | {failed} Failed")
    print(f"========================================================")

    return {
        "total": len(results),
        "successful": successful,
        "failed": failed,
        "results": results
    }


if __name__ == "__main__":
    test_msg = "[HiveTwinAI Python Test] Testing Twilio integration for Langstroth Hive-01."
    print("Running Python Twilio test for recipients:", DEFAULT_FARMER_CONTACTS)
    report = send_to_multiple_farmers(DEFAULT_FARMER_CONTACTS, test_msg)
    print("Report:", json.dumps(report, indent=2))
