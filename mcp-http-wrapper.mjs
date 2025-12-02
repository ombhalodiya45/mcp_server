import express from "express";
import { spawn } from "child_process";

const app = express();
app.use(express.json());

// Spawn MCP server stdio process
const mcpProcess = spawn("node", ["mcp-server.mjs"]);

let buffer = "";
let contentLength = null;
const responseCallbacks = new Map();

// FIXED: Listen to mcpProcess.stdout, not process.stdin
mcpProcess.stdout.on("data", (chunk) => {
  buffer += chunk.toString("utf8");
  console.error("Received data chunk, buffer size:", buffer.length);

  while (true) {
    if (contentLength == null) {
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) break;

      const header = buffer.slice(0, headerEnd);
      const match = header.match(/Content-Length: (\d+)/i);
      if (!match) {
        buffer = buffer.slice(headerEnd + 4);
        continue;
      }
      contentLength = parseInt(match[1], 10);
      console.error("Content-Length:", contentLength);
      buffer = buffer.slice(headerEnd + 4);
    }
    if (buffer.length < contentLength) break;

    const body = buffer.slice(0, contentLength);
    buffer = buffer.slice(contentLength);
    contentLength = null;

    try {
      const resp = JSON.parse(body);
      console.error("Parsed response:", JSON.stringify(resp, null, 2));
      if (resp.id && responseCallbacks.has(resp.id)) {
        responseCallbacks.get(resp.id)(resp);
        responseCallbacks.delete(resp.id);
      }
    } catch (err) {
      console.error("Error parsing MCP response:", err);
    }
  }
});

// Listen to stderr for logs from MCP server
mcpProcess.stderr.on("data", (data) => {
  console.error(" MCP Server stderr:", data.toString());
});

// Handle MCP process errors
mcpProcess.on("error", (err) => {
  console.error("MCP Process error:", err);
});

mcpProcess.on("exit", (code) => {
  console.error("MCP Process exited with code:", code);
});

let nextId = 1;

function sendMcpRequest(jsonRpc) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    jsonRpc.id = id;
    const payload = JSON.stringify(jsonRpc);
    const message = `Content-Length: ${Buffer.byteLength(payload)}\r\n\r\n${payload}`;
    
    console.error("Sending to MCP server:", payload);
    responseCallbacks.set(id, resolve);

    try {
      mcpProcess.stdin.write(message);
    } catch (err) {
      responseCallbacks.delete(id);
      reject(err);
    }

    // Timeout to avoid hanging requests
    setTimeout(() => {
      if (responseCallbacks.has(id)) {
        responseCallbacks.delete(id);
        reject(new Error("Timeout waiting for MCP server response"));
      }
    }, 10000); // 10 seconds
  });
}

app.post("/mcp", async (req, res) => {
  try {
    console.error("Received HTTP request to /mcp");
    const result = await sendMcpRequest(req.body);
    console.error("Sending response to client");
    res.json(result);
  } catch (err) {
    console.error("Error handling MCP HTTP request:", err);
    res.status(500).json({ error: err.message });
  }
});

const port = 4000;
app.listen(port, () => console.log(`MCP HTTP wrapper running on http://localhost:${port}/mcp`));