package main

import (
	"fmt"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

var clients = make(map[*websocket.Conn]bool)
var clientsMutex = sync.Mutex{}

func wsHandler(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}
	defer conn.Close()

	// Dodajemy nowego klienta do mapy
	clientsMutex.Lock()
	clients[conn] = true
	clientsMutex.Unlock()

	// Usuwamy klienta po zakończeniu połączenia
	defer func() {
		clientsMutex.Lock()
		delete(clients, conn)
		clientsMutex.Unlock()
	}()

	log.Println("Nowe połączenie:", conn.RemoteAddr())

	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			log.Println("read:", err)
			break
		}

		log.Printf("Odebrano od %s: %s", conn.RemoteAddr(), message)

		// Przesyłamy wiadomość do wszystkich innych klientów
		broadcastMessage(conn, message)
	}
}

func broadcastMessage(sender *websocket.Conn, message []byte) {
	clientsMutex.Lock()
	defer clientsMutex.Unlock()

	for client := range clients {
		if client != sender {
			err := client.WriteMessage(websocket.TextMessage, message)
			if err != nil {
				log.Printf("write to client failed: %v", err)
				client.Close()
				delete(clients, client)
			}
		}
	}
}

func main() {
	http.HandleFunc("/ws", wsHandler)
	fmt.Println("Serwer uruchomiony na :8080")
	err := http.ListenAndServe(":8080", nil)
	if err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}
