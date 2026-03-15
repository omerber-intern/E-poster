'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
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
import { toast } from 'react-hot-toast';
import type { Schedule } from '@/lib/models/schedule';
import type { PostType } from '@/lib/models/post';

const POST_TYPES: Array<{ value: PostType; label: string; description: string }> = [
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

const POST_LENGTH_OPTIONS: Array<{ value: 'short' | 'medium' | 'long'; label: string; description: string }> = [
  { value: 'short', label: 'Short', description: '~100-150 words. Concise with key points.' },
  { value: 'medium', label: 'Medium', description: '~200 words. Balanced detail and readability.' },
  { value: 'long', label: 'Long', description: '~300+ words. Comprehensive with full detail.' },
];

const TEMPLATE_STYLE_OPTIONS: Array<{ value: 'stats-bottom' | 'revenue-opening'; label: string; description: string; preview: string }> = [
  {
    value: 'revenue-opening',
    label: 'Revenue in Opening',
    description: 'Revenue figure prominently in the first lines. Narrative, energetic style.',
    preview: '"February 2026: +10.03% 🚀"',
  },
  {
    value: 'stats-bottom',
    label: 'Stats at Bottom',
    description: 'Market commentary first, structured stats block at the end. Professional tone.',
    preview: '"Performance Stats: @Portfolio → February: +2.72%"',
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

export default function EditSchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [schedule, setSchedule] = useState<Schedule | null>(null);

  const [name, setName] = useState('');
  const [postType, setPostType] = useState<PostType>('educational');
  const [flowType, setFlowType] = useState<'automatic' | 'approval'>('approval');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [timeOfDay, setTimeOfDay] = useState('09:00');
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [postLength, setPostLength] = useState<'short' | 'medium' | 'long'>('medium');
  const [additionalContext, setAdditionalContext] = useState('');
  const [templateStyle, setTemplateStyle] = useState<'stats-bottom' | 'revenue-opening'>('stats-bottom');

  useEffect(() => {
    async function loadSchedule() {
      try {
        const res = await fetch(`/api/schedules/${id}`);
        if (!res.ok) throw new Error('Schedule not found');
        const data = await res.json();
        const s: Schedule = data.schedule;
        setSchedule(s);

        setName(s.name);
        setPostType(s.postType);
        setFlowType(s.flowType);
        if (s.frequency) setFrequency(s.frequency);
        if (s.timeOfDay) setTimeOfDay(s.timeOfDay);
        if (s.dayOfWeek !== undefined) setDayOfWeek(s.dayOfWeek);
        if (s.dayOfMonth !== undefined) setDayOfMonth(s.dayOfMonth);
        if (s.generationConfig.postLength) setPostLength(s.generationConfig.postLength);
        if (s.generationConfig.additionalContext) setAdditionalContext(s.generationConfig.additionalContext);
        if (s.generationConfig.templateStyle) {
          setTemplateStyle(s.generationConfig.templateStyle as 'stats-bottom' | 'revenue-opening');
        }
      } catch {
        toast.error('Failed to load schedule');
        router.push('/e-poster/schedule');
      } finally {
        setIsLoading(false);
      }
    }
    loadSchedule();
  }, [id, router]);

  const handleSave = async () => {
    if (!schedule) return;

    setIsSaving(true);

    const updates: Record<string, unknown> = {
      name,
      postType,
      flowType,
      frequency,
      timeOfDay,
      dayOfWeek: frequency === 'weekly' ? dayOfWeek : undefined,
      dayOfMonth: frequency === 'monthly' ? dayOfMonth : undefined,
      generationConfig: {
        postLength,
        additionalContext: postType === 'educational' ? additionalContext : undefined,
        templateStyle: postType === 'monthly-update' ? templateStyle : undefined,
      },
    };

    try {
      const res = await fetch(`/api/schedules/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save');
      }
      toast.success('Schedule updated');
      router.push('/e-poster/schedule');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save schedule');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!schedule) return null;

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

          <h1 className="text-3xl font-bold mb-1">Edit Schedule</h1>
          <p className="text-muted-foreground mb-6">Update the settings for this recurring schedule.</p>

          {/* Read-only portfolio info */}
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Portfolio</CardTitle>
              <CardDescription>Cannot be changed after creation.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium">{schedule.portfolioName}</p>
            </CardContent>
          </Card>

          {/* Post Type */}
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
                      onChange={() => setPostType(type.value)}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium">{type.label}</div>
                      <div className="text-sm text-muted-foreground">{type.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Name */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Schedule Name</CardTitle>
            </CardHeader>
            <CardContent>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Weekly Educational - MyPortfolio"
                className="mt-1.5"
              />
            </CardContent>
          </Card>

          {/* Flow type */}
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
                    flowType === 'automatic' ? 'border-primary bg-primary/5' : 'hover:bg-accent/50'
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
                    flowType === 'approval' ? 'border-primary bg-primary/5' : 'hover:bg-accent/50'
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

          {/* Frequency & Timing */}
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

          {/* Content Settings */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Content Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="mb-2 block">Post Length</Label>
                <div className="grid grid-cols-3 gap-2">
                  {POST_LENGTH_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPostLength(opt.value)}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        postLength === opt.value
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-accent/50'
                      }`}
                    >
                      <div className={`text-sm font-medium mb-1 ${postLength === opt.value ? 'text-primary' : ''}`}>
                        {opt.label}
                      </div>
                      <div className="text-xs text-muted-foreground">{opt.description}</div>
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
                  <Label className="mb-2 block">Template Style</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {TEMPLATE_STYLE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setTemplateStyle(opt.value)}
                        className={`p-3 rounded-lg border text-left transition-colors ${
                          templateStyle === opt.value
                            ? 'border-primary bg-primary/5'
                            : 'hover:bg-accent/50'
                        }`}
                      >
                        <div className={`text-sm font-medium mb-1 ${templateStyle === opt.value ? 'text-primary' : ''}`}>
                          {opt.label}
                        </div>
                        <div className="text-xs text-muted-foreground mb-2">{opt.description}</div>
                        <code className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {opt.preview}
                        </code>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <Link href="/e-poster/schedule">
              <Button variant="outline">Cancel</Button>
            </Link>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
