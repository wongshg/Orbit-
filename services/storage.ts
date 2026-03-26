
import { openDB } from 'idb';

const DB_NAME = 'opus-files-db';
const STORE_NAME = 'files';

const initDB = async () => {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });
};

export const saveFile = async (id: string, file: File): Promise<void> => {
  const db = await initDB();
  await db.put(STORE_NAME, file, id);
};

export const getFile = async (id: string): Promise<File | undefined> => {
  const db = await initDB();
  return db.get(STORE_NAME, id);
};

export const deleteFile = async (id: string): Promise<void> => {
  const db = await initDB();
  await db.delete(STORE_NAME, id);
};
