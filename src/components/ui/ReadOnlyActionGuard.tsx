import { useEffect, useRef, type ReactNode } from 'react';

const DEFAULT_DISABLED_REASON = 'Unavailable for the current state.';
const READ_ONLY_REASON = 'Coming soon / read-only';

function markButtonState(button: HTMLButtonElement) {
  const propsKey = Object.keys(button).find((key) => key.startsWith('__reactProps$'));
  const reactProps = propsKey
    ? (button as unknown as Record<string, { onClick?: unknown }>)[propsKey]
    : undefined;

  if (button.disabled) {
    button.dataset.disabledReason ||= button.title || DEFAULT_DISABLED_REASON;
    button.title ||= button.dataset.disabledReason;
    return;
  }

  if (typeof reactProps?.onClick !== 'function' && !button.dataset.actionState) {
    button.dataset.actionState = 'read-only';
    button.title ||= READ_ONLY_REASON;
  }
}

export function ReadOnlyActionGuard({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const markActions = () => root.querySelectorAll('button').forEach(markButtonState);
    const observer = new MutationObserver(markActions);
    markActions();
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [children]);

  return (
    <div ref={rootRef} style={{ display: 'contents' }}>
      {children}
    </div>
  );
}
