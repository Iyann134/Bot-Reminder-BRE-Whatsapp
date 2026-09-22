import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { handleCommand } from './handlers/commandHandler.js';
import { startReminderScheduler } from './services/reminderService.js';

// Global Process Exception Safety Handlers
process.on('uncaughtException', (err) => {
  console.error('⚠️ Uncaught Exception detected:', err.message || err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Unhandled Promise Rejection at:', promise, 'reason:', reason);
});

// HTTP Keep-Alive Server for Web Hosting / Health Check
const PORT = process.env.PORT || 3000;

function startHealthCheckServer(portToUse) {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('🔥 BRE WhatsApp Operations Agent is ONLINE & ACTIVE 24/7!');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`⚠️ Port ${portToUse} is in use (EADDRINUSE). Trying port ${portToUse + 1}...`);
      startHealthCheckServer(portToUse + 1);
    } else {
      console.error('⚠️ Healthcheck HTTP Server error:', err.message);
    }
  });

  server.listen(portToUse, () => {
    console.log(`🌐 Keep-Alive HTTP Healthcheck listening on port ${portToUse}`);
  });
}

startHealthCheckServer(Number(PORT));

const authDir = path.resolve(process.cwd(), 'auth_info_baileys');

function ensureAuthDirClean() {
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
    return;
  }

  // Check if creds.json exists and is valid JSON
  const credsFile = path.join(authDir, 'creds.json');
  if (fs.existsSync(credsFile)) {
    try {
      const content = fs.readFileSync(credsFile, 'utf-8');
      if (!content || content.trim().length === 0) {
        throw new Error('creds.json is empty');
      }
      JSON.parse(content);
    } catch (err) {
      console.warn('⚠️ Sesi auth_info_baileys terdeteksi korup / tidak valid. Menghapus folder untuk me-reset sesi...');
      try {
        fs.rmSync(authDir, { recursive: true, force: true });
        fs.mkdirSync(authDir, { recursive: true });
      } catch (rmErr) {
        console.error('❌ Gagal mereset authDir:', rmErr.message);
      }
    }
  }
}

async function startBot() {
  ensureAuthDirClean();

  let state, saveCreds;
  try {
    const authState = await useMultiFileAuthState(authDir);
    state = authState.state;
    saveCreds = authState.saveCreds;
  } catch (authErr) {
    console.error('⚠️ Error menginisialisasi useMultiFileAuthState. Menghapus authDir dan mencoba ulang...', authErr.message);
    try {
      fs.rmSync(authDir, { recursive: true, force: true });
      fs.mkdirSync(authDir, { recursive: true });
    } catch (e) {}
    const authState = await useMultiFileAuthState(authDir);
    state = authState.state;
    saveCreds = authState.saveCreds;
  }

  const sock = makeWASocket({
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    auth: state,
    browser: ['BRE Secretary Agent', 'Chrome', '1.0.0'],
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 0,
    keepAliveIntervalMs: 25000,
    getMessage: async (key) => {
      return { conversation: '' };
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n📲 *SCAN QR CODE DI BAWAH UNTUK MENGHUBUNGKAN WA BRE:*');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const isLoggedOut = statusCode === DisconnectReason.loggedOut;
      const isBadSession = statusCode === DisconnectReason.badSession;
      const isForbidden = statusCode === 403;
      const isConnectionReplaced = statusCode === DisconnectReason.connectionReplaced;
      const isRestartRequired = statusCode === DisconnectReason.restartRequired;

      // Determine if session credentials should be reset completely
      const shouldResetSession = isLoggedOut || isBadSession || isForbidden || isConnectionReplaced;

      console.log(`🔴 WA Connection closed. Status Code: ${statusCode || 'unknown'}. Reset Required: ${shouldResetSession}`);

      // Clean up event listeners from the closed socket instance
      sock.ev.removeAllListeners();

      if (shouldResetSession) {
        console.log(`⚠️ Sesi WhatsApp terputus / tidak valid (Status Code: ${statusCode || 'unknown'}).`);
        console.log('🗑️ Menghapus folder auth_info_baileys & menyiapkan QR Code baru dalam 2 detik...');
        try {
          fs.rmSync(authDir, { recursive: true, force: true });
        } catch (e) {
          console.error('❌ Gagal menghapus authDir:', e.message);
        }
        setTimeout(() => {
          startBot();
        }, 2000);
      } else if (isRestartRequired) {
        console.log('🔄 Restart diperlukan oleh server WhatsApp (Status Code: 515). Menghubungkan kembali dalam 1 detik...');
        setTimeout(() => {
          startBot();
        }, 1000);
      } else {
        console.log('🔄 Mencoba menghubungkan kembali (Reconnecting) dalam 3 detik...');
        setTimeout(() => {
          startBot();
        }, 3000);
      }
    } else if (connection === 'open') {
      console.log('✅ *BRE WHATSAPP BOT IS ONLINE & READY!* 🚀');
      console.log(`🤖 Agent: BRE Operations`);
      console.log(`⏰ Timezone: ${process.env.TIMEZONE || 'Asia/Jakarta'}`);
      
      // Start proactive reminder scheduler
      startReminderScheduler(sock);
    }
  });

  function extractMessageText(msg) {
    if (!msg || !msg.message) return '';

    let content = msg.message;

    // Unwrap ephemeral (disappearing messages), viewOnce, document wrappers
    if (content.ephemeralMessage) {
      content = content.ephemeralMessage.message;
    }
    if (content.viewOnceMessage) {
      content = content.viewOnceMessage.message;
    }
    if (content.viewOnceMessageV2) {
      content = content.viewOnceMessageV2.message;
    }
    if (content.documentWithCaptionMessage) {
      content = content.documentWithCaptionMessage.message;
    }

    return (
      content?.conversation ||
      content?.extendedTextMessage?.text ||
      content?.imageMessage?.caption ||
      content?.videoMessage?.caption ||
      ''
    );
  }

  sock.ev.on('messages.upsert', async (m) => {
    try {
      const msg = m.messages[0];
      if (!msg || !msg.message) return;

      const remoteJid = msg.key.remoteJid;
      // Ignore broadcast status updates
      if (!remoteJid || remoteJid === 'status@broadcast') return;

      // Identify actual sender JID (works for both private chat & group chats)
      const senderJid = msg.key.participant || remoteJid;
      const messageText = extractMessageText(msg);

      if (!messageText || typeof messageText !== 'string') return;

      console.log(`📩 [PESAN MASUK] dari ${senderJid} (fromMe: ${msg.key.fromMe}): "${messageText}"`);

      const response = await handleCommand(senderJid, messageText);

      if (response) {
        await sock.sendMessage(remoteJid, { text: response }, { quoted: msg });
        console.log(`💬 [RESPONS TERKIRIM] ke ${remoteJid}`);
      }
    } catch (err) {
      console.error('❌ Error handling WhatsApp message:', err);
    }
  });
}

startBot().catch(err => console.error('Fatal error starting BRE Bot:', err));
