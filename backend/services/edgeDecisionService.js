const { fork } = require("child_process");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

class EdgeDecisionService {
  constructor() {
    this.edgeProcess = null;
    this.pending = new Map();
    this.start();
  }

  start() {
    const edgePath = path.join(__dirname, "..", "edgeNode.js");
    this.edgeProcess = fork(edgePath, [], {
      stdio: ["pipe", "pipe", "pipe", "ipc"],
    });

    this.edgeProcess.on("message", (message) => {
      if (!message || !message.requestId) return;
      const resolver = this.pending.get(message.requestId);
      if (!resolver) return;
      resolver(message);
      this.pending.delete(message.requestId);
    });

    this.edgeProcess.on("exit", (code) => {
      console.warn(`Edge node exited with code ${code}, restarting...`);
      setTimeout(() => this.start(), 1500);
    });
  }

  async scoreEmergency(task) {
    if (!this.edgeProcess || !this.edgeProcess.connected) {
      throw new Error("Edge process unavailable");
    }

    const requestId = uuidv4();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error("Edge decision timed out"));
      }, 3000);

      this.pending.set(requestId, (message) => {
        clearTimeout(timeout);
        resolve(message);
      });

      this.edgeProcess.send({ type: "scoreEmergency", requestId, task });
    });
  }
}

module.exports = EdgeDecisionService;
