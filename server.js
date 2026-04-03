const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { spawn } = require("child_process");
const path = require("path");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.static("public"));
app.use(express.json());

// Store active process to prevent multiple runs or allow killing
let activeProcess = null;
let cachedStats = null;

// CENTRALIZED STATS SYNC
function startStatsSync() {
  const scriptPath = path.join(__dirname, 'farmkart-automation', 'stats.js');

  const fetchStats = () => {
    console.log("[Stats Manager] Starting periodic scrape...");
    const child = spawn('node', [scriptPath], {
      cwd: path.dirname(scriptPath),
      env: { ...process.env }
    });

    let output = "";
    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.on('close', (code) => {
      try {
        const cleanOutput = output.trim().split('\n').pop(); // Get the last line (JSON)
        if (cleanOutput.startsWith('{')) {
          cachedStats = JSON.parse(cleanOutput);
          console.log("[Stats Manager] Stats updated successfully.");
          io.emit('stats-update', cachedStats);
        }
      } catch (e) {
        console.error("[Stats Manager] Failed to parse output:", e);
      }
    });
  };

  // Initial fetch and interval
  fetchStats();
  setInterval(fetchStats, 60000); // Sync every 60 seconds
}

// Start sync service
startStatsSync();

// Helper to spawn process
function runScript(scriptPath, args, socket) {
  if (activeProcess) {
    socket.emit(
      "log",
      "⚠️ Another process is already running. Please stop it first or wait.\n",
    );
    return;
  }

  const child = spawn("node", [scriptPath, ...args], {
    cwd: path.dirname(scriptPath), // execute in the script's directory
    env: { ...process.env, FORCE_COLOR: "1" }, // Preserve colors
  });

  activeProcess = child;

  socket.emit("process-start", { pid: child.pid });
  socket.emit("log", `🚀 Process started: ${path.basename(scriptPath)}\n`);

  child.stdout.on("data", (data) => {
    const lines = data.toString().split("\n");
    lines.forEach((line) => {
      if (line.trim()) socket.emit("log", line);
    });
  });

  child.stderr.on("data", (data) => {
    const lines = data.toString().split("\n");
    lines.forEach((line) => {
      if (line.trim()) socket.emit("log", `err: ${line}`);
    });
  });

  child.on("close", (code) => {
    socket.emit("log", `\n🏁 Process exited with code ${code}\n`);
    socket.emit("process-end", { code });
    activeProcess = null;
  });

  child.on("error", (err) => {
    socket.emit("log", `\n❌ Failed to start process: ${err.message}\n`);
    activeProcess = null;
  });
}

// Socket Connection
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Send cached stats immediately
  if (cachedStats) {
    socket.emit('stats-update', cachedStats);
  }

  socket.on("start-invoice", (data) => {
    const scriptPath = path.join(__dirname, "invoice-automation", "index.js");
    const args = ["--auto"];

    if (data.startRow) args.push("--startRow", data.startRow);
    if (data.limit) args.push("--limit", data.limit);

    runScript(scriptPath, args, socket);
  });


  socket.on("start-ofd", (data) => {
    const scriptPath = path.join(__dirname, "farmkart-automation", "index.js");
    const args = [];

    // Pass arguments
    if (data.startRow) args.push("--startRow", data.startRow);
    if (data.limit) args.push("--limit", data.limit);

    runScript(scriptPath, args, socket);
  });

  socket.on("start-booking", (data) => {
    const scriptPath = path.join(
      __dirname,
      "order-booking-automation",
      "index.js",
    );
    const args = [];

    // Pass arguments
    if (data.startRow) args.push("--startRow", data.startRow);
    if (data.limit) args.push("--limit", data.limit);
    // Force auto mode for web execution
    args.push("--auto");

    runScript(scriptPath, args, socket);
  });

  socket.on("start-cancel", (data) => {
    const scriptPath = path.join(__dirname, "cancel-automation", "index.js");
    const args = [];

    // Detect input type: ≤4 digits = row number, ≥6 digits = order ID
    const inputVal = String(data.startRow || '').trim();
    if (inputVal.length <= 4) {
      // Row Number mode
      args.push("--startRow", inputVal);
    } else {
      // Direct Order ID mode
      args.push("--orderId", inputVal);
    }

    if (data.limit && parseInt(data.limit) > 0) {
      args.push("--limit", data.limit);
    }

    runScript(scriptPath, args, socket);
  });

  socket.on("stop-process", () => {
    if (activeProcess) {
      activeProcess.kill();
      activeProcess = null;
      socket.emit("log", "\n🛑 Process terminated by user.\n");
      socket.emit("process-end", { code: "KILL" });
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
