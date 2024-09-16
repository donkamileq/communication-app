const chat = document.getElementById('chat');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');

// Establishing a WebSocket connection
const socket = new WebSocket('ws://localhost:8080/ws');

socket.addEventListener('open', function (event) {
    console.log('Połączono z serwerem WebSocket');
});

socket.addEventListener('message', function (event) {
    const message = event.data;
    // Sprawdź, czy wiadomość nie jest od nas samych
    const messageElement = document.createElement('div');
    messageElement.textContent = `Inny użytkownik: ${message}`;
    chat.appendChild(messageElement);
});

sendButton.addEventListener('click', function () {
    const message = messageInput.value;
    if (message !== '') {
        socket.send(message);
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
