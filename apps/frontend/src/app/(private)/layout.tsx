import { Sidebar } from '@/components/ui/sidebar';

export default function PrivateLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="w-dvw h-dvh overflow-hidden bg-layer00 text-foreground">
      <MainRoutesLayout>{children}</MainRoutesLayout>
    </div>
  );
}

function MainRoutesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full max-w-[1920px] gap-8 p-6">
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      {children}
    </div>
  );
}
