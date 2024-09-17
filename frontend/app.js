const chat = document.getElementById('chat');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');

// Establishing a WebSocket connection
const socket = new WebSocket('ws://localhost:8080/ws');

// Fixed encryption key (for testing purposes)
const encryptionKey = '12345678901234567890123456789012';

socket.addEventListener('open', function (event) {
    console.log('Połączono z serwerem WebSocket');
});

socket.addEventListener('message', async function (event) {
    const encryptedMessage = event.data;
    try {
        const decryptedMessage = await decrypt(encryptedMessage);
        const messageElement = document.createElement('div');
        messageElement.textContent = `Inny użytkownik: ${decryptedMessage}`;
        chat.appendChild(messageElement);
    } catch (e) {
        console.error('Decryption error:', e);
    }
});

sendButton.addEventListener('click', async function () {
    const message = messageInput.value;
    if (message !== '') {
        const encryptedMessage = await encrypt(message);
        socket.send(encryptedMessage);
        const messageElement = document.createElement('div');
        messageElement.textContent = `Ty: ${message}`;
        chat.appendChild(messageElement);
        messageInput.value = '';
    }
});

// Handle the Enter key
messageInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        sendButton.click();
    }
});


// Function to generate CryptoKey from text key
async function getKey() {
    const key = await window.crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(encryptionKey),
        "AES-GCM",
        false,
        ["encrypt", "decrypt"]
    );
    return key;    
}

async function encrypt(text) {
    const key = await getKey();
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 12 bajtów dla AES-GCM
    const encodedText = new TextEncoder().encode(text);
    const encrypted = await window.crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv
        },
        key,
        encodedText
    );

    // Combine iv and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    // Convert to Base64
    return btoa(String.fromCharCode(...combined));
}

async function decrypt(data) {
    const combined = Uint8Array.from(atob(data), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    const key = await getKey();
    const decrypted = await window.crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: iv
        },
        key,
        encrypted
    );

    return new TextDecoder().decode(decrypted);
}