import type { Metadata, Viewport } from "next";
import { Tajawal } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { GlobalRoomInviteDock } from "@/components/social/GlobalRoomInviteDock";

const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700"],
  variable: "--font-tajawal",
});

// Mobile-first viewport. We intentionally:
//   • lock initial-scale + maximum-scale to disable pinch/double-tap zoom
//     while typing into inputs (iOS Safari auto-zooms when font-size < 16px
//     and any of these is missing).
//   • opt into edge-to-edge with `viewport-fit=cover` so safe-area-insets
//     get real values on iPhones with home-indicators / notches.
//   • omit `interactiveWidget: "resizes-content"` — combining it with JS
//     VisualViewport sizing caused inconsistent layout vs visible height on
//     mobile Safari (empty bands when the keyboard opened).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#fff6ea",
};

export const metadata: Metadata = {
  title: "مين أنا؟",
  description: "لعبة تخمين اجتماعية سريعة عبر الويب",
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={`${tajawal.variable} min-h-dvh antialiased`}>
      <body className="app-shell flex min-h-dvh flex-col font-sans text-[#5e3011] antialiased">
        <AuthProvider>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <GlobalRoomInviteDock />
            <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-x-hidden">
              {children}
            </div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
