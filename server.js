const net = require("net")
const PORT = 5000;

// storage all connected clients in server
const clients = new Set();

function broadcast(msg, exceptSocket = null) {
  for (const client of clients) {
    if (client !== exceptSocket && !client.destroyed) {
      client.write(msg)
    }
  }
}

const server = net.createServer((socket) => {
  clients.add(socket);
  console.log("Client connected:", socket.remoteAddress, socket.remotePort, socket.remoteFamily);

  socket.write("Welcome to the TCP server\n");
  socket.write("Open another terminal and connect with other client!\n");

  broadcast("Someone enter in chat!\n", socket);

  socket.on("data", (chunck) => {
    // chunck is a Buffer (bytes)
    const text = chunck.toString("utf8");

    // send message to the orther client
    broadcast(text, socket);
  })

  socket.on("end", () => {
    clients.delete(socket);
    console.log("Cliend desconnected!\n");
    broadcast("Someone exit from the chat!\n")
  })

  socket.on("error", () => {
    clients.delete(socket);
    console.log("Error on socket: ", err.message);
  })
})

server.listen(PORT, () => {
  console.log("Server running in 127.0.0.1:"+PORT)
})
