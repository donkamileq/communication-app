const chat = document.getElementById('chat');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');

// Function to get query parameters from URL
function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

const chatId = getQueryParam('chatId');
const password = getQueryParam('password');

if (!chatId || !password) {
    alert('Missing chatId or password in the URL.');
}

// Generate a unique client ID
const clientId = generateUniqueId();

// Establishing a WebSocket connection
const socket = new WebSocket(`ws://localhost:8080/ws?chatId=${encodeURIComponent(chatId)}&password=${encodeURIComponent(password)}`);

// Fixed encryption key (for testing purposes)
const encryptionKey = '12345678901234567890123456789012';

socket.addEventListener('open', function (event) {
    console.log('Connected to WebSocket server');
});

socket.addEventListener('error', function (event) {
    console.error('WebSocket error:', event);
    alert('Unable to connect to the chat. Please check your chat ID and password.');
});

// Intersection Observer to detect when a message becomes visible
const observer = new IntersectionObserver((entries) => {
    entries.forEach(async (entry) => {
        if (entry.isIntersecting) {
            const messageElement = entry.target;
            const messageId = messageElement.dataset.messageId;

            // Send an ACK for this message, if it has not already been sent
            if (!messageElement.dataset.ackSent) {
                const ackContent = {
                    type: 'ACK',
                    id: messageId,
                    senderId: clientId
                };
                const ackMessage = await encrypt(JSON.stringify(ackContent));
                socket.send(ackMessage);
                messageElement.dataset.ackSent = 'true';
                console.log(`Sent ACK for message ${messageId}`);
            }

            // Stop observing the element
            observer.unobserve(messageElement);
        }
    });
}, {
    threshold: 0.5 // A message is considered visible when 50% of its height is in the view area
});

// Handle incoming messages
socket.addEventListener('message', async function (event) {
    const encryptedMessage = event.data;
    try {
        const decryptedMessage = await decrypt(encryptedMessage);
        const messageContent = JSON.parse(decryptedMessage);

        // Ignore messages sent by ourselves
        if (messageContent.senderId === clientId) {
            return;
        }

        if (messageContent.type === 'ACK') {
            // Received ACK for our message
            console.log(`Received ACK for message ${messageContent.id}`);

            // Find the message element and schedule deletion
            const messageElement = document.querySelector(`[data-message-id='${messageContent.id}']`);
            if (messageElement) {
                setTimeout(() => {
                    if (chat.contains(messageElement)) {
                        chat.removeChild(messageElement);
                    }
                }, 10000);
            }
        } else if (messageContent.type === 'MESSAGE') {
            // Received a new message
            const messageElement = document.createElement('div');
            messageElement.textContent = `Other user: ${messageContent.text}`;
            messageElement.dataset.messageId = messageContent.id;
            chat.appendChild(messageElement);

            // Observe visibility of the message
            observer.observe(messageElement);

            // Remove the message after 10 seconds
            setTimeout(() => {
                if (chat.contains(messageElement)) {
                    chat.removeChild(messageElement);
                }
            }, 10000);
        }
    } catch (e) {
        console.error('Decryption error:', e);
    }
});

// Send a message
sendButton.addEventListener('click', async function () {
    const message = messageInput.value;
    if (message !== '') {
        // Generate a unique message ID
        const messageId = generateUniqueId();
        const messageContent = {
            id: messageId,
            senderId: clientId,
            type: 'MESSAGE',
            text: message
        };
        const encryptedMessage = await encrypt(JSON.stringify(messageContent));
        socket.send(encryptedMessage);

        const messageElement = document.createElement('div');
        messageElement.textContent = `You: ${message}`;
        messageElement.dataset.messageId = messageId;
        chat.appendChild(messageElement);
        messageInput.value = '';

        // Listen for ACKs for this message
        const ackListener = async function (event) {
            const encryptedAck = event.data;
            try {
                const decryptedAck = await decrypt(encryptedAck);
                const ackContent = JSON.parse(decryptedAck);

                // Ignore ACKs sent by ourselves
                if (ackContent.senderId === clientId) {
                    return;
                }

                if (ackContent.type === 'ACK' && ackContent.id === messageId) {
                    // Receiver has read the message
                    console.log(`Confirmation of reading received for message ${messageId}`);
                    setTimeout(() => {
                        if (chat.contains(messageElement)) {
                            chat.removeChild(messageElement);
                        }
                    }, 10000);
                    socket.removeEventListener('message', ackListener);
                }
            } catch (e) {
                // Ignore decryption errors
            }
        };
        socket.addEventListener('message', ackListener);
    }
});

function generateUniqueId() {
    return '_' + Math.random().toString(36).substr(2, 9);
}

// Handle the Enter key
messageInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        sendButton.click();
    }
});

// Function to generate CryptoKey from text key
async function getKey() {
    if (!password) {
        throw new Error('Password is missing');
    }
    // Ensure the key is 32 bytes for AES-256
    const paddedPassword = password.padEnd(32, ' ');
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
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 12 bytes for AES-GCM
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
