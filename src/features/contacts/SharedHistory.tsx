import { useSharedLinkedIn } from './useSharedLinkedIn';

const span = (from: string | null, to: string | null) =>
  [from?.slice(0, 7) ?? '?', to?.slice(0, 7) ?? 'present'].join(' - ');

export function SharedHistory({ contactId }: { contactId: string }) {
  const { data } = useSharedLinkedIn();
  const shared = data?.get(contactId);
  if (!shared) return null;
  return (
    <section className="shared-history">
      <h4>Shared by {shared.full_name ?? 'this contact'} from LinkedIn</h4>
      {shared.headline && <div className="muted">{shared.headline}</div>}
      {shared.positions.length > 0 && (
        <>
          <h5>Experience</h5>
          <ul>
            {shared.positions.map((p, i) => (
              <li key={i}>
                <strong>{[p.title, p.company].filter(Boolean).join(' @ ')}</strong>
                <div className="muted small">
                  {span(p.from, p.to)}
                  {p.location && ` - ${p.location}`}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      {shared.education.length > 0 && (
        <>
          <h5>Education</h5>
          <ul>
            {shared.education.map((e, i) => (
              <li key={i}>
                <strong>{[e.degree, e.school].filter(Boolean).join(', ')}</strong>
                <div className="muted small">{span(e.from, e.to)}</div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
