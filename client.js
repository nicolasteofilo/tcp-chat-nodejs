const net = require("net");
const readline = require("readline");

const HOST = process.argv[2] || "127.0.0.1";
const PORT = Number(process.argv[3]) || 5000;
const socket = net.createConnection({ host: HOST, port: PORT });

let buffer = Buffer.alloc(0);

function pLine(line) {
  process.stdout.write(line + "\n");
}

socket.on("connect", () => {
  pLine(`Connected to chat server at ${HOST}:${PORT}`);
  pLine(`Type /help for commands.`);
});

socket.on("data", (chunck) => {
  buffer = Buffer.concat([buffer, chunck]);

  while(true) {
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