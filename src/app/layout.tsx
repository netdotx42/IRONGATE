import type { Metadata } from "next";
import "./globals.css";
import { Shell } from "@/components/shell";
export const metadata: Metadata = {
  title: {
    default: "IRONGATE — Your Digital Fortress",
    template: "%s | IRONGATE",
  },
  description:
    "Private password analysis, passive website checks and verified-domain monitoring.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
