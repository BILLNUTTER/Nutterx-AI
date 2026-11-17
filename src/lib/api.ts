import type { Chat, Message } from '@/types';

// ---------------- API CONFIGURATION ----------------

const BASE_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
).replace(/\/+$/, '');

// ---------------- AUTHENTICATION HELPERS ----------------

const USER_TOKEN_KEY = 'nutterx_token';
const ADMIN_TOKEN_KEY = 'nutterx_admin_token';

type AuthScope = 'user' | 'admin' | 'none';

function getToken(scope: AuthScope): string | null {
  if (scope === 'admin') {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  }

  if (scope === 'user') {
    return localStorage.getItem(USER_TOKEN_KEY);
  }

  return null;
}

function setToken(token: string): void {
  localStorage.setItem(USER_TOKEN_KEY, token);
}

function setAdminToken(token: string): void {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

function clearUserToken(): void {
  localStorage.removeItem(USER_TOKEN_KEY);
}

function clearAdminToken(): void {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}

function authHeaders(scope: AuthScope): Record<string, string> {
  const token = getToken(scope);

  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ---------------- API REQUEST HANDLER ----------------

async function request<T>(
  path: string,
  options: RequestInit = {},
  scope: AuthScope = 'user'
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        ...authHeaders(scope),
        ...options.headers,
      },
    });
  } catch {
    throw new Error(
      'Cannot connect to NUTTERX-AI server. Please check that the backend is running.'
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMessage =
      (data as { error?: string }).error ??
      `Request failed (${response.status})`;

    if (response.status === 401) {
      if (scope === 'admin') {
        clearAdminToken();
      } else if (scope === 'user') {
        clearUserToken();
      }
    }

    throw new Error(errorMessage);
  }

  return data as T;
}

// ---------------- API TYPES ----------------

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
  };
}

export interface AdminAuthResponse {
  token: string;
  user: {
    id: string;
    username: string;
    email?: string;
    role: 'admin';
  };
}

interface MeResponse {
  user: {
    id: string;
    email: string;
  } | null;
}

interface AdminMeResponse {
  user: {
    id: string;
    username: string;
    email?: string;
    role: 'admin';
  } | null;
}

export interface PersonalMemory {
  id: string;
  content: string;
  category: string;
  autoLearned?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryInput {
  content: string;
  category?: string;
}

export interface SharedKnowledge {
  id: string;
  title: string;
  content: string;
  status: 'pending' | 'approved' | 'rejected';
  source?: string;
  autoDiscovered?: boolean;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  rejectedAt?: string | null;
  submittedBy?: string;
  userId?: string | null;
  approvedBy?: string | null;
  rejectedBy?: string | null;
}

export interface SharedKnowledgeInput {
  title: string;
  content: string;
  confirmPublic: boolean;
}

// ---------------- ADMIN DASHBOARD TYPES ----------------

export interface AdminUser {
  id: string;
  email: string;
  status?: 'active' | 'disabled';
  createdAt: string | null;
}

export interface AdminUsersPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminUsersResponse {
  users: AdminUser[];
  pagination: AdminUsersPagination;
}

export interface AdminUserDetails extends AdminUser {
  stats?: {
    chats: number;
    messages: number;
    personalMemories: number;
    knowledgeContributions: number;
  };
}

export interface DailyConversationStats {
  date: string;
  count: number;
}

export interface MessageRoleStats {
  role: string;
  count: number;
}

export interface ConversationAnalytics {
  summary: {
    totalChats: number;
    totalMessages: number;
    recentChats: number;
    recentMessages: number;
    totalUsers: number;
    periodDays: number;
  };
  dailyChats: DailyConversationStats[];
  dailyMessages: DailyConversationStats[];
  messageRoles: MessageRoleStats[];
}

export interface AdminSystemHealth {
  application: string;
  status: string;
  services: {
    api: string;
    database: string;
    email: string;
    aiProvider: string;
    administratorAuthentication: string;
  };
  server: {
    uptimeSeconds: number;
    nodeVersion: string;
    platform: string;
    architecture: string;
    memory: {
      rssBytes: number;
      heapTotalBytes: number;
      heapUsedBytes: number;
      externalBytes: number;
    };
  };
  checkedAt: string;
}

export interface LearningStatistics {
  personalLearning: {
    totalMemories: number;
    automaticallyLearned: number;
    manuallyCreated: number;
    categories: {
      category: string;
      count: number;
    }[];
  };
  sharedLearning: {
    totalContributions: number;
    pending: number;
    approved: number;
    rejected: number;
    automaticallyDiscovered: number;
    manuallySubmitted: number;
  };
  checkedAt: string;
}

export type AdminUserStatus = 'active' | 'disabled';

// ---------------- API ----------------

export const api = {
  // ---------------- USER AUTHENTICATION ----------------

  async signUp(
    email: string,
    password: string
  ): Promise<AuthResponse> {
    const res = await request<AuthResponse>(
      '/auth/signup',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      },
      'none'
    );

    setToken(res.token);

    return res;
  },

  async signIn(
    email: string,
    password: string
  ): Promise<AuthResponse> {
    const res = await request<AuthResponse>(
      '/auth/signin',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      },
      'none'
    );

    setToken(res.token);

    return res;
  },

  async signOut(): Promise<void> {
    try {
      await request(
        '/auth/signout',
        {
          method: 'POST',
        },
        'user'
      );
    } finally {
      clearUserToken();
    }
  },

  async getMe(): Promise<{ id: string; email: string } | null> {
    if (!localStorage.getItem(USER_TOKEN_KEY)) {
      return null;
    }

    const res = await request<MeResponse>(
      '/auth/me',
      {},
      'user'
    );

    return res.user;
  },

  // ---------------- ADMIN AUTHENTICATION ----------------

  async adminSignIn(
    username: string,
    password: string
  ): Promise<AdminAuthResponse> {
    const res = await request<AdminAuthResponse>(
      '/admin/signin',
      {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      },
      'none'
    );

    setAdminToken(res.token);

    return res;
  },

  async adminGetMe(): Promise<AdminMeResponse['user']> {
    if (!localStorage.getItem(ADMIN_TOKEN_KEY)) {
      return null;
    }

    const res = await request<AdminMeResponse>(
      '/admin/me',
      {},
      'admin'
    );

    return res.user;
  },

  async adminSignOut(): Promise<void> {
    try {
      await request(
        '/admin/signout',
        {
          method: 'POST',
        },
        'admin'
      );
    } finally {
      clearAdminToken();
    }
  },

  // ---------------- CHATS ----------------

  async listChats(): Promise<Chat[]> {
    const res = await request<{ chats: Chat[] }>(
      '/chats',
      {},
      'user'
    );

    return res.chats;
  },

  async createChat(title: string): Promise<Chat> {
    const res = await request<{ chat: Chat }>(
      '/chats',
      {
        method: 'POST',
        body: JSON.stringify({ title }),
      },
      'user'
    );

    return res.chat;
  },

  async deleteChat(chatId: string): Promise<void> {
    await request(
      `/chats/${encodeURIComponent(chatId)}`,
      {
        method: 'DELETE',
      },
      'user'
    );
  },

  // ---------------- MESSAGES ----------------

  async listMessages(chatId: string): Promise<Message[]> {
    const res = await request<{ messages: Message[] }>(
      `/messages?chatId=${encodeURIComponent(chatId)}`,
      {},
      'user'
    );

    return res.messages;
  },

  async createMessage(
    chatId: string,
    role: 'user' | 'assistant',
    content: string
  ): Promise<Message> {
    const res = await request<{ message: Message }>(
      '/messages',
      {
        method: 'POST',
        body: JSON.stringify({
          chat_id: chatId,
          role,
          content,
        }),
      },
      'user'
    );

    return res.message;
  },

  // ---------------- PERSONAL MEMORY ----------------

  async listMemories(): Promise<PersonalMemory[]> {
    const res = await request<{ memories: PersonalMemory[] }>(
      '/memories',
      {},
      'user'
    );

    return res.memories;
  },

  async createMemory(
    input: MemoryInput
  ): Promise<PersonalMemory> {
    const res = await request<{ memory: PersonalMemory }>(
      '/memories',
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
      'user'
    );

    return res.memory;
  },

  async updateMemory(
    memoryId: string,
    input: MemoryInput
  ): Promise<PersonalMemory> {
    const res = await request<{ memory: PersonalMemory }>(
      `/memories/${encodeURIComponent(memoryId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(input),
      },
      'user'
    );

    return res.memory;
  },

  async deleteMemory(memoryId: string): Promise<void> {
    await request(
      `/memories/${encodeURIComponent(memoryId)}`,
      {
        method: 'DELETE',
      },
      'user'
    );
  },

  // ---------------- SHARED KNOWLEDGE ----------------

  async submitKnowledge(
    input: SharedKnowledgeInput
  ): Promise<SharedKnowledge> {
    const res = await request<{
      knowledge: SharedKnowledge;
      message: string;
    }>(
      '/knowledge',
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
      'user'
    );

    return res.knowledge;
  },

  async listMyKnowledge(): Promise<SharedKnowledge[]> {
    const res = await request<{
      contributions: SharedKnowledge[];
    }>(
      '/knowledge/mine',
      {},
      'user'
    );

    return res.contributions;
  },

  async listApprovedKnowledge(): Promise<
    Pick<
      SharedKnowledge,
      'id' | 'title' | 'content' | 'approvedAt'
    >[]
  > {
    const res = await request<{
      knowledge: Pick<
        SharedKnowledge,
        'id' | 'title' | 'content' | 'approvedAt'
      >[];
    }>(
      '/knowledge',
      {},
      'user'
    );

    return res.knowledge;
  },

  // ---------------- USER KNOWLEDGE DELETION ----------------

  async deleteMyKnowledge(knowledgeId: string): Promise<void> {
    await request(
      `/knowledge/${encodeURIComponent(knowledgeId)}`,
      {
        method: 'DELETE',
      },
      'user'
    );
  },

  // ---------------- ADMIN MODERATION ----------------

  async listPendingKnowledge(): Promise<SharedKnowledge[]> {
    const res = await request<{
      contributions: SharedKnowledge[];
    }>(
      '/knowledge/pending',
      {},
      'admin'
    );

    return res.contributions;
  },

  async listAllKnowledge(): Promise<SharedKnowledge[]> {
    const res = await request<{
      contributions: SharedKnowledge[];
    }>(
      '/knowledge/all',
      {},
      'admin'
    );

    return res.contributions;
  },

  async listAdminApprovedKnowledge(): Promise<SharedKnowledge[]> {
    const res = await request<{
      contributions: SharedKnowledge[];
    }>(
      '/knowledge/approved',
      {},
      'admin'
    );

    return res.contributions;
  },

  async approveKnowledge(
    knowledgeId: string
  ): Promise<SharedKnowledge> {
    const res = await request<{
      knowledge: SharedKnowledge;
    }>(
      `/knowledge/${encodeURIComponent(knowledgeId)}/approve`,
      {
        method: 'PATCH',
      },
      'admin'
    );

    return res.knowledge;
  },

  async rejectKnowledge(
    knowledgeId: string
  ): Promise<SharedKnowledge> {
    const res = await request<{
      knowledge: SharedKnowledge;
    }>(
      `/knowledge/${encodeURIComponent(knowledgeId)}/reject`,
      {
        method: 'PATCH',
      },
      'admin'
    );

    return res.knowledge;
  },

  async deleteKnowledge(knowledgeId: string): Promise<void> {
    await request(
      `/knowledge/${encodeURIComponent(knowledgeId)}`,
      {
        method: 'DELETE',
      },
      'admin'
    );
  },

  // ---------------- ADMIN USER MANAGEMENT ----------------

  async listAdminUsers(
    page = 1,
    limit = 25,
    search = ''
  ): Promise<AdminUsersResponse> {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });

    if (search.trim()) {
      params.set('search', search.trim());
    }

    return request<AdminUsersResponse>(
      `/admin/users?${params.toString()}`,
      {},
      'admin'
    );
  },

  async updateAdminUserStatus(
    userId: string,
    status: AdminUserStatus
  ): Promise<void> {
    await request(
      `/admin/users/${encodeURIComponent(userId)}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      },
      'admin'
    );
  },

  // ---------------- ADMIN CONVERSATION ANALYTICS ----------------

  async getConversationAnalytics(
    days = 30
  ): Promise<ConversationAnalytics> {
    const params = new URLSearchParams({
      days: String(days),
    });

    return request<ConversationAnalytics>(
      `/admin/analytics/conversations?${params.toString()}`,
      {},
      'admin'
    );
  },

  // ---------------- ADMIN SYSTEM HEALTH ----------------

  async getAdminSystemHealth(): Promise<AdminSystemHealth> {
    return request<AdminSystemHealth>(
      '/admin/system/health',
      {},
      'admin'
    );
  },

  // ---------------- ADMIN LEARNING STATISTICS ----------------

  async getLearningStatistics(): Promise<LearningStatistics> {
    return request<LearningStatistics>(
      '/admin/learning/stats',
      {},
      'admin'
    );
  },
};