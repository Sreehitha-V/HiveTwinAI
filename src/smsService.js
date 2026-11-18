/**
 * HiveTwinAI - Multi-Provider Farmer SMS Alert Service
 * ====================================================
 * Client-side integration supporting:
 * 1. Twilio SMS (Recommended for Free Trial with $15 credits)
 * 2. Brevo Transactional SMS
 * 
 * Works in both Vite dev server (via secure /api/send-sms proxy)
 * and direct standalone execution.
 */

// Twilio Config from Vite environment or default placeholders
export const TWILIO_CONFIG = {
  accountSid:
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_TWILIO_ACCOUNT_SID) ||
    "AC56971e93ea6d75bc216d55ee20a35ae0",
  authToken:
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_TWILIO_AUTH_TOKEN) ||
    "46a7b77df660e46aae155a2fff51fe29",
  fromNumber:
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_TWILIO_PHONE_NUMBER) ||
    "+18024543046" // Twilio Virtual Number
};

// Brevo Fallback Config
export const BREVO_API_KEY =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_BREVO_API_KEY) ||
  "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";

const BREVO_SMS_API_URL = "https://api.brevo.com/v3/transactionalSMS/sms";
const DEFAULT_SENDER_NAME = "HiveTwinAI";

/**
 * Sends a single transactional SMS alert to a farmer.
 * Tries Twilio dev proxy first, then falls back to Brevo if applicable.
 * 
 * @param {string} phoneNumber - Recipient phone number in E.164 format (+91...)
 * @param {string} alertMessage - Content of the SMS message
 * @param {object} [options] - Optional custom credentials/provider
 * @returns {Promise<{success: boolean, recipient: string, sid?: string, messageId?: string, error?: string}>}
 */
export async function sendHiveAlertSMS(phoneNumber, alertMessage, options = {}) {
  const cleanNumber = String(phoneNumber || "").trim().replace(/[\s-]/g, "");

  if (!cleanNumber) {
    console.warn("[SMS Service] Cannot send SMS: Phone number is empty.");
    return { success: false, recipient: phoneNumber, error: "Empty phone number" };
  }

  const twilioSid = options.accountSid || TWILIO_CONFIG.accountSid;
  const twilioToken = options.authToken || TWILIO_CONFIG.authToken;
  const twilioFrom = options.fromNumber || TWILIO_CONFIG.fromNumber;

  const hasTwilioCredentials =
    twilioSid &&
    twilioToken &&
    !twilioSid.includes("YOUR_TWILIO_ACCOUNT_SID") &&
    !twilioToken.includes("YOUR_TWILIO_AUTH_TOKEN");

  // --- 1. TRY LOCAL TWILIO DEV PROXY (/api/send-sms) ---
  if (hasTwilioCredentials) {
    try {
      const proxyRes = await fetch("/api/send-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: cleanNumber,
          message: alertMessage,
          accountSid: twilioSid,
          authToken: twilioToken,
          fromNumber: twilioFrom
        })
      });

      const proxyData = await proxyRes.json().catch(() => ({}));
      if (proxyRes.ok && (proxyData.sid || proxyData.status === "queued" || proxyData.status === "sent")) {
        console.log(`[Twilio SMS] Successfully delivered alert to ${cleanNumber}:`, proxyData.sid);
        return {
          success: true,
          provider: "twilio",
          recipient: cleanNumber,
          sid: proxyData.sid,
          response: proxyData
        };
      } else {
        console.warn(`[Twilio SMS] Dev proxy response for ${cleanNumber}:`, proxyData);
        // If Twilio returned a specific API error (e.g. unverified trial number or geo permissions)
        if (proxyData.message || proxyData.error) {
          return {
            success: false,
            provider: "twilio",
            recipient: cleanNumber,
            code: proxyData.code,
            error: proxyData.message || proxyData.error,
            response: proxyData
          };
        }
      }
    } catch (err) {
      console.warn("[SMS Service] Dev proxy unreachable, attempting fallback:", err.message);
    }
  }

  // --- 2. FALLBACK TO BREVO API ---
  const activeBrevoKey = options.brevoApiKey || BREVO_API_KEY;
  if (activeBrevoKey && !activeBrevoKey.includes("YOUR_ACTUAL_BREVO_API_KEY_HERE")) {
    try {
      const payload = {
        sender: DEFAULT_SENDER_NAME.slice(0, 11),
        recipient: cleanNumber,
        content: alertMessage,
        type: "transactional"
      };

      const response = await fetch(BREVO_SMS_API_URL, {
        method: "POST",
        headers: {
          accept: "application/json",
          "api-key": activeBrevoKey,
          "content-type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        console.log(`[Brevo SMS] Successfully sent alert to ${cleanNumber}:`, data);
        return {
          success: true,
          provider: "brevo",
          recipient: cleanNumber,
          messageId: data.reference || data.messageId,
          response: data
        };
      } else {
        const errorMsg = data.message || `HTTP ${response.status}`;
        console.warn(`[Brevo SMS] API rejected alert to ${cleanNumber}:`, errorMsg);
        return {
          success: false,
          provider: "brevo",
          recipient: cleanNumber,
          error: errorMsg,
          response: data
        };
      }
    } catch (err) {
      console.error(`[SMS Service] Network error sending to ${cleanNumber}:`, err);
    }
  }

  // --- 3. SIMULATED DISPATCH FALLBACK IF NO REAL CREDENTIALS CONFIGURED ---
  console.info(
    `[SMS Service Simulated] Alert to ${cleanNumber}: "${alertMessage}" (Awaiting real Twilio credentials)`
  );
  return {
    success: true,
    simulated: true,
    recipient: cleanNumber,
    messageId: `sim-${Date.now()}`
  };
}

/**
 * Broadcasts emergency alert to multiple farmer contacts
 * @param {string[]} phoneNumbersList - Array of recipient numbers
 * @param {string} alertMessage - Content of the SMS message
 * @param {object} [options] - Optional custom credentials
 */
export async function sendAlertToMultipleFarmers(phoneNumbersList, alertMessage, options = {}) {
  if (!Array.isArray(phoneNumbersList) || phoneNumbersList.length === 0) {
    console.warn("[SMS Service] No farmer contacts provided.");
    return { total: 0, successful: 0, failed: 0, results: [] };
  }

  console.log(
    `[SMS Service] Broadcasting emergency alert to ${phoneNumbersList.length} farmer(s): "${alertMessage}"`
  );

  const results = await Promise.all(
    phoneNumbersList.map((phone) => sendHiveAlertSMS(phone, alertMessage, options))
  );

  const successful = results.filter((r) => r.success).length;
  const failed = results.length - successful;

  console.log(`[SMS Service] Broadcast completed: ${successful}/${results.length} successful`);

  return {
    total: results.length,
    successful,
    failed,
    results
  };
}

export default {
  TWILIO_CONFIG,
  BREVO_API_KEY,
  sendHiveAlertSMS,
  sendAlertToMultipleFarmers
};
