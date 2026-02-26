'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Send,
  Loader2,
  AlertTriangle,
  Shield,
  ChevronDown,
  ChevronUp,
  Info,
  ImagePlus,
  X,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'react-hot-toast';

interface TopicImpact {
  topic: string;
  impactScore: number;
  direction: 'positive' | 'negative' | 'neutral';
}

interface HoldingImpact {
  symbol: string;
  instrumentName: string;
  impactLevel: 'low' | 'medium' | 'high';
  direction: 'positive' | 'negative' | 'neutral';
  reasoning: string;
  allocation: number;
}

interface NewsEvaluationResult {
  portfolioUsername: string;
  relevancePercent: number;
  topicImpacts: TopicImpact[];
  affectedHoldings: HoldingImpact[];
}

interface DetectedDisclaimer {
  id: string;
  category: string;
  useCase: string;
  text: string;
  reason: string;
  isAutoDetected: boolean;
}

interface AvailableDisclaimer {
  id: string;
  category: string;
  useCase: string;
  text: string;
  detectionType: string;
}

interface DraftDisclaimers {
  detected: DetectedDisclaimer[];
  allAvailable: AvailableDisclaimer[];
  selected: Set<string>;
  loading: boolean;
  loaded: boolean;
}

interface ImageAttachment {
  url: string;
  width: number;
  height: number;
}

interface DraftPost {
  portfolioUsername: string;
  content: string;
  topTickers: string[];
  status: 'generating' | 'draft' | 'posting' | 'posted' | 'failed';
  error?: string;
  hasCredentials: boolean;
  image?: ImageAttachment;
  imageUploading?: boolean;
}

interface SerializedDisclaimers {
  detected: DetectedDisclaimer[];
  allAvailable: AvailableDisclaimer[];
  selected: string[];
  loading: boolean;
  loaded: boolean;
}

function serializeDisclaimers(
  disc: Record<string, DraftDisclaimers>,
): Record<string, SerializedDisclaimers> {
  const result: Record<string, SerializedDisclaimers> = {};
  for (const [key, val] of Object.entries(disc)) {
    result[key] = {
      ...val,
      selected: Array.from(val.selected),
      loading: false,
    };
  }
  return result;
}

function deserializeDisclaimers(
  raw: Record<string, SerializedDisclaimers>,
): Record<string, DraftDisclaimers> {
  const result: Record<string, DraftDisclaimers> = {};
  for (const [key, val] of Object.entries(raw)) {
    result[key] = {
      ...val,
      selected: new Set(val.selected),
      loading: false,
    };
  }
  return result;
}

export default function ReviewPage() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<DraftPost[]>([]);
  const [news, setNews] = useState<{
    headline: string;
    body: string;
    url?: string;
  } | null>(null);
  const [disclaimers, setDisclaimers] = useState<
    Record<string, DraftDisclaimers>
  >({});
  const [expandedManual, setExpandedManual] = useState<Set<string>>(new Set());
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const initialized = useRef(false);

  const saveCache = useCallback(
    (d: DraftPost[], disc: Record<string, DraftDisclaimers>) => {
      const cacheable = d.map(({ imageUploading, ...rest }) => rest);
      sessionStorage.setItem('newsDraftsCache', JSON.stringify(cacheable));
      sessionStorage.setItem(
        'newsDisclaimersCache',
        JSON.stringify(serializeDisclaimers(disc)),
      );
    },
    [],
  );

  const clearCache = () => {
    sessionStorage.removeItem('newsDraftsCache');
    sessionStorage.removeItem('newsDisclaimersCache');
  };

  const generateDraft = useCallback(
    async (
      portfolioUsername: string,
      newsData: { headline: string; body: string; url?: string },
      impact: NewsEvaluationResult,
      postLength: 'short' | 'medium' | 'long' = 'medium',
    ) => {
      try {
        const res = await fetch('/api/posts/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...newsData,
            portfolioUsername,
            impact,
            postLength,
          }),
        });

        if (!res.ok) throw new Error('Generation failed');

        const data = await res.json();
        setDrafts((prev) => {
          const updated = prev.map((d) =>
            d.portfolioUsername === portfolioUsername
              ? {
                  ...d,
                  content: data.content,
                  topTickers: data.topTickers,
                  status: 'draft' as const,
                }
              : d,
          );
          saveCache(updated, {});
          return updated;
        });
      } catch {
        setDrafts((prev) =>
          prev.map((d) =>
            d.portfolioUsername === portfolioUsername
              ? {
                  ...d,
                  status: 'failed' as const,
                  error: 'Content generation failed',
                }
              : d,
          ),
        );
      }
    },
    [saveCache],
  );

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const cached = sessionStorage.getItem('newsDraftsCache');
    if (cached) {
      const cachedDrafts: DraftPost[] = JSON.parse(cached);
      setDrafts(cachedDrafts);

      const cachedDisc = sessionStorage.getItem('newsDisclaimersCache');
      if (cachedDisc) {
        setDisclaimers(deserializeDisclaimers(JSON.parse(cachedDisc)));
      }

      const newsData = sessionStorage.getItem('newsForReview');
      if (newsData) setNews(JSON.parse(newsData));
      return;
    }

    const newsData = sessionStorage.getItem('newsForReview');
    const evalData = sessionStorage.getItem('evaluationData');
    const selectedData = sessionStorage.getItem('selectedPortfoliosForReview');

    if (!newsData || !evalData || !selectedData) {
      toast.error('Missing data. Please start from the beginning.');
      router.push('/e-poster/news-input');
      return;
    }

    const parsedNews = JSON.parse(newsData);
    const parsedEval = JSON.parse(evalData);
    const selected: string[] = JSON.parse(selectedData);
    const postLength = (sessionStorage.getItem('newsPostLength') || 'medium') as 'short' | 'medium' | 'long';
    const withCredentials: string[] =
      parsedEval.portfoliosWithCredentials || [];

    setNews(parsedNews);

    const initialDrafts: DraftPost[] = selected.map((username) => ({
      portfolioUsername: username,
      content: '',
      topTickers: [],
      status: 'generating' as const,
      hasCredentials: withCredentials.includes(username),
    }));
    setDrafts(initialDrafts);

    selected.forEach((username) => {
      const impact = parsedEval.results.find(
        (r: NewsEvaluationResult) => r.portfolioUsername === username,
      );
      if (impact) {
        generateDraft(username, parsedNews, impact, postLength);
      }
    });
  }, [router, generateDraft]);

  const handleContentChange = (username: string, content: string) => {
    setDrafts((prev) => {
      const updated = prev.map((d) =>
        d.portfolioUsername === username ? { ...d, content } : d,
      );
      saveCache(updated, disclaimers);
      return updated;
    });
  };

  const handleImageUpload = async (username: string, file: File) => {
    setDrafts((prev) =>
      prev.map((d) =>
        d.portfolioUsername === username ? { ...d, imageUploading: true } : d,
      ),
    );
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/uploads', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Upload failed');
      }
      const data = await res.json();
      setDrafts((prev) => {
        const updated = prev.map((d) =>
          d.portfolioUsername === username
            ? {
                ...d,
                image: {
                  url: data.url,
                  width: data.width,
                  height: data.height,
                },
                imageUploading: false,
              }
            : d,
        );
        saveCache(updated, disclaimers);
        return updated;
      });
      toast.success('Image uploaded');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      toast.error(msg);
      setDrafts((prev) =>
        prev.map((d) =>
          d.portfolioUsername === username
            ? { ...d, imageUploading: false }
            : d,
        ),
      );
    }
  };

  const removeImage = (username: string) => {
    setDrafts((prev) => {
      const updated = prev.map((d) =>
        d.portfolioUsername === username ? { ...d, image: undefined } : d,
      );
      saveCache(updated, disclaimers);
      return updated;
    });
  };

  const handleSeeMockup = (draft: DraftPost) => {
    const finalContent = getPostContentWithDisclaimers(draft);
    sessionStorage.setItem(
      'mockupData',
      JSON.stringify({
        portfolioUsername: draft.portfolioUsername,
        content: finalContent,
        imageUrl: draft.image?.url,
        imageWidth: draft.image?.width,
        imageHeight: draft.image?.height,
        hasCredentials: draft.hasCredentials,
      }),
    );
    router.push('/e-poster/review/mockup');
  };

  const detectDisclaimers = async (username: string, content: string) => {
    setDisclaimers((prev) => ({
      ...prev,
      [username]: {
        ...prev[username],
        loading: true,
        detected: prev[username]?.detected || [],
        allAvailable: prev[username]?.allAvailable || [],
        selected: prev[username]?.selected || new Set(),
        loaded: prev[username]?.loaded || false,
      },
    }));

    try {
      const res = await fetch('/api/disclaimers/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portfolioUsername: username, content }),
      });

      if (!res.ok) throw new Error('Detection failed');

      const data = await res.json();
      const autoSelected = new Set<string>(
        data.detected.map((d: DetectedDisclaimer) => d.id),
      );

      setDisclaimers((prev) => {
        const updated = {
          ...prev,
          [username]: {
            detected: data.detected,
            allAvailable: data.allAvailable,
            selected: autoSelected,
            loading: false,
            loaded: true,
          },
        };
        saveCache(drafts, updated);
        return updated;
      });
    } catch {
      toast.error(`Failed to detect disclaimers for @${username}`);
      setDisclaimers((prev) => ({
        ...prev,
        [username]: {
          ...prev[username],
          loading: false,
          detected: [],
          allAvailable: [],
          selected: new Set(),
          loaded: false,
        },
      }));
    }
  };

  const toggleDisclaimer = (username: string, disclaimerId: string) => {
    setDisclaimers((prev) => {
      const current = prev[username];
      if (!current) return prev;
      const newSelected = new Set(current.selected);
      if (newSelected.has(disclaimerId)) {
        newSelected.delete(disclaimerId);
      } else {
        newSelected.add(disclaimerId);
      }
      const updated = {
        ...prev,
        [username]: { ...current, selected: newSelected },
      };
      saveCache(drafts, updated);
      return updated;
    });
  };

  const toggleManualExpand = (username: string) => {
    setExpandedManual((prev) => {
      const next = new Set(prev);
      if (next.has(username)) {
        next.delete(username);
      } else {
        next.add(username);
      }
      return next;
    });
  };

  const getPostContentWithDisclaimers = (draft: DraftPost): string => {
    const disc = disclaimers[draft.portfolioUsername];
    if (!disc || disc.selected.size === 0) return draft.content;

    const allRules = [...disc.detected, ...disc.allAvailable];
    const uniqueRules = new Map(allRules.map((r) => [r.id, r]));
    const selectedTexts = Array.from(disc.selected)
      .map((id) => uniqueRules.get(id)?.text)
      .filter(Boolean);

    if (selectedTexts.length === 0) return draft.content;

    return `${draft.content}\n\n${selectedTexts.join('\n')}`;
  };

  const handlePost = async (draft: DraftPost) => {
    if (!draft.hasCredentials) {
      toast.error(`No API key configured for ${draft.portfolioUsername}`);
      return;
    }

    const disc = disclaimers[draft.portfolioUsername];
    if (!disc?.loaded) {
      toast.error(
        'Please detect disclaimers before posting.',
      );
      return;
    }

    setDrafts((prev) =>
      prev.map((d) =>
        d.portfolioUsername === draft.portfolioUsername
          ? { ...d, status: 'posting' as const }
          : d,
      ),
    );

    try {
      const finalContent = getPostContentWithDisclaimers(draft);

      const postBody: Record<string, unknown> = {
        portfolioUsername: draft.portfolioUsername,
        message: finalContent,
      };
      if (draft.image) {
        postBody.attachments = [
          {
            url: draft.image.url,
            mediaType: 'Image',
            media: {
              image: {
                url: draft.image.url,
                width: draft.image.width,
                height: draft.image.height,
              },
            },
          },
        ];
      }

      const res = await fetch('/api/posts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postBody),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Post failed');
      }

      setDrafts((prev) => {
        const updated = prev.map((d) =>
          d.portfolioUsername === draft.portfolioUsername
            ? { ...d, status: 'posted' as const }
            : d,
        );
        saveCache(updated, disclaimers);
        return updated;
      });
      toast.success(`Posted to @${draft.portfolioUsername}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Post failed';
      setDrafts((prev) =>
        prev.map((d) =>
          d.portfolioUsername === draft.portfolioUsername
            ? { ...d, status: 'failed' as const, error: msg }
            : d,
        ),
      );
      toast.error(msg);
    }
  };

  if (!news) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Link href="/e-poster/evaluate" onClick={clearCache}>
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Evaluation
            </Button>
          </Link>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Review & Post</CardTitle>
              <CardDescription>
                AI-generated posts for {drafts.length} portfolio(s). Edit
                content, detect disclaimers, then post.
              </CardDescription>
            </CardHeader>
          </Card>

          <div className="space-y-6">
            {drafts.map((draft) => {
              const disc = disclaimers[draft.portfolioUsername];
              const isManualExpanded = expandedManual.has(
                draft.portfolioUsername,
              );
              const manualRules =
                disc?.allAvailable.filter(
                  (r) =>
                    !disc.detected.some((d) => d.id === r.id),
                ) || [];

              return (
                <Card key={draft.portfolioUsername}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        @{draft.portfolioUsername}
                      </CardTitle>
                      {!draft.hasCredentials && (
                        <span className="flex items-center gap-1 text-xs text-red-500 bg-red-50 px-2 py-1 rounded">
                          <AlertTriangle className="h-3 w-3" />
                          No API key configured
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {draft.status === 'generating' ? (
                      <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating content with Claude...
                      </div>
                    ) : (
                      <>
                        <div className="mb-4">
                          <Label>Post Content</Label>
                          <Textarea
                            value={draft.content}
                            onChange={(e) =>
                              handleContentChange(
                                draft.portfolioUsername,
                                e.target.value,
                              )
                            }
                            rows={10}
                            className="mt-1 font-mono text-sm"
                            disabled={draft.status === 'posted'}
                          />
                        </div>

                        {draft.topTickers.length > 0 && (
                          <div className="mb-4">
                            <Label className="text-xs text-muted-foreground">
                              Top tickers
                            </Label>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {draft.topTickers.map((t) => (
                                <span
                                  key={t}
                                  className="text-xs px-2 py-0.5 rounded bg-muted font-mono"
                                >
                                  ${t}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Image Attachment */}
                        <div className="mb-4">
                          <Label className="text-sm font-medium mb-2 block">
                            Image Attachment (Optional)
                          </Label>
                          {draft.image ? (
                            <div className="flex items-center gap-3">
                              <div className="relative group">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={draft.image.url}
                                  alt="Attached"
                                  className="w-12 h-12 rounded border border-border object-cover cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={() =>
                                    setLightboxUrl(draft.image!.url)
                                  }
                                />
                                <button
                                  onClick={() =>
                                    removeImage(draft.portfolioUsername)
                                  }
                                  className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
                                  disabled={draft.status === 'posted'}
                                >
                                  <X className="h-2.5 w-2.5" />
                                </button>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-foreground">
                                  Image attached
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {draft.image.width} x {draft.image.height}px
                                  &middot; Click to preview
                                </p>
                              </div>
                            </div>
                          ) : (
                            <label
                              className={`flex items-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                                draft.imageUploading
                                  ? 'border-muted bg-muted/20 cursor-wait'
                                  : 'border-border hover:border-primary hover:bg-primary/5'
                              }`}
                            >
                              {draft.imageUploading ? (
                                <>
                                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                  <span className="text-sm text-muted-foreground">
                                    Uploading...
                                  </span>
                                </>
                              ) : (
                                <>
                                  <ImagePlus className="h-5 w-5 text-muted-foreground" />
                                  <span className="text-sm text-muted-foreground">
                                    Click to attach an image
                                  </span>
                                </>
                              )}
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/gif,image/webp"
                                className="hidden"
                                disabled={
                                  draft.imageUploading ||
                                  draft.status === 'posted'
                                }
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    handleImageUpload(
                                      draft.portfolioUsername,
                                      file,
                                    );
                                  }
                                  e.target.value = '';
                                }}
                              />
                            </label>
                          )}
                        </div>

                        {/* Disclaimers Section */}
                        <div className="mb-4 border rounded-lg p-4 bg-muted/30">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Shield className="h-4 w-4 text-amber-600" />
                              <Label className="text-sm font-medium">
                                Compliance Disclaimers
                              </Label>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                detectDisclaimers(
                                  draft.portfolioUsername,
                                  draft.content,
                                )
                              }
                              disabled={
                                disc?.loading ||
                                draft.status === 'posted' ||
                                !draft.content.trim()
                              }
                            >
                              {disc?.loading ? (
                                <>
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                  Detecting...
                                </>
                              ) : disc?.loaded ? (
                                'Re-detect'
                              ) : (
                                'Detect Disclaimers'
                              )}
                            </Button>
                          </div>

                          {!disc?.loaded && !disc?.loading && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Info className="h-3 w-3" />
                              Click &quot;Detect Disclaimers&quot; to
                              auto-detect applicable compliance text based on
                              portfolio holdings and post content.
                            </p>
                          )}

                          {disc?.loaded && (
                            <>
                              {/* Auto-detected disclaimers */}
                              {disc.detected.length > 0 && (
                                <div className="space-y-2 mb-3">
                                  <Label className="text-xs text-muted-foreground">
                                    Auto-detected ({disc.detected.length})
                                  </Label>
                                  {disc.detected.map((d) => (
                                    <label
                                      key={d.id}
                                      className="flex items-start gap-2 p-2 rounded border bg-background cursor-pointer hover:bg-muted/50"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={disc.selected.has(d.id)}
                                        onChange={() =>
                                          toggleDisclaimer(
                                            draft.portfolioUsername,
                                            d.id,
                                          )
                                        }
                                        className="mt-0.5 h-4 w-4 rounded border-gray-300"
                                        disabled={draft.status === 'posted'}
                                      />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className="text-xs font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                                            {d.category}
                                          </span>
                                          <span className="text-xs text-muted-foreground truncate">
                                            {d.reason}
                                          </span>
                                        </div>
                                        <p className="text-xs text-foreground whitespace-pre-line">
                                          {d.text}
                                        </p>
                                      </div>
                                    </label>
                                  ))}
                                </div>
                              )}

                              {disc.detected.length === 0 && (
                                <p className="text-xs text-muted-foreground mb-3">
                                  No disclaimers auto-detected beyond the
                                  defaults. You can manually add from below.
                                </p>
                              )}

                              {/* Manual disclaimer toggle */}
                              {manualRules.length > 0 && (
                                <div>
                                  <button
                                    onClick={() =>
                                      toggleManualExpand(
                                        draft.portfolioUsername,
                                      )
                                    }
                                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    {isManualExpanded ? (
                                      <ChevronUp className="h-3 w-3" />
                                    ) : (
                                      <ChevronDown className="h-3 w-3" />
                                    )}
                                    All disclaimers ({manualRules.length} more)
                                  </button>

                                  {isManualExpanded && (
                                    <div className="space-y-2 mt-2">
                                      {manualRules.map((r) => (
                                        <label
                                          key={r.id}
                                          className="flex items-start gap-2 p-2 rounded border bg-background cursor-pointer hover:bg-muted/50"
                                        >
                                          <input
                                            type="checkbox"
                                            checked={disc.selected.has(r.id)}
                                            onChange={() =>
                                              toggleDisclaimer(
                                                draft.portfolioUsername,
                                                r.id,
                                              )
                                            }
                                            className="mt-0.5 h-4 w-4 rounded border-gray-300"
                                            disabled={
                                              draft.status === 'posted'
                                            }
                                          />
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                              <span className="text-xs font-medium text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                                                {r.category}
                                              </span>
                                              <span className="text-xs text-muted-foreground">
                                                {r.useCase}
                                              </span>
                                            </div>
                                            <p className="text-xs text-foreground whitespace-pre-line">
                                              {r.text}
                                            </p>
                                          </div>
                                        </label>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Preview of selected disclaimers */}
                              {disc.selected.size > 0 && (
                                <div className="mt-3 pt-3 border-t">
                                  <Label className="text-xs text-muted-foreground">
                                    Will be appended to post ({disc.selected.size}{' '}
                                    selected)
                                  </Label>
                                  <div className="mt-1 p-2 rounded bg-amber-50 border border-amber-200 text-xs text-amber-900 whitespace-pre-line">
                                    {Array.from(disc.selected)
                                      .map((id) => {
                                        const all = [
                                          ...disc.detected,
                                          ...disc.allAvailable,
                                        ];
                                        return all.find((r) => r.id === id)
                                          ?.text;
                                      })
                                      .filter(Boolean)
                                      .join('\n')}
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="text-sm text-muted-foreground">
                            {draft.status === 'posted' && (
                              <span className="text-green-600 font-medium">
                                Posted successfully
                              </span>
                            )}
                            {draft.status === 'failed' && draft.error && (
                              <span className="text-red-600">
                                {draft.error}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              onClick={() => handleSeeMockup(draft)}
                              disabled={
                                draft.status === 'posting' ||
                                !draft.content.trim()
                              }
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              See Mockup
                            </Button>

                            {draft.hasCredentials ? (
                              <Button
                                onClick={() => handlePost(draft)}
                                disabled={
                                  draft.status === 'posting' ||
                                  draft.status === 'posted' ||
                                  !draft.content.trim() ||
                                  !disc?.loaded
                                }
                              >
                                {draft.status === 'posting' ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Posting...
                                  </>
                                ) : draft.status === 'posted' ? (
                                  'Posted'
                                ) : (
                                  <>
                                    <Send className="h-4 w-4 mr-2" />
                                    Post
                                  </>
                                )}
                              </Button>
                            ) : (
                              <Button
                                variant="destructive"
                                disabled
                                title="No API key configured for this portfolio"
                              >
                                <AlertTriangle className="h-4 w-4 mr-2" />
                                Cannot Post — No API Key
                              </Button>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
