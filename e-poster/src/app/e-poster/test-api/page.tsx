'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function TestAPIPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [testType, setTestType] = useState<'portfolios' | 'post' | 'instruments'>('portfolios');
  
  const [postData, setPostData] = useState({
    owner: '',
    message: 'Test post from e-poster application',
    tags: [] as Array<{ id: string; name: string }>,
  });

  const testPortfolios = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const response = await fetch('/api/portfolios');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch portfolios');
      }
      
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const testCreatePost = async () => {
    if (!postData.owner || !postData.message) {
      setError('Owner ID and message are required');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const response = await fetch('/api/posts/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-debug': 'true',
        },
        body: JSON.stringify({
          owner: parseInt(postData.owner),
          message: postData.message,
          tags: postData.tags,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to create post');
      }
      
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const testInstruments = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      // Test fetching instruments by IDs
      const testIds = [1001, 1003, 1005]; // AAPL, META, AMZN
      const response = await fetch(`/api/instruments?ids=${testIds.join(',')}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch instruments');
      }
      
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleTest = () => {
    switch (testType) {
      case 'portfolios':
        testPortfolios();
        break;
      case 'post':
        testCreatePost();
        break;
      case 'instruments':
        testInstruments();
        break;
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>eToro API Test Page</CardTitle>
          <CardDescription>
            Test various eToro API endpoints to verify connectivity and authentication
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Test Type Selection */}
          <div className="space-y-2">
            <Label>Test Type</Label>
            <div className="flex gap-2">
              <Button
                variant={testType === 'portfolios' ? 'default' : 'outline'}
                onClick={() => setTestType('portfolios')}
              >
                Test Portfolios
              </Button>
              <Button
                variant={testType === 'post' ? 'default' : 'outline'}
                onClick={() => setTestType('post')}
              >
                Test Create Post
              </Button>
              <Button
                variant={testType === 'instruments' ? 'default' : 'outline'}
                onClick={() => setTestType('instruments')}
              >
                Test Instruments
              </Button>
            </div>
          </div>

          {/* Post Data Input */}
          {testType === 'post' && (
            <div className="space-y-4 p-4 border rounded-lg">
              <div className="space-y-2">
                <Label htmlFor="owner">Owner ID (User ID)</Label>
                <Input
                  id="owner"
                  type="number"
                  value={postData.owner}
                  onChange={(e) => setPostData({ ...postData, owner: e.target.value })}
                  placeholder="Enter user ID"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  value={postData.message}
                  onChange={(e) => setPostData({ ...postData, message: e.target.value })}
                  placeholder="Enter post message"
                  rows={4}
                />
              </div>
            </div>
          )}

          {/* Test Button */}
          <Button onClick={handleTest} disabled={loading} className="w-full">
            {loading ? 'Testing...' : `Test ${testType.charAt(0).toUpperCase() + testType.slice(1)} API`}
          </Button>

          {/* Error Display */}
          {error && (
            <Card className="border-red-500 bg-red-50">
              <CardHeader>
                <CardTitle className="text-red-700">Error</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-sm text-red-600 whitespace-pre-wrap">{error}</pre>
              </CardContent>
            </Card>
          )}

          {/* Result Display */}
          {result && (
            <Card className="border-green-500 bg-green-50">
              <CardHeader>
                <CardTitle className="text-green-700">Success</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-sm text-green-800 whitespace-pre-wrap overflow-auto max-h-96">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}

          {/* Instructions */}
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle className="text-blue-700 text-sm">Instructions</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-blue-600 space-y-2">
              {testType === 'portfolios' && (
                <ul className="list-disc list-inside space-y-1">
                  <li>Tests fetching smart portfolio accounts</li>
                  <li>Requires ETORO_API_KEY and ETORO_USER_KEY in .env.local</li>
                  <li>Endpoint: GET /api/portfolios</li>
                </ul>
              )}
              {testType === 'post' && (
                <ul className="list-disc list-inside space-y-1">
                  <li>Tests creating a post on eToro feed</li>
                  <li>Requires valid Owner ID (user ID of the account to post as)</li>
                  <li>Endpoint: POST /api/posts/create</li>
                  <li>Check browser console for debug output</li>
                </ul>
              )}
              {testType === 'instruments' && (
                <ul className="list-disc list-inside space-y-1">
                  <li>Tests fetching instrument details by IDs</li>
                  <li>Tests with AAPL (1001), META (1003), AMZN (1005)</li>
                  <li>Endpoint: GET /api/instruments</li>
                </ul>
              )}
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}

