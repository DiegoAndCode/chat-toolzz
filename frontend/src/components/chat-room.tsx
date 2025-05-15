'use client';

import { useEffect, useRef, useState, UIEvent } from 'react';
import { io, Socket } from 'socket.io-client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useTranslations } from 'next-intl';
import { useUser } from '@clerk/nextjs';
import { Skeleton } from '@/components/ui/skeleton';
import type { Message } from '@/types/message';
import { formatDateTime } from '@/utils/format-date';

interface ChatRoomProps {
  initialMessages: Message[];
  initialCurrentPage: number;
  initialTotalPages: number;
}

export default function ChatRoom({ 
  initialMessages, 
  initialCurrentPage, 
  initialTotalPages 
}: ChatRoomProps) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const t = useTranslations();
  const { isLoaded, isSignedIn, user } = useUser();

  // Estados principais
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const [hasScrolledInitially, setHasScrolledInitially] = useState(false);

  // Estados de paginação
  const [currentPage, setCurrentPage] = useState(initialCurrentPage);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(initialCurrentPage < initialTotalPages);

  // Atualiza estados de paginação se props mudarem
  useEffect(() => {
    setMessages(initialMessages.slice().reverse()); // Armazena mensagens em ordem cronológica (mais antigas primeiro)
    setCurrentPage(initialCurrentPage);
    setHasMoreMessages(initialCurrentPage < initialTotalPages);
    setHasScrolledInitially(false); // Permite que o scroll inicial ocorra para a nova lista de mensagens
  }, [initialMessages, initialCurrentPage, initialTotalPages]);

  // Conecta socket uma vez
  useEffect(() => {
    const socket = io(apiUrl);
    socketRef.current = socket;

    socket.on('connect_error', console.error);

    socket.on('message', (msg: Message) => {
      setMessages(prev => [...prev, msg]);
    });

    socket.on('start_typing', ({ userName }: { userName: string }) =>
      setTypingUsers(prev => Array.from(new Set([...prev, userName])))
    );
    socket.on('stop_typing', ({ userName }: { userName: string }) =>
      setTypingUsers(prev => prev.filter(name => name !== userName))
    );

    return () => {
      socket.disconnect();
    };
  }, []);

  // Efeito para controlar o scroll da área de mensagens
  useEffect(() => {
    const scrollEl = scrollViewportRef.current;
    if (!scrollEl || !isLoaded || !isSignedIn) return; // Aborta se não estiver pronto

    if (!hasScrolledInitially && messages.length > 0) {
      // Scroll inicial para o final da lista (mensagens mais recentes)
      scrollEl.scrollTop = scrollEl.scrollHeight;
      setHasScrolledInitially(true);
    } else if (hasScrolledInitially && !isLoadingMore && messages.length > 0) {
      // Scroll para novas mensagens apenas se o usuário estiver perto do final
      // Isso evita rolar automaticamente se o usuário estiver lendo o histórico
      const isNearBottom = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight < 150; // Threshold de 150px

      if (isNearBottom) {
        // Usar requestAnimationFrame para garantir que o scroll ocorra após a atualização do DOM
        requestAnimationFrame(() => {
          if (scrollViewportRef.current) { // Verificar ref novamente dentro do rAF
            scrollViewportRef.current.scrollTop = scrollViewportRef.current.scrollHeight;
          }
        });
      }
    }
  }, [messages, isLoadingMore, isLoaded, isSignedIn, hasScrolledInitially, user]); // user é incluído para futuras melhorias (ex: scroll se for mensagem própria)

  // Reseta chat + input no logout
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      setMessages([]);
      setInput('');
      setTypingUsers([]);
      // Resetar paginação também se necessário, mas initial props devem cuidar disso na próxima carga
    }
  }, [isLoaded, isSignedIn]);

  // Debounce para start/stop typing
  let typingTimeout: NodeJS.Timeout;
  const handleInputChange = (value: string) => {
    setInput(value);
    if (!socketRef.current || !isSignedIn || !user?.firstName) return;

    socketRef.current.emit('start_typing', { userName: user.firstName });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      socketRef.current!.emit('stop_typing', { userName: user!.firstName });
    }, 2000);
  };

  // Envia mensagem via REST (persist + broadcast)
  const send = async () => {
    if (!input.trim() || !isSignedIn || !user) return;
    const msg = {
      userId: user.id,
      userName: user.firstName || 'Usuário Anônimo',
      content: input,
      timestamp: new Date().toISOString()
    };

    await fetch(`${apiUrl}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(msg)
    });

    setInput('');
  };

  const fetchOlderMessages = async () => {
    if (isLoadingMore || !hasMoreMessages || !isSignedIn) return;

    setIsLoadingMore(true);
    const nextPageToFetch = currentPage + 1;

    try {
      const res = await fetch(`${apiUrl}/messages?page=${nextPageToFetch}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch messages: ${res.status}`);
      }
      const paginatedResult = await res.json();
      const olderMessagesRaw: Message[] = paginatedResult.data || [];

      if (olderMessagesRaw.length > 0) {
        const olderMessages = olderMessagesRaw.slice().reverse(); // Reverter para ordem cronológica
        const scrollableView = scrollViewportRef.current;
        const oldScrollHeight = scrollableView?.scrollHeight || 0;
        const oldScrollTop = scrollableView?.scrollTop || 0;

        setMessages(prev => [...olderMessages, ...prev]);
        setCurrentPage(paginatedResult.currentPage);
        setHasMoreMessages(paginatedResult.currentPage < paginatedResult.totalPages);

        // Ajusta scroll após o DOM atualizar
        requestAnimationFrame(() => {
          if (scrollableView) {
            const newScrollHeight = scrollableView.scrollHeight;
            scrollableView.scrollTop = oldScrollTop + (newScrollHeight - oldScrollHeight);
          }
        });
      } else {
        setHasMoreMessages(false); // Não há mais mensagens para carregar
      }
    } catch (error) {
      console.error('Error fetching older messages:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    if (target.scrollTop < 5 && !isLoadingMore && hasMoreMessages && isSignedIn) {
      fetchOlderMessages();
    }
  };

  return (
    <>
      <Card className="flex-1 overflow-hidden not-dark:bg-muted">
        <CardContent className="p-4 h-full flex flex-col">
          <ScrollArea 
            className="flex-1 pr-2 overflow-auto h-full"
            onScroll={handleScroll}
            viewportRef={scrollViewportRef}
          >
            {isLoadingMore && (
              <div className="flex justify-center items-center py-4">
                <div className="border-muted size-6 animate-spin rounded-full border-4 border-t-foreground"></div>
              </div>
            )}
            <ul
              role="log"
              aria-live="polite"
              className="flex flex-col gap-3 pb-4"
            >
              {isLoaded && !isSignedIn && (
                <li className="text-center text-muted-foreground py-4">
                  {t('label_login_message')}
                </li>
              )}
              {!isLoaded && (
                <li className="space-y-4">
                  <Skeleton className="max-w-[75%] h-16 rounded-2xl" />
                  <Skeleton className="max-w-[75%] h-16 rounded-2xl" />
                  <Skeleton className="max-w-[75%] h-16 rounded-2xl ml-auto" />
                </li>
              )}
              {isLoaded && isSignedIn && messages.map((msg, i) => {
                const isMe = msg.userId === user?.id;
                return (
                  <li
                    key={`${msg.timestamp}-${msg.userId}-${i}`}
                    className={`max-w-[75%] px-3 py-2 rounded-2xl text-base flex flex-col ${isMe
                        ? 'bg-primary text-primary-foreground self-end'
                        : 'bg-muted text-foreground self-start'
                      }`}
                  >
                    <div className="text-sm font-bold text-muted-foreground mt-1">
                      {isMe ? t('label_you') : msg.userName}
                    </div>
                    <div className="flex items-baseline-last gap-2">
                      <span>{msg.content}</span>
                      <span className="text-xs text-muted-foreground self-end text-end">
                        {formatDateTime(msg.timestamp)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
            <ScrollBar />
          </ScrollArea>
        </CardContent>
      </Card>

      {isSignedIn && typingUsers.length > 0 && (
        <div
          role="status"
          aria-live="assertive"
          className="text-sm italic text-muted-foreground mt-1"
        >
          {typingUsers.filter(name => name !== user?.firstName).join(', ')}{' '}
          {typingUsers.filter(name => name !== user?.firstName).length > 0 && t('label_is_typing')}
        </div>
      )}

      <form
        onSubmit={e => {
          e.preventDefault();
          send();
        }}
        className="mt-4 flex gap-2"
      >
        <label htmlFor="chat-input" className="sr-only">
          {t('input_placeholder')}
        </label>
        <Input
          id="chat-input"
          className="flex-1"
          aria-label={t('input_placeholder')}
          placeholder={t('input_placeholder')}
          value={input}
          onChange={e => handleInputChange(e.target.value)}
          autoComplete='off'
          disabled={!isSignedIn || !isLoaded}
        />
        <Button
          type="submit"
          className="cursor-pointer"
          aria-label={t('button_send')}
          disabled={!isSignedIn || !isLoaded || !input.trim()}
        >
          {t('button_send')}
        </Button>
      </form>
    </>
  );
}
