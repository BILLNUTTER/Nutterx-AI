import { app, connectToDatabase } from "../../../server/index.js";

export default async function handler(req, res) {
  try {
    await connectToDatabase();
    return app(req, res);
  } catch (error) {
    console.error("Admin analytics API error:", error);

    if (!res.headersSent) {
      return res.status(500).json({
        error: "Internal server error",
      });
    }
  }
}