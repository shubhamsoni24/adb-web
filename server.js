const express = require('express');
const multer = require('multer');
const { WebSocketServer } = require('ws');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(express.static(__dirname));

// --- Config persistence ---
const CONFIG_FILE = path.join(__dirname, 'config.json');
let config = { adbPath: 'adb' };
if (fs.existsSync(CONFIG_FILE)) {
  try { config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch(e) {}
}
function saveConfig() {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// --- Upload setup ---
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e4);
    cb(null, unique + '-' + file.originalname);
  }
});
const upload = multer({ storage, fileFilter: (req, file, cb) => {
  if (file.originalname.endsWith('.apk')) cb(null, true);
  else cb(new Error('Only .apk files allowed'));
}});

// --- WebSocket clients ---
const clients = new Set();
wss.on('connection', ws => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
});

function broadcast(data) {
  const msg = JSON.stringify(data);
  clients.forEach(ws => { if (ws.readyState === 1) ws.send(msg); });
}

function log(level, message, extra = {}) {
  broadcast({ type: 'log', level, message, timestamp: new Date().toISOString(), ...extra });
  console.log(`[${level.toUpperCase()}] ${message}`);
}

// --- ADB helper ---
function adbExec(args, onData, onError, onDone) {
  const adb = config.adbPath || 'adb';
  const proc = spawn(adb, args, { shell: true });
  let stdout = '', stderr = '';
  proc.stdout.on('data', d => { const s = d.toString(); stdout += s; if (onData) onData(s); });
  proc.stderr.on('data', d => { const s = d.toString(); stderr += s; if (onError) onError(s); });
  proc.on('close', code => { if (onDone) onDone(code, stdout, stderr); });
  return proc;
}

function adbPromise(args) {
  return new Promise((resolve, reject) => {
    adbExec(args, null, null, (code, stdout, stderr) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr.trim() || `Exit code ${code}`));
    });
  });
}

// --- Routes ---

// Config
app.get('/api/config', (req, res) => res.json(config));
app.post('/api/config', (req, res) => {
  const { adbPath } = req.body;
  if (adbPath !== undefined) config.adbPath = adbPath;
  saveConfig();
  res.json({ ok: true, config });
});

// ADB version / status
app.get('/api/adb/status', async (req, res) => {
  try {
    const version = await adbPromise(['version']);
    res.json({ ok: true, version });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// List devices
app.get('/api/devices', async (req, res) => {
  try {
    const raw = await adbPromise(['devices', '-l']);
    const lines = raw.split('\n').slice(1).filter(l => l.trim() && !l.includes('* daemon'));
    const devices = lines.map(line => {
      const parts = line.trim().split(/\s+/);
      const serial = parts[0];
      const state = parts[1];
      const info = {};
      parts.slice(2).forEach(p => {
        const [k, v] = p.split(':');
        if (k && v) info[k] = v;
      });
      return { serial, state, model: info.model || info.device || 'Unknown', product: info.product || '', transport: info.transport_id || '' };
    }).filter(d => d.serial && d.state);
    res.json({ ok: true, devices });
  } catch (e) {
    res.json({ ok: false, error: e.message, devices: [] });
  }
});

// List uploaded APKs
app.get('/api/apks', (req, res) => {
  try {
    const files = fs.readdirSync(UPLOAD_DIR)
      .filter(f => f.endsWith('.apk'))
      .map(f => {
        const stat = fs.statSync(path.join(UPLOAD_DIR, f));
        return { filename: f, size: stat.size, mtime: stat.mtime };
      })
      .sort((a, b) => b.mtime - a.mtime);
    res.json({ ok: true, files });
  } catch (e) {
    res.json({ ok: false, files: [] });
  }
});

// Upload APK
app.post('/api/upload', upload.single('apk'), (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: 'No file uploaded' });
  log('info', `📦 Uploaded: ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(2)} MB)`);
  res.json({ ok: true, filename: req.file.filename, originalName: req.file.originalname, size: req.file.size });
});

// Delete APK
app.delete('/api/apks/:filename', (req, res) => {
  const filePath = path.join(UPLOAD_DIR, req.params.filename);
  if (!filePath.startsWith(UPLOAD_DIR)) return res.status(400).json({ ok: false });
  try {
    fs.unlinkSync(filePath);
    res.json({ ok: true });
  } catch (e) {
    res.status(404).json({ ok: false, error: e.message });
  }
});

// Install APK
app.post('/api/install', (req, res) => {
  const { filename, serial, flags } = req.body;
  if (!filename) return res.status(400).json({ ok: false, error: 'filename required' });
  
  const filePath = path.join(UPLOAD_DIR, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ ok: false, error: 'File not found' });
  
  const args = [];
  if (serial) { args.push('-s'); args.push(serial); }
  args.push('install');
  if (flags && flags.replace) args.push('-r');
  if (flags && flags.grant) args.push('-g');
  if (flags && flags.downgrade) args.push('-d');
  if (flags && flags.test) args.push('-t');
  args.push(filePath);

  log('info', `🚀 Installing ${filename}${serial ? ' on ' + serial : ''}...`, { apk: filename, device: serial });
  
  const installId = Date.now().toString();
  res.json({ ok: true, installId });

  adbExec(args,
    (data) => log('stdout', data.trim(), { installId }),
    (data) => log('stderr', data.trim(), { installId }),
    (code, stdout, stderr) => {
      if (code === 0 && (stdout + stderr).includes('Success')) {
        log('success', `✅ Installation SUCCESSFUL: ${filename}`, { installId, result: 'success' });
      } else if (code === 0) {
        log('success', `✅ Done (code 0): ${filename}`, { installId, result: 'success' });
      } else {
        const errMsg = (stdout + stderr).match(/INSTALL_FAILED[^\n]*/)?.[0] || 'Unknown error';
        log('error', `❌ Installation FAILED: ${errMsg}`, { installId, result: 'error' });
      }
    }
  );
});

// ADB shell command (safe subset)
app.post('/api/shell', (req, res) => {
  const { serial, command } = req.body;
  if (!command) return res.status(400).json({ ok: false, error: 'command required' });

  // Whitelist safe commands
  const SAFE = ['getprop', 'pm list packages', 'dumpsys battery', 'wm size', 'settings get', 'cat /proc/meminfo', 'uptime'];
  const isSafe = SAFE.some(s => command.startsWith(s));
  if (!isSafe) return res.status(403).json({ ok: false, error: 'Command not in safe list' });

  const args = [];
  if (serial) { args.push('-s'); args.push(serial); }
  args.push('shell');
  args.push(command);

  log('info', `🐚 Shell: adb ${args.join(' ')}`);
  adbExec(args, null, null, (code, stdout, stderr) => {
    res.json({ ok: code === 0, output: stdout, error: stderr });
  });
});

// Generic ADB command (safe subset)
app.post('/api/adb', (req, res) => {
  const { serial, action, extra } = req.body;
  const ALLOWED_ACTIONS = {
    'reboot': ['reboot'],
    'reboot-recovery': ['reboot', 'recovery'],
    'reboot-bootloader': ['reboot', 'bootloader'],
    'reboot-fastboot': ['reboot', 'fastboot'],
    'kill-server': ['kill-server'],
    'start-server': ['start-server'],
    'uninstall': extra ? ['uninstall', extra] : null,
    'logcat': ['logcat', '-d', '-t', '200'],
  };

  const cmdArgs = ALLOWED_ACTIONS[action];
  if (!cmdArgs) return res.status(400).json({ ok: false, error: 'Unknown action' });

  const args = [];
  if (serial) { args.push('-s'); args.push(serial); }
  args.push(...cmdArgs);

  log('info', `⚡ ADB: ${action}${serial ? ' [' + serial + ']' : ''}${extra ? ' ' + extra : ''}`);
  
  adbExec(args, null, null, (code, stdout, stderr) => {
    const output = (stdout + stderr).trim();
    log(code === 0 ? 'success' : 'error', output || (code === 0 ? 'Done' : 'Error'));
    res.json({ ok: code === 0, output, code });
  });
});

// Uninstall package
app.post('/api/uninstall', (req, res) => {
  const { serial, packageName, keepData } = req.body;
  if (!packageName) return res.status(400).json({ ok: false, error: 'packageName required' });

  const args = [];
  if (serial) { args.push('-s'); args.push(serial); }
  args.push('uninstall');
  if (keepData) args.push('-k');
  args.push(packageName);

  log('info', `🗑️ Uninstalling ${packageName}...`);
  const installId = Date.now().toString();
  res.json({ ok: true, installId });

  adbExec(args,
    (data) => log('stdout', data.trim(), { installId }),
    (data) => log('stderr', data.trim(), { installId }),
    (code, stdout, stderr) => {
      const success = (stdout + stderr).includes('Success');
      log(success ? 'success' : 'error',
        success ? `✅ Uninstalled ${packageName}` : `❌ Failed: ${(stdout + stderr).trim()}`,
        { installId, result: success ? 'success' : 'error' }
      );
    }
  );
});

// Serve main HTML
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 3737;
server.listen(PORT, () => {
  console.log(`\n🚀 ADB APK Installer running at http://localhost:${PORT}\n`);
});
