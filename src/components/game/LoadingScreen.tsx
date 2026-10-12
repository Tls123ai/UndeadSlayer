import { Check, Circle, Database, LoaderCircle, RotateCcw, Swords, UserRound, WandSparkles } from "lucide-react";

export interface LoadingStep {
  label: string;
  state: "pending" | "active" | "complete";
}

interface LoadingScreenProps {
  title?: string;
  message?: string;
  progress?: number;
  steps?: LoadingStep[];
  tip?: string;
  error?: string | null;
  onRetry?: () => void;
  onCancel?: () => void;
}

/** Presentation-only so the route's server-rendered fallback works before JS loads. */
export default function LoadingScreen({
  title = "Loading your adventure",
  message = "Preparing your adventure…",
  progress,
  steps,
  tip = "A well-timed dodge can turn the tide. Keep moving when a boss winds up an attack.",
  error,
  onRetry,
  onCancel,
}: LoadingScreenProps) {
  const percent = progress === undefined ? undefined : Math.round(Math.max(0, Math.min(100, progress)));
  const stepIcons = [Database, UserRound, WandSparkles];

  return (
    <main className="realm-loader" aria-busy={!error} data-testid="loading-screen">
      <div className="realm-loader__sky" aria-hidden="true" />
      <div className="realm-loader__mountains" aria-hidden="true" />
      <div className="realm-loader__embers" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} style={{ left: `${12 + i * 11}%`, animationDelay: `${i * -1.7}s`, animationDuration: `${7 + i % 3}s` }} />
        ))}
      </div>

      <div className="realm-loader__content">
        <div className="realm-loader__eyebrow"><span /> A DARK FANTASY ADVENTURE <span /></div>
        <div className="realm-loader__emblem" aria-hidden="true">
          <div className="realm-loader__rune" />
          <div className="realm-loader__rune realm-loader__rune--inner" />
          <div className="realm-loader__crest"><Swords strokeWidth={1.25} /></div>
        </div>
        <h1 className="realm-loader__brand">UNDEAD <span>SLAYER</span></h1>
        <div className="realm-loader__chronicles"><span /> CHRONICLES <span /></div>
        {!error && <div className="realm-loader__activity" aria-hidden="true">
          <LoaderCircle className="realm-loader__spinner" size={13} />
          <span>Loading game</span>
        </div>}

        <div className="realm-loader__loading">
          <h2 className="realm-loader__title">{error ? "The realm is out of reach" : title}</h2>
          {error ? (
            <p className="realm-loader__error" role="alert">{error}</p>
          ) : (
            <>
              <div className="realm-loader__status">
                <p role="status" aria-live="polite">{message}</p>
                <span aria-hidden="true">{percent === undefined ? <LoaderCircle className="realm-loader__spinner" size={15} /> : `${percent}%`}</span>
              </div>
              <div
                className={`realm-loader__track${percent === undefined ? " realm-loader__track--indeterminate" : ""}`}
                role="progressbar"
                aria-label={title}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                aria-valuetext={percent === undefined ? message : `${percent}% — ${message}`}
              >
                <div className="realm-loader__fill" style={percent === undefined ? undefined : { width: `${percent}%` }} />
              </div>
              {steps && (
                <ol className="realm-loader__steps">
                  {steps.map((step, i) => {
                    const Icon = step.state === "complete" ? Check : step.state === "active" ? stepIcons[i % stepIcons.length] : Circle;
                    return (
                      <li key={step.label} data-state={step.state} aria-current={step.state === "active" ? "step" : undefined}>
                        <Icon size={13} aria-hidden="true" />
                        <span>{step.label}</span>
                        <span className="sr-only"> — {step.state}</span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </>
          )}
          {(onRetry && error || onCancel) && (
            <div className="realm-loader__actions">
              {onRetry && error && <button type="button" onClick={onRetry}><RotateCcw size={15} /> Try again</button>}
              {onCancel && <button type="button" className="realm-loader__back" onClick={onCancel}>Return to sanctuary</button>}
            </div>
          )}
        </div>

        <div className="realm-loader__tip">
          <WandSparkles size={17} aria-hidden="true" />
          <p><span>SLAYER&apos;S WISDOM</span>{tip}</p>
        </div>
      </div>
      <footer className="realm-loader__footer">10 HEROES <span>◆</span> 5 CHAPTERS <span>◆</span> ONE DESTINY</footer>
    </main>
  );
}
