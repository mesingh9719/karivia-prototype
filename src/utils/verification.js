export const ID_TYPES = [
  { value: 'passport', label: 'Passport', sides: ['front'] },
  { value: 'national_id', label: 'National identity card', sides: ['front', 'back'] },
  { value: 'driving_license', label: 'Driving licence', sides: ['front', 'back'] },
];
export const BUSINESS_TYPES = [
  { value: 'registration', label: 'Business registration certificate' },
  { value: 'trade_license', label: 'Trade / salon licence' },
  { value: 'tax_registration', label: 'Tax registration certificate' },
];
export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export function validateFile(file) {
  if (!file || !file.size) return 'Choose a non-empty document.';
  if (file.size > MAX_FILE_SIZE) return 'Each file must be 10 MB or smaller.';
  const types = { 'application/pdf': /\.pdf$/i, 'image/jpeg': /\.jpe?g$/i, 'image/png': /\.png$/i };
  if (!types[file.type]?.test(file.name)) return 'Use a PDF, JPG or PNG file with a matching file extension.';
  return '';
}
export function requiredSlots(form) {
  const sides = ID_TYPES.find(type => type.value === form.idType)?.sides || [];
  return [...sides.map(side => ({ key: side, label: side === 'front' ? (form.idType === 'passport' ? 'Passport photo page' : 'Identity document · front') : 'Identity document · back' })), ...(form.role === 'salon' ? [{ key: 'business', label: 'Business registration document' }] : [])];
}
export function validateDetails(form) {
  const errors = {};
  for (const key of ['name', 'legalName', 'email', 'phone', 'country', 'address', 'city', 'postalCode']) if (!form[key]?.trim()) errors[key] = 'This field is required.';
  if (form.name?.trim().length < 2) errors.name = 'Enter at least 2 characters.';
  if (form.legalName?.trim().length < 2) errors.legalName = 'Enter your full legal name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email?.trim() || '')) errors.email = 'Enter a valid email address.';
  const digits = form.phone?.replace(/\D/g, '') || '';
  if (!/^[+\d\s().-]+$/.test(form.phone || '') || digits.length < 7 || digits.length > 15) errors.phone = 'Enter a valid phone number, including country code.';
  if (!['salon', 'freelancer'].includes(form.role)) errors.role = 'Choose a professional account type.';
  return errors;
}
export function validateDocuments(form, files) {
  const errors = {};
  if (!ID_TYPES.some(type => type.value === form.idType)) errors.idType = 'Select an identity document type.';
  if (form.role === 'salon' && !BUSINESS_TYPES.some(type => type.value === form.businessType)) errors.businessType = 'Select a business document type.';
  for (const slot of requiredSlots(form)) { const error = validateFile(files[slot.key]); if (error) errors[slot.key] = error; }
  const selected = requiredSlots(form).map(slot => files[slot.key]).filter(Boolean);
  if (selected.some((file, index) => selected.slice(0, index).some(other => other.name === file.name && other.size === file.size && other.lastModified === file.lastModified))) errors.documents = 'Use a different file for each document side.';
  return errors;
}
