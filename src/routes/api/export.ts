import { createFileRoute } from "@tanstack/react-router";
import { exportCsv } from "@/lib/donations.server";

export const Route = createFileRoute("/api/export")({
  server: {
    handlers: {
      GET: async ({ request }) => exportCsv(new URL(request.url)),
    },
  },
});
