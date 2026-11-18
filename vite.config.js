import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import https from 'node:https'
import querystring from 'node:querystring'

/**
 * Local SMS Proxy middleware for Twilio (avoids browser CORS issues and hides secrets)
 */
function twilioSmsPlugin() {
  return {
    name: 'twilio-sms-proxy',
    configureServer(server) {
      server.middlewares.use('/api/send-sms', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const data = JSON.parse(body || '{}');
            const phone = String(data.phone || '').trim().replace(/[\s-]/g, '');
            const message = data.message || '';
            const accountSid = data.accountSid || process.env.VITE_TWILIO_ACCOUNT_SID || process.env.TWILIO_ACCOUNT_SID;
            const authToken = data.authToken || process.env.VITE_TWILIO_AUTH_TOKEN || process.env.TWILIO_AUTH_TOKEN;
            const fromNumber = data.fromNumber || process.env.VITE_TWILIO_PHONE_NUMBER || process.env.TWILIO_PHONE_NUMBER;

            if (!phone || !message) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: false, error: 'Phone and message required' }));
            }

            if (!accountSid || !authToken || accountSid.includes('YOUR_TWILIO')) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({
                success: false,
                error: 'Twilio credentials not configured. Please supply Account SID and Auth Token.'
              }));
            }

            const postData = querystring.stringify({
              To: phone,
              From: fromNumber,
              Body: message
            });

            const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');
            const twilioReq = https.request({
              hostname: 'api.twilio.com',
              port: 443,
              path: `/2010-04-01/Accounts/${accountSid}/Messages.json`,
              method: 'POST',
              headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData),
                'Accept': 'application/json'
              }
            }, (twilioRes) => {
              let respData = '';
              twilioRes.on('data', chunk => { respData += chunk; });
              twilioRes.on('end', () => {
                res.statusCode = twilioRes.statusCode || 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(respData);
              });
            });

            twilioReq.on('error', (err) => {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: err.message }));
            });

            twilioReq.write(postData);
            twilioReq.end();
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), twilioSmsPlugin()],
})
