
import type { Message } from '@/types';

interface AIResponse {
  reply: string;
  error?: string;
}

const API_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
).replace(/\/+$/, '');

export async function getAIResponse(messages: Message[]): Promise<AIResponse> {
  try {
    const response = await fetch(`${API_URL}/ai-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    const data: AIResponse = await response.json().catch(() => ({
      reply: '',
    }));

    if (!response.ok) {
      return {
        reply: '',
        error: data.error ?? `Request failed (${response.status})`,
      };
    }

    if (!data.reply) {
      return {
        reply: '',
        error: data.error ?? 'No response received from AI',
      };
    }

    return { reply: data.reply };
  } catch {
    return {
      reply: '',
      error: 'Cannot connect to NUTTERX-AI server. Please check that the backend is running.',
    };
  }
}
