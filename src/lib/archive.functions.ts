import { createServerFn } from "@tanstack/react-start";
import { parseFilters, type Filters } from "./archive";

export const getArchivePage = createServerFn({ method: "GET" })
  .validator((input: Filters) => parseFilters(input))
  .handler(async ({ data }) => {
    const { homePayload } = await import("./donations.server");
    return homePayload(data);
  });

export const getKick = createServerFn({ method: "GET" }).handler(async () => {
  const { kickPayload } = await import("./kick.server");
  return kickPayload();
});

export const getPodcast = createServerFn({ method: "GET" }).handler(async () => {
  const { podcastPayload } = await import("./podcast.server");
  return podcastPayload();
});

export const getDonorPage = createServerFn({ method: "GET" })
  .validator((input: { name: string; filters: Filters }) => ({
    name: typeof input?.name === "string" ? input.name.slice(0, 200) : "",
    filters: parseFilters(input?.filters),
  }))
  .handler(async ({ data }) => {
    const { donorPayload } = await import("./donations.server");
    return donorPayload(data.name, data.filters);
  });
