'use client';

import { setTokenGetter } from './http';
import { useAuthStore } from '@/shared/stores/auth-store';

// Wire token getter to the API client (client-side only)
setTokenGetter(() => useAuthStore.getState().accessToken);
