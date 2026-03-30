import Link from 'next/link';
import { ArrowLeft, History, CalendarDays } from 'lucide-react';

export default function PostsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link
            href="/e-poster"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Posts</h1>
          <p className="text-muted-foreground">
            Access your post history or view the scheduled posts calendar.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Link
            href="/e-poster/history"
            className="rounded-lg border bg-card p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-muted p-3">
                <History className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">Post History</h3>
                <p className="text-sm text-muted-foreground">
                  View previously published posts.
                </p>
              </div>
            </div>
          </Link>

          <Link
            href="/e-poster/schedule"
            className="rounded-lg border bg-card p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-muted p-3">
                <CalendarDays className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">Scheduled Posts</h3>
                <p className="text-sm text-muted-foreground">
                  View and manage your scheduled posts calendar.
                </p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
