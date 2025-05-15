import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "./ui/button";
import { Coffee } from "lucide-react";
import Link from "next/link";

export default function DialogAbout() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="cursor-pointer">
          <Coffee />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sobre este desafio técnico</DialogTitle>
          <DialogDescription>Chat Toolzz</DialogDescription>
        </DialogHeader>
        <div className="mt-2 space-y-2 text-sm leading-relaxed text-foreground">
          <p>
            <span className="font-semibold">Desenvolvido por:</span> Diego de
            Andrade
          </p>
          <p>
            <span className="font-semibold">Email:</span>{" "}
            <a
              href="mailto:diegodeandrade1986@gmail.com"
              className="hover:text-primary"
            >
              diegodeandrade1986@gmail.com
            </a>
          </p>
          <p>
            <span className="font-semibold">Data:</span> 15/05/2025
          </p>
        </div>
        <DialogFooter>
          <Link href="https://github.com/DiegoAndCode/chat-toolzz" target="_blank" rel="noopener">
            <Button variant={"outline"} className="cursor-pointer">
              Github
            </Button>
          </Link>
          <Link href={`${apiUrl}/api-docs`} target="_blank" rel="noopener">
            <Button variant={"outline"} className="cursor-pointer">
              API Swagger
            </Button>
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
