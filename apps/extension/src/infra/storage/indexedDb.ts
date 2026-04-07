import type { UserDataBookmarkPort } from "../../../../../packages/core/src/application/ports/UserDataBookmarkPort";
import type { Bookmark } from "../../../../../packages/core/src/domain/entities/Bookmark";
import type { MapHackBookmarkId } from "../../../../../packages/core/src/domain/value/MapHackBookmarkId";

const DEFAULT_DB_NAME = "maphack";
const DEFAULT_STORE_NAME = "bookmarks";
const DEFAULT_DB_VERSION = 2;
const INDEXED_DB_UNAVAILABLE_ERROR = "indexeddb-unavailable";
const CONVERSATION_ID_INDEX = "conversationId";

type StoredBookmarkRow =
  Omit<Bookmark, "edited"> & {
    edited?: boolean;
  };

function normalizeBookmark(bookmark: StoredBookmarkRow): Bookmark {
  return {
    ...bookmark,
    edited: bookmark.edited ?? false
  };
}

function cloneBookmark(bookmark: StoredBookmarkRow): Bookmark {
  return normalizeBookmark(bookmark);
}

function toError(error: unknown, fallbackMessage: string): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(fallbackMessage);
}

function sortBookmarksByCreatedAtDesc(bookmarks: Bookmark[]): Bookmark[] {
  return bookmarks.sort((left, right) => {
    if (left.createdAt !== right.createdAt) {
      return right.createdAt - left.createdAt;
    }
    return left.id.localeCompare(right.id);
  });
}

export interface IndexedDbBookmarkStoreOptions {
  indexedDb?: IDBFactory | null;
  databaseName?: string;
  storeName?: string;
  version?: number;
}

export class IndexedDbBookmarkStore implements UserDataBookmarkPort {
  private readonly indexedDb: IDBFactory | null;
  private readonly databaseName: string;
  private readonly storeName: string;
  private readonly version: number;
  private databasePromise: Promise<IDBDatabase> | null = null;

  constructor(options: IndexedDbBookmarkStoreOptions = {}) {
    const globalIndexedDb = (globalThis as { indexedDB?: IDBFactory }).indexedDB;
    this.indexedDb = options.indexedDb ?? globalIndexedDb ?? null;
    this.databaseName = options.databaseName ?? DEFAULT_DB_NAME;
    this.storeName = options.storeName ?? DEFAULT_STORE_NAME;
    this.version = options.version ?? DEFAULT_DB_VERSION;
  }

  async upsert(bookmark: Bookmark): Promise<void> {
    const next = cloneBookmark(bookmark);
    await this.runReadWrite((store) => store.put(next));
  }

  async remove(bookmarkId: MapHackBookmarkId): Promise<void> {
    await this.runReadWrite((store) => store.delete(bookmarkId));
  }

  async list(): Promise<Bookmark[]> {
    const rows = await this.runReadOnly<StoredBookmarkRow[]>(
      (store) => store.getAll() as IDBRequest<StoredBookmarkRow[]>
    );
    return sortBookmarksByCreatedAtDesc(rows.map(cloneBookmark));
  }

  async listByConversationId(conversationId: Bookmark["conversationId"]): Promise<Bookmark[]> {
    const rows = await this.runReadOnly<StoredBookmarkRow[]>((store) =>
      store.index(CONVERSATION_ID_INDEX).getAll(conversationId) as IDBRequest<StoredBookmarkRow[]>
    );
    return sortBookmarksByCreatedAtDesc(rows.map(cloneBookmark));
  }

  async updateEdited(bookmarkId: MapHackBookmarkId, edited: boolean): Promise<void> {
    await this.runReadWrite((store) => {
      const readRequest = store.get(bookmarkId) as IDBRequest<StoredBookmarkRow | undefined>;

      readRequest.onsuccess = () => {
        const current = readRequest.result;
        if (!current) {
          return;
        }

        if ((current.edited ?? false) === edited) {
          return;
        }

        store.put({
          ...current,
          edited
        });
      };

      return readRequest;
    });
  }

  async updateTimestamp(bookmarkId: MapHackBookmarkId, timestamp: number): Promise<void> {
    await this.runReadWrite((store) => {
      const readRequest = store.get(bookmarkId) as IDBRequest<StoredBookmarkRow | undefined>;

      readRequest.onsuccess = () => {
        const current = readRequest.result;
        if (!current) {
          return;
        }

        if (current.timestamp !== null) {
          return;
        }

        store.put({
          ...current,
          timestamp
        });
      };

      return readRequest;
    });
  }

  private async getDatabase(): Promise<IDBDatabase> {
    if (this.indexedDb === null) {
      throw new Error(INDEXED_DB_UNAVAILABLE_ERROR);
    }

    if (this.databasePromise !== null) {
      return this.databasePromise;
    }

    this.databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = this.indexedDb!.open(this.databaseName, this.version);

      request.onupgradeneeded = () => {
        const database = request.result;
        const store = database.objectStoreNames.contains(this.storeName)
          ? request.transaction!.objectStore(this.storeName)
          : database.createObjectStore(this.storeName, { keyPath: "id" });

        if (!store.indexNames.contains(CONVERSATION_ID_INDEX)) {
          store.createIndex(CONVERSATION_ID_INDEX, "conversationId", { unique: false });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(toError(request.error, "indexeddb-open-failed"));
      };
    });

    return this.databasePromise;
  }

  private async runReadWrite(operation: (store: IDBObjectStore) => IDBRequest<any>): Promise<void> {
    const database = await this.getDatabase();

    return new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(this.storeName, "readwrite");
      const store = transaction.objectStore(this.storeName);
      let settled = false;

      const rejectOnce = (error: unknown, fallbackMessage: string): void => {
        if (settled) {
          return;
        }
        settled = true;
        reject(toError(error, fallbackMessage));
      };

      transaction.oncomplete = () => {
        if (settled) {
          return;
        }
        settled = true;
        resolve();
      };

      transaction.onerror = () => {
        rejectOnce(transaction.error, "indexeddb-transaction-failed");
      };

      transaction.onabort = () => {
        rejectOnce(transaction.error, "indexeddb-transaction-aborted");
      };

      let request: IDBRequest<unknown>;
      try {
        request = operation(store) as IDBRequest<unknown>;
      } catch (error: unknown) {
        rejectOnce(error, "indexeddb-operation-threw");
        return;
      }

      request.onerror = () => {
        rejectOnce(request.error, "indexeddb-request-failed");
      };
    });
  }

  private async runReadOnly<T>(operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const database = await this.getDatabase();

    return new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(this.storeName, "readonly");
      const store = transaction.objectStore(this.storeName);
      let settled = false;
      let result: T | undefined;

      const rejectOnce = (error: unknown, fallbackMessage: string): void => {
        if (settled) {
          return;
        }
        settled = true;
        reject(toError(error, fallbackMessage));
      };

      transaction.oncomplete = () => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(result as T);
      };

      transaction.onerror = () => {
        rejectOnce(transaction.error, "indexeddb-transaction-failed");
      };

      transaction.onabort = () => {
        rejectOnce(transaction.error, "indexeddb-transaction-aborted");
      };

      let request: IDBRequest<T>;
      try {
        request = operation(store);
      } catch (error: unknown) {
        rejectOnce(error, "indexeddb-operation-threw");
        return;
      }

      request.onsuccess = () => {
        result = request.result;
      };

      request.onerror = () => {
        rejectOnce(request.error, "indexeddb-request-failed");
      };
    });
  }
}
