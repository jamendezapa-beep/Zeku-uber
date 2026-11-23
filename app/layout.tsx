export const metadata = { title: "Zeku · Uber Eats" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#0f1115",
          color: "#e8e8ea",
        }}
      >
        {children}
      </body>
    </html>
  );
}
