/**
 * History Page - Post history
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'react-hot-toast';
import type { PostDraft } from '@/lib/models/post';

export default function HistoryPage() {
  const [posts, setPosts] = useState<PostDraft[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/posts/history');
      if (!response.ok) {
        throw new Error('Failed to load history');
      }
      const data = await response.json();
      setPosts(data.posts || []);
    } catch (error) {
      toast.error('Failed to load post history');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'posted':
        return 'text-green-600';
      case 'failed':
        return 'text-red-600';
      case 'pending':
        return 'text-yellow-600';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Link href="/e-poster">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>

          <Card>
            <CardHeader>
              <CardTitle>Post History</CardTitle>
              <CardDescription>
                View history of posted content and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading history...
                </div>
              ) : posts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No posts yet. Start by creating a post from the dashboard.
                </div>
              ) : (
                <div className="space-y-4">
                  {posts.map((post) => (
                    <Card key={post.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-semibold">{post.portfolioName}</h4>
                            <p className="text-sm text-muted-foreground">
                              @{post.portfolioId}
                            </p>
                          </div>
                          <span className={`text-sm font-medium ${getStatusColor(post.status)}`}>
                            {post.status.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                          {post.content}
                        </p>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            Created: {new Date(post.createdAt).toLocaleString()}
                          </span>
                          {post.postedAt && (
                            <span>
                              Posted: {new Date(post.postedAt).toLocaleString()}
                            </span>
                          )}
                        </div>
                        {post.error && (
                          <div className="mt-2 text-sm text-destructive">
                            Error: {post.error}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

