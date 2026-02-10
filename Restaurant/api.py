"""
FastAPI Backend for OpenRice Restaurant Scraper
Provides REST API endpoints for the mobile app to scrape OpenRice data
"""

import sys
import asyncio

# Fix for Windows: Set event loop policy before anything else
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import logging
import time
from datetime import datetime

# Import the scraper
from openrice_playwright import OpenRicePlaywrightScraper, OpenRiceRestaurant, Config

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="OpenRice Scraper API",
    description="Fast restaurant data scraping from OpenRice Hong Kong",
    version="1.0.0"
)

# CORS configuration - Allow your mobile app backend to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4000",
        "http://localhost:5173",
        "http://192.168.68.112:4000",  # Your backend IP
        "http://192.168.68.112:5173",  # Your frontend IP
        "*"  # For development - restrict in production
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request/Response Models
class SearchRequest(BaseModel):
    """Request model for restaurant search"""
    query: str
    get_details: bool = True

class BatchSearchRequest(BaseModel):
    """Request model for batch restaurant search"""
    restaurants: List[str]
    get_details: bool = True

class ImageData(BaseModel):
    """Image data model"""
    url: str
    alt: Optional[str] = None
    is_main: bool = False

class ReviewData(BaseModel):
    """Review metrics model"""
    rating: Optional[float] = None
    review_count: Optional[int] = None
    smile_count: Optional[int] = None
    cry_count: Optional[int] = None

class RestaurantResponse(BaseModel):
    """Response model for restaurant data - Compatible with frontend"""
    query: str
    matched: bool
    confidence: Optional[float] = None
    name: Optional[str] = None
    url: Optional[str] = None  # For backward compatibility
    openrice_url: Optional[str] = None
    openrice_id: Optional[str] = None
    district: Optional[str] = None
    cuisine_types: Optional[List[str]] = None
    price_range: Optional[str] = None
    reviews: Optional[ReviewData] = None
    review_texts: Optional[List[str]] = None
    images: Optional[List[str]] = None  # Simple array for frontend compatibility
    images_detailed: Optional[List[ImageData]] = None  # Detailed version if needed
    scraped_at: Optional[str] = None

class SearchResponse(BaseModel):
    """API response wrapper"""
    success: bool
    data: Optional[RestaurantResponse] = None
    error: Optional[str] = None
    cache_hit: bool = False
    scrape_time_seconds: Optional[float] = None

class BatchSearchResponse(BaseModel):
    """Batch search response"""
    success: bool
    results: List[Dict[str, Any]]
    processed: int
    total_time_seconds: float

# Health check endpoint
@app.get("/", tags=["Health"])
async def root():
    """Root endpoint - API health check"""
    return {
        "status": "healthy",
        "service": "OpenRice Scraper API",
        "version": "1.0.0",
        "cache_duration_hours": Config.CACHE_DURATION_HOURS,
        "message": "API is running. Use /docs for API documentation."
    }

@app.get("/health", tags=["Health"])
async def health_check():
    """Detailed health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "config": {
            "cache_duration_hours": Config.CACHE_DURATION_HOURS,
            "page_timeout_ms": Config.PAGE_TIMEOUT,
            "max_retries": Config.MAX_RETRIES
        }
    }

# Main search endpoint - Compatible with existing Node.js backend
@app.get("/api/openrice/search/{restaurant_name}", 
         response_model=SearchResponse,
         tags=["Search"])
async def search_restaurant(
    restaurant_name: str,
    get_details: bool = Query(True, description="Whether to scrape reviews and images")
):
    """
    Search for a restaurant on OpenRice
    
    - **restaurant_name**: Name of the restaurant to search for
    - **get_details**: Whether to scrape reviews and images (default: true)
    
    Returns restaurant data including:
    - Name, district, cuisine types, price range
    - Reviews (rating, count, sentiment)
    - Review texts (up to 5)
    - Images (up to 3)
    
    **Performance:** 
    - First search: ~15-20 seconds (scraping)
    - Cached: <100ms (instant!)
    """
    logger.info(f"🔍 Search request: '{restaurant_name}' (get_details={get_details})")
    
    start_time = time.time()
    cache_hit = False
    
    try:
        # OPTIMIZATION: Check cache BEFORE launching browser (saves 10-15s!)
        def check_cache():
            from openrice_playwright import CacheManager, OpenRiceRestaurant, OpenRiceReview, OpenRiceImage
            cache_manager = CacheManager()
            cached = cache_manager.get(restaurant_name)
            if cached:
                # Convert nested dicts back to dataclass instances
                if cached.get('reviews') and isinstance(cached['reviews'], dict):
                    cached['reviews'] = OpenRiceReview(**cached['reviews'])
                if cached.get('images'):
                    cached['images'] = [
                        OpenRiceImage(**img) if isinstance(img, dict) else img
                        for img in cached['images']
                    ]
                return OpenRiceRestaurant(**cached)
            return None
        
        # Check cache first (no browser needed!)
        result = await asyncio.to_thread(check_cache)
        
        if result:
            cache_hit = True
            logger.info(f"✅ Cache HIT - Skipping browser launch!")
        else:
            cache_hit = False
            logger.info(f"❌ Cache MISS - Launching browser...")
            
            # Helper function to run sync scraper in thread
            def run_scraper():
                with OpenRicePlaywrightScraper(use_cache=True) as scraper:
                    # Search restaurant
                    return scraper.search_restaurant(restaurant_name, get_details=get_details)
            
            # Run synchronous scraper in thread pool to avoid event loop conflict
            result = await asyncio.to_thread(run_scraper)
        
        if not result:
            raise HTTPException(
                status_code=500,
                detail="Scraper returned no results"
            )
        
        scrape_time = time.time() - start_time
        logger.info(f"⏱️  Completed in {scrape_time:.2f}s")
        
        # Convert to frontend-compatible format
        response_data = RestaurantResponse(
                query=result.query,
                matched=result.matched,
                confidence=result.confidence,
                name=result.name,
                url=result.openrice_url,  # Set 'url' for backward compatibility
                openrice_url=result.openrice_url,
                openrice_id=result.openrice_id,
                district=result.district,
                cuisine_types=result.cuisine_types,
                price_range=result.price_range,
                reviews=ReviewData(**result.reviews.__dict__) if result.reviews else None,
                review_texts=result.review_texts,
                # Convert images to simple array of URLs for frontend
                images=[img.url for img in result.images] if result.images else None,
                images_detailed=[ImageData(**img.__dict__) for img in result.images] if result.images else None,
                scraped_at=datetime.now().isoformat()
            )
        
        return SearchResponse(
            success=True,
            data=response_data,
            cache_hit=cache_hit,
            scrape_time_seconds=round(scrape_time, 2)
        )
        
    except Exception as e:
        logger.error(f"❌ Search failed: {str(e)}", exc_info=True)
        scrape_time = time.time() - start_time
        
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": str(e),
                "scrape_time_seconds": round(scrape_time, 2)
            }
        )

# Batch search endpoint
@app.post("/api/openrice/batch",
          response_model=BatchSearchResponse,
          tags=["Search"])
async def batch_search(request: BatchSearchRequest):
    """
    Batch search for multiple restaurants
    
    - **restaurants**: List of restaurant names to search
    - **get_details**: Whether to scrape reviews and images for each
    
    Maximum 10 restaurants per batch. Results include cache status for each.
    """
    logger.info(f"📦 Batch search: {len(request.restaurants)} restaurants")
    
    # Limit batch size
    max_batch = 10
    restaurants = request.restaurants[:max_batch]
    
    start_time = time.time()
    results = []
    
    try:
        # Helper function to run batch scraper in thread
        def run_batch_scraper():
            with OpenRicePlaywrightScraper(use_cache=True) as scraper:
                batch_results = []
                for i, restaurant_name in enumerate(restaurants, 1):
                    logger.info(f"[{i}/{len(restaurants)}] Searching: {restaurant_name}")
                    
                    try:
                        result = scraper.search_restaurant(
                            restaurant_name, 
                            get_details=request.get_details
                        )
                        batch_results.append((result, None))
                    except Exception as e:
                        logger.error(f"Error searching {restaurant_name}: {e}")
                        batch_results.append((None, str(e)))
                return batch_results
        
        # Run in thread pool
        batch_results = await asyncio.to_thread(run_batch_scraper)
        
        for result, error in batch_results:
            if result:
                response_data = {
                    "query": result.query,
                    "matched": result.matched,
                    "confidence": result.confidence,
                    "name": result.name,
                    "url": result.openrice_url,
                    "images": [img.url for img in result.images] if result.images else [],
                    "reviews": result.reviews.__dict__ if result.reviews else None,
                }
                results.append({
                    "query": result.query,
                    "success": True,
                    "data": response_data
                })
            else:
                results.append({
                    "query": "unknown",
                    "success": False,
                    "error": error or "No results found"
                })
        
        total_time = time.time() - start_time
        logger.info(f"✅ Batch completed: {len(results)} restaurants in {total_time:.2f}s")
        
        return BatchSearchResponse(
            success=True,
            results=results,
            processed=len(results),
            total_time_seconds=round(total_time, 2)
        )
        
    except Exception as e:
        logger.error(f"❌ Batch search failed: {e}", exc_info=True)
        total_time = time.time() - start_time
        
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": str(e),
                "results": results,
                "processed": len(results),
                "total_time_seconds": round(total_time, 2)
            }
        )

# Cache management endpoints
@app.get("/api/cache/stats", tags=["Cache"])
async def cache_stats():
    """Get cache statistics"""
    try:
        # Helper function to get cache stats
        def get_stats():
            with OpenRicePlaywrightScraper(use_cache=True) as scraper:
                if not scraper.cache:
                    return {"cache_enabled": False}
                
                # Count cache files
                import os
                cache_dir = scraper.cache.cache_dir
                cache_files = []
                
                if os.path.exists(cache_dir):
                    cache_files = [f for f in os.listdir(cache_dir) if f.endswith('.json')]
                
                return (cache_dir, cache_files)
        
        # Run in thread pool
        result = await asyncio.to_thread(get_stats)
        if isinstance(result, dict):  # Cache not enabled
            return result
        
        cache_dir, cache_files = result
        
        return {
            "cache_enabled": True,
            "cache_directory": str(cache_dir),
            "cached_restaurants": len(cache_files),
            "cache_duration_hours": Config.CACHE_DURATION_HOURS,
            "files": cache_files[:20]  # Show first 20
        }
    except Exception as e:
        logger.error(f"Error getting cache stats: {e}")
        return {"error": str(e)}

@app.delete("/api/cache/clear", tags=["Cache"])
async def clear_cache():
    """Clear all cached data"""
    try:
        # Helper function to clear cache
        def do_clear_cache():
            with OpenRicePlaywrightScraper(use_cache=True) as scraper:
                if not scraper.cache:
                    return {"success": False, "message": "Cache not enabled"}
                
                # Delete all cache files
                import os
                import shutil
                cache_dir = scraper.cache.cache_dir
                
                if os.path.exists(cache_dir):
                    shutil.rmtree(cache_dir)
                    os.makedirs(cache_dir, exist_ok=True)
                    logger.info("🗑️  Cache cleared")
                    return {"success": True, "message": "Cache cleared successfully"}
                else:
                    return {"success": True, "message": "Cache directory does not exist"}
        
        # Run in thread pool
        return await asyncio.to_thread(do_clear_cache)
                
    except Exception as e:
        logger.error(f"Error clearing cache: {e}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )

# Run with: uvicorn api:app --host 0.0.0.0 --port 8000 --reload
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "api:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
