import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { UpdateButton, useUpdateNotice, type UpdateCall } from './index.js';

const NOTICE = { latest: '0.9.0', version: '0.8.1', text: 'A new version v0.9.0 of text-to-cad is available (currently on v0.8.1)',
  command: 'curl -fsSL https://texttocad.dev/install.sh | sh',
  prompt: 'Run `curl -fsSL https://texttocad.dev/install.sh | sh` to update text-to-cad to 0.9.0 (on Windows: `irm https://www.texttocad.dev/install.ps1 | iex`)',
  instructions: 'https://www.texttocad.dev/install' };

function Host({ call = async () => ({ notice: NOTICE }), initial = NOTICE, send, copy = vi.fn(async () => {}), onLink = vi.fn() }: {
  call?: UpdateCall; initial?: typeof NOTICE | null; send?: (prompt: string) => Promise<void>; copy?: (text: string) => Promise<void>; onLink?: (url: string) => void;
}) {
  const notice = useUpdateNotice(call, initial);
  return notice ? <UpdateButton notice={notice} send={send} copy={copy} onLink={onLink} /> : <p>No notice</p>;
}

async function openCard() {
  fireEvent.click(await screen.findByRole('button', { name: 'Update to 0.9.0' }));
  return screen.findByRole('dialog', { name: 'Update available' });
}

afterEach(cleanup);

it('is a blue button that opens the card with the install command; Send to agent posts the prompt and closes it, and the button stays', async () => {
  const call = vi.fn<UpdateCall>(async () => ({ notice: NOTICE }));
  const send = vi.fn(async () => {});
  render(<Host call={call} send={send} />);
  expect((await screen.findByRole('button', { name: 'Update to 0.9.0' })).className).toContain('bg-blue-500');
  const card = await openCard();
  expect(card.textContent).toContain('A new version of text-to-cad is available. Update with this command:');
  expect(card.querySelector('[data-update-command]')?.textContent).toBe(NOTICE.command);
  const sendButton = screen.getByRole('button', { name: 'Send to agent' });
  expect(sendButton.querySelector('svg')).toBeTruthy(); // its icon first, as Quick Edit's
  await act(async () => { fireEvent.click(sendButton); });
  expect(send).toHaveBeenCalledWith(NOTICE.prompt);
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByRole('button', { name: 'Update to 0.9.0' })).toBeTruthy();
  expect(call).not.toHaveBeenCalled(); // the host knew the notice, and there is no answer to keep
});

it('the command has a copy icon in its corner: it copies the command, and the card stays with a tick beside Send to agent', async () => {
  const send = vi.fn(async () => {});
  const copy = vi.fn(async () => {});
  render(<Host call={async () => ({ notice: NOTICE })} send={send} copy={copy} />);
  await openCard();
  const icon = screen.getByRole('button', { name: 'Copy' });
  expect(icon.textContent).toBe('');
  expect(icon.closest('[data-update-command]')?.textContent).toBe(NOTICE.command);
  expect(screen.queryByRole('button', { name: 'Copy command' })).toBeNull();
  await act(async () => { fireEvent.click(icon); });
  expect(copy).toHaveBeenCalledWith(NOTICE.command);
  expect(screen.getByRole('status').textContent).toBe('Copied. Run it in a terminal.');
  expect((screen.getByRole('button', { name: 'Copied' }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole('button', { name: 'Send to agent' }) as HTMLButtonElement).disabled).toBe(false);
  expect(send).not.toHaveBeenCalled();
});

it('copies the command where nothing can send the prompt, or once sending fails', async () => {
  const copy = vi.fn(async () => {});
  render(<Host call={async () => ({ notice: NOTICE })} send={async () => { throw new Error('refused'); }} copy={copy} />);
  await openCard();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send to agent' })); });
  expect(screen.getByRole('status').textContent).toBe('It could not be sent to the chat. Copy the command and run it in a terminal.');
  // The card's button copies now, in words, and the command keeps its corner icon.
  const copyButton = screen.getByRole('button', { name: 'Copy command' });
  expect([copyButton.querySelector('svg') !== null, copyButton.textContent, copyButton.closest('[data-update-command]')])
    .toEqual([true, 'Copy command', null]);
  expect(screen.getByRole('button', { name: 'Copy' }).closest('[data-update-command]')).not.toBeNull();
  await act(async () => { fireEvent.click(copyButton); });
  expect(copy).toHaveBeenCalledWith(NOTICE.command);
  expect(screen.getByRole('status').textContent).toBe('Copied. Run it in a terminal.');
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('links to manual installation through the host, and the card stays', async () => {
  const onLink = vi.fn();
  render(<Host call={async () => ({ notice: NOTICE })} onLink={onLink} />);
  await openCard();
  const link = screen.getByRole('link', { name: 'Manual installation' }) as HTMLAnchorElement;
  expect([link.href, link.target]).toEqual(['https://www.texttocad.dev/install', '_blank']);
  fireEvent.click(link);
  expect(onLink).toHaveBeenCalledWith('https://www.texttocad.dev/install');
  expect(screen.getByRole('dialog', { name: 'Update available' })).toBeTruthy();
});

it('draws with the page from what the host knew, and reads the server again only when the person comes back', async () => {
  const call = vi.fn<UpdateCall>(async () => ({ notice: null }));
  render(<Host call={call} />);
  // The first render: the button is there, and nothing was asked.
  expect(screen.getByRole('button', { name: 'Update to 0.9.0' })).toBeTruthy();
  expect(call).not.toHaveBeenCalled();
  await act(async () => { fireEvent.focus(window); });
  expect(call).toHaveBeenCalledOnce();
  expect(screen.getByText('No notice')).toBeTruthy(); // the install is current now
});

it('a release found after the page started shows once the person comes back', async () => {
  render(<Host initial={null} />);
  expect(screen.getByText('No notice')).toBeTruthy();
  await act(async () => { fireEvent.focus(window); });
  expect(await screen.findByRole('button', { name: 'Update to 0.9.0' })).toBeTruthy();
});
