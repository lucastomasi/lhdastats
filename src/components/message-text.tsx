import type { ReactNode } from "react";

const URL_RE = /https?:\/\/[^\s]+/gi;

export function MessageText({ text }: { text: string }) {
  if (!text.trim()) {
    return <span className="text-muted-foreground">Sin mensaje</span>;
  }

  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    const start = match.index ?? 0;
    if (start > last) parts.push(text.slice(last, start));
    let url = match[0];
    let trail = "";
    while (url.length > 0 && /[),.;!?]$/.test(url)) {
      trail = url.slice(-1) + trail;
      url = url.slice(0, -1);
    }
    parts.push(
      <a
        key={`${start}-${url}`}
        href={url}
        target="_blank"
        rel="noreferrer"
        className="break-all text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
      >
        {url.replace(/^https?:\/\//, "")}
      </a>,
    );
    if (trail) parts.push(trail);
    last = start + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <span className="break-words">{parts}</span>;
}
