import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex flex-col items-center gap-4 p-5 text-2xl">
      <h1 className="text-xl font-bold text-primary">Landing page</h1>
      <p className="text-muted-primary">[EM CONSTRUÇÃO]</p>
      <Link href="/login">
        <Button>Ir paraa página de login</Button>
      </Link>
    </div>
  );
}
