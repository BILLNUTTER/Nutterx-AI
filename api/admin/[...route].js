import { app, connectToDatabase } from "../../server/index.js";

export default async function handler(req, res) {
  try {
    // Restore the original admin endpoint after Vercel's rewrite.
    const incomingUrl = new URL(
      req.url || "/",
      "http://localhost"
    );

    const originalAdminPath = incomingUrl.searchParams.get(
      "__nutterxOriginalAdminPath"
    );

    if (originalAdminPath !== null) {
      const segments = originalAdminPath
        .split("/")
        .filter(Boolean);

      if (
        segments.length === 0 ||
        segments.some(
          (segment) => segment === "." || segment === ".."
        )
      ) {
        return res.status(400).json({
          error: "Invalid admin API path",
        });
      }

      incomingUrl.searchParams.delete(
        "__nutterxOriginalAdminPath"
      );

      req.url =
        `/api/admin/${segments.join("/")}` +
        (incomingUrl.search || "");
    }

    await connectToDatabase();

    return app(req, res);
  } catch (error) {
    console.error("Vercel admin API error:", error);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
}