// Guardado local en IndexedDB: progreso por dibujo y galería de dibujos terminados.
//   progress: clave = id del dibujo → { paint: Blob, stickers: Blob|null, thumb: Blob, updated: ms }
//   gallery:  { id (auto), drawing: id del dibujo, image: Blob, created: ms }
(function () {
  'use strict';
  const DB_NAME = 'colorines';
  const DB_VERSION = 1;
  let dbPromise = null;

  function open() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          db.createObjectStore('progress');
          db.createObjectStore('gallery', { keyPath: 'id', autoIncrement: true });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbPromise;
  }

  // Ejecuta una petición en una transacción y resuelve con su resultado al completarse.
  async function run(store, mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const req = fn(tx.objectStore(store));
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  window.STORE = {
    getProgress: (id) => run('progress', 'readonly', (s) => s.get(id)),
    putProgress: (id, rec) => run('progress', 'readwrite', (s) => s.put(rec, id)),
    clearProgress: () => run('progress', 'readwrite', (s) => s.clear()),

    // Mapa id → miniatura de todos los dibujos empezados.
    async allThumbs() {
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('progress', 'readonly');
        const s = tx.objectStore('progress');
        const keys = s.getAllKeys();
        const vals = s.getAll();
        tx.oncomplete = () => {
          const map = new Map();
          keys.result.forEach((id, i) => map.set(id, vals.result[i].thumb));
          resolve(map);
        };
        tx.onerror = () => reject(tx.error);
      });
    },

    addArt: (rec) => run('gallery', 'readwrite', (s) => s.add(rec)),
    listArt: () => run('gallery', 'readonly', (s) => s.getAll()),
    deleteArt: (id) => run('gallery', 'readwrite', (s) => s.delete(id)),
  };
})();
