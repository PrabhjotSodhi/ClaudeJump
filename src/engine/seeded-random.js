// Deterministic PRNG (mulberry32). The same seed always produces the same sequence,
// which is what lets a shuffled deck be replayed identically.
export class SeededRandom {
  constructor(seed) {
    this.state = seed >>> 0;
  }

  next() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let result = this.state;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  }

  // Fisher-Yates, leaving the input untouched.
  shuffle(items) {
    const shuffled = items.slice();
    for (let index = shuffled.length - 1; index > 0; index--) {
      const swapIndex = Math.floor(this.next() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled;
  }
}
