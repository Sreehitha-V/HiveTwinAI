/**
 * HiveTwinAI - Twilio SMS Alert Service (Node.js ES Module)
 * =========================================================
 * Sends transactional emergency alerts to beekeepers via Twilio REST API.
 * Uses native Node.js https (Zero external npm packages required).
 *
 * Twilio REST API endpoint:
 * https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Messages.json
 */

import https from 'node:https';
import querystring from 'node:querystring';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import fs from 'node:fs';
import path from 'node:path';

// Helper to optionally load .env if present
function loadEnvFile() {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      content.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const idx = trimmed.indexOf('=');
          if (idx !== -1) {
            const key = trimmed.slice(0, idx).trim();
            const val = trimmed.slice(idx + 1).trim();
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      });
    }
  } catch {
    // Ignore error loading .env
  }
}
loadEnvFile();

// ==============================================================================
// CONFIGURATION & CREDENTIALS
// ==============================================================================
export const TWILIO_CONFIG = {
  accountSid:
    process.env.VITE_TWILIO_ACCOUNT_SID ||
    process.env.TWILIO_ACCOUNT_SID ||
    '',
  authToken:
    process.env.VITE_TWILIO_AUTH_TOKEN ||
    process.env.TWILIO_AUTH_TOKEN ||
    '',
  fromNumber:
    process.env.VITE_TWILIO_PHONE_NUMBER ||
    process.env.TWILIO_PHONE_NUMBER ||
    '',
};

// Target farmer contacts (loaded from .env or defaults)
const envFarmerList = process.env.VITE_FARMER_CONTACTS || process.env.FARMER_CONTACTS;
export const DEFAULT_FARMER_CONTACTS = envFarmerList
  ? envFarmerList.split(',').map((p) => p.trim()).filter(Boolean)
  : [
      '+918639707203', // Primary Apiary Manager
      '+919390864498', // Field Technician
      '+918978015426', // Apiary Inspector
    ];

/**
 * Sends a single transactional SMS via Twilio REST API
 * @param {string} toNumber - Recipient phone number in E.164 (+91...)
 * @param {string} messageBody - Text alert content
 * @param {object} [customConfig] - Optional override for credentials
 * @returns {Promise<{success: boolean, recipient: string, sid?: string, error?: string}>}
 */
export function sendTwilioAlertSMS(toNumber, messageBody, customConfig = {}) {
  const config = { ...TWILIO_CONFIG, ...customConfig };
  const cleanNumber = String(toNumber || '').trim().replace(/[\s-]/g, '');

  return new Promise((resolve) => {
    if (!cleanNumber) {
      return resolve({ success: false, recipient: toNumber, error: 'Empty phone number' });
    }

    if (!config.accountSid || config.accountSid.includes('YOUR_TWILIO_ACCOUNT_SID')) {
      console.warn(`[Twilio Warning] Placeholder credentials active. Real SMS to ${cleanNumber} skipped.`);
      return resolve({
        success: false,
        recipient: cleanNumber,
        error: 'Twilio credentials not configured. Please supply TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env'
      });
    }

    const postData = querystring.stringify({
      To: cleanNumber,
      From: config.fromNumber,
      Body: messageBody,
    });

    const authHeader = 'Basic ' + Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64');

    const options = {
      hostname: 'api.twilio.com',
      port: 443,
      path: `/2010-04-01/Accounts/${config.accountSid}/Messages.json`,
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        Accept: 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`[Twilio SUCCESS] SMS sent to ${cleanNumber} (SID: ${json.sid}, Status: ${json.status})`);
            resolve({
              success: true,
              recipient: cleanNumber,
              sid: json.sid,
              status: json.status,
              response: json,
            });
          } else {
            console.error(`[Twilio FAILED] SMS to ${cleanNumber} failed: [${json.code}] ${json.message}`);
            resolve({
              success: false,
              recipient: cleanNumber,
              code: json.code,
              error: json.message || `HTTP ${res.statusCode}`,
              response: json,
            });
          }
        } catch (e) {
          resolve({
            success: false,
            recipient: cleanNumber,
            error: `Failed to parse response: ${e.message}`,
            raw: data,
          });
        }
      });
    });

    req.on('error', (err) => {
      console.error(`[Twilio Network Error] Request to ${cleanNumber} failed:`, err.message);
      resolve({
        success: false,
        recipient: cleanNumber,
        error: err.message,
      });
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Sends emergency alerts to multiple farmers
 * @param {string[]} phoneNumbersList - Array of recipient numbers
 * @param {string} messageBody - Text message
 * @param {object} [customConfig] - Optional credentials
 */
export async function sendTwilioToMultipleFarmers(phoneNumbersList, messageBody, customConfig = {}) {
  console.log(`\n========================================================`);
  console.log(` HiveTwinAI Twilio Service: Dispatching to ${phoneNumbersList.length} Farmer(s)`);
  console.log(` Message: "${messageBody}"`);
  console.log(`========================================================`);

  const results = [];
  for (const phone of phoneNumbersList) {
    const res = await sendTwilioAlertSMS(phone, messageBody, customConfig);
    results.push(res);
  }

  const successful = results.filter((r) => r.success).length;
  const failed = results.length - successful;

  console.log(`\n========================================================`);
  console.log(` Dispatch Summary: ${successful} Succeeded | ${failed} Failed`);
  console.log(`========================================================\n`);

  return {
    total: results.length,
    successful,
    failed,
    results,
  };
}

export default {
  TWILIO_CONFIG,
  DEFAULT_FARMER_CONTACTS,
  sendTwilioAlertSMS,
  sendTwilioToMultipleFarmers,
};

// ==============================================================================
// DIRECT COMMAND-LINE EXECUTION TEST
// ==============================================================================
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const testMessage = `[HiveTwinAI TEST] Emergency alert service test via Twilio. Hive-01 telemetry link operational.`;
  console.log('Running standalone test with targets:', DEFAULT_FARMER_CONTACTS);
  sendTwilioToMultipleFarmers(DEFAULT_FARMER_CONTACTS, testMessage)
    .then((report) => {
      console.log('Test finished with report:', JSON.stringify(report, null, 2));
    })
    .catch((err) => {
      console.error('Test failed:', err);
    });
}
