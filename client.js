const net = require("net");
const readline = require("readline");

const args = process.argv.slice(2);

let HOST = "127.0.0.1";
let PORT = 5000;
let initialNick = null;

// Accept command line arguments in the following forms:
// - node client.js
// - node client.js <host>
// - node client.js <host> <port>
// - node client.js <host> <port> --nick <name>
// - node client.js --nick <name>
for (let i = 0; i < args.length; i++) {
  const a = args[i];

  if (a === "--nick" || a === "-n") {
    initialNick = args[i + 1] || null;
    i++;
    continue;
  }

  if (!a.startsWith("-")) {
    if (HOST === "127.0.0.1") {
      HOST = a;
      continue;
    }
    if (PORT === 5000) {
      const maybePort = Number(a);
      if (!Number.isNaN(maybePort)) PORT = maybePort;
      continue;
    }
    if (!initialNick) initialNick = a;
  }
}
const socket = net.createConnection({ host: HOST, port: PORT });

let buffer = Buffer.alloc(0);

function pLine(line) {
  process.stdout.write(line + "\n");
}

socket.on("connect", () => {
  pLine(`Connected to chat server at ${HOST}:${PORT}`);
  pLine(`Type /help for commands.`);
  if (initialNick) {
    socket.write(`/nick ${initialNick}\n`);
  }
});

socket.on("data", (chunck) => {
  buffer = Buffer.concat([buffer, chunck]);

  while (true) {
    const idx = buffer.indexOf(0x0a);
    if (idx === -1) break;

    const lineBuf = buffer.slice(0, idx);
    buffer = buffer.slice(idx + 1);

    const line = lineBuf.toString("utf8").replace(/\r$/, "");
    pLine(line);
  }
});

socket.on("end", () => {
  pLine("Disconnected from server.");
  process.exit(0);
});

socket.on("error", (err) => {
  pLine("Connection error: " + err.message);
  process.exit(1);
});

// setup readline
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "",
});

rl.on("line", (line) => {
  socket.write(line + "\n");
});

// CRTL+C handler
rl.on("SIGINT", () => {
  socket.end();
  process.exit(0);
});