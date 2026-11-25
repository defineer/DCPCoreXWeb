import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { GlobalizationProvider } from '@/shared/globalization';
import { DataTable } from '@/shared/ui/data-table';
import { DashboardToolbar } from '@/shared/ui/dashboard';
import { DialogManager, useDialogManager } from '@/shared/ui/dialog-manager';
import { Button } from '@/shared/ui/primitives';

it('supports keyboard selection of a semantic table row', async () => {
  const choose = vi.fn();
  const row = { id: 7, name: 'Ada' };
  render(<DataTable rows={[row]} columns={[{ key: 'name', title: 'Name', render: item => item.name }]}
    label="Users" rowId={item => item.id} selected={7} onSelect={choose} />);
  const user = userEvent.setup();
  await user.tab();
  expect(screen.getByRole('button', { name: 'Ada', pressed: true })).toHaveFocus();
  await user.keyboard('{Enter}');
  expect(choose).toHaveBeenCalledWith(row);
});

it('drives range selection through the reusable dashboard toolbar', async () => {
  const select = vi.fn();
  render(<GlobalizationProvider language="en-US"><DashboardToolbar range="Today" changeRange={select} /></GlobalizationProvider>);
  await userEvent.setup().selectOptions(screen.getByLabelText('Date range'), 'Month');
  expect(select).toHaveBeenCalledWith('Month');
});

it('dismisses confirmation without authorizing the command', async () => {
  const answer = vi.fn();
  function Trigger() {
    const dialog = useDialogManager();
    return <Button onClick={() => { void dialog({ message: 'Remove this record?' }).then(answer); }}>Confirm</Button>;
  }
  render(<GlobalizationProvider language="en-US"><DialogManager><Trigger /></DialogManager></GlobalizationProvider>);
  const user = userEvent.setup();
  const trigger = screen.getByRole('button', { name: 'Confirm' });
  await user.click(trigger);
  expect(screen.getByRole('alertdialog')).toBeVisible();
  await user.keyboard('{Escape}');
  expect(answer).toHaveBeenCalledWith(false);
  expect(trigger).toHaveFocus();
});
