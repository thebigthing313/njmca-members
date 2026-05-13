export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function normalizeNullableEmail(email: string | null) {
  return email === null ? null : normalizeEmail(email);
}
