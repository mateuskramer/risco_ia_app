import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-4 sm:px-10">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <span className="font-data text-sm font-semibold tracking-wide">Gestão de Riscos</span>
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center px-6 py-10">{children}</main>
    </div>
  );
}
