// tools.js
import axios from "axios";

/* ---------------- WEATHER TOOL ---------------- */
export async function getWeather({ city }) {
  console.log("🌤️ getWeather called with:", { city });
  
  if (!city || city.trim() === "") {
    return { success: false, error: "City is required." };
  }

  try {
    const apiKey = process.env.WEATHER_API_KEY;
    console.log("🔑 API Key exists:", !!apiKey);
    console.log("🔑 API Key length:", apiKey?.length);
    
    if (!apiKey) {
      return { success: false, error: "Weather API key is not configured." };
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
      city
    )}&appid=${apiKey}&units=metric`;
    
    console.log("📡 Fetching weather from URL:", url.replace(apiKey, 'HIDDEN'));

    const res = await axios.get(url);
    
    console.log("✅ Weather API Response status:", res.status);
    console.log("📦 Weather API Response data:", JSON.stringify(res.data, null, 2));

    return {
      success: true,
      city,
      temperature: res.data.main.temp,
      condition: res.data.weather[0].description,
      humidity: res.data.main.humidity,
      feels_like: res.data.main.feels_like
    };
  } catch (err) {
    console.error("❌ Weather API error details:");
    console.error("  - Message:", err.message);
    console.error("  - Response status:", err.response?.status);
    console.error("  - Response data:", JSON.stringify(err.response?.data, null, 2));
    console.error("  - Stack:", err.stack);
    
    return { 
      success: false, 
      error: `Could not fetch weather: ${err.response?.data?.message || err.message}` 
    };
  }
}
/* ---------------- TIME TOOL ---------------- */
export function getCurrentTime() {
  return { success: true, time: new Date().toLocaleString() };
}

/* ---------------- WIKIPEDIA TOOL ---------------- */
/* ---------------- WIKIPEDIA TOOL ---------------- */
export async function getWikiSummary({ topic }) {
  console.log("📚 getWikiSummary called with:", { topic });
  
  if (!topic || topic.trim() === "") {
    return { success: false, error: "Topic is required." };
  }

  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic)}`;
    console.log("📡 Fetching Wikipedia from URL:", url);

    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'MCPToolServer/1.0 (Node.js; Educational Project)',
        'Accept': 'application/json'
      }
    });
    
    console.log("✅ Wikipedia API Response status:", res.status);

    // Handle disambiguation pages
    if (res.data.type === "disambiguation") {
      console.log("⚠️ Topic is ambiguous");
      return {
        success: false,
        error: "Topic is ambiguous. Try a more specific name.",
      };
    }

    return {
      success: true,
      title: res.data.title,
      summary: res.data.extract,
      url: res.data.content_urls?.desktop?.page || null,
    };
  } catch (err) {
    console.error("❌ Wikipedia API error details:");
    console.error("  - Message:", err.message);
    console.error("  - Response status:", err.response?.status);
    console.error("  - Response data:", JSON.stringify(err.response?.data, null, 2));
    
    return { 
      success: false, 
      error: `Could not fetch Wikipedia summary: ${err.response?.data?.title || err.message}` 
    };
  }
}

/* ---------------- CURRENCY TOOL ---------------- */
export async function getCurrencyExchange({ from, to }) {
  console.log("🔍 getCurrencyExchange called with:", { from, to });
  
  if (!from || !to) {
    return { success: false, error: "Both 'from' and 'to' currencies are required." };
  }

  try {
    const url = `https://open.exchangerate-api.com/v6/latest/${from.toUpperCase()}`;
    console.log("📡 Fetching from URL:", url);
    
    const res = await axios.get(url);
    
    console.log("✅ API Response status:", res.status);
    console.log("📦 API Response data:", JSON.stringify(res.data, null, 2));

    if (!res.data || !res.data.rates) {
      console.error("❌ Invalid response structure");
      return { success: false, error: "Invalid API response structure." };
    }

    const toUpper = to.toUpperCase();
    const rate = res.data.rates[toUpper];

    if (!rate) {
      console.error(`❌ Currency ${toUpper} not found in rates`);
      return { success: false, error: `Currency ${toUpper} not found.` };
    }

    console.log("✅ Currency exchange successful:", { from, to, rate });

    return {
      success: true,
      from: from.toUpperCase(),
      to: toUpper,
      rate: rate,
      result: rate,
      date: res.data.time_last_update_utc
    };
  } catch (err) {
    console.error("❌ Currency API error details:");
    console.error("  - Message:", err.message);
    console.error("  - Response status:", err.response?.status);
    console.error("  - Response data:", err.response?.data);
    console.error("  - Stack:", err.stack);
    
    return { 
      success: false, 
      error: `Error fetching currency exchange: ${err.message}` 
    };
  }
}