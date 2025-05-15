import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { SignInButton, UserButton, SignedIn, SignedOut } from "@clerk/nextjs";
import ChatRoom from '@/components/chat-room';
import AlertHistoricError from "@/components/alert-historic-error";
import SheetSearch from "@/components/sheet-search";
import { Button } from "@/components/ui/button";
import { auth } from "@clerk/nextjs/server";
import type { Message } from '@/types/message';
import DialogAbout from "@/components/dialog-about";

export default async function ChatPage() {
  const authObj = await auth();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  let initialMessages: Message[] = [];
  let initialCurrentPage = 1;
  let initialTotalPages = 1;
  let fetchError = false;

  if (authObj.userId) {
    try {
      const res = await fetch(`${apiUrl}/messages?page=${initialCurrentPage}&limit=10`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const paginatedResult = await res.json();
      initialMessages = paginatedResult.data || [];
      initialCurrentPage = paginatedResult.currentPage || 1;
      initialTotalPages = paginatedResult.totalPages || 1;
    } catch (err) {
      console.error('Backend is offline:', err);
      fetchError = true;
      // Define valores padrão em caso de erro para evitar que ChatRoom quebre
      initialMessages = [];
      initialCurrentPage = 1;
      initialTotalPages = 1;
    }
  }

  return (
    <main className="flex flex-col h-screen px-4 py-6 max-w-2xl mx-auto">
      <header className="flex justify-between">
        <h1 className="text-2xl font-bold mb-4 text-center">💬 Chat Toolzz</h1>
        <div className="flex space-x-2 items-center">
          <ThemeToggle />
          <LanguageSwitcher />
          <SignedIn>
            <DialogAbout />
            <SheetSearch />
            <UserButton />
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <Button variant="outline" className="cursor-pointer">Login</Button>
            </SignInButton>
          </SignedOut>
        </div>
      </header>
      
      {fetchError && (AlertHistoricError())}

      <ChatRoom 
        initialMessages={initialMessages} 
        initialCurrentPage={initialCurrentPage}
        initialTotalPages={initialTotalPages}
      />
      
    </main>
  );
}
