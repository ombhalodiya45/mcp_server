🚀 Project Overview

The backend is built using Node.js and handles core server functionalities along with custom MCP (Model Context Protocol) endpoints.
It is organized to keep configuration, logic, and documentation clean and modular.

| File / Folder          | Description                             |
| ---------------------- | --------------------------------------- |
| `node_modules/`        | Installed dependencies (ignored in Git) |
| `.env`                 | Environment variables (ignored)         |
| `.gitignore`           | Git ignore rules                        |
| `index.js`             | Main backend entry point                |
| `mcp-http-wrapper.mjs` | MCP HTTP wrapper logic                  |
| `mcp-server.mjs`       | MCP server implementation               |
| `tools.js`             | Utility and tool functions              |
| `test-key.js`          | Testing key or logic                    |
| `package.json`         | Project metadata & scripts              |
| `package-lock.json`    | Dependency lock file                    |


⚙️ Requirements

Node.js (v18+ recommended)
npm or yarn

📦 Installation

Run the following commands inside the backend folder:
npm install

▶️ Running the Server
node index.js

If you are running the MCP server directly:
node mcp-server.mjs

🔐 Environment Variables
Create a .env file inside the backend folder.

GROQ_API_KEY=api_key
WEATHER_API_KEY=api_key
PORT=port_number
EXCHANGE_API_KEY=api_key

🛠️ Scripts
Useful scripts (if defined in package.json):
npm start        # Start the server
npm run dev      # Run in development mode

🧪 Testing

Use test-key.js or additional test scripts to verify key and server functionality.
node test-key.js

📜 .gitignore

The project includes a .gitignore with rules to keep the repository clean:
Ignore environment files
Ignore node_modules/
Ignore system/editor files

📄 License

This project is for internal/learning use unless a license is added.

