import { CardRecord, ScannerTemplate, ScanBatchSession } from '../types';
import { DEFAULT_TEMPLATES } from './defaultTemplates';

const DB_NAME = 'CardVaultDB';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('cards')) {
        const cardStore = db.createObjectStore('cards', { keyPath: 'id' });
        cardStore.createIndex('createdAt', 'createdAt', { unique: false });
        cardStore.createIndex('name', 'name', { unique: false });
        cardStore.createIndex('category', 'category', { unique: false });
        cardStore.createIndex('gradingCompany', 'gradingCompany', { unique: false });
        cardStore.createIndex('isGraded', 'isGraded', { unique: false });
      }

      if (!db.objectStoreNames.contains('templates')) {
        db.createObjectStore('templates', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('sessions')) {
        db.createObjectStore('sessions', { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

// Cards CRUD
export async function getAllCards(): Promise<CardRecord[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('cards', 'readonly');
    const store = transaction.objectStore('cards');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function saveCard(card: CardRecord): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('cards', 'readwrite');
    const store = transaction.objectStore('cards');
    const request = store.put(card);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function saveCardsBatch(cards: CardRecord[]): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('cards', 'readwrite');
    const store = transaction.objectStore('cards');
    for (const card of cards) {
      store.put(card);
    }
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function deleteCard(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('cards', 'readwrite');
    const store = transaction.objectStore('cards');
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteCardsBatch(ids: string[]): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('cards', 'readwrite');
    const store = transaction.objectStore('cards');
    for (const id of ids) {
      store.delete(id);
    }
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

// Templates CRUD
export async function getAllTemplates(): Promise<ScannerTemplate[]> {
  const db = await getDB();
  const customTemplates: ScannerTemplate[] = await new Promise((resolve, reject) => {
    const transaction = db.transaction('templates', 'readonly');
    const store = transaction.objectStore('templates');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });

  // Combine default built-in templates with custom saved templates without ID duplication
  const templateMap = new Map<string, ScannerTemplate>();
  for (const t of DEFAULT_TEMPLATES) {
    templateMap.set(t.id, t);
  }
  for (const t of customTemplates) {
    templateMap.set(t.id, t);
  }

  return Array.from(templateMap.values());
}

export async function saveCustomTemplate(template: ScannerTemplate): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('templates', 'readwrite');
    const store = transaction.objectStore('templates');
    const request = store.put(template);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteCustomTemplate(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('templates', 'readwrite');
    const store = transaction.objectStore('templates');
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
