package main

import (
	"fmt"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

// Upgrader configuration for WebSocket connections
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	// Allow connections from any Origin
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// Maps to store clients in chat rooms
var rooms = make(map[string]map[*websocket.Conn]bool)
var roomsMutex = sync.Mutex{}

// Mapping of chatId to passwords (for simplicity)
var roomPasswords = map[string]string{
	"room1": "secret1",
	"room2": "secret2",
}

// WebSocket handler function
func wsHandler(w http.ResponseWriter, r *http.Request) {
	// Retrieve chatId and password from URL parameters
	chatId := r.URL.Query().Get("chatId")
	password := r.URL.Query().Get("password")

	if chatId == "" || password == "" {
		http.Error(w, "Missing chatId or password parameters", http.StatusBadRequest)
		return
	}

	// Verify the password for the given chatId
	expectedPassword, exists := roomPasswords[chatId]
	if !exists || password != expectedPassword {
		http.Error(w, "Invalid chatId or password", http.StatusUnauthorized)
		return
	}

	// Upgrade the HTTP connection to a WebSocket connection
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Upgrade error:", err)
		return
	}

	// Add the client to the appropriate chat room
	roomsMutex.Lock()
	if rooms[chatId] == nil {
		rooms[chatId] = make(map[*websocket.Conn]bool)
	}
	rooms[chatId][conn] = true
	roomsMutex.Unlock()

	// Remove the client from the room when the connection closes
	defer func() {
		roomsMutex.Lock()
		delete(rooms[chatId], conn)
		roomsMutex.Unlock()
		conn.Close()
	}()

	log.Printf("New connection in room %s from %s", chatId, conn.RemoteAddr())

	// Message handling loop
	for {
		messageType, message, err := conn.ReadMessage()
		if err != nil {
			log.Println("Read error:", err)
			break
		}

		log.Printf("Received from %s: %s", conn.RemoteAddr(), message)

		// Broadcast the message to other clients in the same room
		broadcastMessage(chatId, conn, messageType, message)
	}
}

// Function to broadcast messages to clients in a room
func broadcastMessage(chatId string, sender *websocket.Conn, messageType int, message []byte) {
	roomsMutex.Lock()
	defer roomsMutex.Unlock()

	for client := range rooms[chatId] {
		if client != sender {
			err := client.WriteMessage(messageType, message)
			if err != nil {
				log.Printf("Error sending to client %s: %v", client.RemoteAddr(), err)
				client.Close()
				delete(rooms[chatId], client)
			}
		}
	}
}

func main() {
	http.HandleFunc("/ws", wsHandler)
	fmt.Println("Server started on port :8080")
	err := http.ListenAndServe(":8080", nil)
	if err != nil {
		log.Fatal("ListenAndServe error: ", err)
	}
}
