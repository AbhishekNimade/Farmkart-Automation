#!/usr/bin/env node

/**
 * Wrapper script to run the Farmkart OFD automation from the root directory
 * Usage: node ofd.js [--startRow N] [--limit N]
 */

const { spawn } = require('child_process');
const path = require('path');

const scriptPath = path.join(__dirname, 'farmkart-automation', 'index.js');

// Pass all command line arguments to the actual script
const args = process.argv.slice(2);

const child = spawn('node', [scriptPath, ...args], {
    cwd: path.dirname(scriptPath),
    stdio: 'inherit',
    env: { ...process.env }
});

child.on('error', (err) => {
    console.error('Failed to start OFD automation:', err);
    process.exit(1);
});

child.on('exit', (code) => {
    process.exit(code);
});
