'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Send, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EtoroPostMockup } from '@/components/post-mockup/EtoroPostMockup';
import { toast } from 'react-hot-toast';

interface MockupData {
  portfolioUsername: string;
  content: string;
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  hasCredentials: boolean;
}

export default function MonthlyUpdateMockupPage() {
  const router = useRouter();
  const [data, setData] = useState<MockupData | null>(null);
  const [postStatus, setPostStatus] = useState<'idle' | 'posting' | 'posted' | 'failed'>('idle');
  const [postError, setPostError] = useState<string>('');

  useEffect(() => {
    const stored = sessionStorage.getItem('mockupData');
    if (!stored) {
      toast.error('No mockup data found. Please go back to review.');
      router.push('/e-poster/monthly-update/review');
      return;
    }
    setData(JSON.parse(stored));
  }, [router]);

  const handlePost = async () => {
    if (!data || !data.hasCredentials) return;
    setPostStatus('posting');
    try {
      const postBody: Record<string, unknown> = { portfolioUsername: data.portfolioUsername, message: data.content, postType: 'monthly-update' };
      if (data.imageUrl) {
        postBody.attachments = [{ url: data.imageUrl, mediaType: 'Image', media: { image: { url: data.imageUrl, width: data.imageWidth, height: data.imageHeight } } }];
      }
      const res = await fetch('/api/posts/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(postBody) });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Post failed'); }
      setPostStatus('posted');
      toast.success(`Posted to @${data.portfolioUsername}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Post failed';
      setPostStatus('failed');
      setPostError(msg);
      toast.error(msg);
    }
  };

  if (!data) {
    return (<div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>);
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Link href="/e-poster/monthly-update/review">
            <Button variant="ghost" className="mb-4"><ArrowLeft className="h-4 w-4 mr-2" />Back to Review</Button>
          </Link>
          <Card className="mb-6">
            <CardHeader><CardTitle>Post Preview — @{data.portfolioUsername}</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-muted-foreground">This is how the post will appear on the eToro feed.</p></CardContent>
          </Card>
          <div className="mb-6 bg-gray-50 rounded-xl p-6">
            <EtoroPostMockup username={data.portfolioUsername} content={data.content} imageUrl={data.imageUrl} />
          </div>
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {postStatus === 'posted' && <span className="text-green-600 font-medium">Posted successfully</span>}
              {postStatus === 'failed' && postError && <span className="text-red-600">{postError}</span>}
            </div>
            {data.hasCredentials ? (
              <Button onClick={handlePost} disabled={postStatus === 'posting' || postStatus === 'posted'}>
                {postStatus === 'posting' ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Posting...</>) : postStatus === 'posted' ? 'Posted' : (<><Send className="h-4 w-4 mr-2" />Post to eToro</>)}
              </Button>
            ) : (
              <Button variant="destructive" disabled title="No API key configured"><AlertTriangle className="h-4 w-4 mr-2" />Cannot Post — No API Key</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
