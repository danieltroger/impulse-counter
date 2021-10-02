import rpi_gpio from "rpi-gpio";
import { promises as fs } from "fs";
import { performance } from "perf_hooks";
const { promise: gpio } = rpi_gpio;

restart_if_fails();

async function restart_if_fails() {
  while (true) {
    await main().catch((e) => log("Error happened", e, "restarting in 1s"));
    await new Promise((r) => setTimeout(r, 1000));
  }
}

async function main() {
  const handle = await fs.open("impulses.txt", "a+");

  const PIN = 37;
  await gpio.setup(PIN, gpio.DIR_IN, gpio.EDGE_BOTH);
  const initial_value = await gpio.read(PIN);

  log("Initialized pin", PIN, "and listening for change");
  const value_prom = new infinite_promise();
  gpio.on("change", function (channel, value) {
    if (channel !== PIN) {
      log("Got event from wrong channel", channel, value);
      return;
    }
    value_prom.resolve(value);
  });

  if (initial_value) {
    log("Value was initially high, starting counting once its low");
    while (await value_prom.promise) {}
  }

  while (true) {
    // value is low, wait for high + low
    while (!(await value_prom.promise)) {}
    const start = performance.now();
    while (await value_prom.promise) {}
    const duration = performance.now() - start;
    register_impulse(handle, duration).catch((e) =>
      log("Error registering impulse", e)
    );
  }

  // await handle.close(); // this is never reached lol
}

function log(...stuff) {
  console.log(new Date().toISOString() + " |", ...stuff);
}

async function register_impulse(handle, duration) {
  // log("Got impulse (duration: ", duration, ")");
  await handle.write(`${+new Date()} ${Math.round(duration)}\n`);
}

class infinite_promise {
  resolve;
  promise;
  #internal_resolve = () => {};
  #queue = [];
  #processing = false;
  resolve = async (value) => {
    this.#queue.push(value);
    if (this.#processing) {
      return;
    }
    this.#processing = true;
    for (let i = 0; i < this.#queue.length; i++) {
      const resolve_last_promise = this.#internal_resolve;
      const set_internal_resolve = (r) => (this.#internal_resolve = r);
      this.promise = new Promise(set_internal_resolve);
      // pls don't remove below await, it's needed so that the next item gets resolved the next tick
      await resolve_last_promise(this.#queue[i]);
    }
    while (this.#queue.length) {
      this.#queue.pop();
    }
    this.#processing = false;
  };
  constructor() {
    this.resolve();
  }
}
