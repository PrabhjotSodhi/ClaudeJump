import { OnlineJoinScene } from './online-join-scene.js';
import { OnlineLobbyScene } from './online-lobby-scene.js';
import { OnlineMenuScene } from './online-menu-scene.js';

const ERROR_MESSAGES = {
  'room-not-found': ['No room found', 'Check the code and try again'],
  'room-expired': ['That room has closed', 'Ask the host for a new code'],
  'room-full': ['That room is full', 'A room holds up to four players'],
  'connection-failed': ['Could not connect', 'Check your network and try again'],
  'no-webrtc': ['Online play is unavailable', 'This browser cannot connect players'],
  'server-error': ['Cannot reach the server', 'Try again in a moment'],
};

// The title and the detail line for an OnlineError code. Anything unknown reads as a server problem.
export function describeOnlineError(code) {
  return ERROR_MESSAGES[code] ?? ERROR_MESSAGES['server-error'];
}

function loadOnlineConnection() {
  return import('../engine/online-connection.js');
}

// Everything to do with going online, from the Online option on the title to the lobby. The connection
// module is only fetched here, so offline play never loads it.
//
// `context` is { sceneManager, levels, sprites, seed, returnToTitle(inputByPlayerId) }. `loadConnection`
// stands in for the module loader in tests.
export function openOnlineMenu(context) {
  const flow = { ...context, connectionModule: (context.loadConnection ?? loadOnlineConnection)() };
  flow.connectionModule.catch(() => {});
  showMenu(flow);
}

function showMenu(flow) {
  flow.sceneManager.setScene(
    new OnlineMenuScene({
      title: 'Online',
      options: [
        { label: 'Host', onSelect: () => hostRoomFlow(flow) },
        { label: 'Join', onSelect: () => showJoin(flow) },
        { label: 'Back', onSelect: (inputByPlayerId) => flow.returnToTitle(inputByPlayerId) },
      ],
    }),
  );
}

function showNotice(flow, title, lines, options) {
  const scene = new OnlineMenuScene({ title, lines, options });
  flow.sceneManager.setScene(scene);
  return scene;
}

function showError(flow, code, retry) {
  const [title, detail] = describeOnlineError(code);
  showNotice(flow, title, [detail], [{ label: retry.label, onSelect: retry.action }, backOption(flow)]);
}

function backOption(flow) {
  return { label: 'Back', onSelect: () => showMenu(flow) };
}

async function hostRoomFlow(flow) {
  const connecting = showNotice(flow, 'Creating room', ['Please wait'], [backOption(flow)]);
  try {
    const { hostRoom } = await flow.connectionModule;
    const connection = await hostRoom();
    if (flow.sceneManager.currentScene !== connecting) {
      connection.close();
      return;
    }
    openLobby(flow, connection, true);
  } catch (error) {
    if (flow.sceneManager.currentScene === connecting) {
      showError(flow, error.code, { label: 'Try again', action: () => hostRoomFlow(flow) });
    }
  }
}

function showJoin(flow) {
  flow.sceneManager.setScene(
    new OnlineJoinScene({
      onJoin: (code) => joinRoomFlow(flow, code),
      onBack: () => showMenu(flow),
    }),
  );
}

async function joinRoomFlow(flow, code) {
  const joining = showNotice(flow, 'Joining room', [code], [backOption(flow)]);
  try {
    const { joinRoom } = await flow.connectionModule;
    const connection = await joinRoom(code);
    if (flow.sceneManager.currentScene !== joining) {
      connection.close();
      return;
    }
    openLobby(flow, connection, false);
  } catch (error) {
    if (flow.sceneManager.currentScene === joining) {
      showError(flow, error.code, { label: 'Try another code', action: () => showJoin(flow) });
    }
  }
}

// A joiner must have its lobby up in the same turn the connection resolves, or the host's first message is lost.
function openLobby(flow, connection, isHost) {
  flow.sceneManager.setScene(
    new OnlineLobbyScene({
      sceneManager: flow.sceneManager,
      connection,
      isHost,
      levels: flow.levels,
      sprites: flow.sprites,
      seed: flow.seed,
      onLeave: (inputByPlayerId) => flow.returnToTitle(inputByPlayerId),
      onHostLeft: () =>
        showNotice(
          flow,
          'The host left',
          ['The room is closed'],
          [{ label: 'Back', onSelect: (inputByPlayerId) => flow.returnToTitle(inputByPlayerId) }],
        ),
      onError: (code) => {
        const [title, detail] = describeOnlineError(code);
        showNotice(
          flow,
          title,
          [detail],
          [{ label: 'Back', onSelect: (inputByPlayerId) => flow.returnToTitle(inputByPlayerId) }],
        );
      },
    }),
  );
}
