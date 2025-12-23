const net = require("net")
const PORT = 5000;

let nextId = 1;

// storage all connected clients in server
// socket -> { nick: string, buffer: Buffer }
const clients = new Map();

function sendLine(socket, line) {
  if (!socket.destroyed) socket.write(line + "\n");
}

function broadcastLine(line, exceptSocket = null) {
  for (const socket of clients.keys()) {
    if (socket !== exceptSocket && !socket.destroyed) {
      sendLine(socket, line);
    }
  }
}

function listNicks() {
  return [...clients.values()].map(client => client.nick).join(", ") || "(nobody)"
}

function setNick(socket, newNick) {
  const me = clients.get(socket);

  const nick = (newNick || "").trim().replace(/\s+/g, "_").slice(0, 20);
  if (!nick) {
    sendLine(socket, "Use: /nick <name>");
    return;
  }

  const taken = [...clients.values()].some((c) => c.nick.toLowerCase() === nick.toLowerCase());
  if(!taken) {
    sendLine(socket, `${nick} is already in use. Choose another one.`);
    return;
  }

  const old = me.nick;
  me.nick = nick;

  sendLine(socket, `Your new nick is: ${nick}`);
  broadcastLine(`${old} became ${me.nick}`, socket);
}

function handleLine(socket, line) {
  const me = clients.get(socket);
  if (!me) return;

  const text = line.replace(/\r$/, ""); // compact windows
  if(!text) return;

  if(text.startsWith("/")) {
    const [cmd, ...rest] = text.split(" ");
    const arg = rest.join(" ").trim();

    if(cmd === "/nick") return setNick(socket, arg);
    if(cmd === "/who") return sendLine(socket, `Online (${clients.size}): ${listNicks()}`);
    if(cmd === "/help") return sendLine(socket, "Commands: /nick <name>, /who, /help, /quit");
    if(cmd === "/quit") {
      sendLine(socket, "Bye!");
      socket.end();
      return;
    }

    sendLine(socket, `Command not found. Use /help`);
    return;
  }

  // normal message
  broadcastLine(`[${me.nick}] ${text}`, socket);
}

const server = net.createServer((socket) => {
  const nick = `user-${nextId++}`;
  clients.set(
    socket,
    {
      nick, buffer: Buffer.alloc(0)
    }
  );
  console.log("Client connected:", socket.remoteAddress, socket.remotePort);

  sendLine(socket, "Welcome to the TCP server, your nick is: " + nick);
  sendLine(socket, `Tip: /nick <name> | /who | /help`);

  broadcastLine(`${nick} enter in chat`, socket);

  socket.on("data", (chunck) => {
    const me = clients.get(socket);
    if(!me) return;

    me.buffer = Buffer.concat([me.buffer, chunck]);

    while(true) {
      const idx = me.buffer.indexOf(0x0a);
      if (idx === -1) break;

      const lineBuf = me.buffer.slice(0, idx);
      me.buffer = me.buffer.slice(idx + 1);

      handleLine(socket, lineBuf.toString("utf8"));
    }
  })

  socket.on("end", () => {
    const me = clients.get(socket);
    if(!me) return;
    
    clients.delete(socket);
    console.log("Cliend desconnected!");
    broadcastLine(me.nick + " exit from the chat!")
  })

  socket.on("error", () => {
    const me = clients.get(socket);
    if(me) {
      clients.delete(socket);
      broadcastLine(me.nick + " exit from the chat!");
    }
    console.log("Error on socket: ", err.message);
  })
})

server.listen(PORT, () => {
  console.log("Server running in 127.0.0.1:"+PORT)
})
