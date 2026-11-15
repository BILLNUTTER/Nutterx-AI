
import type { Chat, Message } from '@/types';

// ---------------- API CONFIGURATION ----------------

const BASE_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
).replace(/\/+$/, '');

// ---------------- AUTHENTICATION HELPERS ----------------

function getToken(): string | null {
  return localStorage.getItem('nutterx_token');
}

function setToken(token: string): void {
  localStorage.setItem('nutterx_token', token);
}

function clearToken(): void {
  localStorage.removeItem('nutterx_token');
}

function authHeaders(): Record<string, string> {
  const token = getToken();

  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ---------------- API REQUEST HANDLER ----------------

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        ...authHeaders(),
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
      clearToken();
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

interface MeResponse {
  user: {
    id: string;
    email: string;
  } | null;
}

export interface PersonalMemory {
  id: string;
  content: string;
  category: string;
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
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
}

export interface SharedKnowledgeInput {
  title: string;
  content: string;
  confirmPublic: boolean;
}

// ---------------- API ----------------

export const api = {
  // ---------------- AUTH ----------------

  async signUp(
    email: string,
    password: string
  ): Promise<AuthResponse> {
    const res = await request<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    setToken(res.token);

    return res;
  },

  async signIn(
    email: string,
    password: string
  ): Promise<AuthResponse> {
    const res = await request<AuthResponse>('/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    setToken(res.token);

    return res;
  },

  async signOut(): Promise<void> {
    try {
      await request('/auth/signout', {
        method: 'POST',
      });
    } finally {
      clearToken();
    }
  },

  async getMe(): Promise<{ id: string; email: string } | null> {
    if (!getToken()) {
      return null;
    }

    const res = await request<MeResponse>('/auth/me');

    return res.user;
  },

  // ---------------- CHATS ----------------

  async listChats(): Promise<Chat[]> {
    const res = await request<{ chats: Chat[] }>('/chats');

    return res.chats;
  },

  async createChat(title: string): Promise<Chat> {
    const res = await request<{ chat: Chat }>('/chats', {
      method: 'POST',
      body: JSON.stringify({ title }),
    });

    return res.chat;
  },

  async deleteChat(chatId: string): Promise<void> {
    await request(`/chats/${encodeURIComponent(chatId)}`, {
      method: 'DELETE',
    });
  },

  // ---------------- MESSAGES ----------------

  async listMessages(chatId: string): Promise<Message[]> {
    const res = await request<{ messages: Message[] }>(
      `/messages?chatId=${encodeURIComponent(chatId)}`
    );

    return res.messages;
  },

  async createMessage(
    chatId: string,
    role: 'user' | 'assistant',
    content: string
  ): Promise<Message> {
    const res = await request<{ message: Message }>('/messages', {
      method: 'POST',
      body: JSON.stringify({
        chat_id: chatId,
        role,
        content,
      }),
    });

    return res.message;
  },

  // ---------------- PERSONAL MEMORY ----------------

  async listMemories(): Promise<PersonalMemory[]> {
    const res = await request<{ memories: PersonalMemory[] }>(
      '/memories'
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
      }
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
      }
    );

    return res.memory;
  },

  async deleteMemory(memoryId: string): Promise<void> {
    await request(
      `/memories/${encodeURIComponent(memoryId)}`,
      {
        method: 'DELETE',
      }
    );
  },

  // ---------------- SHARED KNOWLEDGE ----------------

  async submitKnowledge(
    input: SharedKnowledgeInput
  ): Promise<SharedKnowledge> {
    const res = await request<{
      knowledge: SharedKnowledge;
      message: string;
    }>('/knowledge', {
      method: 'POST',
      body: JSON.stringify(input),
    });

    return res.knowledge;
  },

  async listMyKnowledge(): Promise<SharedKnowledge[]> {
    const res = await request<{
      contributions: SharedKnowledge[];
    }>('/knowledge/mine');

    return res.contributions;
  },

  async listApprovedKnowledge(): Promise<
    Pick<SharedKnowledge, 'id' | 'title' | 'content' | 'approvedAt'>[]
  > {
    const res = await request<{
      knowledge: Pick<
        SharedKnowledge,
        'id' | 'title' | 'content' | 'approvedAt'
      >[];
    }>('/knowledge');

    return res.knowledge;
  },

  // ---------------- MODERATION ----------------

  async listPendingKnowledge(): Promise<SharedKnowledge[]> {
    const res = await request<{
      contributions: SharedKnowledge[];
    }>('/knowledge/pending');

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
      }
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
      }
    );

    return res.knowledge;
  },

  async deleteKnowledge(knowledgeId: string): Promise<void> {
    await request(
      `/knowledge/${encodeURIComponent(knowledgeId)}`,
      {
        method: 'DELETE',
      }
    );
  },
};
