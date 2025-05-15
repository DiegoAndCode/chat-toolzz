"use client";

import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from 'next-intl';
import { Input } from "./ui/input";
import type { Message } from '@/types/message';
import { useState } from "react";
import { formatDateTime } from "@/utils/format-date";
import { ScrollArea } from "./ui/scroll-area";

export default function SheetSearch() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const t = useTranslations();
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/search?q=${encodeURIComponent(query)}`, {
        cache: "no-store"
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const result = await res.json();
      setMessages(result);

      if (result.length === 0) {
        setError(t('search.no_results'));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet 
      onOpenChange={() => {
          setQuery("");
          setMessages([]);
          setError(null);
        }
      }
    >
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="cursor-pointer">
          <Search />
        </Button>
      </SheetTrigger>
      <SheetTitle className="sr-only">{t('search.title')}</SheetTitle>
      <SheetContent side="right" className="flex flex-col">
        <h2 className="px-6 pt-6">Pesquisar Mensagens</h2>
        <div className="px-6 flex flex-col flex-1 overflow-hidden">
          <form
            onSubmit={e => {
            e.preventDefault();
            search();
            }}
            className="flex mt-4 gap-2"
          >
            <label htmlFor="chat-input" className="sr-only">
              {t('search.placeholder')}
            </label>
            <Input
              id="search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1"
              aria-label={t('search.placeholder')}
              placeholder={t('search.placeholder')}
              autoComplete='off'
            />
            <Button
              type="submit"
              className="cursor-pointer"
              aria-label={t('search.button')}
              disabled={!query.trim()}
            >
              <Search />
            </Button>
          </form>

          {error && !messages.length && (
            <div className="flex justify-center items-center py-4">
              <div className="text-sm text-muted-foreground">
                {error}
              </div>
            </div>
          )}

          {loading && (
            <div className="flex justify-center items-center py-4">
              <div className="border-muted size-6 animate-spin rounded-full border-4 border-t-foreground"></div>
            </div>
          )}

          <ScrollArea 
            className="flex-1 pr-2 min-h-0"
          >
            <ul className="flex flex-col gap-3 py-4">
              {messages.map((msg, i) => (
                <li 
                  key={`${msg.userId}-${i}`} 
                  className="px-3 py-2 rounded-xl text-base flex flex-col bg-muted text-foreground"
                >
                  <div className="text-sm font-bold text-muted-foreground mt-1">
                    {msg.userName}
                  </div>
                  <div className="flex items-baseline-last justify-between gap-2">
                    <span>{msg.content}</span>
                    <span className="text-xs text-muted-foreground self-end text-end">
                      {formatDateTime(msg.timestamp)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
