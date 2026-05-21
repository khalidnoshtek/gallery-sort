import { IS_DEMO } from "@/lib/demo/data";

export function DemoBanner() {
  if (!IS_DEMO) return null;
  return (
    <div className="mb-6 flex items-center gap-3 rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm">
      <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-black">Demo</span>
      <span className="text-amber-100/80">
        This is the UI running against sample data — your files are not being scanned. For the real thing,{" "}
        <a className="underline" href="https://github.com/khalidnoshtek/gallery-sort#quick-start" target="_blank" rel="noreferrer">
          clone the repo and run locally
        </a>.
      </span>
    </div>
  );
}
