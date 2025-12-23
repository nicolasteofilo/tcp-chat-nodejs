# TCP Chat (Node.js)

TCP chat server and CLI client that illustrate sockets, framing, and a minimal application-layer protocol.

## Features
- Multi-client TCP server using Node's `net` module
- Line-based framing (`\n`) to handle TCP streams safely
- Nicknames, broadcasts, action messages (`/me`)
- Direct messages with `/msg` and quick replies with `/reply`
- Load test script to simulate many clients

## Project Layout

```txt
tcp-chat/
  server.js        # TCP chat server
  client.js        # Interactive CLI client
  load_test.js     # Load testing tool (simulates many clients)
  certs/           # (optional) if you later add TLS
  README.md
```

## Requirements
- Node.js **18+**
- (Optional) `openssl` if you later add TLS

## Quick Start
1) Start the server
```bash
node server.js
```
Server listens on `127.0.0.1:5000`.

2) Start one or more clients
```bash
node client.js
```
Use multiple terminals for multiple clients. To connect elsewhere: `node client.js <host> <port>`.

3) (Optional) Start with a nickname  
`node client.js --nick alice` or `node client.js 127.0.0.1 5000 -n alice`

## Commands (run inside the client)

| Command | Description | Example |
| --- | --- | --- |
| `/nick <name>` | Set or change your nickname (`spaces → _`). | `/nick alice` |
| `/who` | List connected users. | `/who` |
| `/me <action>` | Send an action message to everyone. | `/me is coding TCP` |
| `/msg <nick> <text>` | Send a private message to a user. | `/msg bob hey` |
| `/reply <text>` | Reply to the last DM peer. | `/reply on it` |
| `/help` | Show available commands. | `/help` |
| `/quit` | Disconnect from the server. | `/quit` |

## How It Works
- TCP is a byte stream, so a single `data` event may contain partial or multiple messages. Newline framing (`\n`) buffers bytes until a full line is ready.
- Server keeps socket state (nick, buffer) plus DM routing (`lastDmPeer`) for `/reply`.
- Each client gets its own socket; the server listens on port `5000` by default.

## Load Testing
Start the server, then in another terminal:
```bash
node load_test.js --clients 50 --messages 5 --interval 200
```
Options: `--host` (127.0.0.1), `--port` (5000), `--clients|-c`, `--messages|-m`, `--interval <ms>`.  
Example: `node load_test.js --host 127.0.0.1 --port 5000 -c 100 -m 10 --interval 100`

## Troubleshooting
- `write after end`: guard writes (`socket.writable`, `socket.writableEnded`, `socket.destroyed`) and drop clients on quit/disconnect.
- Messages merged/split: expected without framing; newline framing solves it here.

## License
MIT (or pick your preferred license).
