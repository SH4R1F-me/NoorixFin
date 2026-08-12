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
export const __resetUuid = () => {
  counter = 0;
};

export default {
  expoConfig: { version: '1.0.0' },
  easConfig: null,
};
