/** Stubs for the Expo native modules the sync path touches. */
export const secureStore = new Map<string, string>();

export const getItemAsync = (k: string) => Promise.resolve(secureStore.get(k) ?? null);
export const setItemAsync = (k: string, v: string) => {
  secureStore.set(k, v);
  return Promise.resolve();
};
export const deleteItemAsync = (k: string) => {
  secureStore.delete(k);
  return Promise.resolve();
};

let counter = 0;
export const randomUUID = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`;
export const getRandomBytesAsync = (length: number) =>
  Promise.resolve(Uint8Array.from({ length }, (_, index) => (index * 17 + 29) % 256));

export enum SecurityLevel {
  NONE = 0,
  SECRET = 1,
  BIOMETRIC_WEAK = 2,
  BIOMETRIC_STRONG = 3,
}

export const getEnrolledLevelAsync = jest.fn(() => Promise.resolve(SecurityLevel.BIOMETRIC_STRONG));
export const authenticateAsync = jest.fn(() => Promise.resolve({ success: true }));
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 'WHEN_UNLOCKED_THIS_DEVICE_ONLY';

export const Paths = { document: '/tmp' };
export class File {
  exists = false;
  text = () => Promise.resolve('[]');
  create = () => undefined;
  write = (_value: string) => undefined;
  move = (_destination: File, _options?: { overwrite?: boolean }) => Promise.resolve();
}

export const __resetUuid = () => {
  counter = 0;
};

export default {
  expoConfig: { version: '1.0.0' },
  easConfig: null,
};
