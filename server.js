const net = require("net")
const PORT = 5000;

const dgram = require("node:dgram")


const server = net.createServer((socket) => {
  console.log("Client connected:", socket.remoteAddress, socket.remotePort, socket.remoteFamily);

  socket.write("Welcome to the TCP server\n")

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
