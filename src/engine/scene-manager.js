export class SceneManager {
  // The sound player, if any, listens to every scene's events. It is also on the manager so
  // menus can show and flip the sound setting.
  constructor({ soundPlayer = null } = {}) {
    this.currentScene = null;
    this.soundPlayer = soundPlayer;
  }

  setScene(scene) {
    this.currentScene = scene;
    this.soundPlayer?.attach(scene.events);
  }

  update(inputByPlayerId) {
    this.currentScene?.update(inputByPlayerId);
    this.soundPlayer?.endTick();
  }

  render(renderer) {
    this.currentScene?.render(renderer);
  }
}
