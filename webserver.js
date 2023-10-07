import http from "http";
import util from "util";
import { exec as raw_exec } from "child_process";
const exec = util.promisify(raw_exec);

http.createServer(
  async (req, res) => {
    res.setHeader("Content-type", "text/plain");
    res.setHeader("Cache-Control", "no-store");
    res.writeHead(200);
    const { stdout } = await exec("wc -l impulses.txt");
    res.end((+stdout.split(" ")[0] * 1/400) + "kWh");
  }
).listen(80);
