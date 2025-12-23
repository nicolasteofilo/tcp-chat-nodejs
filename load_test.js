// load_test.js
const net = require("net");

const args = process.argv.slice(2);

let HOST = "127.0.0.1";
let PORT = 5000;
let CLIENTS = 50;
let MESSAGES_PER_CLIENT = 5;
let INTERVAL_MS = 200; // tempo entre mensagens de cada cliente

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--host") HOST = args[++i] || HOST;
  else if (a === "--port") PORT = Number(args[++i] || PORT);
  else if (a === "--clients" || a === "-c") CLIENTS = Number(args[++i] || CLIENTS);
  else if (a === "--messages" || a === "-m") MESSAGES_PER_CLIENT = Number(args[++i] || MESSAGES_PER_CLIENT);
  else if (a === "--interval") INTERVAL_MS = Number(args[++i] || INTERVAL_MS);
}

function makeClient(i) {
  const socket = net.createConnection({ host: HOST, port: PORT });

  let buffer = Buffer.alloc(0);
  let sent = 0;
  let received = 0;

  // latência simples: marca timestamp por mensagem enviada
  const pending = new Map(); // msgId -> t0
  const latencies = [];

  function sendLine(line) {
    socket.write(line + "\n");
  }

  function onLine(line) {
    received++;

    // Se você quiser medir latência aproximada, detecta o token "[id=...]"
    // (funciona melhor se seu servidor mandar a mensagem de volta, mas aqui é broadcast pros outros)
    // Mesmo assim, dá pra medir latência de “eco” se você habilitar enviar pra si mesmo depois.
    const m = line.match(/\[id=(\d+)\]/);
    if (m) {
      const id = Number(m[1]);
      const t0 = pending.get(id);
      if (t0) {
        latencies.push(Date.now() - t0);
        pending.delete(id);
      }
    }
  }

  socket.on("connect", () => {
    const nick = `bot-${i}`;
    sendLine(`/nick ${nick}`);

    const timer = setInterval(() => {
      if (sent >= MESSAGES_PER_CLIENT) {
        clearInterval(timer);
        // dá um tempinho pra receber mensagens e sai
        setTimeout(() => {
          sendLine("/quit");
          socket.end();
        }, 300);
        return;
      }

      const msgId = i * 1_000_000 + sent;
      pending.set(msgId, Date.now());

      // manda uma mensagem normal (broadcast)
      sendLine(`hello from ${nick} [id=${msgId}] #${sent + 1}`);
      sent++;
    }, INTERVAL_MS);
  });

  socket.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (true) {
      const idx = buffer.indexOf(0x0a); // \n
      if (idx === -1) break;

      const lineBuf = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);

      const line = lineBuf.toString("utf8").replace(/\r$/, "");
      onLine(line);
    }
  });

  socket.on("error", (err) => {
    // não mata o teste inteiro
    console.log(`[bot-${i}] error: ${err.message}`);
  });

  socket.on("close", () => {
    reportClient(i, sent, received, latencies);
  });
}

const results = [];
function reportClient(i, sent, received, latencies) {
  results.push({ i, sent, received, latencies });

  if (results.length === CLIENTS) {
    // resumo
    const totalSent = results.reduce((a, r) => a + r.sent, 0);
    const totalReceived = results.reduce((a, r) => a + r.received, 0);

    const allLat = results.flatMap((r) => r.latencies);
    allLat.sort((a, b) => a - b);

    const p = (q) => (allLat.length ? allLat[Math.floor(q * (allLat.length - 1))] : null);

    console.log("\n=== LOAD TEST SUMMARY ===");
    console.log(`Host: ${HOST}:${PORT}`);
    console.log(`Clients: ${CLIENTS}`);
    console.log(`Messages/client: ${MESSAGES_PER_CLIENT}`);
    console.log(`Interval: ${INTERVAL_MS}ms`);
    console.log(`Total sent: ${totalSent}`);
    console.log(`Total received (lines): ${totalReceived}`);
    console.log(`Latency samples: ${allLat.length} (only if matched [id=...])`);
    if (allLat.length) {
      console.log(`p50: ${p(0.50)}ms | p90: ${p(0.90)}ms | p99: ${p(0.99)}ms`);
    } else {
      console.log(`(Latency not measured — expected if server doesn't echo to sender.)`);
    }
  }
}

for (let i = 1; i <= CLIENTS; i++) makeClient(i);
