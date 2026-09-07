import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      {/* =====================================================================
          SLOT 1 · PIXELS (GTM / Meta / GA4 / TikTok / UTMify)
          Cole os scripts de tracking aqui, via next/script (estratégia
          "afterInteractive" ou "beforeInteractive" conforme a necessidade).
          Exemplo:
            <Script src="https://cdn.utmify.com.br/scripts/utms/latest.js"
                    strategy="afterInteractive"
                    data-utmify-prevent-xcod-sck />
          ===================================================================== */}
      <body>{children}</body>
    </html>
  );
}
