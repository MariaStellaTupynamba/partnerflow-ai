import { DashboardAuthGate } from "@/lib/user-context";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardAuthGate>{children}</DashboardAuthGate>;
}
