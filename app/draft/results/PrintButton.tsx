'use client';

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded bg-neutral-900 text-white text-sm font-semibold px-4 py-2 print:hidden hover:bg-neutral-700"
    >
      Print
    </button>
  );
}
