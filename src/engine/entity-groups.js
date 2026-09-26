export class EntityGroups {
  constructor() {
    this.entitiesByGroupName = new Map();
  }

  add(groupName, entity) {
    if (!this.entitiesByGroupName.has(groupName)) this.entitiesByGroupName.set(groupName, []);
    this.entitiesByGroupName.get(groupName).push(entity);
  }

  get(groupName) {
    return this.entitiesByGroupName.get(groupName) ?? [];
  }

  clear(groupName) {
    this.entitiesByGroupName.set(groupName, []);
  }

  remove(groupName, entity) {
    const entities = this.get(groupName).filter((existing) => existing !== entity);
    this.entitiesByGroupName.set(groupName, entities);
  }

  renderAll(...args) {
    for (const entities of this.entitiesByGroupName.values()) {
      for (const entity of entities) entity.render(...args);
    }
  }
}
