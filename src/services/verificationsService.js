import { resource } from './resourceService';
import { api } from '../api/client';
import { requiredSlots, validateDetails, validateDocuments } from '../utils/verification';
export const verificationsService = resource('verifications');
export const isVerificationDemo = () => import.meta.env.VITE_DATA_PROVIDER !== 'api';
function documentStore(action, key, value) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('karivia-verification-files', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('documents');
    request.onerror = () => reject(new Error('Document storage is unavailable. Please enable browser storage and retry.'));
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('documents', action === 'get' ? 'readonly' : 'readwrite');
      const store = tx.objectStore('documents');
      const operation = action === 'get' ? store.get(key) : action === 'delete' ? store.delete(key) : store.put(value, key);
      tx.oncomplete = () => { db.close(); resolve(operation.result); };
      tx.onerror = () => { db.close(); reject(new Error('Could not save documents. Check browser storage and retry.')); };
      tx.onabort = tx.onerror;
    };
  });
}
export const readVerificationDocument = (key, requestId) => isVerificationDemo()
  ? documentStore('get', key)
  : api.get(`/verifications/${encodeURIComponent(requestId)}/documents/${encodeURIComponent(key)}`, { responseType: 'blob' });
export const loadVerificationDraft = userId => documentStore('get', `draft:${userId}`);
export const saveVerificationDraft = (userId, draft) => documentStore('put', `draft:${userId}`, draft);
export const deleteVerificationDraft = userId => documentStore('delete', `draft:${userId}`);
export async function submitVerification(user, form, files, previous) {
  const submit = () => persistVerification(user, form, files, previous);
  // Serialize submissions across tabs where browser Web Locks are available.
  return globalThis.navigator?.locks
    ? navigator.locks.request(`karivia-verification:${user?.id}`, submit)
    : submit();
}
async function persistVerification(user, form, files, previous) {
  if (!user || user.role !== form.role) throw new Error('Sign in with the matching professional account to submit.');
  if (Object.keys(validateDetails(form)).length || Object.keys(validateDocuments(form, files)).length || !form.consent) throw new Error('Complete all required details, documents and confirmation.');
  const existing = await verificationsService.list({ pageSize: 1000, filters: { userId: user.id } });
  if (existing.data.some(item => ['pending', 'approved'].includes(item.status))) throw new Error('You already have a submitted request. Reload to view its status.');
  const details = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]));
  const payload = { ...details, userId: user.id, business: details.name, type: form.role === 'salon' ? 'Salon' : 'Freelancer', document: form.idType, status: 'pending', submittedAt: new Date().toISOString(), consentAt: new Date().toISOString() };
  if (!isVerificationDemo()) {
    const body = new FormData();
    body.append('details', JSON.stringify(payload));
    requiredSlots(form).forEach(slot => body.append(slot.key, files[slot.key]));
    if (previous?.status === 'rejected') return api.post(`/verifications/${encodeURIComponent(previous.id)}/resubmit`, body, { headers: { 'Content-Type': undefined } });
    return api.post('/verifications', body, { headers: { 'Content-Type': undefined } });
  }
  const documents = [];
  try {
    for (const slot of requiredSlots(form)) {
      const file = files[slot.key], key = crypto.randomUUID();
      await documentStore('put', key, file);
      documents.push({ key, slot: slot.key, label: slot.label, name: file.name, size: file.size, mime: file.type });
    }
    const result = previous?.status === 'rejected' ? await verificationsService.update(previous.id, { ...payload, documents, rejectionReason: '', reviewedAt: null }) : await verificationsService.create({ ...payload, documents });
    if (previous?.documents) await Promise.allSettled(previous.documents.map(doc => documentStore('delete', doc.key)));
    return result;
  } catch (error) {
    await Promise.allSettled(documents.map(doc => documentStore('delete', doc.key)));
    throw error;
  }
}
