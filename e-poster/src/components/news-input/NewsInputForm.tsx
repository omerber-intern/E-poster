/**
 * News Input Form Component
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'react-hot-toast';
import type { NewsContent } from '@/lib/models/news';

interface NewsInputFormProps {
  onNewsSubmit?: (news: NewsContent) => void;
}

export function NewsInputForm({ onNewsSubmit }: NewsInputFormProps) {
  const router = useRouter();
  const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('');
  const [source, setSource] = useState('');
  const [url, setUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!headline.trim() || !body.trim()) {
      toast.error('Please fill in both headline and body');
      return;
    }

    setIsSubmitting(true);

    try {
      const news: NewsContent = {
        headline: headline.trim(),
        body: body.trim(),
        source: source.trim() || undefined,
        url: url.trim() || undefined,
        createdAt: new Date(),
      };

      // Store in sessionStorage for next step
      sessionStorage.setItem('newsContent', JSON.stringify(news));

      if (onNewsSubmit) {
        onNewsSubmit(news);
      } else {
        // Navigate to evaluate page
        router.push('/e-poster/evaluate');
      }

      toast.success('News content saved');
    } catch (error) {
      toast.error('Failed to save news content');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enter News Content</CardTitle>
        <CardDescription>
          Input or paste news content to evaluate and post to relevant smart portfolios
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="headline">Headline *</Label>
            <Input
              id="headline"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="Enter news headline..."
              required
              maxLength={500}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Body Content *</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Enter news body content..."
              required
              rows={10}
              maxLength={5000}
            />
            <p className="text-xs text-muted-foreground">
              {body.length} / 5000 characters
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="source">Source (Optional)</Label>
            <Input
              id="source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="e.g., Reuters, Bloomberg"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="url">URL (Optional)</Label>
            <Input
              id="url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Processing...' : 'Continue to Evaluation'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

