import psycopg2
from psycopg2.extras import RealDictCursor
import time

# Database connection settings - UPDATE THESE
DB_CONFIG = {
    'host': 'localhost',
    'database': 'nutrition_db',
    'user': 'postgres',  # Your PostgreSQL username
    'password': '2002ktz',  # Your PostgreSQL password (CHANGE THIS)
    'port': 5432
}

class UltraFastNutritionLookup:
    def __init__(self):
        self.conn = None
        self.cursor = None
        self.connect()
        self.prepare_statements()
    
    def connect(self):
        """Connect to PostgreSQL database with optimized settings"""
        try:
            self.conn = psycopg2.connect(**DB_CONFIG)
            # Optimize connection for performance
            self.conn.autocommit = True  # Avoid transaction overhead for reads
            self.cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            print("⚡ Connected to high-performance nutrition database!")
        except psycopg2.Error as e:
            print(f"❌ Database connection failed: {e}")
            print("💡 Make sure to run migrate_to_postgres_optimized.py first!")
            exit(1)
    
    def prepare_statements(self):
        """Prepare statements for maximum performance"""
        # All heavy lifting is done in PostgreSQL stored procedures
        # This eliminates Python processing overhead
        print("🔧 Preparing optimized SQL statements...")
        
        # Test that stored procedures exist
        try:
            self.cursor.execute("SELECT search_food('test', 1)")
            self.cursor.fetchall()
            print("✅ Database procedures ready!")
        except psycopg2.Error:
            print("❌ Database procedures not found. Run migration script first!")
            exit(1)
    
    def search_food_ultra_fast(self, food_name, limit=10):
        """Ultra-fast food search using PostgreSQL stored procedure"""
        start_time = time.perf_counter()
        
        # Single SQL call - all processing in database
        self.cursor.execute("SELECT * FROM search_food(%s, %s)", (food_name, limit))
        results = self.cursor.fetchall()
        
        end_time = time.perf_counter()
        search_time = (end_time - start_time) * 1000  # Convert to milliseconds
        
        return results, search_time
    
    def get_nutrition_ultra_fast(self, food_id, portion_g):
        """Ultra-fast nutrition calculation using PostgreSQL stored procedure"""
        start_time = time.perf_counter()
        
        # Single SQL call - all calculations in database
        self.cursor.execute("SELECT * FROM get_nutrition_for_portion(%s, %s)", (food_id, portion_g))
        result = self.cursor.fetchone()
        
        end_time = time.perf_counter()
        calc_time = (end_time - start_time) * 1000  # Convert to milliseconds
        
        return result, calc_time
    
    def display_search_results(self, results, search_time):
        """Display search results with performance metrics"""
        print(f"\n🔍 Search Results ({search_time:.2f}ms)")
        print("=" * 60)
        
        if not results:
            print("❌ No matches found")
            return
        
        for i, row in enumerate(results, 1):
            similarity = row['similarity_score']
            similarity_bar = "█" * int(similarity * 10) + "░" * (10 - int(similarity * 10))
            print(f"{i:2d}. {row['food_item']}")
            print(f"    Source: {row['data_source']} | Match: {similarity_bar} {similarity:.2f}")
    
    def display_nutrition(self, nutrition_data, calc_time):
        """Display nutrition information with performance metrics"""
        if not nutrition_data:
            print("❌ Nutrition data not found")
            return
        
        print(f"\n🍽️ Nutrition Information ({calc_time:.2f}ms)")
        print("=" * 60)
        print(f"Food: {nutrition_data['food_name']}")
        print(f"Portion: {nutrition_data['portion_size']}g")
        print()
        
        # Macronutrients
        print("📊 Macronutrients:")
        print(f"   Energy:       {nutrition_data['energy_kcal']:.1f} kcal")
        print(f"   Protein:      {nutrition_data['protein_g']:.1f} g")
        print(f"   Carbs:        {nutrition_data['carbohydrate_g']:.1f} g")
        print(f"   Total Fat:    {nutrition_data['total_fat_g']:.1f} g")
        
        print("\n🥗 Detailed Nutrients:")
        print(f"   Dietary Fiber: {nutrition_data['dietary_fibre_g']:.1f} g")
        print(f"   Sugars:       {nutrition_data['sugars_g']:.1f} g")
        print(f"   Saturated Fat: {nutrition_data['saturated_fat_g']:.1f} g")
        print(f"   Trans Fat:    {nutrition_data['trans_fat_g']:.1f} g")
        print(f"   Cholesterol:  {nutrition_data['cholesterol_mg']:.1f} mg")
        print(f"   Sodium:       {nutrition_data['sodium_mg']:.1f} mg")
    
    def benchmark_performance(self):
        """Benchmark the system performance"""
        print("\n⚡ Performance Benchmark")
        print("=" * 40)
        
        test_foods = ["chicken breast", "brown rice", "apple", "salmon", "broccoli"]
        total_search_time = 0
        total_calc_time = 0
        
        for food in test_foods:
            # Search benchmark
            results, search_time = self.search_food_ultra_fast(food, 5)
            total_search_time += search_time
            
            if results:
                # Calculation benchmark
                _, calc_time = self.get_nutrition_ultra_fast(results[0]['id'], 100)
                total_calc_time += calc_time
                
                print(f"'{food}': {search_time:.2f}ms search + {calc_time:.2f}ms calc = {search_time + calc_time:.2f}ms total")
        
        avg_search = total_search_time / len(test_foods)
        avg_calc = total_calc_time / len(test_foods)
        avg_total = avg_search + avg_calc
        
        print(f"\n📊 Average Performance:")
        print(f"   Search: {avg_search:.2f}ms")
        print(f"   Calculation: {avg_calc:.2f}ms")
        print(f"   Total: {avg_total:.2f}ms")
        
        if avg_total < 5:
            print("🏆 EXCELLENT: Sub-5ms response time!")
        elif avg_total < 10:
            print("✅ GOOD: Sub-10ms response time")
        else:
            print("⚠️  Consider optimizing indexes or hardware")
    
    def run_interactive_lookup(self):
        """Run the ultra-fast interactive lookup system"""
        print("⚡ Ultra-Fast Nutrition Lookup System")
        print("🚀 Optimized for 15,000+ records with sub-millisecond search")
        print("=" * 60)
        
        # Show performance benchmark first
        self.benchmark_performance()
        
        print("\n" + "=" * 60)
        print("🔍 Interactive Food Search")
        print("Enter 'benchmark' to run performance test again")
        print("Enter 'quit' to exit")
        
        while True:
            # Get food item
            food_name = input("\n🍕 Enter food name: ").strip()
            
            if food_name.lower() == 'quit':
                break
            elif food_name.lower() == 'benchmark':
                self.benchmark_performance()
                continue
            elif not food_name:
                continue
            
            # Ultra-fast search
            results, search_time = self.search_food_ultra_fast(food_name, 10)
            
            if not results:
                print(f"❌ No food items found matching '{food_name}' ({search_time:.2f}ms)")
                continue
            
            # Display results
            self.display_search_results(results, search_time)
            
            # Let user select
            try:
                choice = int(input(f"\n📋 Select item (1-{len(results)}): ")) - 1
                if choice < 0 or choice >= len(results):
                    print("❌ Invalid selection")
                    continue
                selected_food = results[choice]
            except (ValueError, KeyboardInterrupt):
                print("❌ Invalid input or cancelled")
                continue
            
            # Get portion size
            try:
                portion = float(input("⚖️  Enter portion size in grams: "))
                if portion <= 0:
                    print("❌ Portion size must be positive")
                    continue
            except (ValueError, KeyboardInterrupt):
                print("❌ Invalid portion size or cancelled")
                continue
            
            # Ultra-fast nutrition calculation
            nutrition_data, calc_time = self.get_nutrition_ultra_fast(selected_food['id'], portion)
            
            if nutrition_data:
                self.display_nutrition(nutrition_data, calc_time)
                
                total_time = search_time + calc_time
                print(f"\n⚡ Total response time: {total_time:.2f}ms")
            else:
                print("❌ Could not calculate nutrition data")
    
    def close(self):
        """Close database connection"""
        if self.cursor:
            self.cursor.close()
        if self.conn:
            self.conn.close()

def main():
    # Check credentials
    if DB_CONFIG['password'] == 'your_password':
        print("❌ Please update DB_CONFIG with your PostgreSQL credentials!")
        print("   Edit the DB_CONFIG dictionary at the top of this file.")
        return
    
    lookup = UltraFastNutritionLookup()
    try:
        lookup.run_interactive_lookup()
    except KeyboardInterrupt:
        print("\n\n👋 Goodbye!")
    finally:
        lookup.close()

if __name__ == "__main__":
    main()