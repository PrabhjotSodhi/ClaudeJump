import { getStore } from '@netlify/blobs';
import { handleRoomRequest } from '../rooms/room-http.js';
import { createRoomService } from '../rooms/room-service.js';

export const config = { path: '/api/rooms/*' };

export default async function rooms(request) {
  const blobs = getStore({ name: 'rooms', consistency: 'strong' });
  const store = {
    get: (key) => blobs.get(key, { type: 'json' }),
    set: (key, value) => blobs.setJSON(key, value),
    delete: (key) => blobs.delete(key),
    list: async (prefix) => (await blobs.list({ prefix })).blobs.map((blob) => blob.key),
    read: async (key) => {
      const stored = await blobs.getWithMetadata(key, { type: 'json' });
      return stored ? { value: stored.data, version: stored.etag } : null;
    },
    write: async (key, value, version) => {
      const condition = version === null ? { onlyIfNew: true } : { onlyIfMatch: version };
      return (await blobs.setJSON(key, value, condition)).modified;
    },
  };
  return handleRoomRequest(createRoomService({ store }), request);
}
