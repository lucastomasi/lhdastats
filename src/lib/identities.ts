/** Folded Ceneka names that are the same person as another folded name. */
const SAME_PERSON: Record<string, string> = {
  raffsody: "soylucastomasi",
};

export function canonicalKey(folded: string) {
  return SAME_PERSON[folded] ?? folded;
}

/** Kick handle for a canonical donor key. */
export const KICK_HANDLES: Record<string, string> = {
  soylucastomasi: "raffsody",
};
