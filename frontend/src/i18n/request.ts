import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from './locales';

export default getRequestConfig(async () => {
  const cookieLocale = (await cookies()).get('CHAT_LOCALE')?.value;

  // Determina o locale
  const locale = cookieLocale || DEFAULT_LOCALE;

  // Verifica se é suportado ou retorna o padrão
  const finalLocale = SUPPORTED_LOCALES.includes(locale)
    ? locale
    : DEFAULT_LOCALE;

  return {
    locale: finalLocale,
    messages: (await import(`./dictionaries/${finalLocale}.json`)).default,
  };
});
