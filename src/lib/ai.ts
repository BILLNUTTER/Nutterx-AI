
import type { Message } from '@/types';

interface AIResponse {
  reply: string;
  error?: string;
}

interface StreamEvent {
  delta?: string;
  done?: boolean;
  error?: string;
}

const API_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
).replace(/\/+$/, '');

export async function getAIResponse(
  messages: Message[],
  onChunk?: (chunk: string) => void
): Promise<AIResponse> {
  try {
    const response = await fetch(`${API_URL}/ai-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        messages: messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      }),
    });

    if (!response.ok) {
      const data: AIResponse = await response.json().catch(() => ({
        reply: '',
      }));

      return {
        reply: '',
        error: data.error || `Request failed (${response.status})`,
      };
    }

    if (!response.body) {
      return {
        reply: '',
        error: 'Your browser does not support response streaming.',
      };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = '';
    let fullReply = '';
    let streamCompleted = false;

    const processEvent = (event: string) => {
      const dataLines = event
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim());

      for (const dataLine of dataLines) {
        if (!dataLine) continue;

        let parsed: StreamEvent;

        try {
          parsed = JSON.parse(dataLine) as StreamEvent;
        } catch {
          continue;
        }

        if (parsed.error) {
          throw new Error(parsed.error);
        }

        if (typeof parsed.delta === 'string') {
          fullReply += parsed.delta;
          onChunk?.(parsed.delta);
        }

        if (parsed.done) {
          streamCompleted = true;
        }
      }
    };

    while (!streamCompleted) {
      const { value, done } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() || '';

      for (const event of events) {
        processEvent(event);

        if (streamCompleted) break;
      }
    }

    buffer += decoder.decode();

    if (buffer.trim() && !streamCompleted) {
      processEvent(buffer);
    }

    if (!fullReply.trim()) {
      return {
        reply: '',
        error: 'No response received from AI',
      };
    }

    return {
      reply: fullReply.trim(),
    };
  } catch (error) {
    return {
      reply: '',
      error:
        error instanceof Error
          ? error.message
          : 'Cannot connect to NUTTERX-AI server. Please check that the backend is running.',
    };
  }
}
