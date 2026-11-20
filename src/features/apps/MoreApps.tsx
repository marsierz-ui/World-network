// The five xTrails apps, same account. An app without a public URL yet is a
// plain dot, not a link.
const APPS = [
  { name: 'CrowdTrails', color: '#3F5BB8', url: null, current: true },
  { name: 'PicTrails', color: '#A73B15', url: null },
  { name: 'BrainTrails', color: '#894095', url: null },
  { name: 'SpendingTrails', color: '#007A3A', url: null },
  { name: 'StockTrails', color: '#007598', url: 'https://marsierz-ui.github.io/attention-tracker/' },
] as const;

export function MoreApps() {
  return (
    <div className="more-apps">
      <div className="more-apps-title">xTrails apps, same account</div>
      <div className="app-dots">
        {APPS.map((a) => {
          const current = 'current' in a;
          if (current) {
            return <span key={a.name} className="app-dot current" style={{ background: a.color }} title={a.name} aria-label={`${a.name}, current app`} />;
          }
          if (!a.url) {
            return <span key={a.name} className="app-dot off" style={{ background: a.color }} title={`${a.name}, not online yet`} aria-label={`${a.name}, not online yet`} />;
          }
          return <a key={a.name} className="app-dot" href={a.url} style={{ background: a.color }} title={a.name} aria-label={a.name} />;
        })}
      </div>
    </div>
  );
}
