#!/usr/bin/env node

/**
 * Start script - Starts the server and opens the browser automatically
 * Usage: node start.js
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const http = require('http');

const PORT = 3000;
const URL = `http://localhost:${PORT}`;

console.log('🚀 Starting Merge Project...\n');

// Function to check if server is already running
function checkServerRunning() {
    return new Promise((resolve) => {
        const req = http.get(URL, (res) => {
            resolve(true); // Server is running
        });

        req.on('error', () => {
            resolve(false); // Server is not running
        });

        req.setTimeout(1000, () => {
            req.destroy();
            resolve(false);
        });
    });
}

// Function to open browser
function openBrowser() {
    console.log(`🌐 Opening browser at ${URL}...\n`);

    const command = process.platform === 'darwin' ? 'open' :
        process.platform === 'win32' ? 'start' : 'xdg-open';

    exec(`${command} ${URL}`, (err) => {
        if (err) {
            console.error('⚠️  Could not open browser automatically.');
            console.log(`Please open ${URL} manually in your browser.`);
        } else {
            console.log('✅ Browser opened successfully!\n');
        }
    });
}

// Main logic
(async () => {
    const isRunning = await checkServerRunning();

    if (isRunning) {
        console.log('✅ Server is already running on port 3000!\n');
        openBrowser();
        console.log('💡 Tip: Server is running in another terminal. Use Ctrl+C there to stop it.\n');
        process.exit(0);
    } else {
        console.log('🔄 Starting new server...\n');

        // Start the server
        const serverPath = path.join(__dirname, 'server.js');
        const server = spawn('node', [serverPath], {
            cwd: __dirname,
            stdio: 'inherit',
            env: { ...process.env }
        });

        server.on('error', (err) => {
            console.error('❌ Failed to start server:', err);
            process.exit(1);
        });

        // Wait for server to start, then open browser
        setTimeout(() => {
            openBrowser();
        }, 2000);

        // Handle graceful shutdown
        process.on('SIGINT', () => {
            console.log('\n\n🛑 Shutting down server...');
            server.kill();
            process.exit(0);
        });

        process.on('SIGTERM', () => {
            server.kill();
            process.exit(0);
        });
    }
})();
