'use client';

import { PenSquare, CalendarClock, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function CreatePostPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Link
            href="/e-poster"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>

          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-2">Create a Post</h1>
            <p className="text-lg text-muted-foreground">
              Would you like to post now or schedule it for later?
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 mb-8">
            <Link
              href="/e-poster/create/now"
              className="group rounded-lg border bg-card p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-primary/10 p-3">
                  <PenSquare className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1">Create a Post Now</h3>
                  <p className="text-sm text-muted-foreground">
                    Generate and publish a post immediately — news, educational,
                    monthly update, or performance highlight.
                  </p>
                </div>
              </div>
            </Link>

            <Link
              href="/e-poster/schedule/create"
              className="group rounded-lg border bg-card p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-primary/10 p-3">
                  <CalendarClock className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1">Schedule a Post</h3>
                  <p className="text-sm text-muted-foreground">
                    Set up a recurring schedule to automatically generate and
                    publish posts at a chosen time and frequency.
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
