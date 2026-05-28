// Local IndexedDB persistence for CardForge
const DB_NAME = 'CardForgeDB';
const DB_VERSION = 1;
const STORE_NAME = 'cards';

export function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('Database failed to open:', event.target.error);
      reject(event.target.error);
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

export async function getCards() {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      // Sort by last modified date, newest first
      const cards = request.result || [];
      cards.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      resolve(cards);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function saveCard(card) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const cardToSave = {
      ...card,
      updatedAt: Date.now()
    };
    
    const request = store.put(cardToSave);

    request.onsuccess = () => {
      resolve(cardToSave);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function deleteCard(id) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}
