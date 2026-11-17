import { useCallback, useState } from 'react';

export type AuthFormField = 'name' | 'email' | 'password' | 'confirmPassword';

// Shared draft for the login and signup forms. The login and signup routes are separate
// components, so their local state resets on navigation. This module-level draft keeps what
// was typed while switching between the two pages. It lasts for the current page session only.
const authFormDraft: Record<AuthFormField, string> = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
};

/** Forget everything typed, so the next person on this tab does not see the previous user's details */
export function clearAuthFormDraft() {
  for (const field of Object.keys(authFormDraft) as AuthFormField[]) {
    authFormDraft[field] = '';
  }
}

export function useAuthFormField(field: AuthFormField) {
  const [value, setValue] = useState(authFormDraft[field]);

  const updateValue = useCallback(
    (next: string) => {
      authFormDraft[field] = next;
      setValue(next);
    },
    [field],
  );

  return [value, updateValue] as const;
}
