'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, Upload, Plus, RefreshCw, Pencil, Trash2, X, Check, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'react-hot-toast';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PortfolioEntry {
  id: string;
  username: string;
  apiKey: string;
  userKey: string;
  gcid: string;
}

interface ValidationResult {
  valid: { username: string; gcid: string }[];
  invalid: string[];
}

interface CredTestResult {
  username: string;
  valid: boolean;
  error?: string;
}

interface MaskedConfig {
  username: string;
  hasCredentials: boolean;
  credentials: {
    apiKey: string;
    userKey: string;
    gcid: string;
  } | null;
}

// ─── Add Portfolios Tab ──────────────────────────────────────────────────────

function AddPortfoliosTab() {
  const [entries, setEntries] = useState<PortfolioEntry[]>([]);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [credTestResults, setCredTestResults] = useState<CredTestResult[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasEdited, setHasEdited] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addEmptyRow = () => {
    setEntries((prev) => [
      ...prev,
      { id: crypto.randomUUID(), username: '', apiKey: '', userKey: '', gcid: '' },
    ]);
    setValidationResult(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/portfolio-config/import', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to parse file');
        return;
      }

      const newEntries: PortfolioEntry[] = data.rows.map(
        (row: { username: string; apiKey: string; userKey: string; gcid: string }) => ({
          id: crypto.randomUUID(),
          username: row.username,
          apiKey: row.apiKey || '',
          userKey: row.userKey || '',
          gcid: row.gcid || '',
        }),
      );
      setEntries((prev) => [...prev, ...newEntries]);
      setValidationResult(null);
      toast.success(`Loaded ${newEntries.length} entries from file`);
    } catch {
      toast.error('Failed to upload file');
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const updateEntry = (id: string, field: keyof PortfolioEntry, value: string) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)),
    );
    if (field === 'username' && validationResult) {
      setHasEdited(true);
    }
  };

  const removeEntry = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setValidationResult(null);
    setCredTestResults([]);
  };

  const handleValidate = async () => {
    if (entries.length === 0) {
      toast.error('No portfolios to validate');
      return;
    }

    const missingCreds = entries.filter((e) => !e.apiKey.trim() || !e.userKey.trim());
    if (missingCreds.length > 0) {
      toast.error(
        `Please fill in API Key and User Key for: ${missingCreds.map((e) => e.username).join(', ')}`,
      );
      return;
    }

    setIsValidating(true);
    setHasEdited(false);
    setCredTestResults([]);
    try {
      // Step 1: Validate usernames
      const res = await fetch('/api/portfolio-config/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usernames: entries.map((e) => e.username.trim()),
        }),
      });
      const data: ValidationResult = await res.json();
      setValidationResult(data);

      // Auto-fill gcid for valid entries
      if (data.valid.length > 0) {
        setEntries((prev) =>
          prev.map((entry) => {
            const match = data.valid.find(
              (v) => v.username === entry.username.trim(),
            );
            if (match && match.gcid) {
              return { ...entry, gcid: match.gcid };
            }
            return entry;
          }),
        );
      }

      if (data.invalid.length > 0) {
        toast.error(
          `${data.invalid.length} username(s) not found on eToro`,
        );
      }

      // Step 2: Test API keys for valid usernames
      const validUsernames = data.valid.map((v) => v.username);
      const entriesToTest = entries.filter((e) =>
        validUsernames.includes(e.username.trim()),
      );

      if (entriesToTest.length > 0) {
        const testRes = await fetch('/api/portfolio-config/test-credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entries: entriesToTest.map((e) => ({
              username: e.username.trim(),
              apiKey: e.apiKey.trim(),
              userKey: e.userKey.trim(),
            })),
          }),
        });
        const testData = await testRes.json();
        const results: CredTestResult[] = testData.results ?? [];
        setCredTestResults(results);

        const failed = results.filter((r) => !r.valid);
        if (failed.length > 0) {
          toast.error(
            `${failed.length} API key(s) failed: ${failed.map((f) => f.username).join(', ')}`,
          );
        } else if (data.invalid.length === 0) {
          toast.success('All usernames and API keys verified');
        }
      }
    } catch {
      toast.error('Validation request failed');
    } finally {
      setIsValidating(false);
    }
  };

  const allValid =
    validationResult !== null &&
    validationResult.invalid.length === 0 &&
    credTestResults.length > 0 &&
    credTestResults.every((r) => r.valid) &&
    !hasEdited;

  const handleApproveAndAdd = async () => {
    if (!allValid) return;

    setIsSaving(true);
    try {
      const res = await fetch('/api/portfolio-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portfolios: entries.map((e) => ({
            username: e.username.trim(),
            credentials: {
              apiKey: e.apiKey.trim(),
              userKey: e.userKey.trim(),
              gcid: e.gcid.trim(),
            },
          })),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to add portfolios');
        setIsSaving(false);
        return;
      }

      if (data.duplicates?.length > 0) {
        toast(`Skipped duplicates: ${data.duplicates.join(', ')}`);
      }
      toast.success(`Added ${data.added.length} portfolio(s)`);

      // Trigger full sync
      setIsSyncing(true);
      const syncRes = await fetch('/api/sync?type=all', { method: 'POST' });
      const syncData = await syncRes.json();

      if (syncData.success) {
        toast.success(
          `Synced ${syncData.portfolios?.synced ?? 0} portfolios, ${syncData.bios?.fetched ?? 0} bios`,
        );
      } else {
        toast.error('Sync completed with errors');
      }

      // Reset form
      setEntries([]);
      setValidationResult(null);
    } catch {
      toast.error('Failed to save portfolios');
    } finally {
      setIsSaving(false);
      setIsSyncing(false);
    }
  };

  const getEntryStatus = (
    username: string,
  ): 'valid' | 'invalid' | 'cred_fail' | 'pending' => {
    if (!validationResult || hasEdited) return 'pending';
    if (validationResult.invalid.includes(username.trim())) return 'invalid';
    if (validationResult.valid.some((v) => v.username === username.trim())) {
      const credResult = credTestResults.find(
        (r) => r.username === username.trim(),
      );
      if (credResult && !credResult.valid) return 'cred_fail';
      return 'valid';
    }
    return 'pending';
  };

  const getCredError = (username: string): string | undefined => {
    return credTestResults.find((r) => r.username === username.trim())?.error;
  };

  return (
    <div className="space-y-6">
      {/* Manual entry + file upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Add Portfolios</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_1fr_1fr_36px] gap-3 items-end">
            <Label className="text-xs font-semibold">Portfolio Name *</Label>
            <Label className="text-xs font-semibold">API Key *</Label>
            <Label className="text-xs font-semibold">User Key *</Label>
            <span />
          </div>

          {/* Entry rows */}
          {entries.map((entry) => {
            const status = getEntryStatus(entry.username);
            const rowBorder =
              status === 'valid'
                ? 'ring-1 ring-green-500/50'
                : status === 'invalid' || status === 'cred_fail'
                  ? 'ring-1 ring-red-500/50'
                  : '';
            return (
              <div key={entry.id} className="space-y-1">
                <div
                  className={`grid grid-cols-[1fr_1fr_1fr_36px] gap-3 items-center rounded-md ${rowBorder}`}
                >
                  <div className="flex items-center gap-1.5">
                    {status === 'valid' && (
                      <Check className="h-4 w-4 text-green-600 shrink-0" />
                    )}
                    {(status === 'invalid' || status === 'cred_fail') && (
                      <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                    )}
                    <Input
                      value={entry.username}
                      onChange={(e) =>
                        updateEntry(entry.id, 'username', e.target.value)
                      }
                      placeholder="e.g. PureMomentum"
                    />
                  </div>
                  <Input
                    value={entry.apiKey}
                    onChange={(e) =>
                      updateEntry(entry.id, 'apiKey', e.target.value)
                    }
                    placeholder="API Key"
                  />
                  <Input
                    value={entry.userKey}
                    onChange={(e) =>
                      updateEntry(entry.id, 'userKey', e.target.value)
                    }
                    placeholder="User Key"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => removeEntry(entry.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {status === 'invalid' && (
                  <p className="text-xs text-red-600 pl-1">
                    Not found on eToro — possible mistype?
                  </p>
                )}
                {status === 'cred_fail' && (
                  <p className="text-xs text-red-600 pl-1">
                    Username valid but API key test failed
                    {getCredError(entry.username)
                      ? ` (${getCredError(entry.username)})`
                      : ''}
                  </p>
                )}
                {status === 'valid' && (
                  <p className="text-xs text-green-600 pl-1">
                    Username and API key verified
                    {entry.gcid ? ` · GCID: ${entry.gcid}` : ''}
                  </p>
                )}
              </div>
            );
          })}

          <Button size="sm" variant="outline" onClick={addEmptyRow}>
            <Plus className="mr-1 h-4 w-4" />
            Add Row
          </Button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">
              OR upload CSV / Excel
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleFileUpload}
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              Choose File (.csv, .xlsx)
            </Button>
            <p className="mt-1 text-xs text-muted-foreground">
              Expected columns: username, apiKey, userKey
            </p>
          </div>

          {/* Actions */}
          {entries.length > 0 && (
            <>
              <div className="flex gap-3 pt-2 border-t">
                <Button
                  onClick={handleValidate}
                  disabled={isValidating || entries.length === 0}
                >
                  {isValidating ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Validating...
                    </>
                  ) : hasEdited ? (
                    'Re-validate'
                  ) : (
                    'Validate & Submit'
                  )}
                </Button>

                <Button
                  onClick={handleApproveAndAdd}
                  disabled={!allValid || isSaving || isSyncing}
                  variant={allValid ? 'default' : 'outline'}
                >
                  {isSyncing ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Syncing portfolios...
                    </>
                  ) : isSaving ? (
                    'Saving...'
                  ) : (
                    'Approve & Add Portfolios'
                  )}
                </Button>
              </div>

              {validationResult && !hasEdited && (
                <div className="text-sm space-y-1">
                  {validationResult.valid.length > 0 && (
                    <p className="text-green-600">
                      {validationResult.valid.length} valid:{' '}
                      {validationResult.valid.map((v) => v.username).join(', ')}
                    </p>
                  )}
                  {validationResult.invalid.length > 0 && (
                    <p className="text-red-600">
                      {validationResult.invalid.length} invalid:{' '}
                      {validationResult.invalid.join(', ')} — fix or remove
                      them, then re-validate.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Manage API Keys Tab ─────────────────────────────────────────────────────

function ManageApiKeysTab() {
  const [configs, setConfigs] = useState<MaskedConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [missingOnly, setMissingOnly] = useState(false);
  const [isFetchingGcids, setIsFetchingGcids] = useState(false);
  const [credTestStatus, setCredTestStatus] = useState<
    Record<string, 'testing' | 'pass' | 'fail' | string>
  >({});
  const [isTestingAll, setIsTestingAll] = useState(false);

  // Edit dialog
  const [editUsername, setEditUsername] = useState<string | null>(null);
  const [editApiKey, setEditApiKey] = useState('');
  const [editUserKey, setEditUserKey] = useState('');
  const [editExistingGcid, setEditExistingGcid] = useState('');
  const [editMaskedApiKey, setEditMaskedApiKey] = useState('');
  const [editMaskedUserKey, setEditMaskedUserKey] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Delete — double confirmation
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchConfigs = useCallback(async () => {
    try {
      const res = await fetch('/api/portfolio-config');
      const data = await res.json();
      setConfigs(data.portfolios ?? []);
    } catch {
      toast.error('Failed to load portfolio configs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const filtered = missingOnly
    ? configs.filter((c) => !c.hasCredentials)
    : configs;

  // ── Edit handlers ──

  const openEdit = (config: MaskedConfig) => {
    setEditUsername(config.username);
    setEditApiKey('');
    setEditUserKey('');
    setEditExistingGcid(config.credentials?.gcid ?? '');
    setEditMaskedApiKey(config.credentials?.apiKey ?? '');
    setEditMaskedUserKey(config.credentials?.userKey ?? '');
  };

  const handleSaveEdit = async () => {
    if (!editUsername) return;
    if (!editApiKey.trim() || !editUserKey.trim()) {
      toast.error('API Key and User Key are required');
      return;
    }

    setIsSavingEdit(true);
    try {
      const res = await fetch(
        `/api/portfolio-config/${encodeURIComponent(editUsername)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            credentials: {
              apiKey: editApiKey.trim(),
              userKey: editUserKey.trim(),
              gcid: editExistingGcid,
            },
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to update');
        return;
      }
      toast.success(`Updated credentials for ${editUsername}`);
      setEditUsername(null);
      await fetchConfigs();
    } catch {
      toast.error('Request failed');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // ── Delete handlers ──

  const openDelete = (username: string) => {
    setDeleteTarget(username);
    setDeleteStep(1);
  };

  const handleDeleteConfirmStep1 = () => {
    setDeleteStep(2);
  };

  const handleDeleteConfirmStep2 = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(
        `/api/portfolio-config/${encodeURIComponent(deleteTarget)}`,
        { method: 'DELETE' },
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to delete');
        return;
      }
      toast.success(`Removed ${deleteTarget}`);
      setDeleteTarget(null);
      await fetchConfigs();
    } catch {
      toast.error('Request failed');
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelDelete = () => {
    setDeleteTarget(null);
    setDeleteStep(1);
  };

  const handleFetchMissingGcids = async () => {
    setIsFetchingGcids(true);
    try {
      const res = await fetch('/api/portfolio-config/backfill-gcid', {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to fetch GCIDs');
        return;
      }
      if (data.updated === 0) {
        toast.success(data.message || 'All portfolios already have GCIDs');
      } else {
        toast.success(
          `Updated GCID for ${data.updated} portfolio(s): ${data.updatedPortfolios.join(', ')}`,
        );
      }
      if (data.errors?.length > 0) {
        toast.error(`Errors: ${data.errors.join('; ')}`);
      }
      await fetchConfigs();
    } catch {
      toast.error('Request failed');
    } finally {
      setIsFetchingGcids(false);
    }
  };

  const handleTestOne = async (username: string) => {
    setCredTestStatus((prev) => ({ ...prev, [username]: 'testing' }));
    try {
      const res = await fetch('/api/portfolio-config/test-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: [{ username }] }),
      });
      const data = await res.json();
      const result = data.results?.[0];
      if (result?.valid) {
        setCredTestStatus((prev) => ({ ...prev, [username]: 'pass' }));
      } else {
        setCredTestStatus((prev) => ({
          ...prev,
          [username]: result?.error || 'fail',
        }));
      }
    } catch {
      setCredTestStatus((prev) => ({ ...prev, [username]: 'fail' }));
    }
  };

  const handleTestAll = async () => {
    const withCreds = configs.filter((c) => c.hasCredentials);
    if (withCreds.length === 0) {
      toast.error('No portfolios with API keys to test');
      return;
    }

    setIsTestingAll(true);
    const testing: Record<string, string> = {};
    for (const c of withCreds) testing[c.username] = 'testing';
    setCredTestStatus((prev) => ({ ...prev, ...testing }));

    try {
      const res = await fetch('/api/portfolio-config/test-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: withCreds.map((c) => ({ username: c.username })),
        }),
      });
      const data = await res.json();
      const results: CredTestResult[] = data.results ?? [];

      const updated: Record<string, string> = {};
      let passed = 0;
      let failed = 0;
      for (const r of results) {
        if (r.valid) {
          updated[r.username] = 'pass';
          passed++;
        } else {
          updated[r.username] = r.error || 'fail';
          failed++;
        }
      }
      setCredTestStatus((prev) => ({ ...prev, ...updated }));

      if (failed === 0) {
        toast.success(`All ${passed} API key(s) are valid`);
      } else {
        toast.error(`${passed} valid, ${failed} failed`);
      }
    } catch {
      toast.error('Test request failed');
    } finally {
      setIsTestingAll(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Checkbox
            id="missing-only"
            checked={missingOnly}
            onCheckedChange={(v) => setMissingOnly(v === true)}
          />
          <Label htmlFor="missing-only" className="text-sm cursor-pointer">
            Show only portfolios missing API keys
          </Label>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleTestAll}
            disabled={isTestingAll}
          >
            {isTestingAll ? (
              <>
                <RefreshCw className="mr-1 h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <ShieldCheck className="mr-1 h-4 w-4" />
                Test All API Keys
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleFetchMissingGcids}
            disabled={isFetchingGcids}
          >
            {isFetchingGcids ? (
              <>
                <RefreshCw className="mr-1 h-4 w-4 animate-spin" />
                Fetching...
              </>
            ) : (
              'Fetch Missing GCIDs'
            )}
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        API key tests use a read-only GET request — no posts or changes will be
        made to your portfolios.
      </p>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            {missingOnly
              ? 'All portfolios have API keys configured.'
              : 'No portfolios configured yet.'}
          </p>
        )}
        {filtered.map((config) => (
          <div
            key={config.username}
            className="flex items-center justify-between gap-3 rounded-lg border p-3"
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{config.username}</p>
              <div className="flex gap-3 text-xs text-muted-foreground">
                <span>
                  {config.hasCredentials
                    ? `API: ${config.credentials?.apiKey}`
                    : 'No API key configured'}
                </span>
                {config.credentials?.gcid && (
                  <span>GCID: {config.credentials.gcid}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {credTestStatus[config.username] === 'testing' && (
                <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
              {credTestStatus[config.username] === 'pass' && (
                <Check className="h-4 w-4 text-green-600" />
              )}
              {credTestStatus[config.username] &&
                credTestStatus[config.username] !== 'testing' &&
                credTestStatus[config.username] !== 'pass' && (
                  <X className="h-4 w-4 text-red-600" />
                )}
              {config.hasCredentials && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleTestOne(config.username)}
                  disabled={credTestStatus[config.username] === 'testing'}
                >
                  <ShieldCheck className="h-4 w-4 mr-1" />
                  Test
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openEdit(config)}
              >
                <Pencil className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                onClick={() => openDelete(config.username)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Credentials Dialog */}
      <Dialog
        open={editUsername !== null}
        onOpenChange={(open) => !open && setEditUsername(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Credentials: {editUsername}</DialogTitle>
            <DialogDescription>
              Enter the new API credentials for this portfolio.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>API Key *</Label>
              {editMaskedApiKey && (
                <p className="text-xs text-muted-foreground mb-1">
                  Current: {editMaskedApiKey}
                </p>
              )}
              <Input
                value={editApiKey}
                onChange={(e) => setEditApiKey(e.target.value)}
                placeholder="Enter new API Key"
              />
            </div>
            <div>
              <Label>User Key *</Label>
              {editMaskedUserKey && (
                <p className="text-xs text-muted-foreground mb-1">
                  Current: {editMaskedUserKey}
                </p>
              )}
              <Input
                value={editUserKey}
                onChange={(e) => setEditUserKey(e.target.value)}
                placeholder="Enter new User Key"
              />
            </div>
            <div>
              <Label className="text-muted-foreground">GCID</Label>
              <p className="text-sm mt-1">
                {editExistingGcid || '—'}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUsername(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSavingEdit}>
              {isSavingEdit ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation — Step 1 */}
      <Dialog
        open={deleteTarget !== null && deleteStep === 1}
        onOpenChange={(open) => !open && cancelDelete()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this portfolio?
            </DialogDescription>
          </DialogHeader>
          <div className="py-3">
            <p className="font-medium text-center text-lg">{deleteTarget}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={cancelDelete}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirmStep1}>
              Yes, Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation — Step 2 (Final) */}
      <Dialog
        open={deleteTarget !== null && deleteStep === 2}
        onOpenChange={(open) => !open && cancelDelete()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">
              Final Confirmation
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. You are about to permanently
              remove this portfolio and its credentials.
            </DialogDescription>
          </DialogHeader>
          <div className="py-3 text-center">
            <p className="font-bold text-lg">{deleteTarget}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Please confirm one final time.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={cancelDelete}>
              Go Back
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirmStep2}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Confirm Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ManagePortfoliosPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <Link
              href="/e-poster"
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to Dashboard
            </Link>
          </div>

          <div className="mb-8">
            <h1 className="text-3xl font-bold">Manage Portfolios</h1>
            <p className="text-muted-foreground mt-1">
              Add new portfolios, manage API keys, and remove existing ones.
            </p>
          </div>

          <Tabs defaultValue="add">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="add">Add Portfolios</TabsTrigger>
              <TabsTrigger value="manage">Manage API Keys</TabsTrigger>
            </TabsList>

            <TabsContent value="add" className="mt-6">
              <AddPortfoliosTab />
            </TabsContent>

            <TabsContent value="manage" className="mt-6">
              <ManageApiKeysTab />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
