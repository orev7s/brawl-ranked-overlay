import { EventEmitter } from 'node:events';
import { config } from './config.js';

export class Poller extends EventEmitter {
  constructor(engine) {
    super();
    this.engine = engine;
    this.timer = null;
    this.running = false;
  }

  start() {
    this.schedule(0);
  }

  stop() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  schedule(ms) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.tick(), ms);
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.engine.poll();
      this.emit('state', this.engine.state());
    } catch (err) {
      this.engine.error = err?.message || 'Poll failed';
      this.emit('state', this.engine.state());
    } finally {
      this.running = false;
      const delay = this.engine.source === 'demo'
        ? Math.min(6500, Math.max(4000, config.pollMs))
        : config.pollMs;
      this.schedule(delay);
    }
  }

  push() {
    this.emit('state', this.engine.state());
  }
}