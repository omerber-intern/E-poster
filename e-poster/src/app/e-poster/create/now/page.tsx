'use client';

import { Newspaper, GraduationCap, TrendingUp, Award, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function CreatePostNowPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Link
            href="/e-poster/create"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>

          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-2">Create a Post Now</h1>
            <p className="text-lg text-muted-foreground">
              Choose a post type to get started
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 mb-8">
            <Link
              href="/e-poster/news-input"
              className="group rounded-lg border bg-card p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-primary/10 p-3">
                  <Newspaper className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1">News Post</h3>
                  <p className="text-sm text-muted-foreground">
                    Submit a news article, analyze portfolio impact with AI, and
                    generate tailored posts for each affected portfolio.
                  </p>
                </div>
              </div>
            </Link>

            <Link
              href="/e-poster/educational"
              className="group rounded-lg border bg-card p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-primary/10 p-3">
                  <GraduationCap className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1">
                    Educational Content
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Generate educational posts about portfolio strategies,
                    factor investing, and diversification benefits.
                  </p>
                </div>
              </div>
            </Link>

            <Link
              href="/e-poster/monthly-update"
              className="group rounded-lg border bg-card p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-primary/10 p-3">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1">Monthly Update</h3>
                  <p className="text-sm text-muted-foreground">
                    Publish monthly performance updates with revenue data and
                    portfolio strategy summaries.
                  </p>
                </div>
              </div>
            </Link>

            <Link
              href="/e-poster/performance-highlight"
              className="group rounded-lg border bg-card p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-primary/10 p-3">
                  <Award className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1">
                    Performance Highlight
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Generate promotional posts that compliment strong portfolio
                    performance with strategy highlights and key stats.
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
