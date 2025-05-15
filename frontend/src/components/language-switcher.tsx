'use client';

import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';

const locales = [
  { code: 'pt', label: 'Português', flag: 'br' },
  { code: 'en', label: 'English', flag: 'us' },
  { code: 'es', label: 'Español', flag: 'es' }
];

function getChatLocaleCookie(): string | null {
  const match = document.cookie.match(/(?:^|; )CHAT_LOCALE=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function LanguageSwitcher() {
  const router = useRouter();

  // só pra cliente
  const [mounted, setMounted] = useState(false);
  const [currentLocale, setCurrentLocale] = useState('pt');

  // após montar, leio o cookie
  useEffect(() => {
    const cookieLocale = getChatLocaleCookie();
    if (cookieLocale && locales.some(l => l.code === cookieLocale)) {
      setCurrentLocale(cookieLocale);
    }
    setMounted(true);
  }, []);

  const active = locales.find(l => l.code === currentLocale)!;

  const changeLanguage = (locale: string) => {
    document.cookie = `CHAT_LOCALE=${locale}; path=/; max-age=${60 * 60 * 24 * 365}`;
    setCurrentLocale(locale);
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/*
          Enquanto não montou, exibe um botão genérico
          (tem que bater com o SSR)
        */}
        {!mounted ? (
          <Button variant="outline" size="icon" aria-label="Loading languages..." disabled>
            🌐
          </Button>
        ) : (
          <Button variant="outline" size="icon" className="cursor-pointer" aria-label={active.label}>
            <img
              src={`https://flagcdn.com/w20/${active.flag}.png`}
              alt={active.label}
              width={20}
              height={14}
              className="rounded-sm"
            />
          </Button>
        )}
      </DropdownMenuTrigger>

      {mounted && (
        <DropdownMenuContent>
          {locales.map(locale => (
            <DropdownMenuItem key={locale.code} className='cursor-pointer' onClick={() => changeLanguage(locale.code)}>
              <div className="flex items-center gap-2">
                <img
                  src={`https://flagcdn.com/w20/${locale.flag}.png`}
                  alt={locale.label}
                  width={20}
                  height={14}
                  className="rounded-sm"
                />
                <span>{locale.label}</span>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      )}
    </DropdownMenu>
  );
}
