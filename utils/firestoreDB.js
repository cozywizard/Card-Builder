import { firestoreDb, storage } from './firebase.js';
import {
  collection, doc, getDocs, setDoc, deleteDoc, query, orderBy, getDoc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {
  ref, uploadString, getDownloadURL, deleteObject
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';

// Fields that may contain base64 data URLs — these get uploaded to Firebase Storage
const IMAGE_FIELDS = ['cardArt', 'cardBackImage', 'iconUpload', 'artIconUpload'];

async function uploadImage(userId, cardId, field, dataUrl) {
  const imgRef = ref(storage, `users/${userId}/images/${cardId}/${field}`);
  await uploadString(imgRef, dataUrl, 'data_url');
  return await getDownloadURL(imgRef);
}

async function processCardImages(userId, card) {
  const processed = { ...card };
  await Promise.all(IMAGE_FIELDS.map(async (field) => {
    const value = processed[field];
    if (value && typeof value === 'string' && value.startsWith('data:')) {
      processed[field] = await uploadImage(userId, card.id, field, value);
    }
  }));
  return processed;
}

export async function getCards(userId) {
  const q = query(
    collection(firestoreDb, 'users', userId, 'cards'),
    orderBy('updatedAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => d.data());
}

export async function saveCard(userId, card) {
  const cardToSave = { ...card, updatedAt: Date.now() };
  const processed = await processCardImages(userId, cardToSave);
  await setDoc(doc(firestoreDb, 'users', userId, 'cards', card.id), processed);
  return processed;
}

export async function deleteCard(userId, cardId) {
  await deleteDoc(doc(firestoreDb, 'users', userId, 'cards', cardId));
  // Best-effort cleanup of any uploaded images
  await Promise.all(IMAGE_FIELDS.map(async (field) => {
    try {
      await deleteObject(ref(storage, `users/${userId}/images/${cardId}/${field}`));
    } catch (_) {}
  }));
}

// Sheet items are stored in compact form: { id, cardId, sheetIndex, x, y, w, h }
// The full card object is NOT stored to avoid duplicating image data
export async function getSheets(userId) {
  const sheetsRef = doc(firestoreDb, 'users', userId, 'sheets', 'current');
  const snapshot = await getDoc(sheetsRef);
  return snapshot.exists() ? [snapshot.data()] : [];
}

export async function saveSheets(userId, sheetData) {
  const payload = {
    id: 'current-sheets',
    items: Array.isArray(sheetData) ? sheetData : (sheetData.items || []),
    pageCount: sheetData.pageCount || 1,
    updatedAt: Date.now()
  };
  await setDoc(doc(firestoreDb, 'users', userId, 'sheets', 'current'), payload);
  return payload;
}

export async function clearSheets(userId) {
  await deleteDoc(doc(firestoreDb, 'users', userId, 'sheets', 'current'));
}
