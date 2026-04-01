export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  isAdmin?: boolean;
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (!res.ok) return null;
    const data = await res.json();
    return { ...data.user, isAdmin: data.isAdmin };
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
  });
  window.location.href = '/auth/signin';
}

export function loginWithGoogle(): void {
  window.location.href = '/api/auth/google';
}
