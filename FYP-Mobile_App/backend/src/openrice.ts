/**
 * OpenRice Integration API
 * 
 * This module provides endpoints to enrich Hong Kong restaurant data
 * with OpenRice information (images, ratings, reviews).
 */

import { Router, Request, Response } from 'express';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const router = Router();

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// FastAPI Backend URL (Python Playwright scraper)
const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';

// Note: Caching is now handled by FastAPI backend (7 days, file-based)
// This Node.js backend simply proxies requests to FastAPI

interface OpenRiceImage {
  url: string;
  alt?: string;
  is_main?: boolean;
}

interface OpenRiceData {
  query: string;
  matched: boolean;
  confidence?: number;
  name?: string;
  url?: string; // For backward compatibility
  openrice_id?: string;
  openrice_url?: string;
  district?: string;
  cuisine_types?: string[];
  price_range?: string;
  reviews?: {
    rating?: number;
    review_count?: number;
    smile_count?: number;
    cry_count?: number;
  };
  review_texts?: string[]; // NEW: User review texts from OpenRice
  images?: string[]; // Array of image URLs
  scraped_at?: string;
}

/**
 * Call FastAPI backend to scrape OpenRice data
 * FastAPI handles caching (7 days), Playwright scraping, and all the heavy lifting
 */
async function fetchFromFastAPI(restaurantName: string): Promise<OpenRiceData | null> {
  console.log('\n' + '='.repeat(70));
  console.log('🍽️  [OpenRice] Fetching from FastAPI backend');
  console.log('='.repeat(70));
  console.log(`📝 Restaurant: "${restaurantName}"`);
  console.log(`🔗 FastAPI URL: ${FASTAPI_URL}`);
  
  try {
    const apiUrl = `${FASTAPI_URL}/api/openrice/search/${encodeURIComponent(restaurantName)}`;
    console.log(`📡 Calling: ${apiUrl}`);
    
    const startTime = Date.now();
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`⏱️  Request completed in ${duration}s`);
    
    if (!response.ok) {
      console.error(`❌ FastAPI returned ${response.status}: ${response.statusText}`);
      const errorText = await response.text();
      console.error(`Error body: ${errorText}`);
      return null;
    }
    
    const result = await response.json();
    console.log(`✅ Success: ${result.success}`);
    console.log(`💾 Cache hit: ${result.cache_hit}`);
    
    if (!result.success || !result.data) {
      console.error('❌ No data in FastAPI response');
      return null;
    }
    
    const data = result.data;
    console.log(`📊 Matched: ${data.matched ? '✅ YES' : '❌ NO'}`);
    console.log(`📸 Images: ${data.images?.length || 0}`);
    console.log(`💬 Reviews: ${data.review_texts?.length || 0}`);
    console.log('='.repeat(70) + '\n');
    
    return data;
    
  } catch (error: any) {
    console.error('\n❌ [OpenRice] FastAPI call failed!');
    console.error('─'.repeat(70));
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('─'.repeat(70));
    console.error('\n💡 Make sure FastAPI is running:');
    console.error('   cd Restaurant');
    console.error('   python -m uvicorn api:app --reload');
    console.error('='.repeat(70) + '\n');
    return null;
  }
}

/**
 * GET /api/openrice/search/:name
 * 
 * Search for a restaurant on OpenRice - Proxies to FastAPI backend
 */
router.get('/search/:name', async (req: Request, res: Response) => {
  console.log('\n' + '🌐'.repeat(35));
  console.log('📥 [API] Received OpenRice search request');
  console.log('🌐'.repeat(35));
  console.log('Timestamp:', new Date().toISOString());
  console.log('IP:', req.ip);
  
  try {
    const restaurantName = decodeURIComponent(req.params.name);
    console.log(`📝 Restaurant name: "${restaurantName}"`);
    
    if (!restaurantName || restaurantName.trim().length === 0) {
      console.error('❌ Empty restaurant name provided');
      return res.status(400).json({
        success: false,
        error: 'Restaurant name is required',
      });
    }
    
    // Call FastAPI backend
    console.log('🚀 Calling FastAPI backend...\n');
    const data = await fetchFromFastAPI(restaurantName);
    
    if (!data) {
      console.error('❌ FastAPI returned no data');
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch OpenRice data. Make sure FastAPI is running.',
      });
    }
    
    const response = {
      success: true,
      data,
    };
    
    console.log('\n✅ [API] Sending successful response');
    console.log('🌐'.repeat(35) + '\n');
    
    return res.json(response);
    
  } catch (error: any) {
    console.error('\n❌ [OpenRice API] Unhandled error!');
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    console.error('🌐'.repeat(35) + '\n');
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

/**
 * POST /api/openrice/batch
 * 
 * Batch search for multiple restaurants - Proxies to FastAPI
 * Body: { restaurants: string[] }
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { restaurants } = req.body;
    
    if (!Array.isArray(restaurants) || restaurants.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'restaurants array is required',
      });
    }
    
    console.log(`📦 Batch search: ${restaurants.length} restaurants`);
    
    // Call FastAPI batch endpoint
    const apiUrl = `${FASTAPI_URL}/api/openrice/batch`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        restaurants,
        get_details: true,
      }),
    });
    
    if (!response.ok) {
      console.error(`❌ FastAPI batch failed: ${response.status}`);
      return res.status(500).json({
        success: false,
        error: 'FastAPI batch request failed',
      });
    }
    
    const result = await response.json();
    return res.json(result);
    
  } catch (error: any) {
    console.error('[OpenRice API] Batch error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

export default router;
