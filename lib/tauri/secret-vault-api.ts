import { createLogger } from '@/lib/logger';
import { isDesktop, isTauri } from '@/lib/storage/platform';

const logger = createLogger('secret-vault-api');

// The stronghold plugin is only registered in the desktop Rust build;
// mobile Tauri falls back to in-memory session secrets like web.
function hasStronghold(): boolean {
  return isTauri() && isDesktop();
}
const encoder = new TextEncoder();
const decoder = new TextDecoder();

type DesktopStoreHandle = {
  stronghold: {
    save(): Promise<void>;
  };
  store: {
    get(key: string): Promise<ArrayLike<number> | null>;
    insert(key: string, value: number[]): Promise<void>;
    remove(key: string): Promise<void>;
  };
};

interface SecretVaultBootstrap {
  password: string;
  vaultPath: string;
  clientName: string;
  storeName: string;
}

export interface SecretVaultStatus {
  available: boolean;
  mode: 'desktop' | 'web';
  state: 'ready' | 'web-session' | 'unavailable' | 'error';
  message?: string;
}

const sessionSecrets = new Map<string, string>();
let desktopStorePromise: Promise<DesktopStoreHandle> | null = null;

function mapRef(provider: string, keyId: string): string {
  return `map/${provider}/${keyId}`;
}

function plateSolverRef(): string {
  return 'plate-solver/astrometry-net/default';
}

function eventSourceRef(sourceId: string): string {
  return `event-source/${sourceId}/api-key`;
}

async function getDesktopStore(): Promise<DesktopStoreHandle> {
  if (!hasStronghold()) {
    throw new Error('Stronghold is only available in desktop mode');
  }

  if (!desktopStorePromise) {
    desktopStorePromise = (async () => {
      const [{ invoke }, { Stronghold }] = await Promise.all([
        import('@tauri-apps/api/core'),
        import('@tauri-apps/plugin-stronghold'),
      ]);

      const bootstrap = await invoke<SecretVaultBootstrap>('get_or_create_secret_vault_bootstrap');
      const stronghold = await Stronghold.load(bootstrap.vaultPath, bootstrap.password);

      let client;
      try {
        client = await stronghold.loadClient(bootstrap.clientName);
      } catch {
        client = await stronghold.createClient(bootstrap.clientName);
      }

      const store = await client.getStore(bootstrap.storeName);
      return { stronghold, store } satisfies DesktopStoreHandle;
    })().catch((error) => {
      desktopStorePromise = null;
      throw error;
    });
  }

  return desktopStorePromise;
}

async function getSecret(reference: string): Promise<string | null> {
  if (!hasStronghold()) {
    return sessionSecrets.get(reference) ?? null;
  }

  const { store } = await getDesktopStore();
  const value = await store.get(reference);
  if (!value) {
    return null;
  }

  return decoder.decode(new Uint8Array(Array.from(value)));
}

async function setSecret(reference: string, value: string): Promise<void> {
  if (!hasStronghold()) {
    sessionSecrets.set(reference, value);
    return;
  }

  const { stronghold, store } = await getDesktopStore();
  await store.insert(reference, Array.from(encoder.encode(value)));
  await stronghold.save();
}

async function deleteSecret(reference: string): Promise<void> {
  if (!hasStronghold()) {
    sessionSecrets.delete(reference);
    return;
  }

  const { stronghold, store } = await getDesktopStore();
  try {
    await store.remove(reference);
    await stronghold.save();
  } catch (error) {
    logger.warn(`Failed to remove secret record ${reference}`, error);
  }
}

export const secretVaultApi = {
  isAvailable(): boolean {
    return hasStronghold();
  },

  async getStatus(): Promise<SecretVaultStatus> {
    if (!hasStronghold()) {
      return {
        available: false,
        mode: 'web',
        state: 'web-session',
        message: 'Durable secure secret storage is only available in the desktop app.',
      };
    }

    try {
      await getDesktopStore();
      return {
        available: true,
        mode: 'desktop',
        state: 'ready',
      };
    } catch (error) {
      return {
        available: false,
        mode: 'desktop',
        state: 'error',
        message: error instanceof Error ? error.message : 'Failed to initialize desktop secret vault.',
      };
    }
  },

  async getMapApiKey(provider: string, keyId: string): Promise<string | null> {
    return getSecret(mapRef(provider, keyId));
  },

  async setMapApiKey(provider: string, keyId: string, value: string): Promise<void> {
    await setSecret(mapRef(provider, keyId), value);
  },

  async deleteMapApiKey(provider: string, keyId: string): Promise<void> {
    await deleteSecret(mapRef(provider, keyId));
  },

  async getPlateSolverApiKey(): Promise<string | null> {
    return getSecret(plateSolverRef());
  },

  async setPlateSolverApiKey(value: string): Promise<void> {
    await setSecret(plateSolverRef(), value);
  },

  async deletePlateSolverApiKey(): Promise<void> {
    await deleteSecret(plateSolverRef());
  },

  async getEventSourceApiKey(sourceId: string): Promise<string | null> {
    return getSecret(eventSourceRef(sourceId));
  },

  async setEventSourceApiKey(sourceId: string, value: string): Promise<void> {
    await setSecret(eventSourceRef(sourceId), value);
  },

  async deleteEventSourceApiKey(sourceId: string): Promise<void> {
    await deleteSecret(eventSourceRef(sourceId));
  },
};

export default secretVaultApi;
