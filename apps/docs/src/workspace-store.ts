export interface WorkspaceSettings {
  name: string;
  description: string;
  email: string;
  notifications: boolean;
}

export interface WorkspaceRecord {
  workspace: WorkspaceSettings;
  revision: number;
}

export interface WorkspaceChange {
  before: WorkspaceSettings;
  after: WorkspaceRecord;
}

export const defaultWorkspace: WorkspaceSettings = {
  name: 'Labpics',
  description: 'Дизайн и разработка цифровых продуктов',
  email: 'hello@labpics.ru',
  notifications: true,
};

function workspace(value: unknown): WorkspaceSettings | undefined {
  if (!value || typeof value !== 'object') return;
  if (
    !('name' in value) ||
    typeof value.name !== 'string' ||
    !value.name.trim() ||
    !('notifications' in value) ||
    typeof value.notifications !== 'boolean'
  )
    return;
  return {
    name: value.name,
    notifications: value.notifications,
    description:
      'description' in value && typeof value.description === 'string'
        ? value.description
        : defaultWorkspace.description,
    email:
      'email' in value && typeof value.email === 'string' ? value.email : defaultWorkspace.email,
  };
}

function initialRecord(): WorkspaceRecord {
  // Preserve values saved by the earlier version of this example.
  try {
    const saved = workspace(JSON.parse(localStorage.getItem('labui.workspace.v1') ?? 'null'));
    if (saved) return { workspace: saved, revision: 0 };
  } catch {
    // An unavailable legacy store does not prevent using IndexedDB.
  }
  return { workspace: { ...defaultWorkspace }, revision: 0 };
}

function readRecord(value: unknown): WorkspaceRecord {
  if (value === undefined) return initialRecord();
  if (value && typeof value === 'object' && 'workspace' in value && 'revision' in value) {
    const decoded = workspace(value.workspace);
    if (decoded && Number.isSafeInteger(value.revision) && Number(value.revision) >= 0)
      return { workspace: decoded, revision: Number(value.revision) };
  }
  throw new Error('Invalid workspace record');
}

/** A real asynchronous commit. Drafts stay in the UI; Undo checks the committed revision. */
async function transact<T>(
  mode: IDBTransactionMode,
  operation: (current: WorkspaceRecord) => { result: T; write?: WorkspaceRecord },
): Promise<T> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('labui.workspace', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('settings');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction('settings', mode);
      const store = transaction.objectStore('settings');
      let result: T;
      let failure: unknown;
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = () => reject(failure ?? transaction.error);
      const request = store.get('workspace');
      request.onsuccess = () => {
        try {
          const next = operation(readRecord(request.result));
          result = next.result;
          if (next.write) store.put(next.write, 'workspace');
        } catch (error) {
          failure = error;
          transaction.abort();
        }
      };
    });
  } finally {
    database.close();
  }
}

export function readWorkspace(): Promise<WorkspaceRecord> {
  return transact('readonly', (current) => ({ result: current }));
}

export function saveWorkspace(next: WorkspaceSettings): Promise<WorkspaceChange> {
  return transact('readwrite', (current) => {
    const value = workspace(next);
    if (!value) throw new Error('A workspace needs a name');
    const after = {
      workspace: {
        ...value,
        name: value.name.trim(),
        email: value.email.trim(),
        description: value.description.trim(),
      },
      revision: current.revision + 1,
    };
    return { result: { before: current.workspace, after }, write: after };
  });
}

export function undoWorkspace(change: WorkspaceChange): Promise<WorkspaceRecord | null> {
  return transact('readwrite', (current) => {
    if (current.revision !== change.after.revision) return { result: null };
    const restored = { workspace: change.before, revision: current.revision + 1 };
    return { result: restored, write: restored };
  });
}
