/** The public ID inside an invite link (`dozari://i/ABC2345` or `https://host/i/ABC2345`), or null for anything else. */
export function parseInviteLink(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = /^(?:dozari:\/\/|https?:\/\/[^/\s]+\/)i\/([A-Za-z0-9]{4,12})(?:[/?#].*)?$/.exec(url.trim());
  return m ? (m[1] as string).toUpperCase() : null;
}
