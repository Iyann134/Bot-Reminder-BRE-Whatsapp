import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { handleCommand } from './handlers/commandHandler.js';
import { startReminderScheduler } from './services/reminderService.js';

// HTTP Keep-Alive Server for Render.com Web Service Health Check
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('🔥 BRE WhatsApp Operations Agent is ONLINE & ACTIVE 24/7!');
}).listen(PORT, () => {
  console.log(`🌐 Keep-Alive HTTP Healthcheck listening on port ${PORT}`);
});

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
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('🔴 WA Connection closed. Reconnecting...', shouldReconnect);
      if (shouldReconnect) {
        startBot();
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
      if (!msg || !msg.message || msg.key.fromMe) return;

      const remoteJid = msg.key.remoteJid;
      if (!remoteJid) return;

      // Extract message text from multiple message structures
      const messageText = 
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        msg.message.videoMessage?.caption ||
        '';

      if (!messageText) return;

      const senderPhone = remoteJid;
      const response = await handleCommand(senderPhone, messageText);

      if (response) {
        await sock.sendMessage(remoteJid, { text: response }, { quoted: msg });
        console.log(`💬 Handled command from ${remoteJid}: "${messageText.slice(0, 30)}..."`);
      }
    } catch (err) {
      console.error('Error handling WhatsApp message:', err);
    }
  });
}

startBot().catch(err => console.error('Fatal error starting BRE Bot:', err));
