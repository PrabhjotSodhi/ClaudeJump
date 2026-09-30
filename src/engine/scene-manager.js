export class SceneManager {
  // The sound player, if any, listens to every scene's events. It is also on the manager so
  // menus can show and flip the sound setting. The music player follows each scene's
  // musicTrackName and pauses down while a scene reports it is paused.
  constructor({ soundPlayer = null, musicPlayer = null } = {}) {
    this.currentScene = null;
    this.soundPlayer = soundPlayer;
    this.musicPlayer = musicPlayer;
  }

  setScene(scene) {
    this.currentScene = scene;
    this.soundPlayer?.attach(scene.events);
    this.musicPlayer?.attach(scene.events);
    this.musicPlayer?.playTrack(scene.musicTrackName);
  }

  update(inputByPlayerId) {
    this.currentScene?.update(inputByPlayerId);
    this.soundPlayer?.endTick();
    this.musicPlayer?.setPaused(!!this.currentScene?.paused);
  }

  render(renderer) {
    this.currentScene?.render(renderer);
  }
}
