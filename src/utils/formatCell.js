// DuckDB returns TIMESTAMP columns as BigInt (microseconds since Unix epoch).
// Plausible range: years 1000–2200 in microseconds.
const TS_MIN_US = -30_610_224_000_000_000n;
const TS_MAX_US =  7_258_118_400_000_000n;

/**
 * Format a single cell value for display or export.
 * - BigInt in timestamp range → ISO date/datetime string
 * - BigInt out of range → plain number string
 * - Date objects → ISO datetime string
 * - null/undefined → null (callers decide how to render)
 * - everything else → unchanged
 */
export function formatCell(cell) {
    if (cell == null) return null;
    if (typeof cell === 'bigint') {
        if (cell >= TS_MIN_US && cell <= TS_MAX_US) {
            try {
                const ms = Number(cell / 1000n);
                const d = new Date(ms);
                if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0) {
                    return d.toISOString().slice(0, 10);
                }
                return d.toISOString().replace('T', ' ').replace(/\.000Z$/, ' UTC').replace(/(\.\d+)Z$/, ' UTC');
            } catch { /* fall through */ }
        }
        return cell.toString();
    }
    if (cell instanceof Date) {
        return cell.toISOString().replace('T', ' ').replace(/\.000Z$/, ' UTC').replace(/(\.\d+)Z$/, ' UTC');
    }
    return cell;
}
