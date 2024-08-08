const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const fastcsv = require('fast-csv');

// Pengaturan bot
const token = '7310061862:AAEIvWMx2hj38VSIsiTV1bhE8KIQEiHwteA'; // Ganti dengan token bot Anda
const ownerId = '7365835326'; // Ganti dengan ID Telegram Anda
let PASSWORD = 'abeb2903';   // Ganti dengan password yang Anda inginkan

// Inisialisasi bot
const bot = new TelegramBot(token, { polling: true });

// Load subscribers
let subscribers = [];
function saveSubscribers() {
  fs.writeFileSync('subscribers.json', JSON.stringify(subscribers, null, 2));
}
function loadSubscribers() {
  if (fs.existsSync('subscribers.json')) {
    subscribers = JSON.parse(fs.readFileSync('subscribers.json'));
  }
}
loadSubscribers();

// Store user state
let userState = {};

// Fungsi untuk mengkonversi TXT ke VCF
function convertTxtToVcf(txtPath, vcfPath, contactName, contactCount, callback) {
  const contacts = [];
  const readStream = fs.createReadStream(txtPath);

  fastcsv.parseStream(readStream, { headers: false })
    .on('data', (data) => {
      const phone = data[0]?.trim();
      if (phone) {
        contacts.push(`BEGIN:VCARD\nVERSION:3.0\nFN:${contactName} ${contacts.length + 1}\nTEL:+${phone}\nEND:VCARD`);
      }
    })
    .on('end', () => {
      const parts = Math.ceil(contacts.length / contactCount);
      for (let i = 0; i < parts; i++) {
        const partContacts = contacts.slice(i * contactCount, (i + 1) * contactCount);
        fs.writeFileSync(`${vcfPath},PART${i + 1}.vcf`, partContacts.join('\n'));
      }
      callback(parts);
    });
}

// Handle pesan /start
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "Selamat datang! Kirim format dahulu dengan perintah: NAMA_FILE,NAMA_KONTAK,JUMLAH_KONTAK.\nKemudian kirim file TXT yang akan dikonversi ke VCF.\n\nGunakan /subscribe <password> untuk berlangganan.");
});

// Handle perintah /subscribe
bot.onText(/\/subscribe (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const password = match[1];

  if (password === PASSWORD) {
    if (!subscribers.some(sub => sub.userId === userId)) {
      subscribers.push({ userId, chatId });
      saveSubscribers();
      bot.sendMessage(chatId, "Anda telah berhasil berlangganan!");
    } else {
      bot.sendMessage(chatId, "Anda sudah berlangganan.");
    }
  } else {
    bot.sendMessage(chatId, "Password yang Anda masukkan salah.");
  }
});

// Handle perintah /listprem
bot.onText(/\/listprem/, (msg) => {
  if (msg.from.id.toString() === ownerId) {
    const list = subscribers.map(sub => `User ID: ${sub.userId}, Chat ID: ${sub.chatId}`).join('\n');
    bot.sendMessage(msg.chat.id, `Daftar pengguna berlangganan:\n\n${list}`);
  } else {
    bot.sendMessage(msg.chat.id, "Anda tidak memiliki izin untuk menggunakan perintah ini.");
  }
});

// Handle perintah /delprem
bot.onText(/\/delprem (.+)/, (msg, match) => {
  if (msg.from.id.toString() === ownerId) {
    const userId = match[1];
    subscribers = subscribers.filter(sub => sub.userId.toString() !== userId);
    saveSubscribers();
    bot.sendMessage(msg.chat.id, `Pengguna dengan User ID ${userId} telah dihapus dari daftar langganan.`);
  } else {
    bot.sendMessage(msg.chat.id, "Anda tidak memiliki izin untuk menggunakan perintah ini.");
  }
});

// Handle perintah /resetpassword
bot.onText(/\/resetpassword (.+)/, (msg, match) => {
  if (msg.from.id.toString() === ownerId) {
    const newPassword = match[1];
    if (newPassword) {
      PASSWORD = newPassword;
      bot.sendMessage(msg.chat.id, "Password berhasil diperbarui.");
    } else {
      bot.sendMessage(msg.chat.id, "Password baru tidak valid.");
    }
  } else {
    bot.sendMessage(msg.chat.id, "Anda tidak memiliki izin untuk menggunakan perintah ini.");
  }
});

// Handle format yang dikirim
bot.onText(/(.+),(.+),(.+)/, (msg, match) => {
  const userId = msg.from.id;

  if (!subscribers.some(sub => sub.userId === userId) && userId.toString() !== ownerId) {
    return bot.sendMessage(msg.chat.id, "Anda tidak memiliki akses. Silakan berlangganan dengan menggunakan perintah /subscribe <password>.");
  }

  const [namaFile, namaKontak, jumlahKontak] = match.slice(1, 4);

  if (!namaFile || !namaKontak || !jumlahKontak) {
    return bot.sendMessage(msg.chat.id, "Format salah! Gunakan format: NAMA_FILE,NAMA_KONTAK,JUMLAH_KONTAK.");
  }

  const contactCount = parseInt(jumlahKontak);
  if (isNaN(contactCount)) {
    return bot.sendMessage(msg.chat.id, "Jumlah kontak harus berupa angka.");
  }

  userState[userId] = { namaFile, namaKontak, contactCount };
  bot.sendMessage(msg.chat.id, "Format diterima! Sekarang kirim file TXT yang akan dikonversi.");
});

// Fungsi untuk menangkap angka di ujung nama file
function extractNumberFromFilename(filename) {
  const match = filename.match(/(\d+)(?!.*\d)/);
  if (match) {
    const num = parseInt(match[1]);
    if (num >= 1 && num <= 1000) {
      return num;
    }
  }
  return null;
}

// Handle file TXT yang dikirim
bot.on('message', (msg) => {
  const userId = msg.from.id;

  if (msg.document && userState[userId]) {
    const { namaFile, namaKontak, contactCount } = userState[userId];

    const fileId = msg.document.file_id;
    const originalFileName = msg.document.file_name;
    const txtPath = `${namaFile}.txt`;
    const vcfPath = `${namaFile}`;

    bot.downloadFile(fileId, './')
      .then((filePath) => {
        fs.renameSync(filePath, txtPath);

        // Extract the valid number from the end of the file name
        const fileNumber = extractNumberFromFilename(originalFileName) || '000';

        convertTxtToVcf(txtPath, `${vcfPath} ${fileNumber}`, namaKontak, contactCount, (parts) => {
          const sendFile = (part) => {
            return new Promise((resolve, reject) => {
              bot.sendDocument(msg.chat.id, `${vcfPath} ${fileNumber},PART${part}.vcf`, {}, { contentType: 'text/x-vcard' })
                .then(() => resolve())
                .catch(err => reject(err));
            });
          };

          let promiseChain = Promise.resolve();
          for (let i = 1; i <= parts; i++) {
            promiseChain = promiseChain.then(() => sendFile(i));
          }

          promiseChain
            .then(() => {
              if (fs.existsSync(txtPath)) {
                fs.unlinkSync(txtPath);
              }
            })
            .catch(err => {
              bot.sendMessage(msg.chat.id, `Gagal mengirim file: ${err.message}`);
            });
        });
      })
      .catch((err) => {
        bot.sendMessage(msg.chat.id, `Gagal mengunduh file: ${err.message}`);
      });
  }
});
