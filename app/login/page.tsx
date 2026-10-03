import { safeNext } from "@/lib/auth";
import { LoginButtons } from "./login-buttons";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : null);
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome</h1>
        <p className="text-neutral-600 dark:text-neutral-400">Sign in to order food from local merchants.</p>
      </div>
      {sp.error && <p className="text-sm text-red-600">Sign-in failed. Please try again.</p>}
      <LoginButtons next={next} />
    </main>
  );
}
