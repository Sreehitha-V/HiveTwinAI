"""
HiveTwinAI - Farmer SMS Alert Service
=====================================
Standalone Python service to send transactional SMS alerts to beekeepers/farmers 
using the Brevo (formerly Sendinblue) REST API v3.

Endpoint: https://api.brevo.com/v3/transactionalSMS/sms
Docs: https://developers.brevo.com/reference/sendtransacsms
"""

import os
import json
from typing import List, Dict, Any, Optional

try:
    import requests
except ImportError:
    requests = None
    import urllib.request
    import urllib.error

# ==============================================================================
# CONFIGURATION & CONSTANTS
# ==============================================================================
# Replace with your actual Brevo API Key, or set the environment variable BREVO_API_KEY
BREVO_API_KEY_PLACEHOLDER = "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"
BREVO_SMS_API_URL = "https://api.brevo.com/v3/transactionalSMS/sms"

# Brevo alphanumeric sender name: max 11 alphanumeric characters (no spaces/symbols)
DEFAULT_SENDER_NAME = "HiveTwinAI"


def get_api_key(custom_key: Optional[str] = None) -> str:
    """
    Resolves the Brevo API key from the parameter, environment variable,
    or the default placeholder.
    """
    if custom_key and custom_key.strip():
        return custom_key.strip()
    env_key = os.environ.get("BREVO_API_KEY", "").strip()
    if env_key:
        return env_key
    return BREVO_API_KEY_PLACEHOLDER


def send_hive_alert_sms(
    phone_number: str,
    alert_message: str,
    api_key: Optional[str] = None,
    sender: str = DEFAULT_SENDER_NAME
) -> Dict[str, Any]:
    """
    Sends a transactional SMS alert to an individual farmer via the Brevo API.

    Parameters:
        phone_number (str): Recipient's phone number with international country code
                            (e.g., '+919876543210' or '+1234567890').
        alert_message (str): Text content of the SMS alert.
        api_key (str, optional): Brevo API key. If omitted, uses env var or placeholder.
        sender (str, optional): Alphanumeric sender name (max 11 chars, default: 'HiveTwinAI').

    Returns:
        dict: A dictionary containing status information and API response.
              {
                  "success": True/False,
                  "recipient": phone_number,
                  "message_id": "...",      # present on success
                  "response": {...},
                  "error": "..."            # present on failure
              }
    """
    resolved_api_key = get_api_key(api_key)

    # Basic input sanitation
    clean_number = phone_number.strip().replace(" ", "").replace("-", "")
    if not clean_number:
        return {
            "success": False,
            "recipient": phone_number,
            "error": "Phone number cannot be empty."
        }

    # Warn if using placeholder key
    if "YOUR_ACTUAL_BREVO_API_KEY_HERE" in resolved_api_key:
        print("[WARNING] You are using the placeholder Brevo API key. Please set your real API key.")

    headers = {
        "accept": "application/json",
        "api-key": resolved_api_key,
        "content-type": "application/json"
    }

    payload = {
        "sender": sender[:11],         # Brevo enforces max 11 alphanumeric chars
        "recipient": clean_number,     # E.164 format with country code (+91...)
        "content": alert_message,
        "type": "transactional"
    }

    # Execute HTTP POST request (using 'requests' if installed, or fallback 'urllib')
    try:
        if requests is not None:
            response = requests.post(
                BREVO_SMS_API_URL,
                headers=headers,
                json=payload,
                timeout=15
            )
            try:
                data = response.json()
            except ValueError:
                data = {"raw_text": response.text}

            if 200 <= response.status_code < 300:
                print(f"[SUCCESS] SMS alert dispatched to {clean_number} (Status: {response.status_code})")
                return {
                    "success": True,
                    "recipient": clean_number,
                    "status_code": response.status_code,
                    "message_id": data.get("reference") or data.get("messageId"),
                    "response": data
                }
            else:
                error_msg = data.get("message", f"HTTP {response.status_code}: {response.text}")
                print(f"[FAILED] SMS alert to {clean_number} failed: {error_msg}")
                return {
                    "success": False,
                    "recipient": clean_number,
                    "status_code": response.status_code,
                    "error": error_msg,
                    "response": data
                }
        else:
            # Fallback using standard library urllib
            req_data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                BREVO_SMS_API_URL,
                data=req_data,
                headers=headers,
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=15) as res:
                body = res.read().decode("utf-8")
                data = json.loads(body)
                print(f"[SUCCESS] SMS alert dispatched to {clean_number} (Status: {res.status})")
                return {
                    "success": True,
                    "recipient": clean_number,
                    "status_code": res.status,
                    "message_id": data.get("reference") or data.get("messageId"),
                    "response": data
                }

    except Exception as e:
        error_str = str(e)
        print(f"[ERROR] Exception while sending SMS to {clean_number}: {error_str}")
        return {
            "success": False,
            "recipient": clean_number,
            "error": error_str
        }


def send_to_multiple_farmers(
    phone_numbers_list: List[str],
    alert_message: str,
    api_key: Optional[str] = None,
    sender: str = DEFAULT_SENDER_NAME
) -> Dict[str, Any]:
    """
    Sends the same transactional SMS alert to multiple farmers/beekeepers.

    Parameters:
        phone_numbers_list (list of str): List of phone numbers in international format.
        alert_message (str): Text content of the SMS alert.
        api_key (str, optional): Brevo API key.
        sender (str, optional): Sender name (default: 'HiveTwinAI').

    Returns:
        dict: A summary report containing total, successful, failed counts and details.
              {
                  "total": 3,
                  "successful": 2,
                  "failed": 1,
                  "results": [...]
              }
    """
    print(f"\n========================================================")
    print(f" HiveTwinAI: Dispatching SMS Alerts to {len(phone_numbers_list)} Farmer(s)")
    print(f" Message: \"{alert_message}\"")
    print(f"========================================================")

    results = []
    successful_count = 0
    failed_count = 0

    for idx, phone in enumerate(phone_numbers_list, start=1):
        print(f"[{idx}/{len(phone_numbers_list)}] Sending to {phone}...")
        res = send_hive_alert_sms(
            phone_number=phone,
            alert_message=alert_message,
            api_key=api_key,
            sender=sender
        )
        results.append(res)
        if res.get("success"):
            successful_count += 1
        else:
            failed_count += 1

    summary = {
        "total": len(phone_numbers_list),
        "successful": successful_count,
        "failed": failed_count,
        "results": results
    }

    print(f"\n--- Broadcast Complete: {successful_count}/{len(phone_numbers_list)} Delivered Successfully ---")
    return summary


# ==============================================================================
# DIRECT TEST EXECUTION BLOCK
# ==============================================================================
if __name__ == "__main__":
    print("\n------------------------------------------------------------")
    print(" HiveTwinAI - SMS Alert Service")
    print("------------------------------------------------------------")

    # 1. Provide your Brevo API key below or run with:
    #    set BREVO_API_KEY=xkeysib-your-key (on Windows Command Prompt)
    #    $env:BREVO_API_KEY="xkeysib-your-key" (on Windows PowerShell)
    TEST_API_KEY = "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"

    # 2. Add the farmers' phone numbers with country codes (E.164 format)
    #    Example: '+919876543210' for India, '+14155552671' for US/Canada
    TEST_FARMER_NUMBERS = [
        "+918639707203",  # Farmer 1 (Primary Apiary Manager)
        "+919390864498",  # Farmer 2 (Field Technician)
        "+918978015426"   # Farmer 3 (Apiary Inspector)
    ]

    # 3. Sample emergency telemetry alert message
    TEST_ALERT_MESSAGE = (
        "[HiveTwinAI ALERT] Critical Overheat Detected in Langstroth Hive-01! "
        "Core Temp: 39.4°C (Limit: 36.5°C). Immediate ventilation or shading required."
    )

    print(f"\nTarget Farmers: {TEST_FARMER_NUMBERS}")
    print(f"Test Alert: {TEST_ALERT_MESSAGE}\n")

    # Execute broadcast to multiple farmers
    broadcast_report = send_to_multiple_farmers(
        phone_numbers_list=TEST_FARMER_NUMBERS,
        alert_message=TEST_ALERT_MESSAGE,
        api_key=TEST_API_KEY
    )

    print("\nFull JSON Execution Report:")
    print(json.dumps(broadcast_report, indent=2))
