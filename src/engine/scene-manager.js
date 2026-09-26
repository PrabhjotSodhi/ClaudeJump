export class SceneManager {
  constructor() {
    this.currentScene = null;
  }

  setScene(scene) {
    this.currentScene = scene;
  }

  update(inputByPlayerId) {
    this.currentScene?.update(inputByPlayerId);
  }

  render(renderer) {
    this.currentScene?.render(renderer);
  }
}
