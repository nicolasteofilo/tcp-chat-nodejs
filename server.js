const net = require("net")
const PORT = 5000;

const server = net.createServer((socket) => {
  console.log("Client connected:", socket.remoteAddress, socket.remotePort, socket.remoteFamily);

  socket.write("Welcome to the TCP server\n")
  socket.write("Type some text:")

  socket.on("data", (chunck) => {
    // chunck is a Buffer (bytes)
    const text = chunck.toString("utf8");
    console.log("Recevied from the client: ", JSON.stringify(text));
    socket.write("Eco: " + text)
  })

  socket.on("end", () => {
    console.log("Cliend desconnected")
  })

  socket.on("error", () => {
    console.log("Error on socket: ", err.message)
  })
})

server.listen(PORT, () => {
  console.log("Server running in 127.0.0.1:"+PORT)
})
