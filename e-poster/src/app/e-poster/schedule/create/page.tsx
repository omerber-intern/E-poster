'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Search,
  Loader2,
  Calendar,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'react-hot-toast';
import type { PostType } from '@/lib/models/post';

interface LengthRange {
  label: 'short' | 'medium' | 'long';
  min: number;
  max: number;
}

const DEFAULT_NEWS_LENGTH_MAPPING: LengthRange[] = [
  { label: 'short', min: 15, max: 30 },
  { label: 'medium', min: 30, max: 60 },
  { label: 'long', min: 60, max: 100 },
];

const POST_TYPES: Array<{
  value: PostType;
  label: string;
  description: string;
}> = [
  {
    value: 'news',
    label: 'News',
    description: 'Event-triggered news posts based on portfolio relevance thresholds.',
  },
  {
    value: 'educational',
    label: 'Educational',
    description: 'Educational posts about portfolio strategies and factor investing.',
  },
  {
    value: 'monthly-update',
    label: 'Monthly Update',
    description: 'Monthly performance updates with revenue data.',
  },
  {
    value: 'performance-highlight',
    label: 'Performance Highlight',
    description: 'Promotional posts highlighting strong performance.',
  },
];

const DAY_OPTIONS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

interface PortfolioInfo {
  username: string;
  hasCredentials: boolean;
}

function CreateScheduleForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isBatch = searchParams.get('batch') === 'true';

  const [step, setStep] = useState(1);
  const [portfolios, setPortfolios] = useState<PortfolioInfo[]>([]);
  const [selectedPortfolios, setSelectedPortfolios] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingPortfolios, setIsLoadingPortfolios] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [postType, setPostType] = useState<PostType>('educational');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [flowType, setFlowType] = useState<'automatic' | 'approval'>('approval');
  const [timeOfDay, setTimeOfDay] = useState('09:00');
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [postLength, setPostLength] = useState<'short' | 'medium' | 'long'>('medium');
  const [additionalContext, setAdditionalContext] = useState('');
  const [templateStyle, setTemplateStyle] = useState<'stats-bottom' | 'revenue-opening'>('stats-bottom');

  // News-specific state
  const [newsThreshold, setNewsThreshold] = useState(15);
  const [newsLengthMapping, setNewsLengthMapping] = useState<LengthRange[]>([...DEFAULT_NEWS_LENGTH_MAPPING]);

  const isNews = postType === 'news';

  useEffect(() => {
    async function loadPortfolios() {
      try {
        const res = await fetch('/api/portfolios');
        const data = await res.json();
        const allUsernames: string[] = data.allUsernames || [];
        const withCreds: string[] = data.portfoliosWithCredentials || [];
        setPortfolios(
          allUsernames.map((u) => ({
            username: u,
            hasCredentials: withCreds.includes(u),
          })),
        );
      } catch {
        toast.error('Failed to load portfolios');
      } finally {
        setIsLoadingPortfolios(false);
      }
    }
    loadPortfolios();
  }, []);

  const filteredPortfolios = portfolios.filter((p) =>
    p.username.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const togglePortfolio = (username: string) => {
    setSelectedPortfolios((prev) => {
      const next = new Set(prev);
      if (next.has(username)) next.delete(username);
      else next.add(username);
      return next;
    });
  };

  const selectAll = () =>
    setSelectedPortfolios(new Set(filteredPortfolios.map((p) => p.username)));
  const clearAll = () => setSelectedPortfolios(new Set());

  const handleSubmit = async () => {
    if (selectedPortfolios.size === 0) {
      toast.error('Select at least one portfolio');
      return;
    }

    setIsSubmitting(true);
    try {
      const generationConfig: Record<string, string | undefined> = {
        postLength: isNews ? undefined : postLength,
      };
      if (postType === 'educational' && additionalContext) {
        generationConfig.additionalContext = additionalContext;
      }
      if (postType === 'monthly-update') {
        generationConfig.templateStyle = templateStyle;
      }

      const newsConfig = isNews
        ? { minimumRelevancePercent: newsThreshold, lengthMapping: newsLengthMapping }
        : undefined;

      if (isBatch || selectedPortfolios.size > 1) {
        const portfolioList = Array.from(selectedPortfolios).map((u) => ({
          username: u,
          name: u,
        }));

        const res = await fetch('/api/schedules/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            portfolios: portfolioList,
            postType,
            frequency: isNews ? undefined : frequency,
            flowType,
            timeOfDay: isNews ? undefined : timeOfDay,
            dayOfWeek: !isNews && frequency === 'weekly' ? dayOfWeek : undefined,
            dayOfMonth: !isNews && frequency === 'monthly' ? dayOfMonth : undefined,
            generationConfig,
            newsConfig,
            namePrefix: name || undefined,
          }),
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || 'Failed to create schedules');
        }

        const data = await res.json();
        toast.success(`Created ${data.created} schedule(s)`);
      } else {
        const portfolioUsername = Array.from(selectedPortfolios)[0];

        const res = await fetch('/api/schedules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name || `${postType} - ${portfolioUsername}`,
            portfolioUsername,
            portfolioName: portfolioUsername,
            postType,
            frequency: isNews ? undefined : frequency,
            flowType,
            timeOfDay: isNews ? undefined : timeOfDay,
            dayOfWeek: !isNews && frequency === 'weekly' ? dayOfWeek : undefined,
            dayOfMonth: !isNews && frequency === 'monthly' ? dayOfMonth : undefined,
            generationConfig,
            newsConfig,
          }),
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || 'Failed to create schedule');
        }

        toast.success('Schedule created');
      }

      router.push('/e-poster/schedule');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create schedule');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceedStep1 = selectedPortfolios.size > 0;

  const handleNext = () => {
    if (step === 1 && !canProceedStep1) {
      toast.error('Select at least one portfolio');
      return;
    }
    setStep((s) => Math.min(s + 1, 3));
  };

  const handleBack = () => setStep((s) => Math.max(s - 1, 1));

  const postTypeLabel = POST_TYPES.find((t) => t.value === postType)?.label ?? postType;

  const frequencyDetail = (() => {
    if (isNews) return 'Event-triggered (when news is submitted)';
    if (frequency === 'daily') return `Daily at ${timeOfDay}`;
    if (frequency === 'weekly')
      return `Weekly on ${DAY_OPTIONS.find((d) => d.value === dayOfWeek)?.label} at ${timeOfDay}`;
    return `Monthly on day ${dayOfMonth} at ${timeOfDay}`;
  })();

  const updateNewsLengthRange = (index: number, field: 'min' | 'max', value: number) => {
    setNewsLengthMapping((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const stepLabels = isNews
    ? ['Basics', 'News Config', 'Summary']
    : ['Basics', 'Schedule & Content', 'Summary'];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <Link href="/e-poster/schedule">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Schedule
            </Button>
          </Link>

          <h1 className="text-3xl font-bold mb-2">
            {isBatch ? 'Batch Schedule' : 'New Schedule'}
          </h1>
          <p className="text-muted-foreground mb-6">
            {isBatch
              ? 'Create recurring post schedules for multiple portfolios at once.'
              : 'Set up a recurring post schedule for a portfolio.'}
          </p>

          {/* Step Indicator */}
          <div className="flex items-center gap-2 mb-8">
            {stepLabels.map((label, i) => {
              const stepNum = i + 1;
              const isActive = step === stepNum;
              const isCompleted = step > stepNum;
              return (
                <div key={label} className="flex items-center gap-2 flex-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (isCompleted) setStep(stepNum);
                    }}
                    className={`
                      flex items-center justify-center h-8 w-8 rounded-full text-sm font-medium shrink-0 transition-colors
                      ${isActive ? 'bg-primary text-primary-foreground' : ''}
                      ${isCompleted ? 'bg-primary/20 text-primary cursor-pointer' : ''}
                      ${!isActive && !isCompleted ? 'bg-muted text-muted-foreground' : ''}
                    `}
                  >
                    {isCompleted ? <Check className="h-4 w-4" /> : stepNum}
                  </button>
                  <span
                    className={`text-sm font-medium hidden sm:block ${
                      isActive ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {label}
                  </span>
                  {i < stepLabels.length - 1 && (
                    <div
                      className={`flex-1 h-px ${
                        isCompleted ? 'bg-primary/40' : 'bg-border'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Step 1: Basics ── */}
          {step === 1 && (
            <>
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-lg">Schedule Name</CardTitle>
                </CardHeader>
                <CardContent>
                  <div>
                    <Label htmlFor="name">
                      {isBatch ? 'Name Prefix (optional)' : 'Schedule Name'}
                    </Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={
                        isBatch
                          ? 'e.g., Weekly Educational'
                          : 'e.g., Weekly Educational - MyPortfolio'
                      }
                      className="mt-1.5"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-lg">
                    {isBatch ? 'Select Portfolios' : 'Select Portfolio'}
                  </CardTitle>
                  <CardDescription>
                    {isBatch
                      ? 'A separate schedule will be created for each selected portfolio.'
                      : 'Choose which portfolio this schedule applies to.'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingPortfolios ? (
                    <div className="text-center py-4 text-muted-foreground">
                      Loading portfolios...
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search portfolios..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                          />
                        </div>
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm" onClick={selectAll}>
                            All
                          </Button>
                          <Button variant="outline" size="sm" onClick={clearAll}>
                            None
                          </Button>
                        </div>
                      </div>
                      <div className="max-h-[300px] overflow-y-auto border rounded-lg">
                        {filteredPortfolios.map((p) => (
                          <label
                            key={p.username}
                            className="flex items-center gap-3 px-3 py-2 hover:bg-accent/50 cursor-pointer border-b last:border-b-0"
                          >
                            <Checkbox
                              checked={selectedPortfolios.has(p.username)}
                              onCheckedChange={() => togglePortfolio(p.username)}
                            />
                            <span className="text-sm flex-1">{p.username}</span>
                            {!p.hasCredentials && (
                              <span className="text-xs text-amber-600">No credentials</span>
                            )}
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {selectedPortfolios.size} selected
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-lg">Post Flow</CardTitle>
                  <CardDescription>
                    Choose whether posts are published automatically or require your approval.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3">
                    <label
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        flowType === 'automatic'
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-accent/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="flowType"
                        value="automatic"
                        checked={flowType === 'automatic'}
                        onChange={() => setFlowType('automatic')}
                        className="mt-1"
                      />
                      <div>
                        <div className="font-medium">Automatic</div>
                        <div className="text-sm text-muted-foreground">
                          AI generates content and posts automatically to eToro. No manual review needed.
                        </div>
                      </div>
                    </label>
                    <label
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        flowType === 'approval'
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-accent/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="flowType"
                        value="approval"
                        checked={flowType === 'approval'}
                        onChange={() => setFlowType('approval')}
                        className="mt-1"
                      />
                      <div>
                        <div className="font-medium">Needs Approval</div>
                        <div className="text-sm text-muted-foreground">
                          AI generates content, but you review and approve before it gets posted.
                        </div>
                      </div>
                    </label>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* ── Step 2: Schedule & Content / News Config ── */}
          {step === 2 && (
            <>
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-lg">Post Type</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3">
                    {POST_TYPES.map((type) => (
                      <label
                        key={type.value}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          postType === type.value
                            ? 'border-primary bg-primary/5'
                            : 'hover:bg-accent/50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="postType"
                          value={type.value}
                          checked={postType === type.value}
                          onChange={(e) =>
                            setPostType(e.target.value as PostType)
                          }
                          className="mt-1"
                        />
                        <div>
                          <div className="font-medium">
                            {type.label}
                            {type.value === 'news' && (
                              <span className="ml-2 text-xs font-normal text-muted-foreground">
                                Event-triggered
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {type.description}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* News-specific: Relevance Threshold & Length Mapping */}
              {isNews && (
                <>
                  <Card className="mb-6">
                    <CardHeader>
                      <CardTitle className="text-lg">Relevance Threshold</CardTitle>
                      <CardDescription>
                        Portfolios scoring below this relevance percentage will be skipped when news is submitted.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min={0}
                          max={50}
                          step={1}
                          value={newsThreshold}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            setNewsThreshold(val);
                            setNewsLengthMapping((prev) => {
                              const next = [...prev];
                              if (next[0] && next[0].min !== val) {
                                next[0] = { ...next[0], min: val };
                              }
                              return next;
                            });
                          }}
                          className="flex-1 accent-primary"
                        />
                        <span className="text-sm font-mono w-12 text-right font-medium">
                          {newsThreshold}%
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Low (&lt;15%): gray</span>
                        <span>Medium (15-29%): blue</span>
                        <span>High (30%+): purple</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="mb-6">
                    <CardHeader>
                      <CardTitle className="text-lg">Relevance → Post Length</CardTitle>
                      <CardDescription>
                        Map relevance percentage ranges to post lengths. Higher relevance = more detailed posts.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Visual bar */}
                      <div className="space-y-1">
                        <div className="flex h-8 rounded-md overflow-hidden border">
                          {[
                            { min: 0, max: newsThreshold, label: 'Skipped', bg: 'bg-gray-200', text: 'text-gray-500' },
                            ...newsLengthMapping.map((r) => {
                              const colors: Record<string, { bg: string; text: string }> = {
                                short: { bg: 'bg-blue-200', text: 'text-blue-800' },
                                medium: { bg: 'bg-purple-200', text: 'text-purple-800' },
                                long: { bg: 'bg-purple-400', text: 'text-white' },
                              };
                              const c = colors[r.label] ?? { bg: 'bg-gray-200', text: 'text-gray-700' };
                              return { min: r.min, max: r.max, label: r.label, bg: c.bg, text: c.text };
                            }),
                          ].map((seg) => {
                            const width = seg.max - seg.min;
                            if (width <= 0) return null;
                            return (
                              <div
                                key={`${seg.label}-${seg.min}`}
                                className={`${seg.bg} ${seg.text} flex items-center justify-center text-xs font-medium`}
                                style={{ width: `${width}%` }}
                                title={`${seg.label}: ${seg.min}% – ${seg.max}%`}
                              >
                                {width >= 12 && (
                                  <span className="truncate px-1 capitalize">{seg.label}</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex justify-between text-[10px] text-muted-foreground px-0.5">
                          <span>0%</span>
                          <span>25%</span>
                          <span>50%</span>
                          <span>75%</span>
                          <span>100%</span>
                        </div>
                      </div>

                      {/* Editable ranges */}
                      <div className="space-y-3">
                        {newsLengthMapping.map((range, idx) => (
                          <div key={range.label} className="flex items-center gap-3">
                            <span className="text-sm font-medium capitalize w-16">{range.label}</span>
                            <div className="flex items-center gap-1.5 flex-1">
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                value={range.min}
                                onChange={(e) =>
                                  updateNewsLengthRange(idx, 'min', parseInt(e.target.value, 10) || 0)
                                }
                                className="w-20 h-8 text-sm"
                              />
                              <span className="text-xs text-muted-foreground">% to</span>
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                value={range.max}
                                onChange={(e) =>
                                  updateNewsLengthRange(idx, 'max', parseInt(e.target.value, 10) || 0)
                                }
                                className="w-20 h-8 text-sm"
                              />
                              <span className="text-xs text-muted-foreground">%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}

              {/* Non-news: Frequency & Timing */}
              {!isNews && (
                <>
                  <Card className="mb-6">
                    <CardHeader>
                      <CardTitle className="text-lg">Frequency & Timing</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label>Frequency</Label>
                        <div className="grid grid-cols-3 gap-2 mt-1.5">
                          {(['daily', 'weekly', 'monthly'] as const).map((freq) => (
                            <button
                              key={freq}
                              type="button"
                              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                                frequency === freq
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'hover:bg-accent'
                              }`}
                              onClick={() => setFrequency(freq)}
                            >
                              {freq.charAt(0).toUpperCase() + freq.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="timeOfDay">Time of Day</Label>
                          <Input
                            id="timeOfDay"
                            type="time"
                            value={timeOfDay}
                            onChange={(e) => setTimeOfDay(e.target.value)}
                            className="mt-1.5"
                          />
                        </div>

                        {frequency === 'weekly' && (
                          <div>
                            <Label htmlFor="dayOfWeek">Day of Week</Label>
                            <select
                              id="dayOfWeek"
                              value={dayOfWeek}
                              onChange={(e) => setDayOfWeek(Number(e.target.value))}
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 mt-1.5"
                            >
                              {DAY_OPTIONS.map((d) => (
                                <option key={d.value} value={d.value}>
                                  {d.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {frequency === 'monthly' && (
                          <div>
                            <Label htmlFor="dayOfMonth">Day of Month</Label>
                            <Input
                              id="dayOfMonth"
                              type="number"
                              min={1}
                              max={28}
                              value={dayOfMonth}
                              onChange={(e) => setDayOfMonth(Number(e.target.value))}
                              className="mt-1.5"
                            />
                            <p className="text-xs text-muted-foreground mt-1">1-28 recommended</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="mb-6">
                    <CardHeader>
                      <CardTitle className="text-lg">Content Settings</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label>Post Length</Label>
                        <div className="grid grid-cols-3 gap-2 mt-1.5">
                          {(['short', 'medium', 'long'] as const).map((len) => (
                            <button
                              key={len}
                              type="button"
                              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                                postLength === len
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'hover:bg-accent'
                              }`}
                              onClick={() => setPostLength(len)}
                            >
                              {len.charAt(0).toUpperCase() + len.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>

                      {postType === 'educational' && (
                        <div>
                          <Label htmlFor="context">Additional Context (optional)</Label>
                          <Textarea
                            id="context"
                            value={additionalContext}
                            onChange={(e) => setAdditionalContext(e.target.value)}
                            placeholder="e.g., Focus on factor investing benefits..."
                            className="mt-1.5"
                            rows={3}
                          />
                        </div>
                      )}

                      {postType === 'monthly-update' && (
                        <div>
                          <Label>Template Style</Label>
                          <div className="grid grid-cols-2 gap-2 mt-1.5">
                            <button
                              type="button"
                              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                                templateStyle === 'stats-bottom'
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'hover:bg-accent'
                              }`}
                              onClick={() => setTemplateStyle('stats-bottom')}
                            >
                              Stats Bottom
                            </button>
                            <button
                              type="button"
                              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                                templateStyle === 'revenue-opening'
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'hover:bg-accent'
                              }`}
                              onClick={() => setTemplateStyle('revenue-opening')}
                            >
                              Revenue Opening
                            </button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </>
          )}

          {/* ── Step 3: Summary ── */}
          {step === 3 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">Review & Confirm</CardTitle>
                <CardDescription>
                  Review your schedule settings before creating.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  <div className="py-3 flex justify-between">
                    <span className="text-sm text-muted-foreground">Schedule Name</span>
                    <span className="text-sm font-medium text-right">
                      {name || (isBatch ? '(auto-generated)' : `${postType} - ${Array.from(selectedPortfolios)[0] ?? ''}`)}
                    </span>
                  </div>

                  <div className="py-3 flex justify-between items-start">
                    <span className="text-sm text-muted-foreground">
                      Portfolio{selectedPortfolios.size > 1 ? 's' : ''} ({selectedPortfolios.size})
                    </span>
                    <div className="text-sm font-medium text-right max-w-[60%]">
                      {selectedPortfolios.size <= 5 ? (
                        Array.from(selectedPortfolios).map((u) => (
                          <div key={u}>@{u}</div>
                        ))
                      ) : (
                        <>
                          {Array.from(selectedPortfolios).slice(0, 3).map((u) => (
                            <div key={u}>@{u}</div>
                          ))}
                          <div className="text-muted-foreground">
                            +{selectedPortfolios.size - 3} more
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="py-3 flex justify-between">
                    <span className="text-sm text-muted-foreground">Post Flow</span>
                    <span className="text-sm font-medium">
                      {flowType === 'automatic' ? 'Automatic' : 'Needs Approval'}
                    </span>
                  </div>

                  <div className="py-3 flex justify-between">
                    <span className="text-sm text-muted-foreground">Post Type</span>
                    <span className="text-sm font-medium">{postTypeLabel}</span>
                  </div>

                  <div className="py-3 flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      {isNews ? 'Trigger' : 'Frequency'}
                    </span>
                    <span className="text-sm font-medium">{frequencyDetail}</span>
                  </div>

                  {isNews && (
                    <>
                      <div className="py-3 flex justify-between">
                        <span className="text-sm text-muted-foreground">Min. Relevance</span>
                        <span className="text-sm font-medium">{newsThreshold}%</span>
                      </div>
                      <div className="py-3 flex justify-between items-start">
                        <span className="text-sm text-muted-foreground">Length Mapping</span>
                        <div className="text-sm font-medium text-right">
                          {newsLengthMapping.map((r) => (
                            <div key={r.label} className="capitalize">
                              {r.label}: {r.min}% – {r.max}%
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {!isNews && (
                    <div className="py-3 flex justify-between">
                      <span className="text-sm text-muted-foreground">Post Length</span>
                      <span className="text-sm font-medium capitalize">{postLength}</span>
                    </div>
                  )}

                  {postType === 'educational' && additionalContext && (
                    <div className="py-3 flex justify-between items-start">
                      <span className="text-sm text-muted-foreground">Additional Context</span>
                      <span className="text-sm font-medium text-right max-w-[60%] line-clamp-3">
                        {additionalContext}
                      </span>
                    </div>
                  )}

                  {postType === 'monthly-update' && (
                    <div className="py-3 flex justify-between">
                      <span className="text-sm text-muted-foreground">Template Style</span>
                      <span className="text-sm font-medium">
                        {templateStyle === 'stats-bottom' ? 'Stats Bottom' : 'Revenue Opening'}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Navigation Buttons ── */}
          <div className="flex items-center justify-between">
            <div>
              {step === 1 && (
                <Link href="/e-poster/schedule">
                  <Button variant="outline">Cancel</Button>
                </Link>
              )}
              {step > 1 && (
                <Button variant="outline" onClick={handleBack}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              )}
            </div>
            <div>
              {step < 3 && (
                <Button
                  onClick={handleNext}
                  disabled={step === 1 && !canProceedStep1}
                >
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
              {step === 3 && (
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Calendar className="h-4 w-4 mr-2" />
                      {isBatch || selectedPortfolios.size > 1
                        ? `Create ${selectedPortfolios.size} Schedule(s)`
                        : 'Create Schedule'}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CreateSchedulePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <CreateScheduleForm />
    </Suspense>
  );
}
