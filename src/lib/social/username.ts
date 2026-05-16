const MIN = 3;
const MAX = 20;

export type UsernameValidationOk = { ok: true; usernameLower: string; usernameDisplay: string };
export type UsernameValidationErr = { ok: false; error: string };

export function stripAt(raw: string): string {
  return raw.trim().replace(/^@+/, "");
}

/**
 * Validates social username (Latin letters, digits, underscore).
 * Returns normalized lowercase key + display form (without @).
 */
export function validateUsernameInput(raw: string): UsernameValidationOk | UsernameValidationErr {
  const inner = stripAt(raw);
  if (inner.length < MIN) {
    return { ok: false, error: `اسم المستخدم يجب أن يكون ${MIN} أحرف على الأقل.` };
  }
  if (inner.length > MAX) {
    return { ok: false, error: `اسم المستخدم يجب ألا يتجاوز ${MAX} حرفاً.` };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(inner)) {
    return { ok: false, error: "يُسمح بالإنجليزية والأرقام والشرطة السفلية فقط." };
  }
  if (/^[0-9]/.test(inner)) {
    return { ok: false, error: "لا يمكن أن يبدأ اسم المستخدم برقم." };
  }
  const usernameLower = inner.toLowerCase();
  return { ok: true, usernameLower, usernameDisplay: inner };
}
