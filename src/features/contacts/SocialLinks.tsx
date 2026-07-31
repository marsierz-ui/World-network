import { PLATFORMS, toUrl } from '../../lib/socials';

export function SocialLinks({ socials }: { socials?: Record<string, string> }) {
  if (!socials) return null;
  const entries = PLATFORMS.filter((p) => socials[p.key]?.trim());
  if (entries.length === 0) return null;
  return (
    <span className="social-links" onClick={(e) => e.stopPropagation()}>
      {entries.map((p) => (
        <a
          key={p.key}
          className="social-chip"
          href={toUrl(p.key, socials[p.key])}
          target="_blank"
          rel="noreferrer"
          title={p.label}
        >
          {p.icon}
        </a>
      ))}
    </span>
  );
}
