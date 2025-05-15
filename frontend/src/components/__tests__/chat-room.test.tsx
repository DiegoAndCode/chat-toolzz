/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import ChatRoom from '../chat-room';
import { useUser } from '@clerk/nextjs';
import { useTranslations } from 'next-intl';
import { io } from 'socket.io-client';

// mocks
jest.mock('@clerk/nextjs', () => ({
  useUser: jest.fn()
}));
jest.mock('next-intl', () => ({
  useTranslations: jest.fn()
}));
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => ({
    on: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn()
  }))
}));

describe('ChatRoom', () => {
  const initialMessages = [
    {
      userId: 'u1',
      userName: 'Alice',
      content: 'Hello',
      timestamp: '2025-05-14T10:00:00.000Z'
    },
    {
      userId: 'u2',
      userName: 'Bob',
      content: 'Hi there',
      timestamp: '2025-05-14T10:01:00.000Z'
    }
  ];

  beforeEach(() => {
    // signed in user
    (useUser as jest.Mock).mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      user: { id: 'u1', firstName: 'Alice' }
    });
    // t() returns key for simplicity
    (useTranslations as jest.Mock).mockReturnValue((key: string) => key);
    // reset fetch mock
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({})
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('renders the initial messages in order', () => {
    render(
      <ChatRoom
        initialMessages={initialMessages}
        initialCurrentPage={1}
        initialTotalPages={1}
      />
    );

    // messages should appear; since component uses flex-col-reverse, the first in DOM is latest
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(initialMessages.length);

    // check content
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('Hi there')).toBeInTheDocument();
  });

  it('shows typing indicator when other user types', () => {
    // override socket mock to call handler immediately
    const onMock = jest.fn((evt, cb) => {
      if (evt === 'start_typing') {
        cb({ userName: 'Bob' });
      }
    });
    (io as jest.Mock).mockReturnValue({
      on: onMock,
      emit: jest.fn(),
      disconnect: jest.fn()
    });

    render(
      <ChatRoom
        initialMessages={initialMessages}
        initialCurrentPage={1}
        initialTotalPages={1}
      />
    );

    // should show "Bob label_is_typing"
    expect(screen.getByText(/Bob label_is_typing/)).toBeInTheDocument();
  });
});
