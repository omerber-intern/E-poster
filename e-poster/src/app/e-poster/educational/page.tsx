'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'react-hot-toast';

interface PortfolioInfo {
  username: string;
  hasCredentials: boolean;
}

export default function EducationalPage() {
  const router = useRouter();
  const [portfolios, setPortfolios] = useState<PortfolioInfo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/portfolios');
        const data = await res.json();

        const allUsernames: string[] = data.allUsernames || [];
        const withCreds: string[] = data.portfoliosWithCredentials || [];

        setPortfolios(
          allUsernames.map((u: string) => ({
            username: u,
            hasCredentials: withCreds.includes(u),
          })),
        );

        // Select all by default
        setSelected(new Set(allUsernames));
      } catch {
        toast.error('Failed to load portfolios');
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const filteredPortfolios = portfolios.filter((p) =>
    p.username.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const togglePortfolio = (username: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(username)) next.delete(username);
      else next.add(username);
      return next;
    });
  };

  const checkAll = () =>
    setSelected(new Set(filteredPortfolios.map((p) => p.username)));

  const uncheckAll = () => setSelected(new Set());

  const handleGenerate = () => {
    if (selected.size === 0) {
      toast.error('Select at least one portfolio');
      return;
    }
    sessionStorage.setItem(
      'eduSelectedPortfolios',
      JSON.stringify(Array.from(selected)),
    );
    sessionStorage.setItem('eduAdditionalContext', additionalContext);
    router.push('/e-poster/educational/review');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <Link href="/e-poster/create">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Create a post
            </Button>
          </Link>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Generate Educational Content</CardTitle>
              <CardDescription>
                Select portfolios and generate educational posts about their
                strategies, factor logic, and diversification benefits.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Search + bulk actions */}
              <div className="flex items-center gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search portfolios..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={checkAll}>
                  Check All
                </Button>
                <Button variant="outline" size="sm" onClick={uncheckAll}>
                  Uncheck All
                </Button>
              </div>

              {/* Portfolio list */}
              <div className="border rounded-lg divide-y max-h-[400px] overflow-y-auto">
                {filteredPortfolios.map((p) => (
                  <label
                    key={p.username}
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(p.username)}
                      onChange={() => togglePortfolio(p.username)}
                      className="rounded"
                    />
                    <span className="flex-1 font-medium text-sm">
                      @{p.username}
                    </span>
                    {!p.hasCredentials && (
                      <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded">
                        No API key
                      </span>
                    )}
                  </label>
                ))}
              </div>

              <p className="text-xs text-muted-foreground mt-2">
                {selected.size} of {portfolios.length} selected
              </p>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">
                Additional Context (Optional)
              </CardTitle>
              <CardDescription>
                Specify the type of educational content you want generated.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Label htmlFor="context">Context</Label>
              <Textarea
                id="context"
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                placeholder="e.g., Focus on factor investing basics, or explain momentum vs value strategies..."
                rows={4}
                className="mt-1"
              />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              onClick={handleGenerate}
              disabled={selected.size === 0}
            >
              Generate Content ({selected.size} portfolios)
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
