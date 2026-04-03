#!/usr/bin/env node

/**
 * Wrapper script to run the Farmkart stats scraper from the root directory
 * Usage: node stats.js
 */

const { spawn } = require('child_process');
const path = require('path');

const scriptPath = path.join(__dirname, 'farmkart-automation', 'stats.js');

const child = spawn('node', [scriptPath], {
    cwd: path.dirname(scriptPath),
    stdio: 'inherit',
    env: { ...process.env }
});

child.on('error', (err) => {
    console.error('Failed to start stats scraper:', err);
    process.exit(1);
});

child.on('exit', (code) => {
    process.exit(code);
});
