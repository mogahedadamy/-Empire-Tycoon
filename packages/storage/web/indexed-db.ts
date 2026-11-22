/** IndexedDB storage port. Reads and compare-and-swap writes settle when their transaction ends. */
import type { SaveRecord, SaveStore } from '../src';

const storeName = 'slots';

/** Opens a local single-player database. Call close when its owning context is disposed. */
export async function openIndexedDbSaveStore(factory: IDBFactory, name: string): Promise<SaveStore & { close(): void }> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      request.onsuccess = () => request.result.close();
      reject(new Error('Save database upgrade blocked'));
    };
    request.onsuccess = () => resolve(request.result);
  });
  database.onversionchange = () => database.close();

  function transaction<Result>(
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore, result: (value: Result) => void) => void,
  ): Promise<Result> {
    return new Promise((resolve, reject) => {
      const tx = database.transaction(storeName, mode);
      let value: Result;
      tx.oncomplete = () => resolve(value);
      tx.onabort = () => reject(tx.error ?? new Error('Save transaction interrupted'));
      run(tx.objectStore(storeName), (next) => { value = next; });
    });
  }

  return {
    read(slot) {
      return transaction<SaveRecord | null>('readonly', (store, done) => {
        const read = store.get(slot);
        read.onsuccess = () => done(read.result ?? null);
      });
    },
    compareAndSwap(slot, expectedHead, next) {
      return transaction<boolean>('readwrite', (store, done) => {
        const read = store.get(slot);
        read.onsuccess = () => {
          const actual = read.result as SaveRecord | undefined;
          const matches = (actual?.head ?? null) === expectedHead;
          if (matches) store.put(next, slot);
          done(matches);
        };
      });
    },
    close: () => database.close(),
  };
}
