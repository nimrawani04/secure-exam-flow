import type { ReactNode } from 'react';

interface HodPageShellProps {
  eyebrow: string;
  title: ReactNode;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * Shared HOD page wrapper — Figma "warm paper" language.
 * Provides the full-bleed #f7f4ef / #0c1118 background, serif heading,
 * and consistent content width. Inner cards should use:
 * bg-white dark:bg-[#101820] border-[#e8e2da] dark:border-[#1c2d3d] rounded-[14px]
 */
export function HodPageShell({ eyebrow, title, description, actions, children }: HodPageShellProps) {
  return (
    <div className="-m-3.5 sm:-m-6 lg:-m-8 bg-[#f7f4ef] dark:bg-[#0c1118] text-[#18202e] dark:text-[#e2eaf4] min-h-[calc(100vh-57px)] overflow-x-hidden">
      <div className="max-w-6xl mx-auto px-3.5 sm:px-6 lg:px-10 py-6 sm:py-9 pb-20 sm:pb-16">
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-[#a0aec0] dark:text-[#3d5166] tracking-[0.08em] uppercase mb-1.5 sm:mb-2">
                {eyebrow}
              </p>
              <h1 className="font-serif font-light text-[26px] sm:text-[38px] leading-[1.15] tracking-[-0.025em] break-words">
                {title}
              </h1>
              <div className="flex items-center gap-2 sm:gap-3 mt-2.5 sm:mt-3">
                <div className="h-px w-6 sm:w-8 bg-[#e8e2da] dark:bg-[#1c2d3d] shrink-0" />
                <p className="text-[12.5px] sm:text-[13px] text-[#64748b] dark:text-[#6b8299]">{description}</p>
              </div>
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
