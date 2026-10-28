import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ApiUser } from '@codedrop/shared';

interface SessionState {
  userId: string | null;
  idToken: string | null;
  user: ApiUser | null;
  lowData: boolean;
  hydrated: boolean;
  setSession: (s: { userId?: string | null; idToken?: string | null; user?: ApiUser | null }) => void;
  setLowData: (v: boolean) => void;
  signOut: () => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      userId: null,
      idToken: null,
      user: null,
      lowData: false,
      hydrated: false,
      setSession: (s) => set((prev) => ({ ...prev, ...s })),
      setLowData: (lowData) => set({ lowData }),
      signOut: () => set({ userId: null, idToken: null, user: null }),
    }),
    {
      name: 'codedrop-session',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ userId: s.userId, idToken: s.idToken, user: s.user, lowData: s.lowData }),
      onRehydrateStorage: () => () => {
        useSession.setState({ hydrated: true });
      },
    },
  ),
);

export function authHeaders(): Record<string, string> {
  const { idToken, userId } = useSession.getState();
  if (idToken) return { Authorization: `Bearer ${idToken}` };
  if (userId) return { 'x-user-id': userId };
  return {};
}
