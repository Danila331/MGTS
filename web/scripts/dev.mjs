import { spawn } from "node:child_process";

const args = process.argv.slice(2).map((arg) => {
  if (arg === "--host") return "--hostname";
  if (arg.startsWith("--host=")) return `--hostname=${arg.slice("--host=".length)}`;
  return arg;
});
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", ...args], { stdio: "inherit", env: process.env });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code, signal) => { if (signal) process.kill(process.pid, signal); else process.exit(code ?? 0); });
