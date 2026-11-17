/**
 * Production API intentionally disabled in this Pages-compatible demo.
 *
 * This endpoint never accepts uploads, never buffers request bodies, never reads
 * provider secrets, and never claims to have processed media. A real backend
 * must use direct-to-private-storage uploads, durable jobs, authentication or
 * secure anonymous ownership, server-side media inspection, and a worker.
 */

module.exports = async function generateDisabled(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  return res.status(503).json({
    error: "Production processing is not enabled in this demo.",
    code: "DEMO_ONLY"
  });
};
