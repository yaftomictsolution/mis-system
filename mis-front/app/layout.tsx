import "./globals.css";
import Providers from "./providers";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
        <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var d=document.documentElement;var t=localStorage.getItem('theme');var n=t==='light'||t==='dark'?t:'dark';d.classList.remove('light','dark');d.classList.add(n)})();`,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
