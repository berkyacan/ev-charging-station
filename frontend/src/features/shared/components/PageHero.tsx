import type { ReactNode } from 'react';

export interface PageHeroMetric {
  hint?: string;
  label: string;
  value: string;
}

interface PageHeroProps {
  actions?: ReactNode;
  badge?: string;
  description: string;
  eyebrow: string;
  metrics?: PageHeroMetric[];
  title: string;
}

export function PageHero({
  actions,
  badge,
  description,
  eyebrow,
  metrics = [],
  title,
}: PageHeroProps): JSX.Element {
  const spotlightMetric = metrics[0];

  return (
    <div className="page-hero">
      <div aria-hidden="true" className="page-hero__glow" />
      <div className="page-hero__main">
        <div className="page-hero__meta">
          <span className="eyebrow">{eyebrow}</span>
          {badge ? <span className="page-hero__badge">{badge}</span> : null}
        </div>
        <div className="page-hero__headline">
          <div className="page-hero__copy">
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          <div className="page-hero__support">
            {actions ? <div className="page-hero__actions">{actions}</div> : null}
            <article className="page-hero__spotlight">
              <span className="page-hero__spotlight-label">
                {spotlightMetric?.label ?? 'Workspace Summary'}
              </span>
              <strong>{spotlightMetric?.value ?? badge ?? 'Ready'}</strong>
              <p>
                {spotlightMetric?.hint ??
                  'Content refreshes based on the latest workspace state.'}
              </p>
            </article>
          </div>
        </div>
      </div>

      {metrics.length > 0 ? (
        <div className="page-hero__metrics">
          {metrics.map((metric) => (
            <article className="hero-stat" key={metric.label}>
              <span className="hero-stat__label">{metric.label}</span>
              <strong className="hero-stat__value">{metric.value}</strong>
              {metric.hint ? <span className="hero-stat__hint">{metric.hint}</span> : null}
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
