import type { ReactNode } from 'react';
import { cx } from './cx';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  /**
   * Right-aligns and applies tabular figures.
   *
   * Worth a flag rather than leaving it to the call site: a column of amounts
   * whose digits do not line up is materially harder to scan, and on a ledger
   * that is most of the table.
   */
  numeric?: boolean;
  /** Announced by screen readers when the visible header is an icon or blank. */
  srHeader?: string;
}

export interface TableProps<T> {
  columns: Array<Column<T>>;
  rows: T[];
  rowKey: (row: T) => string;
  /** Rendered in place of the table body when there are no rows. */
  empty?: ReactNode;
  /** Required: a table without a caption is unnavigable by screen reader. */
  caption: string;
  /** Hide the caption visually while keeping it for assistive technology. */
  captionVisible?: boolean;
  className?: string;
}

/**
 * A data table.
 *
 * `caption` is a required prop, not an optional one. A screen reader user
 * moving between tables hears only the caption, so an uncaptioned table is
 * announced as "table" with no way to tell which. Making it required means the
 * decision is taken once, here, rather than skipped at 20 call sites.
 */
export function Table<T>({
  columns,
  rows,
  rowKey,
  empty,
  caption,
  captionVisible = false,
  className,
}: TableProps<T>) {
  if (rows.length === 0 && empty) return <>{empty}</>;

  return (
    <div className="nx-table-wrap">
      <table className={cx('nx-table', className)}>
        <caption
          style={
            captionVisible
              ? {
                  textAlign: 'start',
                  padding: '0 0 0.75rem',
                  color: 'var(--text-tertiary)',
                  fontSize: '0.8125rem',
                }
              : {
                  position: 'absolute',
                  width: 1,
                  height: 1,
                  overflow: 'hidden',
                  clip: 'rect(0 0 0 0)',
                  whiteSpace: 'nowrap',
                }
          }
        >
          {caption}
        </caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={cx(column.numeric && 'nx-num')}>
                {column.srHeader ? (
                  <span
                    style={{
                      position: 'absolute',
                      width: 1,
                      height: 1,
                      overflow: 'hidden',
                      clip: 'rect(0 0 0 0)',
                    }}
                  >
                    {column.srHeader}
                  </span>
                ) : null}
                <span aria-hidden={column.srHeader ? 'true' : undefined}>{column.header}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => (
                <td key={column.key} className={cx(column.numeric && 'nx-num')}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
