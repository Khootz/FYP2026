"""
OpenRice Playwright Scraper
============================
Uses Playwright to scrape OpenRice Hong Kong with JavaScript execution.
Faster than Selenium, maintains same logic as original scraper.

Installation:
    pip install playwright beautifulsoup4
    playwright install chromium

Usage:
    python openrice_playwright.py "Restaurant Name"
    
Or import:
    from openrice_playwright import OpenRicePlaywrightScraper
    scraper = OpenRicePlaywrightScraper()
    result = scraper.search_restaurant("Tai Cheong Bakery")
"""

import json
import time
import random
import re
import hashlib
from pathlib import Path
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from typing import Optional, List, Dict, Any
from urllib.parse import quote_plus
from bs4 import BeautifulSoup

# Playwright imports
from playwright.sync_api import sync_playwright, Browser, Page, TimeoutError as PlaywrightTimeout


# =============================================================================
# CONFIGURATION
# =============================================================================

class Config:
    """Scraper configuration"""
    CACHE_DIR = Path("./cache/openrice")
    CACHE_DURATION_HOURS = 24 * 7  # 7 days for better cache hit rate
    REQUEST_DELAY_MIN = 0.5  # Reduced since Playwright is faster
    REQUEST_DELAY_MAX = 1.0
    MAX_RETRIES = 2
    PAGE_TIMEOUT = 15000  # 15 seconds (reduced from 20s)
    HEADLESS = True  # Run browser in background


# =============================================================================
# DATA MODELS
# =============================================================================

@dataclass
class OpenRiceImage:
    """Restaurant image from OpenRice"""
    url: str
    alt: Optional[str] = None
    is_main: bool = False


@dataclass
class OpenRiceReview:
    """Review summary from OpenRice"""
    rating: Optional[float] = None
    review_count: Optional[int] = None
    smile_count: Optional[int] = None
    cry_count: Optional[int] = None


@dataclass
class OpenRiceRestaurant:
    """Restaurant data scraped from OpenRice"""
    # Search match info
    query: str
    matched: bool
    confidence: float  # 0-1 how confident the match is
    
    # Basic info
    name: Optional[str] = None
    openrice_id: Optional[str] = None
    openrice_url: Optional[str] = None
    
    # Location
    address: Optional[str] = None
    district: Optional[str] = None
    
    # Details
    cuisine_types: List[str] = None
    price_range: Optional[str] = None
    phone: Optional[str] = None
    
    # Reviews
    reviews: Optional[OpenRiceReview] = None
    review_texts: List[str] = None  # User review excerpts
    
    # Images
    images: List[OpenRiceImage] = None
    main_image: Optional[str] = None
    
    # Meta
    scraped_at: Optional[str] = None
    
    def __post_init__(self):
        if self.cuisine_types is None:
            self.cuisine_types = []
        if self.images is None:
            self.images = []
        if self.review_texts is None:
            self.review_texts = []
        if self.scraped_at is None:
            self.scraped_at = datetime.now().isoformat()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        data = asdict(self)
        if self.reviews:
            data['reviews'] = asdict(self.reviews)
        if self.images:
            data['images'] = [asdict(img) for img in self.images]
        return data
    
    def to_json(self) -> str:
        """Convert to JSON string"""
        return json.dumps(self.to_dict(), indent=2, ensure_ascii=False)


# =============================================================================
# CACHE MANAGER
# =============================================================================

class CacheManager:
    """File-based caching for scraped data"""
    
    def __init__(self):
        Config.CACHE_DIR.mkdir(parents=True, exist_ok=True)
    
    def _get_cache_key(self, query: str) -> str:
        """Generate cache key from query"""
        normalized = query.lower().strip()
        return hashlib.md5(normalized.encode()).hexdigest()
    
    def get(self, query: str) -> Optional[Dict]:
        """Retrieve cached result if valid"""
        cache_key = self._get_cache_key(query)
        cache_file = Config.CACHE_DIR / f"{cache_key}.json"
        
        if cache_file.exists():
            try:
                with open(cache_file, 'r', encoding='utf-8') as f:
                    cached = json.load(f)
                
                cached_time = datetime.fromisoformat(cached.get('cached_at', '2000-01-01'))
                if datetime.now() - cached_time < timedelta(hours=Config.CACHE_DURATION_HOURS):
                    print(f"[Cache] Using cached result for '{query}'")
                    return cached.get('data')
            except (json.JSONDecodeError, KeyError, ValueError):
                pass
        
        return None
    
    def set(self, query: str, data: Dict):
        """Cache the result"""
        cache_key = self._get_cache_key(query)
        cache_file = Config.CACHE_DIR / f"{cache_key}.json"
        
        cache_data = {
            'cached_at': datetime.now().isoformat(),
            'query': query,
            'data': data
        }
        
        with open(cache_file, 'w', encoding='utf-8') as f:
            json.dump(cache_data, f, ensure_ascii=False, indent=2)
    
    def clear(self):
        """Clear all cached data"""
        for cache_file in Config.CACHE_DIR.glob("*.json"):
            cache_file.unlink()
        print("Cache cleared")


# =============================================================================
# OPENRICE PLAYWRIGHT SCRAPER
# =============================================================================

class OpenRicePlaywrightScraper:
    """
    Playwright-based scraper for OpenRice Hong Kong restaurant data.
    Handles JavaScript execution automatically, faster than Selenium.
    
    Usage:
        scraper = OpenRicePlaywrightScraper()
        result = scraper.search_restaurant("Restaurant Name")
        print(result.to_json())
        scraper.close()  # Important: close browser when done
        
    Or use context manager:
        with OpenRicePlaywrightScraper() as scraper:
            result = scraper.search_restaurant("Restaurant Name")
    """
    
    BASE_URL = "https://www.openrice.com"
    SEARCH_URL = f"{BASE_URL}/en/hongkong/restaurants"
    
    def __init__(self, use_cache: bool = True, headless: bool = True):
        """
        Initialize the scraper.
        
        Args:
            use_cache: Enable caching to speed up repeated searches
            headless: Run browser in headless mode (no GUI)
        """
        self.cache = CacheManager() if use_cache else None
        self.headless = headless
        
        # Initialize Playwright
        print(f"[Init] Starting Playwright browser (headless={headless})...")
        self.playwright = sync_playwright().start()
        self.browser = self.playwright.chromium.launch(headless=headless)
        self.context = self.browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            )
        )
        self.page = self.context.new_page()
        self.page.set_default_timeout(Config.PAGE_TIMEOUT)
        print("[Init] Browser ready")
    
    def __enter__(self):
        """Context manager entry"""
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit"""
        self.close()
    
    def close(self):
        """Close browser and cleanup"""
        if hasattr(self, 'page') and self.page:
            self.page.close()
        if hasattr(self, 'context') and self.context:
            self.context.close()
        if hasattr(self, 'browser') and self.browser:
            self.browser.close()
        if hasattr(self, 'playwright') and self.playwright:
            self.playwright.stop()
        print("[Cleanup] Browser closed")
    
    def _delay(self):
        """Add random delay between requests"""
        delay = random.uniform(Config.REQUEST_DELAY_MIN, Config.REQUEST_DELAY_MAX)
        time.sleep(delay)
    
    def _get_page_content(self, url: str, retries: int = Config.MAX_RETRIES) -> Optional[BeautifulSoup]:
        """
        Navigate to URL and get page content after JavaScript execution.
        
        Args:
            url: URL to navigate to
            retries: Number of retry attempts
            
        Returns:
            BeautifulSoup object with parsed HTML, or None if failed
        """
        for attempt in range(1, retries + 1):
            try:
                print(f"[Request] Loading: {url}")
                
                # Navigate to page
                self.page.goto(url, wait_until="domcontentloaded")
                
                # Wait for the anti-bot challenge to complete
                # Look for actual content to appear
                try:
                    # Wait for restaurant list or details to load
                    self.page.wait_for_selector(
                        "div.poi-list-cell, div.restaurant-detail, section.address-section",
                        timeout=5000  # Reduced timeout for faster failure
                    )
                except PlaywrightTimeout:
                    # If specific selectors don't appear, wait a bit for JS to execute
                    self.page.wait_for_timeout(1000)  # Reduced from 2000ms
                
                # Get page HTML after JavaScript execution
                html = self.page.content()
                
                # Parse with BeautifulSoup
                soup = BeautifulSoup(html, 'html.parser')
                
                print(f"[Request] Page loaded successfully")
                return soup
                
            except PlaywrightTimeout as e:
                print(f"[Request] Timeout on attempt {attempt}/{retries}: {e}")
                if attempt < retries:
                    time.sleep(2)
                else:
                    return None
            except Exception as e:
                print(f"[Request] Attempt {attempt}/{retries} failed: {e}")
                if attempt < retries:
                    time.sleep(2)
                else:
                    return None
        
        return None
    
    def _calculate_match_confidence(self, query: str, found_name: str) -> float:
        """Calculate how confident we are that this is the right restaurant"""
        query_lower = query.lower().strip()
        found_lower = found_name.lower().strip()
        
        # Exact match
        if query_lower == found_lower:
            return 1.0
        
        # Query is contained in found name
        if query_lower in found_lower:
            return 0.9
        
        # Found name is contained in query
        if found_lower in query_lower:
            return 0.85
        
        # Word overlap
        query_words = set(query_lower.split())
        found_words = set(found_lower.split())
        overlap = len(query_words & found_words)
        total = len(query_words | found_words)
        
        if total > 0:
            return 0.5 + (0.4 * overlap / total)
        
        return 0.3
    
    def _parse_search_result(self, item: BeautifulSoup) -> Optional[Dict]:
        """Parse a single search result item"""
        try:
            # Get restaurant name (try multiple selectors)
            name_el = item.select_one("div.poi-name") or item.select_one("[class*='poi-name']")
            
            if not name_el:
                return None
            
            name = name_el.get_text(strip=True)
            
            # Get restaurant link (find the main restaurant page, not /photos)
            # Look for links with /r- but exclude /photos links
            all_links = item.find_all("a", href=lambda x: x and '/r-' in x)
            link_el = None
            for link in all_links:
                href = link.get('href', '')
                # Skip /photos links, we want the main restaurant page
                if '/photos' not in href and '/reviews' not in href:
                    link_el = link
                    break
            
            # If no non-photos link found, just remove /photos from URL
            if not link_el and all_links:
                link_el = all_links[0]
            
            if not link_el:
                return None
            
            href = link_el.get('href', '')
            # Clean up URL - remove /photos or /reviews
            href = href.split('/photos')[0].split('/reviews')[0]
            url = f"{self.BASE_URL}{href}" if href.startswith('/') else href
            
            # Extract OpenRice ID from URL
            openrice_id = None
            if '/r-' in href:
                match = re.search(r'/r-([^/]+)', href)
                if match:
                    openrice_id = match.group(1)
            
            # Get district
            district_el = item.select_one("div.poi-addr")
            district = district_el.get_text(strip=True) if district_el else None
            
            # Get cuisine types
            cuisine_el = item.select_one("div.poi-cuisine-short")
            cuisines = []
            if cuisine_el:
                cuisines = [c.strip() for c in cuisine_el.get_text().split('|') if c.strip()]
            
            # Get price range
            price_el = item.select_one("div.poi-price")
            price = price_el.get_text(strip=True) if price_el else None
            
            # Get rating/smile count
            smile_el = item.select_one("span.smile-face")
            smile_count = None
            if smile_el:
                smile_text = smile_el.get_text(strip=True)
                try:
                    smile_count = int(re.sub(r'\D', '', smile_text))
                except ValueError:
                    pass
            
            # Get main image
            img_el = item.select_one("img.poi-list-cell-img")
            main_image = None
            if img_el:
                main_image = img_el.get('src') or img_el.get('data-src')
            
            return {
                'name': name,
                'openrice_id': openrice_id,
                'openrice_url': url,
                'district': district,
                'cuisine_types': cuisines,
                'price_range': price,
                'smile_count': smile_count,
                'main_image': main_image,
            }
        except Exception as e:
            print(f"[Parse] Error parsing search result: {e}")
            return None
    
    def _scrape_reviews(self, soup: BeautifulSoup) -> List[str]:
        """
        Scrape user review texts from the restaurant detail page.
        Extracts text from review-post-extract class within review boxes.
        """
        review_texts = []
        
        try:
            # Find all review boxes
            review_boxes = soup.select("div.review-post-trim-desktop.poi-detail-review-trim")
            
            print(f"[Reviews] Found {len(review_boxes)} review boxes")
            
            for idx, box in enumerate(review_boxes):
                # Extract review text from the review-post-extract class
                review_extract = box.select_one("div.review-post-extract")
                
                if review_extract:
                    review_text = review_extract.get_text(strip=True)
                    
                    if review_text:
                        review_texts.append(review_text)
                        print(f"[Reviews] Review {idx + 1}: {review_text[:80]}...")
            
            if not review_texts:
                print("[Reviews] No review texts found")
            else:
                print(f"[Reviews] Successfully extracted {len(review_texts)} reviews")
                
        except Exception as e:
            print(f"[Reviews] Error scraping reviews: {e}")
        
        return review_texts
    
    def _scrape_photos_page(self, base_url: str) -> List[OpenRiceImage]:
        """
        Scrape images from the /photos/all page.
        Gets the first 3 images from media-item-thumbnail-media class.
        """
        images = []
        
        # Build photos URL
        photos_url = base_url.rstrip('/') + '/photos/all'
        print(f"[Photos] Scraping images from: {photos_url}")
        
        self._delay()
        soup = self._get_page_content(photos_url)
        if not soup:
            return images
        
        try:
            # Find all media items with the specific class
            media_items = soup.select("div.media-item-thumbnail-media")
            
            print(f"[Photos] Found {len(media_items)} media items")
            
            for idx, item in enumerate(media_items):
                # Look for img tag inside
                img_tag = item.select_one("img.media-item-thumbnail-image")
                if img_tag:
                    src = img_tag.get('src')
                    if src and src.startswith('http'):
                        images.append(OpenRiceImage(
                            url=src,
                            alt=img_tag.get('alt', ''),
                            is_main=(idx == 0)  # First image is main
                        ))
                        
                        print(f"[Photos] Image {idx + 1}: {src[:80]}...")
                        
                        # Only get first 3 images as per user requirement
                        if len(images) >= 3:
                            break
            
            if not images:
                print("[Photos] No images found on photos page")
            else:
                print(f"[Photos] Successfully extracted {len(images)} images")
                
        except Exception as e:
            print(f"[Photos] Error scraping photos page: {e}")
        
        return images
    
    def _scrape_detail_page(self, url: str) -> Dict:
        """Scrape additional details from restaurant detail page"""
        details = {
            'address': None,
            'phone': None,
            'images': [],
            'rating': None,
            'review_count': None,
            'review_texts': [],
        }
        
        self._delay()
        soup = self._get_page_content(url)
        if not soup:
            return details
        
        try:
            # Get full address
            addr_el = soup.select_one("section.address-section span.address")
            if addr_el:
                details['address'] = addr_el.get_text(strip=True)
            
            # Get phone number
            phone_el = soup.select_one("a[href^='tel:']")
            if phone_el:
                details['phone'] = phone_el.get_text(strip=True)
            
            # Get rating
            rating_el = soup.select_one("div.header-score")
            if rating_el:
                try:
                    details['rating'] = float(rating_el.get_text(strip=True))
                except ValueError:
                    pass
            
            # Get review count
            review_el = soup.select_one("span.review-count, a.review-count")
            if review_el:
                review_text = review_el.get_text(strip=True)
                try:
                    details['review_count'] = int(re.sub(r'\D', '', review_text))
                except ValueError:
                    pass
            
            # Scrape user reviews from the main page (BEFORE photos)
            details['review_texts'] = self._scrape_reviews(soup)
            
            # Get images from the /photos/all page
            details['images'] = self._scrape_photos_page(url)
            
        except Exception as e:
            print(f"[Detail] Error scraping detail page: {e}")
        
        return details
    
    def search_restaurant(self, query: str, get_details: bool = True) -> OpenRiceRestaurant:
        """
        Search for a restaurant on OpenRice and return scraped data.
        
        Args:
            query: Restaurant name to search for
            get_details: Whether to scrape the detail page for more info
            
        Returns:
            OpenRiceRestaurant object with scraped data
        """
        # Check cache first
        if self.cache:
            cached = self.cache.get(query)
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
        
        print(f"[Search] Searching OpenRice for: {query}")
        
        # Build search URL
        search_url = f"{self.SEARCH_URL}?whatwhere={quote_plus(query)}"
        
        # Get search results page (Playwright handles JavaScript automatically)
        soup = self._get_page_content(search_url)
        if not soup:
            return OpenRiceRestaurant(
                query=query,
                matched=False,
                confidence=0.0,
            )
        
        # Parse search results
        results = []
        
        # Check for restaurant cells
        poi_cells = soup.select("div.poi-list-cell")
        desktop_sections = soup.select("div.poi-list-cell-desktop-main-section")
        
        print(f"[Debug] Found {len(poi_cells)} poi-list-cell elements")
        print(f"[Debug] Found {len(desktop_sections)} desktop-main-section elements")
        
        for item in poi_cells:
            parsed = self._parse_search_result(item)
            if parsed:
                results.append(parsed)
        
        if not results:
            print(f"[Search] No results found for: {query}")
            print("[Debug] Trying alternative parsing method...")
            
            # Alternative: Look for desktop-main-section
            for section in desktop_sections:
                link = section.select_one("a[href*='/r-']")
                if link:
                    name_div = section.select_one("div.poi-name")
                    if name_div:
                        name = name_div.get_text(strip=True)
                        href = link.get('href', '')
                        url = f"{self.BASE_URL}{href}" if href.startswith('/') else href
                        
                        results.append({
                            'name': name,
                            'openrice_url': url,
                            'openrice_id': href.split('/')[-1] if '/r-' in href else None,
                        })
                        print(f"[Debug] Alternative parse found: {name}")
            
            if not results:
                return OpenRiceRestaurant(
                    query=query,
                    matched=False,
                    confidence=0.0,
                )
        
        # Find best match (or pick first - you can modify this)
        best_match = None
        best_confidence = 0.0
        
        for result in results:
            confidence = self._calculate_match_confidence(query, result['name'])
            if confidence > best_confidence:
                best_confidence = confidence
                best_match = result
        
        # Alternative: Always pick first result
        # best_match = results[0] if results else None
        # best_confidence = 0.8 if best_match else 0.0
        
        if not best_match or best_confidence < 0.3:
            return OpenRiceRestaurant(
                query=query,
                matched=False,
                confidence=best_confidence,
            )
        
        print(f"[Match] Found: {best_match['name']} (confidence: {best_confidence:.2f})")
        
        # Create base restaurant object
        restaurant = OpenRiceRestaurant(
            query=query,
            matched=True,
            confidence=best_confidence,
            name=best_match['name'],
            openrice_id=best_match.get('openrice_id'),
            openrice_url=best_match.get('openrice_url'),
            district=best_match.get('district'),
            cuisine_types=best_match.get('cuisine_types', []),
            price_range=best_match.get('price_range'),
            main_image=best_match.get('main_image'),
            reviews=OpenRiceReview(smile_count=best_match.get('smile_count')),
        )
        
        # OPTIMIZATION: Skip detail page scraping
        # Address, phone, rating will be provided by Geoapify in production
        # Only scrape images and reviews from main page if needed
        if get_details and best_match.get('openrice_url'):
            # Navigate to restaurant page for reviews and images
            self._delay()
            soup = self._get_page_content(best_match['openrice_url'])
            
            if soup:
                # Scrape reviews from main page
                restaurant.review_texts = self._scrape_reviews(soup)
                
                # Scrape images from /photos/all
                restaurant.images = self._scrape_photos_page(best_match['openrice_url'])
        
        # Cache the result
        if self.cache:
            self.cache.set(query, restaurant.to_dict())
        
        return restaurant
    
    def batch_search(self, queries: List[str], get_details: bool = True) -> List[OpenRiceRestaurant]:
        """
        Search for multiple restaurants.
        
        Args:
            queries: List of restaurant names
            get_details: Whether to scrape detail pages
            
        Returns:
            List of OpenRiceRestaurant objects
        """
        results = []
        
        for i, query in enumerate(queries, 1):
            print(f"\n[Batch] Processing {i}/{len(queries)}: {query}")
            result = self.search_restaurant(query, get_details)
            results.append(result)
            
            # Add delay between searches
            if i < len(queries):
                self._delay()
        
        return results


# =============================================================================
# CLI INTERFACE
# =============================================================================

def main():
    """CLI entry point"""
    import sys
    import io
    
    # Fix encoding for Windows console
    if sys.platform == 'win32':
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    
    print("=" * 60)
    print("🍽️  OpenRice Playwright Scraper")
    print("=" * 60)
    
    if len(sys.argv) > 1:
        # Search from command line argument
        query = " ".join(sys.argv[1:])
        
        # Use context manager to ensure browser closes
        with OpenRicePlaywrightScraper() as scraper:
            result = scraper.search_restaurant(query)
            
            print("\n" + "=" * 60)
            print("RESULT:")
            print("=" * 60)
            print(result.to_json())
            
            # Save to file
            output_file = Path("./output") / f"openrice_{query.replace(' ', '_')}.json"
            output_file.parent.mkdir(exist_ok=True)
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(result.to_json())
            print(f"\n📄 Saved to: {output_file}")
        
    else:
        # Interactive mode
        print("\nEnter restaurant names to search (one per line).")
        print("Type 'quit' to exit.\n")
        
        # Keep browser open for multiple searches
        with OpenRicePlaywrightScraper() as scraper:
            while True:
                query = input("Restaurant name: ").strip()
                
                if query.lower() in ('quit', 'exit', 'q'):
                    break
                
                if not query:
                    continue
                
                result = scraper.search_restaurant(query)
                
                if result.matched:
                    print(f"\n✅ Found: {result.name}")
                    print(f"   URL: {result.openrice_url}")
                    print(f"   Rating: {result.reviews.rating if result.reviews else 'N/A'}")
                    print(f"   Images: {len(result.images)}")
                    print(f"   Confidence: {result.confidence:.0%}")
                else:
                    print(f"\n❌ No match found for: {query}")
                
                print()


if __name__ == "__main__":
    main()
