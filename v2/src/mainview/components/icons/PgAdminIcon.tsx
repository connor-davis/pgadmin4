/**
 * PgAdminIcon — the pgAdmin / PostgreSQL elephant rendered as a themeable SVG.
 *
 * The icon path comes from the `simple-icons` package (siPostgresql), which
 * ships the official PostgreSQL elephant as a single-color SVG path.  Setting
 * `fill="currentColor"` (via the Tailwind `text-*` utilities on the parent or
 * directly on the component) lets the icon inherit the active theme's colors.
 *
 * Usage:
 *   <PgAdminIcon className="h-5 w-5 text-primary" />
 */
import { siPostgresql } from 'simple-icons';

interface PgAdminIconProps {
  className?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
  title?: string;
}

export function PgAdminIcon({
  className,
  'aria-hidden': ariaHidden = true,
  title,
}: PgAdminIconProps) {
  return (
    <svg
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : ariaHidden}
      aria-label={title}
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      {title && <title>{title}</title>}
      <path d={siPostgresql.path} />
    </svg>
  );
}
