// utils/maskPhone.js
export const maskPhone = (number) => {
  if (!number) return '••••••••••';
  const cleaned = number.replace(/\D/g, ''); // strip non-digits
  if (cleaned.length < 4) return '••••';
  const first2 = cleaned.slice(0, 2);
  const last2  = cleaned.slice(-2);
  const dots   = '•'.repeat(cleaned.length - 4);
  return `+${first2}${dots}${last2}`;
  // e.g. 919876543289 → +91••••••••89
};