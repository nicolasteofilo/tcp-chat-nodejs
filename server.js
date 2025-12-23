const net = require("net")
const PORT = 5000;

let nextId = 1;

// storage all connected clients in server
// socket -> { nick: string, buffer: Buffer }
const clients = new Map();
const lastDmPeer = new Map();

function sendLine(socket, line) {
  if (!socket.destroyed) socket.write(line + "\n");
}

function dropDmRefs(deadSocket) {
  lastDmPeer.delete(deadSocket);
  for (const [socket, peer] of lastDmPeer.entries()) {
    if (peer === deadSocket) lastDmPeer.delete(socket);
  }
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

function broadcastAllLine(line) {
  for (const socket of clients.keys()) {
    if (!socket.destroyed) {
      sendLine(socket, line);
    }
  }
}

function findSocketByNick(nick) {
  if (!nick || nick.length === 0) return null;
  const wanted = (nick || "").trim().toLowerCase();
  if (!wanted) return null;

  for (const [socket, client] of clients.entries()) {
    if (client.nick.toLowerCase() === wanted) return socket;
  }
  return null;
}

function setNick(socket, newNick) {
  const me = clients.get(socket);

  const nick = (newNick || "").trim().replace(/\s+/g, "_").slice(0, 20);
  if (!nick) {
    sendLine(socket, "Use: /nick <name>");
    return;
  }

  const taken = [...clients.values()].some((x) => x.nick.toLowerCase() === nick.toLowerCase());
  if (taken) {
    sendLine(socket, `Nome "${nick}" já está em uso.`);
    return;
  }

  const old = me.nick;
  me.nick = nick;

  if (!me.announced) {
    if (me.joinTimer) clearTimeout(me.joinTimer);
    me.joinTimer = null;

    sendLine(socket, `Nick: ${me.nick}`);
    announceJoin(socket);
    return;
  }

  // Caso já esteja anunciado, aí sim é uma troca pública de nick.
  sendLine(socket, `✅ Your nick is: ${me.nick}`);
  broadcastLine(`📢 ${old} became ${me.nick}`, socket);
  return;
}

function handleLine(socket, line) {
  const me = clients.get(socket);
  if (!me) return;

  const text = line.replace(/\r$/, ""); // compact windows
  if (!text) return;

  if (!me.announced && !text.startsWith("/nick")) {
    if (me.joinTimer) clearTimeout(me.joinTimer);
    me.joinTimer = null;
    announceJoin(socket);
  }

  if (text.startsWith("/")) {
    const [cmd, ...rest] = text.split(" ");
    const arg = rest.join(" ").trim();

    if (cmd === "/nick") return setNick(socket, arg);
    if (cmd === "/who") return sendLine(socket, `Online (${clients.size}): ${listNicks()}`);
    if (cmd === "/help") {
      sendLine(socket, "Available commands:");
      sendLine(socket, "  /nick <name>           Set or change your nickname (no spaces; use '_' if needed).");
      sendLine(socket, "  /who                   List online users.");
      sendLine(socket, "  /msg <nick> <text>     Send a private message (DM) to a specific user.");
      sendLine(socket, "  /reply <text>          Reply to the last user you exchanged DMs with.");
      sendLine(socket, "  /me <action>           Send an action message to everyone (e.g. \"/me is coding\").");
      sendLine(socket, "  /quit                  Disconnect from the server.");
      sendLine(socket, "  /help                  Show this help message.");
      return;
    }
    if (cmd === "/quit") {
      sendLine(socket, "Bye!");
      socket.end();
      return;
    }

    if (cmd === "/msg") {
      const [targetNick, ...messageParts] = rest;
      const msg = messageParts.join(" ").trim();

      if (!targetNick || !msg) {
        sendLine(socket, "Use: /msg <nick> <text>");
        return;
      }

      const targetSocket = findSocketByNick(targetNick);
      if (!targetSocket) {
        sendLine(socket, `User "${targetNick}" not found.`);
        return;
      }
      lastDmPeer.set(socket, targetSocket);
      lastDmPeer.set(targetSocket, socket);

      sendLine(targetSocket, `[private] [${me.nick}] ${msg}`);
      sendLine(socket, `[private to ${targetNick}] ${msg}`);
      return;
    }

    if (cmd === "/reply") {
      const msg = arg;
      if (!msg) {
        sendLine(socket, "Use: /reply <text>");
        return;
      }

      const targetSocket = lastDmPeer.get(socket);
      if (!targetSocket) {
        sendLine(socket, "No recent DM peer to reply to.");
        return;
      }

      if (targetSocket.destroyed || !clients.has(targetSocket)) {
        sendLine(socket, "Your recent DM peer is no longer available.");
        lastDmPeer.delete(socket);
        return;
      }

      sendLine(targetSocket, `[private] [${me.nick}] ${msg}`);
      sendLine(socket, `[private to ${clients.get(targetSocket).nick}] ${msg}`);
      return;
    }

    if (cmd === "/me") {
      if (!arg) {
        sendLine(socket, "Use: /me <action>");
        return;
      }

      // send to all (including me)
      broadcastAllLine(`* ${me.nick} ${arg}`);
      return;
    }

    sendLine(socket, `Command not found. Use /help`);
    return;
  }

  // normal message
  broadcastLine(`[${me.nick}] ${text}`, socket);
}

function announceJoin(socket) {
  const me = clients.get(socket);
  if (!me || me.announced) return;

  me.announced = true;
  broadcastLine(`${me.nick} enter in chat`, socket);
}

const server = net.createServer((socket) => {
  const nick = `user-${nextId++}`;
  clients.set(socket, { nick, buffer: Buffer.alloc(0), announced: false, joinTimer: null });
  console.log("Client connected:", socket.remoteAddress, socket.remotePort);

  sendLine(socket, "Welcome to the TCP server!");
  sendLine(socket, `Tip: /nick <name> | /who | /help`);

  // broadcastLine(`${nick} enter in chat`, socket);
  const me = clients.get(socket);
  me.joinTimer = setTimeout(() => announceJoin(socket), 300);

  socket.on("data", (chunck) => {
    const me = clients.get(socket);
    if (!me) return;

    me.buffer = Buffer.concat([me.buffer, chunck]);

    while (true) {
      const idx = me.buffer.indexOf(0x0a);
      if (idx === -1) break;

      const lineBuf = me.buffer.slice(0, idx);
      me.buffer = me.buffer.slice(idx + 1);

      handleLine(socket, lineBuf.toString("utf8"));
    }
  })

  socket.on("end", () => {
    const me = clients.get(socket);
    if (!me) return;

    clients.delete(socket);
    lastDmPeer.delete(socket);
    dropDmRefs(socket);
    console.log("Cliend desconnected!");
    broadcastAllLine(me.nick + " left the chat!");
    broadcastAllLine(`There are now ${clients.size} user(s) online.`)
    if (me?.joinTimer) clearTimeout(me.joinTimer);
  })

  socket.on("error", (err) => {
    const me = clients.get(socket);
    if (me) {
      clients.delete(socket);
      broadcastAllLine(me.nick + " left the chat!");
      broadcastAllLine(`There are now ${clients.size} user(s) online.`)
    }
    lastDmPeer.delete(socket);
    dropDmRefs(socket);
    console.log("Error on socket: ", err.message);
    if (me?.joinTimer) clearTimeout(me.joinTimer);
  })
})

server.listen(PORT, () => {
  console.log("Server running in 127.0.0.1:" + PORT)
})
