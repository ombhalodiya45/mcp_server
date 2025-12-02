import express from "express";
import dotenv from "dotenv";
import Groq from "groq-sdk";
import axios from "axios";

dotenv.config();
const app = express();
app.use(express.json());

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Tools metadata for LLM prompt
const tools = [
  {
    type: "function",
    function: {
      name: "getWeather",
      description: "Get current weather information for a specific city. Use this when the user asks about weather, temperature, or climate conditions in a location.",
      parameters: {
        type: "object",
        properties: {
          city: {
            type: "string",
            description: "The name of the city to get weather for (e.g., 'London', 'New York', 'Tokyo')"
          }
        },
        required: ["city"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "getCurrentTime",
      description: "Get the current local server time. Use this when the user asks what time it is now.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function",
    function: {
      name: "getCurrencyExchange",
      description: "Get real-time currency exchange rates between two currencies. Use this when the user asks about currency conversion, exchange rates, or converting money from one currency to another (e.g., 'USD to EUR', 'convert dollars to euros', 'AUD to CAD rate').",
      parameters: {
        type: "object",
        properties: {
          from: {
            type: "string",
            description: "The source currency code (e.g., 'USD', 'EUR', 'GBP', 'AUD')"
          },
          to: {
            type: "string",
            description: "The target currency code (e.g., 'USD', 'EUR', 'GBP', 'CAD')"
          }
        },
        required: ["from", "to"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "getWikiSummary",
      description: "Get a summary from Wikipedia about a topic, person, place, concept, or historical event. Use this ONLY when the user asks for information about a specific topic, NOT for weather, time, or currency. Do NOT use this for currency exchange rates or weather information.",
      parameters: {
        type: "object",
        properties: {
          topic: {
            type: "string",
            description: "The Wikipedia topic to search for (e.g., 'Albert Einstein', 'Python programming language', 'World War II')"
          }
        },
        required: ["topic"]
      }
    }
  }
];

// Helper to call MCP server via HTTP JSON-RPC proxy
async function callMcpServer(toolName, args) {
  try {
    const mcpRequest = {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: toolName,
        arguments: args
      }
    };
    const response = await axios.post("http://localhost:4000/mcp", mcpRequest, {
      timeout: 10000
    });
    return response.data.result.content[0].json;
  } catch (error) {
    console.error(`Error calling MCP server for ${toolName}:`, error.message);
    return {
      success: false,
      error: `Failed to execute ${toolName}: ${error.message}`
    };
  }
}

app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;

  // Validate input
  if (!userMessage || typeof userMessage !== 'string' || userMessage.trim() === '') {
    return res.status(400).json({ 
      error: "Message is required and must be a non-empty string" 
    });
  }

  console.log("Received message:", userMessage);

  try {
    console.log("Making first LLM call...");
    const first = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: "You are a helpful AI assistant. You have access to several tools: weather info, current time, currency exchange rates, and Wikipedia summaries. Choose the most appropriate tool based on the user's question. For currency questions, ALWAYS use getCurrencyExchange. For weather questions, use getWeather. For general knowledge, use getWikiSummary."
        },
        { role: "user", content: userMessage }
      ],
      tools,
      tool_choice: "auto"
    });

    const msg = first.choices[0].message;
    console.log("LLM Response:", JSON.stringify(msg, null, 2));

    // CASE 1 → No tool used
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      console.log("No tool needed, returning LLM response");
      return res.json({ answer: msg.content, source: "LLM" });
    }

    // CASE 2 → TOOL CALLED
    const toolCall = msg.tool_calls[0];
    console.log("Tool called:", toolCall.function.name);
    console.log("Tool arguments:", toolCall.function.arguments);

    let args;
    try {
      args = typeof toolCall.function.arguments === 'string'
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
    } catch (parseError) {
      console.error("Failed to parse tool arguments:", parseError);
      return res.status(400).json({
        error: "Invalid tool arguments",
        details: parseError.message
      });
    }

    let result = {};

    if (toolCall.function.name === "getWeather") {
      console.log("Calling getWeather...");
      result = await callMcpServer("getWeather", args);
    }
    else if (toolCall.function.name === "getCurrentTime") {
      console.log("Calling getCurrentTime...");
      result = await callMcpServer("getCurrentTime", args);
    }
    else if (toolCall.function.name === "getWikiSummary") {
      console.log("Calling getWikiSummary...");
      const topic = args.topic?.trim();
      if (!topic) {
        result = { success: false, error: "No topic provided." };
      } else {
        result = await callMcpServer("getWikiSummary", { topic });
      }
    }
    else if (toolCall.function.name === "getCurrencyExchange") {
      console.log("Calling getCurrencyExchange...");
      result = await callMcpServer("getCurrencyExchange", args);
    }
    else {
      console.error("Unknown tool:", toolCall.function.name);
      return res.status(400).json({
        error: "Unknown tool",
        toolName: toolCall.function.name
      });
    }

    console.log("Tool result:", JSON.stringify(result, null, 2));

    // Send tool result back to LLM for final answer formatting
    console.log("Making final LLM call with tool result...");
    const final = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "You are a helpful AI assistant." },
        { role: "user", content: userMessage },
        msg,
        {
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result)
        }
      ],
      temperature: 0.7
    });

    console.log("Final response generated");
    res.json({
      answer: final.choices[0].message.content,
      toolResult: result,
      toolUsed: toolCall.function.name
    });
  } catch (error) {
    console.error("ERROR in /chat endpoint:");
    console.error("  - Message:", error.message);
    console.error("  - Stack:", error.stack);

    // Check if it's a Groq API error
    if (error.response?.data) {
      console.error("  - Groq API Error:", JSON.stringify(error.response.data, null, 2));
    }

    res.status(500).json({
      error: "Something went wrong",
      details: error.message,
      apiError: error.response?.data || null
    });
  }
});

app.get("/test", (req, res) => {
  res.json({ status: "Server is running" });
});

app.get("/health", async (req, res) => {
  try {
    await axios.post("http://localhost:4000/mcp", {
      jsonrpc: "2.0",
      method: "ping",
      params: {}
    }, { timeout: 3000 });
    
    res.json({ 
      status: "healthy",
      server: "running",
      mcpServer: "connected",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({ 
      status: "unhealthy",
      server: "running",
      mcpServer: "disconnected",
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.listen(3000, () => console.log("Express + MCP client server running on port 3000"));