'use server';

import { cookies } from 'next/headers';
import { LOCALE_COOKIE_NAME } from './locales';

export async function setUserLocale(locale: string) {
  (await cookies()).set(LOCALE_COOKIE_NAME, locale);
}
