/**
 * Format a cell value for export (CSV).
 * - Date objects → ISO date string (date-only if midnight UTC, otherwise datetime)
 * - BigInt → plain number string (timestamps are already converted to Date by duckdbService)
 * - null/undefined → null (caller renders as empty)
 * - everything else → unchanged (numbers stay as numbers)
 */
export function formatCell(cell) {
    if (cell == null) return null;
    if (cell instanceof Date) {
        // DATE columns (DateDay) always land at midnight UTC — show as date-only.
        // TIMESTAMP columns with a time component show the full datetime.
        if (cell.getUTCHours() === 0 && cell.getUTCMinutes() === 0 && cell.getUTCSeconds() === 0 && cell.getUTCMilliseconds() === 0) {
            return cell.toISOString().slice(0, 10);
        }
        return cell.toISOString().replace('T', ' ').replace(/\.000Z$/, ' UTC').replace(/(\.\d+)Z$/, ' UTC');
    }
    if (typeof cell === 'bigint') {
        return cell.toString();
    }
    return cell;
}

/**
 * Format a cell value for display in the table.
 * Same as formatCell, but also adds locale-aware comma separators to numbers
 * so that 1234567.89 renders as "1,234,567.89" (or locale equivalent).
 */
export function formatCellDisplay(cell) {
    const value = formatCell(cell);
    if (typeof value === 'number' && isFinite(value)) {
        return value.toLocaleString(undefined, {
            maximumFractionDigits: 10,
            // Don't force decimal places — integers stay as integers
        });
    }
    return value;
}
