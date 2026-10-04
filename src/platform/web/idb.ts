/**
 * 极简 IndexedDB 封装：单库单表（saves），键为存档槽名。
 */
const DB_NAME = 'cuilan-archipelago';
const STORE = 'saves';

export interface SaveRecord {
  slot: string;
  data: string;
  summary: unknown;
  savedAt: string;
}

export function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'slot' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB 打开失败'));
    req.onblocked = () => reject(new Error('IndexedDB 被其他标签页占用'));
  });
}

function tx<T>(db: IDBDatabase, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB 操作失败'));
  });
}

export const idbGet = (db: IDBDatabase, slot: string) => tx<SaveRecord | undefined>(db, 'readonly', (s) => s.get(slot));
export const idbPut = (db: IDBDatabase, rec: SaveRecord) => tx<IDBValidKey>(db, 'readwrite', (s) => s.put(rec));
export const idbDelete = (db: IDBDatabase, slot: string) => tx<undefined>(db, 'readwrite', (s) => s.delete(slot));
export const idbAll = (db: IDBDatabase) => tx<SaveRecord[]>(db, 'readonly', (s) => s.getAll());
