'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Pause,
  Play,
  Trash2,
  Bell,
  Pencil,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'react-hot-toast';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  startOfDay,
  endOfDay,
} from 'date-fns';
import type { PostType } from '@/lib/models/post';
import type { Schedule, ScheduleFrequency } from '@/lib/models/schedule';

const POST_TYPE_LABELS: Record<PostType, string> = {
  news: 'News',
  educational: 'Educational',
  'monthly-update': 'Monthly Update',
  'performance-highlight': 'Performance Highlight',
};

const POST_TYPE_DOT_COLORS: Record<PostType, string> = {
  news: 'bg-blue-500',
  educational: 'bg-purple-500',
  'monthly-update': 'bg-amber-500',
  'performance-highlight': 'bg-emerald-500',
};

const POST_TYPE_BADGE_COLORS: Record<PostType, string> = {
  news: 'bg-blue-100 text-blue-800',
  educational: 'bg-purple-100 text-purple-800',
  'monthly-update': 'bg-amber-100 text-amber-800',
  'performance-highlight': 'bg-emerald-100 text-emerald-800',
};

const FREQUENCY_LABELS: Record<ScheduleFrequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

interface ScheduleRun {
  schedule: Schedule;
  runDate: string;
}

export default function SchedulePage() {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'month' | 'week'>('month');
  const [runs, setRuns] = useState<ScheduleRun[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [portfolioNames, setPortfolioNames] = useState<string[]>([]);
  const [selectedPortfolio, setSelectedPortfolio] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [dayDialogOpen, setDayDialogOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [schedulerRunning, setSchedulerRunning] = useState(false);

  const loadSchedulerStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/scheduler/init');
      const data = await res.json();
      setSchedulerRunning(data.running);
    } catch { /* ignore */ }
  }, []);

  const loadPendingCount = useCallback(async () => {
    try {
      const res = await fetch('/api/pending-posts?countOnly=true');
      const data = await res.json();
      setPendingCount(data.count || 0);
    } catch { /* ignore */ }
  }, []);

  const getDateRange = useCallback(() => {
    if (view === 'month') {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      return {
        start: startOfWeek(monthStart, { weekStartsOn: 0 }),
        end: endOfWeek(monthEnd, { weekStartsOn: 0 }),
      };
    } else {
      return {
        start: startOfWeek(currentDate, { weekStartsOn: 0 }),
        end: endOfWeek(currentDate, { weekStartsOn: 0 }),
      };
    }
  }, [currentDate, view]);

  const loadCalendarData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { start, end } = getDateRange();
      const params = new URLSearchParams({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      });
      if (selectedPortfolio) params.set('portfolio', selectedPortfolio);

      const [runsRes, schedulesRes] = await Promise.all([
        fetch(`/api/schedules?${params.toString()}`),
        fetch('/api/schedules'),
      ]);

      const runsData = await runsRes.json();
      const schedulesData = await schedulesRes.json();

      setRuns(runsData.runs || []);
      setSchedules(schedulesData.schedules || []);

      const names = new Set<string>();
      for (const s of schedulesData.schedules || []) {
        names.add(s.portfolioName);
      }
      setPortfolioNames(Array.from(names).sort());
    } catch {
      toast.error('Failed to load schedule data');
    } finally {
      setIsLoading(false);
    }
  }, [getDateRange, selectedPortfolio]);

  useEffect(() => {
    loadCalendarData();
    loadPendingCount();
    loadSchedulerStatus();
  }, [loadCalendarData, loadPendingCount, loadSchedulerStatus]);

  const navigate = (direction: 'prev' | 'next') => {
    if (view === 'month') {
      setCurrentDate(direction === 'next' ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    } else {
      setCurrentDate(direction === 'next' ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
    }
  };

  const goToToday = () => setCurrentDate(new Date());

  const getRunsForDay = (day: Date): ScheduleRun[] => {
    return runs.filter((r) => isSameDay(new Date(r.runDate), day));
  };

  const handleDayClick = (day: Date) => {
    const dayRuns = getRunsForDay(day);
    if (dayRuns.length > 0) {
      setSelectedDay(day);
      setDayDialogOpen(true);
    }
  };

  const handleToggleSchedule = async (scheduleId: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/schedules/${scheduleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (!res.ok) throw new Error('Failed to update');
      toast.success(isActive ? 'Schedule paused' : 'Schedule activated');
      loadCalendarData();
    } catch {
      toast.error('Failed to update schedule');
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return;
    try {
      const res = await fetch(`/api/schedules/${scheduleId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Schedule deleted');
      loadCalendarData();
    } catch {
      toast.error('Failed to delete schedule');
    }
  };

  const handleToggleScheduler = async () => {
    try {
      const res = await fetch('/api/scheduler/init', {
        method: schedulerRunning ? 'DELETE' : 'POST',
      });
      const data = await res.json();
      setSchedulerRunning(data.running);
      toast.success(data.running ? 'Scheduler started' : 'Scheduler stopped');
    } catch {
      toast.error('Failed to toggle scheduler');
    }
  };

  const { start: rangeStart, end: rangeEnd } = getDateRange();
  const calendarDays = eachDayOfInterval({ start: rangeStart, end: rangeEnd });

  const displayedSchedules = selectedPortfolio
    ? schedules.filter((s) => s.portfolioName === selectedPortfolio)
    : schedules;
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const headerLabel =
    view === 'month'
      ? format(currentDate, 'MMMM yyyy')
      : `${format(rangeStart, 'MMM d')} - ${format(rangeEnd, 'MMM d, yyyy')}`;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <Link href="/e-poster">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>

          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold">Schedule</h1>
              <p className="text-muted-foreground mt-1">
                Manage recurring posts and view the posting calendar.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/e-poster/schedule/pending">
                <Button variant="outline" className="relative">
                  <Bell className="h-4 w-4 mr-2" />
                  Posts waiting for manual approval
                  {pendingCount > 0 && (
                    <span className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                      {pendingCount}
                    </span>
                  )}
                </Button>
              </Link>
              <Link href="/e-poster/schedule/create">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Schedule
                </Button>
              </Link>
            </div>
          </div>

          {/* Scheduler Status */}
          <Card className="mb-6">
            <CardContent className="py-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`h-2.5 w-2.5 rounded-full ${
                      schedulerRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                    }`}
                  />
                  <span className="text-sm font-medium">
                    Scheduler: {schedulerRunning ? 'Running' : 'Stopped'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {schedulerRunning
                      ? 'Checking for due schedules every minute'
                      : 'Start the scheduler to auto-post'}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToggleScheduler}
                >
                  {schedulerRunning ? (
                    <>
                      <Pause className="h-4 w-4 mr-1" /> Stop
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-1" /> Start
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Calendar */}
            <div className="lg:col-span-3">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => navigate('prev')}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <h2 className="text-lg font-semibold min-w-[200px] text-center">
                        {headerLabel}
                      </h2>
                      <Button variant="ghost" size="icon" onClick={() => navigate('next')}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={goToToday}>
                        Today
                      </Button>
                    </div>
                    <Tabs value={view} onValueChange={(v) => setView(v as 'month' | 'week')}>
                      <TabsList>
                        <TabsTrigger value="month">Month</TabsTrigger>
                        <TabsTrigger value="week">Week</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="text-center py-12 text-muted-foreground">
                      Loading calendar...
                    </div>
                  ) : (
                    <div>
                      <div className="grid grid-cols-7 mb-1">
                        {weekDays.map((day) => (
                          <div
                            key={day}
                            className="text-center text-xs font-medium text-muted-foreground py-2"
                          >
                            {day}
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 border-t border-l">
                        {calendarDays.map((day) => {
                          const dayRuns = getRunsForDay(day);
                          const isCurrentMonth = isSameMonth(day, currentDate);
                          const today = isToday(day);

                          return (
                            <div
                              key={day.toISOString()}
                              className={`
                                min-h-[100px] border-r border-b p-1.5 cursor-pointer
                                hover:bg-accent/50 transition-colors
                                ${!isCurrentMonth && view === 'month' ? 'bg-muted/30' : ''}
                              `}
                              onClick={() => handleDayClick(day)}
                            >
                              <div
                                className={`
                                  text-sm font-medium mb-1
                                  ${today ? 'bg-primary text-primary-foreground w-7 h-7 rounded-full flex items-center justify-center' : ''}
                                  ${!isCurrentMonth && view === 'month' ? 'text-muted-foreground' : ''}
                                `}
                              >
                                {format(day, 'd')}
                              </div>
                              <div className="space-y-0.5">
                                {dayRuns.slice(0, 3).map((run, i) => (
                                  <div
                                    key={`${run.schedule.id}-${i}`}
                                    className="flex items-center gap-1 text-xs truncate"
                                  >
                                    <div
                                      className={`h-2 w-2 rounded-full shrink-0 ${
                                        POST_TYPE_DOT_COLORS[run.schedule.postType] || 'bg-gray-400'
                                      }`}
                                    />
                                    <span className="truncate">
                                      {run.schedule.portfolioName}
                                    </span>
                                  </div>
                                ))}
                                {dayRuns.length > 3 && (
                                  <div className="text-xs text-muted-foreground">
                                    +{dayRuns.length - 3} more
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Legend */}
                  <div className="flex items-center gap-4 mt-4 pt-3 border-t">
                    {(['news', 'educational', 'monthly-update', 'performance-highlight'] as PostType[]).map(
                      (type) => (
                        <div key={type} className="flex items-center gap-1.5 text-xs">
                          <div
                            className={`h-2.5 w-2.5 rounded-full ${POST_TYPE_DOT_COLORS[type]}`}
                          />
                          {POST_TYPE_LABELS[type]}
                        </div>
                      ),
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar: Filters + Schedule List */}
            <div className="space-y-6">
              {/* Portfolio Filter */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Filter</CardTitle>
                </CardHeader>
                <CardContent>
                  <Label htmlFor="portfolio-filter" className="text-sm mb-1.5 block">
                    Portfolio
                  </Label>
                  <select
                    id="portfolio-filter"
                    value={selectedPortfolio}
                    onChange={(e) => setSelectedPortfolio(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="">All Portfolios</option>
                    {portfolioNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </CardContent>
              </Card>

              {/* Active Schedules */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    Active Schedules ({displayedSchedules.filter((s) => s.isActive).length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {displayedSchedules.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No schedules yet. Create one to get started.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {displayedSchedules.map((schedule) => (
                        <div
                          key={schedule.id}
                          className={`p-3 rounded-lg border text-sm ${
                            !schedule.isActive ? 'opacity-50' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between mb-1">
                            <span className="font-medium truncate flex-1">
                              {schedule.name}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => router.push(`/e-poster/schedule/edit/${schedule.id}`)}
                                title="Edit"
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() =>
                                  handleToggleSchedule(schedule.id, schedule.isActive)
                                }
                                title={schedule.isActive ? 'Pause' : 'Activate'}
                              >
                                {schedule.isActive ? (
                                  <Pause className="h-3 w-3" />
                                ) : (
                                  <Play className="h-3 w-3" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => handleDeleteSchedule(schedule.id)}
                                title="Delete"
                              >
                                <Trash2 className="h-3 w-3 text-red-500" />
                              </Button>
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            <div>{schedule.portfolioName}</div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                                  POST_TYPE_BADGE_COLORS[schedule.postType] || 'bg-gray-100'
                                }`}
                              >
                                {POST_TYPE_LABELS[schedule.postType]}
                              </span>
                                {schedule.frequency && (
                                <span>{FREQUENCY_LABELS[schedule.frequency]}</span>
                              )}
                              {schedule.timeOfDay && (
                                <span>
                                  <Clock className="h-3 w-3 inline mr-0.5" />
                                  {schedule.timeOfDay}
                                </span>
                              )}
                            </div>
                            <div>
                              {schedule.flowType === 'automatic' ? 'Auto-post' : 'Needs approval'}
                            </div>
                            {schedule.lastRunError && (
                              <div className="flex items-start gap-1.5 mt-1 p-1.5 rounded bg-red-50 border border-red-200 text-red-700">
                                <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                                <span className="break-words">{schedule.lastRunError}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Day Detail Dialog */}
          <Dialog open={dayDialogOpen} onOpenChange={setDayDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {selectedDay && format(selectedDay, 'EEEE, MMMM d, yyyy')}
                </DialogTitle>
                <DialogDescription>Scheduled posts for this day</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {selectedDay &&
                  getRunsForDay(selectedDay).map((run, i) => (
                    <div key={`${run.schedule.id}-${i}`} className="p-3 rounded-lg border">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            POST_TYPE_BADGE_COLORS[run.schedule.postType] || 'bg-gray-100'
                          }`}
                        >
                          {POST_TYPE_LABELS[run.schedule.postType]}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {run.schedule.timeOfDay}
                        </span>
                      </div>
                      <div className="font-medium text-sm">{run.schedule.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {run.schedule.portfolioName} &middot;{' '}
                        {run.schedule.flowType === 'automatic' ? 'Auto-post' : 'Needs approval'}
                      </div>
                    </div>
                  ))}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
