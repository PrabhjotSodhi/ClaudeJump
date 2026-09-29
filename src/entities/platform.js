import { Entity } from '../engine/entity.js';

// A one way platform can be jumped up through and only stops a player landing on its top.
export class Platform extends Entity {
  constructor({ x, y, width, height, oneWay = false }) {
    super({ x, y, width, height });
    this.oneWay = oneWay;
  }
}
