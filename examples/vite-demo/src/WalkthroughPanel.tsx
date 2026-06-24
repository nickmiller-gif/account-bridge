import { useMemo } from 'react';

import type { WalkthroughScenario, WalkthroughScenarioId } from './walkthrough.js';

interface ServiceStatus {
  walletHost: boolean;
  nodeProxy: boolean;
  platformService: boolean;
}

export interface WalkthroughPanelProps {
  scenario: WalkthroughScenario;
  activeStep: number;
  onStepChange: (index: number) => void;
  onScenarioSelect: (id: WalkthroughScenarioId) => void;
  scenarios: WalkthroughScenario[];
  services: ServiceStatus;
}

export function WalkthroughPanel({
  scenario,
  activeStep,
  onStepChange,
  onScenarioSelect,
  scenarios,
  services,
}: WalkthroughPanelProps) {
  const blocker = useMemo(() => {
    if (scenario.requiresWalletHost && !services.walletHost) {
      return {
        label: 'Wallet host offline',
        hint: 'Run npm run demo from account-bridge root (starts port 3456).',
      };
    }
    if (scenario.requiresNodeProxy && !services.nodeProxy) {
      return {
        label: 'Node proxy offline',
        hint: 'Run npm run demo -- --with-proxy from account-bridge root (port 3920).',
      };
    }
    if (scenario.requiresPlatformService && !services.platformService) {
      return {
        label: 'Platform service offline',
        hint: 'Run npm run demo:platform from account-bridge root (port 3460).',
      };
    }
    return null;
  }, [scenario, services]);

  return (
    <section className="walkthrough" aria-label="Walkthrough guide">
      <div className="walkthrough__scenarios" role="tablist" aria-label="Demo scenarios">
        {scenarios.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={scenario.id === item.id}
            className={[
              'walkthrough__scenario',
              scenario.id === item.id ? 'walkthrough__scenario--active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onScenarioSelect(item.id)}
          >
            <span className="walkthrough__scenario-title">{item.title}</span>
            <span className="walkthrough__scenario-sub">{item.subtitle}</span>
          </button>
        ))}
      </div>

      {blocker ? (
        <div className="walkthrough__blocker" role="status">
          <strong>{blocker.label}</strong>
          <p>{blocker.hint}</p>
        </div>
      ) : null}

      <ol className="walkthrough__steps">
        {scenario.steps.map((step, index) => {
          const state =
            index < activeStep ? 'done' : index === activeStep ? 'current' : 'upcoming';
          return (
            <li key={step.title}>
              <button
                type="button"
                className={[
                  'walkthrough__step',
                  `walkthrough__step--${state}`,
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => onStepChange(index)}
                aria-current={state === 'current' ? 'step' : undefined}
              >
                <span className="walkthrough__step-num" aria-hidden>
                  {state === 'done' ? '✓' : index + 1}
                </span>
                <span className="walkthrough__step-body">
                  <span className="walkthrough__step-title">{step.title}</span>
                  <span className="walkthrough__step-detail">{step.detail}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="walkthrough__actions">
        <button
          type="button"
          className="walkthrough__btn walkthrough__btn--ghost"
          disabled={activeStep <= 0}
          onClick={() => onStepChange(activeStep - 1)}
        >
          Previous
        </button>
        <button
          type="button"
          className="walkthrough__btn walkthrough__btn--primary"
          disabled={activeStep >= scenario.steps.length - 1}
          onClick={() => onStepChange(activeStep + 1)}
        >
          Next step
        </button>
      </div>

      <ul className="walkthrough__see">
        {scenario.youWillSee.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  );
}
