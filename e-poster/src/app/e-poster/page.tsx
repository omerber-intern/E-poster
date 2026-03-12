'use client';

import { PenSquare, RefreshCw, History, Settings, CalendarClock } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'react-hot-toast';

function formatSyncDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }) + ', ' + d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export default function DashboardPage() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/sync')
      .then((res) => res.json())
      .then((data) => {
        if (data.syncedAt) setLastSyncedAt(data.syncedAt);
      })
      .catch(() => {});
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/sync?type=all', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setLastSyncedAt(data.syncedAt);
        toast.success(
          `Synced ${data.portfolios?.synced ?? 0} portfolios, ${data.bios?.fetched ?? 0} bios`,
        );
      } else {
        toast.error(data.error || 'Sync failed');
      }
    } catch {
      toast.error('Sync request failed');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-2">e-poster</h1>
            <p className="text-lg text-muted-foreground">
              Smart Portfolio Content Publisher for eToro
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 mb-8">
            <Link
              href="/e-poster/create"
              className="group rounded-lg border bg-card p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-primary/10 p-3">
                  <PenSquare className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1">Create a post</h3>
                  <p className="text-sm text-muted-foreground">
                    News posts, educational content, monthly updates, and
                    performance highlights.
                  </p>
                </div>
              </div>
            </Link>

            <Link
              href="/e-poster/history"
              className="rounded-lg border bg-card p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-muted p-3">
                  <History className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1">
                    Post History
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    View previously published posts.
                  </p>
                </div>
              </div>
            </Link>

            <div className="rounded-lg border bg-card p-6">
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-muted p-3">
                  <RefreshCw
                    className={`h-6 w-6 text-muted-foreground ${isSyncing ? 'animate-spin' : ''}`}
                  />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1">
                    Refresh Portfolio&apos;s Data
                  </h3>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSync}
                    disabled={isSyncing}
                    className="mb-3"
                  >
                    {isSyncing ? 'Refreshing...' : 'Refresh Now'}
                  </Button>
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>The portfolio&apos;s data is saved in the code base</span>
                    {lastSyncedAt && (
                      <span className="whitespace-nowrap">
                        Last refresh: {formatSyncDate(lastSyncedAt)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <Link
              href="/e-poster/schedule"
              className="rounded-lg border bg-card p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-primary/10 p-3">
                  <CalendarClock className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1">
                    Scheduled Posts
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Set up recurring posts, view the calendar, and manage
                    pending approvals.
                  </p>
                </div>
              </div>
            </Link>

            <Link
              href="/e-poster/manage-portfolios"
              className="rounded-lg border bg-card p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-muted p-3">
                  <Settings className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1">
                    Manage Portfolios
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Add new portfolios, manage API keys, and remove existing
                    ones.
                  </p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
