import { foodImageUrl } from "@/lib/images";

// The public URL of a food's photo (from its stored path), or null.
export function foodPhotoUrl(path: string | null | undefined): string | null {
  return foodImageUrl(process.env.NEXT_PUBLIC_SUPABASE_URL, path);
}

export function FoodPhoto({ url, alt, size = 56 }: { url: string | null | undefined; alt: string; size?: number }) {
  if (!url) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={alt} width={size} height={size} loading="lazy" className="shrink-0 rounded object-cover" style={{ width: size, height: size }} />
  );
}
