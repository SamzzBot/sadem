const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const token = '7457743354:AAGn3FtGjHTflLwcolak5WViImS0gdhgJ-Y'; // Ganti dengan token bot Anda

// Pengaturan owner
const ownerId = 7365835326; // Ganti dengan ID Telegram Anda
const botPassword = 'abeb2903'; // Ganti dengan password yang Anda inginkan
let authorizedUsers = []; // Menyimpan pengguna yang berhasil memasukkan password

const bot = new TelegramBot(token, { polling: true });

let namaFile = '';

// Fitur password untuk akses
bot.onText(/\/subscribe (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const password = match[1].trim();

    if (password === botPassword) {
        if (!authorizedUsers.includes(chatId)) {
            authorizedUsers.push(chatId);
            bot.sendMessage(chatId, 'Anda telah berhasil berlangganan.');
        } else {
            bot.sendMessage(chatId, 'Anda sudah berlangganan.');
        }
    } else {
        bot.sendMessage(chatId, 'Password yang Anda masukkan salah.');
    }
});

// Fitur /listprem untuk melihat pengguna yang berhasil memasukkan password
bot.onText(/\/listprem/, (msg) => {
    const chatId = msg.chat.id;
    if (chatId !== ownerId) {
        bot.sendMessage(chatId, 'Anda tidak memiliki akses untuk menggunakan perintah ini.');
        return;
    }

    if (authorizedUsers.length === 0) {
        bot.sendMessage(chatId, 'Tidak ada pengguna yang berlangganan.');
    } else {
        const userList = authorizedUsers.join(', ');
        bot.sendMessage(chatId, `Pengguna yang berlangganan: ${userList}`);
    }
});

// Fitur /delprem untuk menghapus pengguna yang memiliki akses ke bot
bot.onText(/\/delprem (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    if (chatId !== ownerId) {
        bot.sendMessage(chatId, 'Anda tidak memiliki akses untuk menggunakan perintah ini.');
        return;
    }

    const userId = match[1].trim();
    const userIndex = authorizedUsers.indexOf(Number(userId));
    
    if (userIndex !== -1) {
        authorizedUsers.splice(userIndex, 1);
        bot.sendMessage(chatId, `Pengguna dengan ID ${userId} telah dihapus.`);
    } else {
        bot.sendMessage(chatId, `Pengguna dengan ID ${userId} tidak ditemukan.`);
    }
});

// Fungsi untuk memeriksa apakah pengguna memiliki akses
function isAuthorized(chatId) {
    return chatId === ownerId || authorizedUsers.includes(chatId);
}

// Mengatur nama file
bot.onText(/\/filename (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    if (!isAuthorized(chatId)) {
        bot.sendMessage(chatId, 'Anda tidak memiliki akses untuk menggunakan bot ini.');
        return;
    }
    
    namaFile = match[1].trim();
    bot.sendMessage(chatId, `Nama file diatur menjadi ${namaFile}`);
});

// Memproses pesan teks dengan format tertentu
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    if (msg.text.startsWith('/filename') || msg.text.startsWith('/subscribe') || msg.text.startsWith('/listprem') || msg.text.startsWith('/delprem')) return;

    if (!isAuthorized(chatId)) {
        bot.sendMessage(chatId, 'Anda tidak memiliki akses untuk menggunakan bot ini.');
        return;
    }

    const lines = msg.text.trim().split('\n');
    if (lines.length === 0) return;

    let isiVCF = '';
    let currentName = '';
    let counter = 1;

    for (const line of lines) {
        if (isNaN(line)) {
            // Nama kontak baru
            currentName = line.trim();
            counter = 1; // Reset counter for new contact name
        } else {
            // Nomor telepon
            const nomorTelepon = line.startsWith('+') ? line.trim() : `+${line.trim()}`;
            isiVCF += `BEGIN:VCARD\nVERSION:3.0\nFN:${currentName} ${counter}\nTEL:${nomorTelepon}\nEND:VCARD\n`;
            counter++;
        }
    }

    if (namaFile === '') {
        bot.sendMessage(chatId, 'Nama file belum diatur. Gunakan perintah /filename untuk mengatur nama file.');
        return;
    }

    const filePath = `${namaFile}.vcf`;

    fs.writeFile(filePath, isiVCF, (err) => {
        if (err) {
            bot.sendMessage(chatId, 'Terjadi kesalahan saat menyimpan file VCF.');
            console.error(err);
            return;
        }

        bot.sendDocument(chatId, filePath).then(() => {
            fs.unlinkSync(filePath); // Hapus file setelah dikirim
        });
    });
});
