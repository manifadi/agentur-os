/**
 * Overlap layout algorithm for calendar events.
 * Groups overlapping events and assigns column positions so they
 * display side-by-side (like Apple Calendar / Google Calendar).
 */

export interface OverlapInfo {
    col: number;
    totalCols: number;
}

interface TimedItem {
    id: string;
    start_at: string;
    end_at: string;
}

export function computeOverlapLayout<T extends TimedItem>(events: T[]): Map<string, OverlapInfo> {
    const result = new Map<string, OverlapInfo>();
    if (events.length === 0) return result;

    // Sort by start time, then by duration descending
    const sorted = [...events].sort((a, b) => {
        const startDiff = new Date(a.start_at).getTime() - new Date(b.start_at).getTime();
        if (startDiff !== 0) return startDiff;
        return new Date(b.end_at).getTime() - new Date(a.end_at).getTime();
    });

    // Build "clusters" of overlapping events
    const clusters: T[][] = [];
    let currentCluster: T[] = [];
    let clusterEnd = new Date(0);

    for (const ev of sorted) {
        const start = new Date(ev.start_at);
        const end = new Date(ev.end_at);

        if (start < clusterEnd) {
            // overlaps with current cluster
            currentCluster.push(ev);
            if (end > clusterEnd) clusterEnd = end;
        } else {
            if (currentCluster.length > 0) clusters.push(currentCluster);
            currentCluster = [ev];
            clusterEnd = end;
        }
    }
    if (currentCluster.length > 0) clusters.push(currentCluster);

    // Assign columns within each cluster
    for (const cluster of clusters) {
        // Greedy column assignment
        const cols: Date[] = []; // tracks end time of last event in each column
        const colAssign = new Map<string, number>();

        for (const ev of cluster) {
            const start = new Date(ev.start_at);
            // Find the first column where this event fits
            let placed = false;
            for (let c = 0; c < cols.length; c++) {
                if (start >= cols[c]) {
                    colAssign.set(ev.id, c);
                    cols[c] = new Date(ev.end_at);
                    placed = true;
                    break;
                }
            }
            if (!placed) {
                colAssign.set(ev.id, cols.length);
                cols.push(new Date(ev.end_at));
            }
        }

        const totalCols = cols.length;
        for (const ev of cluster) {
            result.set(ev.id, { col: colAssign.get(ev.id) ?? 0, totalCols });
        }
    }

    return result;
}
