export interface Chat {
  id: string;
  title: string;
  user_id: string;
  created_at: string;
}

export interface Message {
  id: string;
  chat_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface AuthUser {
  id: string;
  email: string;
}
