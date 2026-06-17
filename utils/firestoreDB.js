import { firestoreDb } from './firebase.js';
import {
  collection, doc, getDocs, setDoc, deleteDoc, query, orderBy, getDoc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// Uploaded image fields store base64 data URLs which can be large.
// Firestore has a 1MB document limit, so we strip them before saving.
// Images remain in the local in-memory state and display correctly in the
// current session, but do not sync across devices.
const IMAGE_FIELDS = ['cardArt', 'cardBackImage', 'iconUpload', 'artIconUpload'];

function stripDataUrls(card) {
  const stripped = { ...card };
  for (const field of IMAGE_FIELDS) {
    if (stripped[field] && typeof stripped[field] === 'string' && stripped[field].startsWith('data:')) {
      stripped[field] = null;
    }
  }
  return stripped;
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
  const cardToSave = { ...stripDataUrls(card), updatedAt: Date.now() };
  await setDoc(doc(firestoreDb, 'users', userId, 'cards', card.id), cardToSave);
  // Return the original card (with images) so the UI stays intact
  return { ...card, updatedAt: cardToSave.updatedAt };
}

export async function deleteCard(userId, cardId) {
  await deleteDoc(doc(firestoreDb, 'users', userId, 'cards', cardId));
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
