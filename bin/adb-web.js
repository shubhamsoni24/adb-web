#!/usr/bin/env node

'use strict';

const { spawn, exec } = require('child_process');
const path = require('path');
const net = require('net');

// ── Colours ──────────────────────────────────────────────
const c = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  green:  '\x1b[32m',
  cyan:   '\x1b[36m',
  yellow: '\x1b[33m',
  magenta:'\x1b[35m',
  red:    '\x1b[31m',
};

function banner(port) {
  console.log('');
  console.log(`${c.magenta}${c.bold}  ╔═══════════════════════════════════════╗${c.reset}`);
  console.log(`${c.magenta}${c.bold}  ║   📱  ADB Web — APK Installer          ║${c.reset}`);
  console.log(`${c.magenta}${c.bold}  ╚═══════════════════════════════════════╝${c.reset}`);
  console.log('');
  console.log(`  ${c.green}✔${c.reset}  Server running on ${c.cyan}${c.bold}http://localhost:${port}${c.reset}`);
  console.log(`  ${c.green}✔${c.reset}  Opening browser…`);
  console.log('');
  console.log(`  ${c.dim}Press Ctrl+C to stop${c.reset}`);
  console.log('');
}

// ── Find a free port ─────────────────────────────────────
function getFreePort(preferred) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(preferred, () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on('error', () => {
      // preferred taken → let OS pick
      const srv2 = net.createServer();
      srv2.listen(0, () => {
        const { port } = srv2.address();
        srv2.close(() => resolve(port));
      });
    });
  });
}

// ── Open browser cross-platform ──────────────────────────
function openBrowser(url) {
  const platform = process.platform;
  let cmd;
  if (platform === 'win32') cmd = `start "" "${url}"`;
  else if (platform === 'darwin') cmd = `open "${url}"`;
  else cmd = `xdg-open "${url}"`;
  exec(cmd, (err) => {
    if (err) console.log(`  ${c.yellow}⚠${c.reset}  Could not auto-open browser. Visit: ${c.cyan}${url}${c.reset}`);
  });
}

// ── Main ─────────────────────────────────────────────────
async function main() {
  const preferredPort = parseInt(process.env.PORT || '3737', 10);
  const port = await getFreePort(preferredPort);

  // Pass the port to the server via env
  const serverPath = path.join(__dirname, '..', 'server.js');
  const child = spawn(process.execPath, [serverPath], {
    env: { ...process.env, PORT: String(port) },
    stdio: 'inherit',
  });

  child.on('error', (err) => {
    console.error(`${c.red}Failed to start server:${c.reset}`, err.message);
    process.exit(1);
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });

  // Give the server a moment to boot, then open browser
  setTimeout(() => {
    const url = `http://localhost:${port}`;
    banner(port);
    openBrowser(url);
  }, 800);

  // Forward signals
  ['SIGINT', 'SIGTERM'].forEach((sig) => {
    process.on(sig, () => {
      child.kill(sig);
    });
  });
}

main();
