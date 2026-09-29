import { DEFAULT_ACTION_IDENTIFIER, type NotificationResponse } from 'expo-notifications';

import { letterIdFromResponse } from '@/features/notifications/pushPlatform';

const ID = '0f8fad5b-d9cb-469f-a165-70867728950e';

function response(data: Record<string, unknown>, action = DEFAULT_ACTION_IDENTIFIER) {
  return {
    actionIdentifier: action,
    notification: { request: { content: { data } } },
  } as unknown as NotificationResponse;
}

describe('Notification tap payload', () => {
  it('opens only a well-formed letter id from a plain tap', () => {
    expect(letterIdFromResponse(response({ letter_id: ID }))).toBe(ID);
    expect(letterIdFromResponse(response({ letter_id: ID.toUpperCase() }))).toBe(ID);
    expect(letterIdFromResponse(response({ letter_id: '../settings' }))).toBeNull();
    expect(letterIdFromResponse(response({ letter_id: 42 }))).toBeNull();
    expect(letterIdFromResponse(response({}))).toBeNull();
    expect(letterIdFromResponse(response({ letter_id: ID }, 'dismiss'))).toBeNull();
    expect(letterIdFromResponse(null)).toBeNull();
  });
});
