import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { handleCommand } from './handlers/commandHandler.js';
import { startReminderScheduler } from './services/reminderService.js';

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
if (!fs.existsSync(authDir)) {
  fs.mkdirSync(authDir, { recursive: true });
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  const sock = makeWASocket({
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    auth: state,
    browser: ['BRE Secretary Agent', 'Chrome', '1.0.0']
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
      console.log(`🔴 WA Connection closed. Status Code: ${statusCode || 'unknown'}. Logged out: ${isLoggedOut}`);

      // Clean up event listeners from the closed socket instance
      sock.ev.removeAllListeners();

      if (isLoggedOut) {
        console.log('⚠️ Sesi WhatsApp telah terputus / Logged Out.');
        console.log('🗑️ Menghapus folder auth_info_baileys & menyiapkan QR Code baru dalam 2 detik...');
        try {
          fs.rmSync(authDir, { recursive: true, force: true });
        } catch (e) {
          console.error('Gagal menghapus authDir:', e);
        }
        setTimeout(() => {
          startBot();
        }, 2000);
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

  sock.ev.on('messages.upsert', async (m) => {
    try {
      const msg = m.messages[0];
      if (!msg || !msg.message) return;

      const remoteJid = msg.key.remoteJid;
      // Ignore broadcast status updates
      if (!remoteJid || remoteJid === 'status@broadcast') return;

      // Identify actual sender JID (works for both private chat & group chats)
      const senderJid = msg.key.participant || remoteJid;

      // Extract message text from multiple message structures
      const messageText = 
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        msg.message.videoMessage?.caption ||
        '';

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
