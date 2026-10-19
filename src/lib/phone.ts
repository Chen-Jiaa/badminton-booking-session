/**
 * Turns a Malaysian phone number as people type it ("012-345 6789", "+60 12 345 6789")
 * into the digits-only international form wa.me wants ("60123456789").
 * Returns null when it can't be a real number.
 */
export function toWhatsAppNumber(phone: string): string | null {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `60${digits.slice(1)}`;
  return digits.length >= 10 && digits.length <= 13 ? digits : null;
}

export function whatsAppLink(phone: string): string | null {
  const number = toWhatsAppNumber(phone);
  return number ? `https://wa.me/${number}` : null;
}
