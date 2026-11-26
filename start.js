#!/usr/bin/env node

/**
 * Start script - Starts the server on a unique port and opens the browser automatically
 * Usage: node start.js
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const http = require('http');
const net = require('net');

const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 3005;

// Function to check if server is already running on a specific port
function checkServerRunning(port) {
    return new Promise((resolve) => {
        const req = http.get(`http://localhost:${port}`, (res) => {
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

// Function to find next available port
function getAvailablePort(port) {
    return new Promise((resolve) => {
        const srv = net.createServer();
        srv.unref();
        srv.on('error', () => {
            resolve(getAvailablePort(port + 1));
        });
        srv.listen(port, () => {
            srv.close(() => resolve(port));
        });
    });
}

// Function to open browser
function openBrowser(url) {
    console.log(`🌐 Opening browser at ${url}...\n`);

    const command = process.platform === 'darwin' ? 'open' :
        process.platform === 'win32' ? 'start' : 'xdg-open';

    exec(`${command} ${url}`, (err) => {
        if (err) {
            console.error('⚠️  Could not open browser automatically.');
            console.log(`Please open ${url} manually in your browser.`);
        } else {
            console.log('✅ Browser opened successfully!\n');
        }
    });
}

// Main logic
(async () => {
    console.log('🚀 Starting Merge Project...\n');

    const isRunning = await checkServerRunning(DEFAULT_PORT);

    if (isRunning) {
        console.log(`✅ Server is already running on port ${DEFAULT_PORT}!\n`);
        openBrowser(`http://localhost:${DEFAULT_PORT}`);
        console.log('💡 Tip: Server is running in another terminal. Use Ctrl+C there to stop it.\n');
        process.exit(0);
    } else {
        const port = await getAvailablePort(DEFAULT_PORT);
        const url = `http://localhost:${port}`;
        console.log(`🔄 Starting new server on unique port ${port}...\n`);

        // Start the server
        const serverPath = path.join(__dirname, 'server.js');
        const server = spawn('node', [serverPath], {
            cwd: __dirname,
            stdio: 'inherit',
            env: { ...process.env, PORT: port }
        });

        server.on('error', (err) => {
            console.error('❌ Failed to start server:', err);
            process.exit(1);
        });

        // Wait for server to start, then open browser
        setTimeout(() => {
            openBrowser(url);
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
