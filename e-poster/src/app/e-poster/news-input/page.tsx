/**
 * News Input Page
 */

'use client';

import { NewsInputForm } from '@/components/news-input/NewsInputForm';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NewsInputPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Link href="/e-poster/create">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Create a post
            </Button>
          </Link>

          <NewsInputForm />
        </div>
      </div>
    </div>
  );
}

