// Fullscreen for the whole page, so the page around the game comes along. The browser only allows a
// request from a user gesture such as a key press or a click. Some phone browsers have no fullscreen
// API, so `supported` lets menus hide the option there.
export function createFullscreen(root = document.documentElement) {
  return {
    get supported() {
      return Boolean(document.fullscreenEnabled && root.requestFullscreen);
    },
    get active() {
      return Boolean(document.fullscreenElement);
    },
    toggle() {
      try {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        else root.requestFullscreen().catch(() => {});
      } catch {
        // The browser refused, so the game stays as it is.
      }
    },
  };
}
