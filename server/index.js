
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";
import {
  createHash,
  randomBytes,
  timingSafeEqual,
  randomUUID,
} from "node:crypto";

dotenv.config();

// ---------------- ENVIRONMENT ----------------

const {
  MONGODB_URI,
  DB_NAME = "nutterxai",
  PORT = 3000,
  CLIENT_URL = "http://localhost:5173",
  CLIENT_URLS = "",
  POLLINATIONS_API_URL = "https://text.pollinations.ai/openai",
  POLLINATIONS_MODEL = "openai",
} = process.env;

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI is missing from environment variables");
}

// ---------------- APP SETUP ----------------

const app = express();

const mongoClient = new MongoClient(MONGODB_URI, {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 10000,
});

let db;
let dbConnectionPromise;

// ---------------- CORS ----------------

const allowedOrigins = [
  CLIENT_URL,
  ...CLIENT_URLS.split(",").map((url) => url.trim()),
  "http://localhost:5173",
  "http://localhost:5174",
].filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Origin not allowed by CORS"));
  },
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "1mb" }));

// ---------------- DATABASE CONNECTION ----------------

const users = () => db.collection("users");
const sessions = () => db.collection("sessions");
const chats = () => db.collection("chats");
const messages = () => db.collection("messages");

export async function connectToDatabase() {
  if (db) {
    return db;
  }

  if (!dbConnectionPromise) {
    dbConnectionPromise = (async () => {
      await mongoClient.connect();

      const database = mongoClient.db(DB_NAME);

      await database.collection("users").createIndex(
        { email: 1 },
        { unique: true }
      );

      await database.collection("sessions").createIndex(
        { token: 1 },
        { unique: true }
      );

      await database.collection("sessions").createIndex(
        { expiresAt: 1 },
        { expireAfterSeconds: 0 }
      );

      await database.collection("chats").createIndex({
        userId: 1,
        createdAt: -1,
      });

      await database.collection("messages").createIndex({
        chatId: 1,
        createdAt: 1,
      });

      db = database;

      console.log(`Connected to MongoDB database: ${DB_NAME}`);

      return db;
    })().catch((error) => {
      dbConnectionPromise = null;
      throw error;
    });
  }

  return dbConnectionPromise;
}

// ---------------- ASYNC ROUTE HANDLER ----------------

const asyncRoute = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

// ---------------- AUTHENTICATION HELPERS ----------------

function getToken(req) {
  const authorization = req.headers.authorization || "";

  if (authorization.startsWith("Bearer ")) {
    return authorization.slice(7);
  }

  return authorization || null;
}

function sessionQuery(token) {
  return {
    token,
    $or: [
      { expiresAt: { $gt: new Date() } },
      { expiresAt: { $exists: false } },
    ],
  };
}

async function createSession(user) {
  const token = randomBytes(32).toString("hex");

  await sessions().insertOne({
    token,
    userId: user._id,
    email: user.email,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  return token;
}

// ---------------- PASSWORD VERIFICATION ----------------

async function verifyPassword(password, storedHash) {
  if (typeof storedHash !== "string") {
    return false;
  }

  if (storedHash.startsWith("$2")) {
    return bcrypt.compare(password, storedHash);
  }

  const [salt, expectedHash] = storedHash.split(":");

  if (!salt || !expectedHash) {
    return false;
  }

  const actualHash = createHash("sha256")
    .update(salt + password)
    .digest("hex");

  const actual = Buffer.from(actualHash, "hex");
  const expected = Buffer.from(expectedHash, "hex");

  return (
    actual.length === expected.length &&
    timingSafeEqual(actual, expected)
  );
}

// ---------------- AUTH MIDDLEWARE ----------------

const requireAuth = asyncRoute(async (req, res, next) => {
  const token = getToken(req);

  if (!token) {
    return res.status(401).json({
      error: "Unauthorized",
    });
  }

  const session = await sessions().findOne(sessionQuery(token));

  if (!session) {
    return res.status(401).json({
      error: "Unauthorized",
    });
  }

  req.userSession = session;

  next();
});

// ---------------- HEALTH CHECK ----------------

app.get("/", (req, res) => {
  res.json({
    status: "NUTTERX-AI server is running",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    application: "NUTTERX-AI",
  });
});

// ---------------- AUTHENTICATION ----------------

// Sign up
app.post(
  "/api/auth/signup",
  asyncRoute(async (req, res) => {
    const body = req.body || {};

    const email = String(body.email || "").trim().toLowerCase();
    const password = body.password;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required",
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        error: "Invalid email address",
      });
    }

    if (typeof password !== "string" || password.length < 6) {
      return res.status(400).json({
        error: "Password must be at least 6 characters",
      });
    }

    const existing = await users().findOne({ email });

    if (existing) {
      return res.status(409).json({
        error: "An account with this email already exists",
      });
    }

    const user = {
      _id: randomUUID(),
      email,
      passwordHash: await bcrypt.hash(password, 12),
      createdAt: new Date(),
    };

    await users().insertOne(user);

    const token = await createSession(user);

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
      },
    });
  })
);

// Sign in
app.post(
  "/api/auth/signin",
  asyncRoute(async (req, res) => {
    const body = req.body || {};

    const email = String(body.email || "").trim().toLowerCase();
    const password = body.password;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required",
      });
    }

    const user = await users().findOne({ email });

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    if (!user.passwordHash.startsWith("$2")) {
      const passwordHash = await bcrypt.hash(password, 12);

      await users().updateOne(
        { _id: user._id },
        { $set: { passwordHash } }
      );
    }

    const token = await createSession(user);

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
      },
    });
  })
);

// Sign out
app.post(
  "/api/auth/signout",
  asyncRoute(async (req, res) => {
    const token = getToken(req);

    if (token) {
      await sessions().deleteOne({ token });
    }

    res.json({
      success: true,
    });
  })
);

// Get current user
app.get(
  "/api/auth/me",
  asyncRoute(async (req, res) => {
    const token = getToken(req);

    if (!token) {
      return res.json({ user: null });
    }

    const session = await sessions().findOne(sessionQuery(token));

    if (!session) {
      return res.json({ user: null });
    }

    res.json({
      user: {
        id: session.userId,
        email: session.email,
      },
    });
  })
);

// ---------------- CHATS ----------------

// List chats
app.get(
  "/api/chats",
  requireAuth,
  asyncRoute(async (req, res) => {
    const chatList = await chats()
      .find({ userId: req.userSession.userId })
      .sort({ createdAt: -1 })
      .toArray();

    res.json({
      chats: chatList.map((chat) => ({
        id: chat._id,
        title: chat.title,
        user_id: chat.userId,
        created_at: chat.createdAt.toISOString(),
      })),
    });
  })
);

// Create chat
app.post(
  "/api/chats",
  requireAuth,
  asyncRoute(async (req, res) => {
    const body = req.body || {};

    const title =
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim()
        : "New Chat";

    const chat = {
      _id: randomUUID(),
      title,
      userId: req.userSession.userId,
      createdAt: new Date(),
    };

    await chats().insertOne(chat);

    res.json({
      chat: {
        id: chat._id,
        title: chat.title,
        user_id: chat.userId,
        created_at: chat.createdAt.toISOString(),
      },
    });
  })
);

// Delete chat and messages
app.delete(
  "/api/chats/:id",
  requireAuth,
  asyncRoute(async (req, res) => {
    const chatId = req.params.id;

    const chat = await chats().findOne({
      _id: chatId,
      userId: req.userSession.userId,
    });

    if (!chat) {
      return res.status(404).json({
        error: "Chat not found",
      });
    }

    await chats().deleteOne({ _id: chatId });
    await messages().deleteMany({ chatId });

    res.json({
      success: true,
    });
  })
);

// ---------------- MESSAGES ----------------

// List messages
app.get(
  "/api/messages",
  requireAuth,
  asyncRoute(async (req, res) => {
    const chatId = req.query.chatId;

    if (!chatId) {
      return res.status(400).json({
        error: "chatId is required",
      });
    }

    const chat = await chats().findOne({
      _id: chatId,
      userId: req.userSession.userId,
    });

    if (!chat) {
      return res.status(404).json({
        error: "Chat not found",
      });
    }

    const messageList = await messages()
      .find({ chatId })
      .sort({ createdAt: 1 })
      .toArray();

    res.json({
      messages: messageList.map((message) => ({
        id: message._id,
        chat_id: message.chatId,
        role: message.role,
        content: message.content,
        created_at: message.createdAt.toISOString(),
      })),
    });
  })
);

// Save message
app.post(
  "/api/messages",
  requireAuth,
  asyncRoute(async (req, res) => {
    const body = req.body || {};

    const { chat_id, role, content } = body;

    if (
      typeof chat_id !== "string" ||
      !["user", "assistant"].includes(role) ||
      typeof content !== "string" ||
      !content.trim()
    ) {
      return res.status(400).json({
        error: "Invalid message data",
      });
    }

    const chat = await chats().findOne({
      _id: chat_id,
      userId: req.userSession.userId,
    });

    if (!chat) {
      return res.status(404).json({
        error: "Chat not found",
      });
    }

    const message = {
      _id: randomUUID(),
      chatId: chat_id,
      role,
      content,
      createdAt: new Date(),
    };

    await messages().insertOne(message);

    res.json({
      message: {
        id: message._id,
        chat_id: message.chatId,
        role: message.role,
        content: message.content,
        created_at: message.createdAt.toISOString(),
      },
    });
  })
);

// ---------------- AI CHAT ----------------

const AI_SYSTEM_PROMPT = `You are NUTTERX-AI, a highly capable, professional, helpful, and friendly AI assistant.

RESPONSE STYLE AND FORMATTING:

1. Write naturally and professionally. Responses should feel like clear, well-written conversations rather than collections of randomly formatted sections.

2. Use normal paragraphs for explanations, general questions, and conversational replies.

3. Use Markdown headings only when an answer genuinely contains multiple distinct sections. Do not add headings to short or simple answers.

4. Use bullet points when presenting several related items.

5. Use numbered lists for instructions, procedures, and step-by-step explanations.

6. Avoid tables by default. Only use a table when comparing multiple items or presenting structured data where a table genuinely improves readability.

7. Format programming code using appropriate Markdown code blocks. Keep code explanations separate from the code itself.

8. Avoid excessive bold text, unnecessary headings, repetitive introductions, and conclusions that simply repeat the answer.

9. Answer the user's actual question directly. Do not add unrelated information just to make an answer longer.

10. Match the length of your response to the complexity of the question. Simple questions deserve concise answers; complex questions deserve thorough explanations.

11. Maintain conversation context. Understand follow-up questions and refer to previous messages when relevant. Do not unnecessarily repeat information already explained.

12. When uncertain, be honest. Never invent facts, sources, or capabilities.

13. When helping with a task, provide practical and actionable guidance.

14. Keep formatting consistent throughout every response.

IDENTITY:

Your name is NUTTERX-AI. You are a capable general-purpose AI assistant. Be respectful, approachable, accurate, and solution-oriented.`;

// Send one SSE message to the frontend
function sendStreamEvent(res, data) {
  if (!res.writableEnded && !res.destroyed) {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}

// Generate streamed AI response
app.post(
  "/api/ai-chat",
  asyncRoute(async (req, res) => {
    const body = req.body || {};
    const incomingMessages = body.messages;

    if (!Array.isArray(incomingMessages)) {
      return res.status(400).json({
        error: "Messages are required",
      });
    }

    const validMessages = incomingMessages
      .filter(
        (message) =>
          message &&
          ["user", "assistant"].includes(message.role) &&
          typeof message.content === "string" &&
          message.content.trim()
      )
      .slice(-30)
      .map((message) => ({
        role: message.role,
        content: message.content.trim(),
      }));

    if (validMessages.length === 0) {
      return res.status(400).json({
        error: "No valid messages provided",
      });
    }

    const controller = new AbortController();

    res.on("close", () => {
      if (!res.writableEnded) {
        controller.abort();
      }
    });

    let response;

    try {
      response = await fetch(POLLINATIONS_API_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          model: POLLINATIONS_MODEL,
          messages: [
            {
              role: "system",
              content: AI_SYSTEM_PROMPT,
            },
            ...validMessages,
          ],
          temperature: 0.7,
          max_tokens: 1000,
          stream: true,
        }),
      });
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      console.error("Pollinations connection error:", error);

      return res.status(502).json({
        error: "Could not connect to the AI provider",
      });
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");

      console.error(
        "Pollinations request failed:",
        response.status,
        errorText.slice(0, 500)
      );

      return res.status(502).json({
        error: "The AI provider could not complete your request",
      });
    }

    if (!response.body) {
      return res.status(502).json({
        error: "The AI provider returned an empty response",
      });
    }

    // Prepare Server-Sent Events response
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    res.flushHeaders?.();

    const contentType = response.headers.get("content-type") || "";

    let fullReply = "";

    try {
      // Handle a normal JSON response if the provider does not stream.
      if (!contentType.includes("text/event-stream")) {
        const raw = await new Response(response.body).text();

        let result;

        try {
          result = JSON.parse(raw);
        } catch {
          result = raw;
        }

        const reply =
          typeof result === "string"
            ? result
            : result?.choices?.[0]?.message?.content ??
              result?.reply ??
              "";

        if (typeof reply !== "string" || !reply.trim()) {
          sendStreamEvent(res, {
            error: "No response received from AI",
          });
          return res.end();
        }

        fullReply = reply.trim();

        // Send the response in small pieces for a consistent client interface.
        const chunkSize = 24;

        for (let i = 0; i < fullReply.length; i += chunkSize) {
          if (controller.signal.aborted) {
            return;
          }

          sendStreamEvent(res, {
            delta: fullReply.slice(i, i + chunkSize),
          });
        }

        sendStreamEvent(res, { done: true });
        return res.end();
      }

      // Read the provider's actual streaming response.
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let buffer = "";
      let streamFinished = false;

      function processSSELine(line) {
        const trimmedLine = line.trim();

        if (!trimmedLine.startsWith("data:")) {
          return;
        }

        const data = trimmedLine.slice(5).trim();

        if (!data || data === "[DONE]") {
          if (data === "[DONE]") {
            streamFinished = true;
          }
          return;
        }

        let parsed;

        try {
          parsed = JSON.parse(data);
        } catch {
          return;
        }

        const delta = parsed?.choices?.[0]?.delta?.content;

        if (typeof delta === "string" && delta.length > 0) {
          fullReply += delta;

          sendStreamEvent(res, {
            delta,
          });
        }

        const messageContent =
          parsed?.choices?.[0]?.message?.content;

        if (
          typeof messageContent === "string" &&
          messageContent.length > 0 &&
          !fullReply
        ) {
          fullReply += messageContent;

          sendStreamEvent(res, {
            delta: messageContent,
          });
        }
      }

      while (!streamFinished) {
        if (controller.signal.aborted) {
          return;
        }

        const { value, done } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          processSSELine(line);

          if (streamFinished) {
            break;
          }
        }
      }

      // Process any remaining buffered data.
      if (buffer.trim() && !controller.signal.aborted) {
        processSSELine(buffer);
      }

      if (controller.signal.aborted) {
        return;
      }

      if (!fullReply.trim()) {
        sendStreamEvent(res, {
          error: "No response received from AI",
        });
        return res.end();
      }

      sendStreamEvent(res, {
        done: true,
      });

      res.end();
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      console.error("AI streaming error:", error);

      sendStreamEvent(res, {
        error: "An error occurred while receiving the AI response",
      });

      res.end();
    }
  })
);

// ---------------- ERROR HANDLING ----------------

app.use((err, req, res, next) => {
  console.error("Server error:", err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    error: "Internal server error",
  });
});

// ---------------- LOCAL DEVELOPMENT ----------------

async function startLocalServer() {
  await connectToDatabase();

  app.listen(Number(PORT), () => {
    console.log(
      `NUTTERX-AI backend running on http://localhost:${PORT}`
    );

    console.log(
      `Connected to MongoDB database: ${DB_NAME}`
    );
  });
}

if (process.env.VERCEL !== "1") {
  startLocalServer().catch((error) => {
    console.error("Could not start NUTTERX-AI backend:", error);
    process.exit(1);
  });
}

// Export Express app for Vercel
export { app };
