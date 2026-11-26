import Link from "next/link";

export default function NotFound() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-24 text-center">
      <h1 className="text-3xl font-bold text-slate-900 mb-3">Page not found</h1>
      <p className="text-slate-600 mb-6">That page doesn&apos;t exist or has moved.</p>
      <Link href="/" className="underline text-slate-900">Go to the homepage</Link>
    </div>
  );
}
