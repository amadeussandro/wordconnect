/** A simple countdown timer with tick + expiry callbacks. */
export class Countdown {
  constructor(seconds, onTick, onExpire) {
    this.remaining = seconds; this.onTick = onTick; this.onExpire = onExpire; this._id = null;
  }
  start() {
    this.stop();
    this.onTick && this.onTick(this.remaining);
    this._id = setInterval(() => {
      this.remaining -= 1;
      if (this.remaining <= 0) { this.remaining = 0; this.onTick && this.onTick(0); this.stop(); this.onExpire && this.onExpire(); return; }
      this.onTick && this.onTick(this.remaining);
    }, 1000);
  }
  stop() { if (this._id) { clearInterval(this._id); this._id = null; } }
}
