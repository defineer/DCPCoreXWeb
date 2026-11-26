import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { logManager } from '../log';
import { useGlobalization } from '../globalization';
import { Button, WorkspaceIcon } from './primitives';

export interface ToolbarAction {
  key: string;
  label: string;
  accessibleLabel?: string;
  icon?: ReactNode;
  enabled?: boolean;
  allowed?: boolean;
  run?: () => void | Promise<void>;
  actions?: ToolbarAction[];
}

export function ToolbarBar({ children }: { children: ReactNode }) {
  const { t } = useGlobalization();
  return <div role="group" aria-label={t('Common.Actions')} className="workspace-toolbar" data-print-hidden>{children}</div>;
}

export function ClosePageButton({ disabled }: { disabled?: boolean }) {
  const { t } = useGlobalization();
  const navigate = useNavigate();
  return <Button variant="ghost" className="workspace-toolbar-button" disabled={disabled} onClick={() => navigate('/index')}>
    <WorkspaceIcon name="back" />{t('Close', undefined, 'Core')}
  </Button>;
}

export function Toolbar({ actions, operation }: { actions: ToolbarAction[]; operation: string }) {
  const [expanded, setExpanded] = useState<string>();
  const eligible = (action: ToolbarAction) => action.allowed !== false;
  function invoke(action: ToolbarAction) {
    if (!eligible(action) || action.enabled === false) return;
    if (action.actions) { setExpanded(current => current === action.key ? undefined : action.key); return; }
    setExpanded(undefined);
    logManager.write({ level: 'info', category: 'action', outcome: 'intent', operation: operation + '.' + action.key });
    void action.run?.();
  }
  return <ToolbarBar>
    {actions.filter(eligible).map(action => <div key={action.key} className="workspace-toolbar-item">
      <Button variant="ghost" className="workspace-toolbar-button" disabled={action.enabled === false}
        aria-label={action.accessibleLabel} title={action.accessibleLabel}
        aria-expanded={action.actions ? expanded === action.key : undefined} onClick={() => invoke(action)}>
        {action.icon}{action.label}{action.actions && <ChevronDown className="workspace-toolbar-caret" />}
      </Button>
      {action.actions && expanded === action.key && <div className="workspace-toolbar-menu z-20 mt-1 grid min-w-44 gap-1 rounded-md border border-border bg-card p-1 shadow-lg"
        onKeyDown={event => { if (event.key === 'Escape') setExpanded(undefined); }}>
        {action.actions.filter(eligible).map(child => <Button key={child.key} variant="ghost"
          className="justify-start" disabled={child.enabled === false} onClick={() => invoke(child)}>{child.icon}{child.label}</Button>)}
      </div>}
    </div>)}
  </ToolbarBar>;
}
