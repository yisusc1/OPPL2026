import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from 'sonner';
import { UserProvider } from "@/components/providers/user-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sistema de Gestión",
  description: "Plataforma integral de operaciones",
};

// ... imports
import { createClient } from "@/lib/supabase/server";
import { getSystemSettings } from "./admin/settings-actions";

// ... existing imports

import { VoiceAssistant } from "@/components/voice-assistant";
import { VoiceProvider } from "@/components/voice-provider";
import { ThemeProvider } from "@/components/theme-provider";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile = null;

  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    profile = data;
  }

  // Fetch System Settings
  const settings = await getSystemSettings()
  const isVoiceEnabled = settings["VOICE_ENABLED"] !== false // Default true

  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <UserProvider initialUser={user} initialProfile={profile}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <VoiceProvider>
              {children}
              {isVoiceEnabled && <VoiceAssistant />}
              <Toaster
                position="top-center"
                toastOptions={{
                  classNames: {
                    toast: 'bg-background/80 backdrop-blur-md border border-[0.75px] border-border shadow-sm rounded-xl',
                    description: 'text-muted-foreground',
                    title: 'text-foreground font-medium',
                    actionButton: 'bg-primary text-primary-foreground',
                    cancelButton: 'bg-muted text-muted-foreground',
                    icon: 'text-foreground'
                  }
                }}
              />
            </VoiceProvider>
          </ThemeProvider>
        </UserProvider>
      </body>
    </html>
  );
}
