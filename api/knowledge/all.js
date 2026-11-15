
import { app, connectToDatabase } from "../../server/index.js";

export default async function handler(req, res) {
  try {
    await connectToDatabase();
    return app(req, res);
  } catch (error) {
    console.error("Knowledge all API error:", error);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
}

