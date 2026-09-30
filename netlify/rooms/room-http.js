import { RoomError } from './room-service.js';

const JSON_HEADERS = { 'content-type': 'application/json', 'cache-control': 'no-store' };

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

async function readBody(request) {
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? body : {};
  } catch {
    throw new RoomError('bad-request', 400);
  }
}

/**
 * Routes `.../create`, `.../join`, `.../signal` (POST) and `.../poll` (GET)
 * to the room service. Errors become `{ error: code }` with the error's status.
 */
export async function handleRoomRequest(service, request) {
  try {
    const url = new URL(request.url);
    const action = url.pathname.split('/').filter(Boolean).pop();
    if (request.method === 'GET' && action === 'poll') {
      const parameters = url.searchParams;
      return jsonResponse(
        await service.poll({
          code: parameters.get('code'),
          playerId: parameters.get('playerId'),
          after: parameters.get('after') ?? '',
        }),
      );
    }
    if (request.method === 'POST' && action === 'create') {
      return jsonResponse(await service.create());
    }
    if (request.method === 'POST' && (action === 'join' || action === 'signal')) {
      return jsonResponse(await service[action](await readBody(request)));
    }
    throw new RoomError('not-found', 404);
  } catch (error) {
    if (error instanceof RoomError) return jsonResponse({ error: error.code }, error.status);
    return jsonResponse({ error: 'server-error' }, 500);
  }
}
