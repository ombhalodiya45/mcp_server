import dotenv from "dotenv";
dotenv.config();

import {
  getWeather,
  getCurrentTime,
  getWikiSummary,
  getCurrencyExchange,
} from "./tools.js";

console.error("MCP Server starting..."); // Use stderr for logs

// ----- JSON-RPC SEND HELPERS -----
function send(payloadObj) {
  console.error("Sending response:", JSON.stringify(payloadObj)); // Add logging
  const payload = JSON.stringify(payloadObj);
  const bytes = Buffer.from(payload, "utf8");

  process.stdout.write(`Content-Length: ${bytes.length}\r\n\r\n${payload}`);
}

function sendResponse(id, result) {
  send({ jsonrpc: "2.0", id, result });
}

function sendError(id, code, message, data) {
  send({
    jsonrpc: "2.0",
    id,
    error: { code, message, data },
  });
}

// ----- HANDLE MCP REQUESTS -----
async function handleRequest(req) {
  if (!req) return;

  const { id, method, params } = req;

  if (method === "ping") {
    return sendResponse(id, { ok: true });
  }

  // Return tool list
  if (method === "tools/list") {
    return sendResponse(id, {
      tools: [
        {
          name: "getWeather",
          description: "Get weather of any city using OpenWeatherMap API.",
          inputSchema: {
            type: "object",
            properties: { city: { type: "string" } },
            required: ["city"],
          },
        },
        {
          name: "getCurrentTime",
          description: "Returns the current server time.",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "getCurrencyExchange",
          description: "Fetch currency exchange rate from one currency to another.",
          inputSchema: {
            type: "object",
            properties: {
              from: { type: "string" },
              to: { type: "string" },
            },
            required: ["from", "to"],
          },
        },
        {
          name: "getWikiSummary",
          description: "Fetch a Wikipedia summary for a topic.",
          inputSchema: {
            type: "object",
            properties: {
              topic: { type: "string" },
            },
            required: ["topic"],
          },
        },
      ],
    });
  }

  // Execute tool call
  if (method === "tools/call") {
    const toolName = params?.name;
    const args = params?.arguments || {};

    try {
      let result;

      switch (toolName) {
        case "getWeather":
          result = await getWeather(args);
          break;
        case "getCurrentTime":
          result = getCurrentTime();
          break;
        case "getWikiSummary":
          result = await getWikiSummary(args);
          break;
        case "getCurrencyExchange":
          result = await getCurrencyExchange(args);
          break;
        default:
          return sendError(id, -32601, `Unknown tool: ${toolName}`);
      }

      // Must follow MCP spec: { result: { content: [...] } }
      return sendResponse(id, {
        content: [
          {
            type: "json",
            json: result,
          },
        ],
      });
    } catch (err) {
      console.error("Tool execution error:", err);

      return sendError(id, -32000, "Tool execution error", {
        message: err?.message || "Unknown error",
      });
    }
  }

  // Unknown method
  sendError(id, -32601, `Unknown method: ${method}`);
}

// ----- MCP STDIN PARSER -----
let buffer = "";
let contentLength = null;

process.stdin.on("data", (chunk) => {
  buffer += chunk.toString();

  while (true) {
    if (contentLength === null) {
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) break;

      const header = buffer.slice(0, headerEnd);
      const match = header.match(/Content-Length: (\d+)/i);

      if (!match) {
        buffer = buffer.slice(headerEnd + 4);
        continue;
      }

      contentLength = parseInt(match[1], 10);
      buffer = buffer.slice(headerEnd + 4);
    }

    if (buffer.length < contentLength) break;

    const body = buffer.slice(0, contentLength);
    buffer = buffer.slice(contentLength);
    contentLength = null;

    try {
      const json = JSON.parse(body);
      handleRequest(json);
    } catch (err) {
      console.error("Invalid JSON:", err);
    }
  }
});

process.stdin.on("end", () => process.exit(0));
console.error("MCP Server ready and waiting for requests...");