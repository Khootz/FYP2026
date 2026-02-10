import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
import numpy as np
import re

# Database connection settings - UPDATE THESE WITH YOUR CREDENTIALS
DB_CONFIG = {
    'host': 'localhost',
    'database': 'nutrition_db',
    'user': 'postgres',  # Your PostgreSQL username
    'password': '2002ktz',  # Your PostgreSQL password (CHANGE THIS)
    'port': 5432
}

def clean_column_name(col_name):
    """Convert CSV column names to SQL-friendly names"""
    # Remove units from column names and convert to snake_case
    cleaned = col_name.lower()
    cleaned = re.sub(r'\s*\([^)]*\)', '', cleaned)  # Remove (g), (mg), etc.
    cleaned = re.sub(r'[^a-zA-Z0-9\s]', '', cleaned)  # Remove special chars
    cleaned = re.sub(r'\s+', '_', cleaned.strip())  # Convert spaces to underscores
    return cleaned

def examine_csv_structure():
    """Examine the CSV file structure"""
    print("🔍 Examining CSV structure...")
    
    df = pd.read_csv("database.csv")
    print(f"📊 Dataset info:")
    print(f"   Rows: {len(df):,}")
    print(f"   Columns: {len(df.columns)}")
    
    print(f"\n📋 Column mapping:")
    for i, col in enumerate(df.columns, 1):
        sql_col = clean_column_name(col)
        print(f"   {i:2d}. '{col}' → '{sql_col}'")
    
    print(f"\n🔍 Data sample:")
    print(df.head(3).to_string())
    
    # Check for missing values
    print(f"\n❓ Missing values:")
    missing = df.isnull().sum()
    for col, count in missing.items():
        if count > 0:
            pct = (count / len(df)) * 100
            print(f"   {col}: {count:,} ({pct:.1f}%)")
    
    return df

def create_optimized_schema():
    """Create highly optimized PostgreSQL schema"""
    
    schema_sql = """
    -- Drop existing objects
    DROP TABLE IF EXISTS nutrition_data CASCADE;
    DROP INDEX IF EXISTS idx_food_search;
    DROP INDEX IF EXISTS idx_food_trigram;
    DROP MATERIALIZED VIEW IF EXISTS food_search_cache;
    
    -- Enable extensions for performance
    CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- Trigram matching for fuzzy search
    CREATE EXTENSION IF NOT EXISTS btree_gin; -- Better indexing
    
    -- Create optimized table with proper data types for nutrition data
    CREATE TABLE nutrition_data (
        id SERIAL PRIMARY KEY,
        food_item TEXT NOT NULL,
        data_source CHAR(1),
        portion VARCHAR(10),
        energy_kcal NUMERIC(8,2),        -- Max ~999,999.99 kcal (handles high-energy foods)
        protein_g NUMERIC(8,2),          -- Max ~999,999.99 g
        carbohydrate_g NUMERIC(8,2),     -- Max ~999,999.99 g  
        total_fat_g NUMERIC(8,2),        -- Max ~999,999.99 g
        dietary_fibre_g NUMERIC(8,2),    -- Max ~999,999.99 g
        sugars_g NUMERIC(8,2),           -- Max ~999,999.99 g
        saturated_fat_g NUMERIC(8,2),    -- Max ~999,999.99 g
        trans_fat_g NUMERIC(8,2),        -- Max ~999,999.99 g
        cholesterol_mg NUMERIC(8,2),     -- Max ~999,999.99 mg
        sodium_mg NUMERIC(8,2),          -- Max ~999,999.99 mg (handles high-sodium foods)
        
        -- Computed columns for search optimization
        food_item_lower TEXT GENERATED ALWAYS AS (LOWER(food_item)) STORED,
        search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', food_item)) STORED
    );
    
    -- High-performance indexes
    CREATE INDEX idx_food_search ON nutrition_data USING gin(search_vector);
    CREATE INDEX idx_food_lower ON nutrition_data USING gin(food_item_lower gin_trgm_ops);
    CREATE INDEX idx_food_exact ON nutrition_data (food_item_lower);
    
    -- Create materialized view for instant search results (most common searches)
    CREATE MATERIALIZED VIEW food_search_cache AS
    SELECT 
        food_item,
        food_item_lower,
        COUNT(*) OVER() as total_count,
        ROW_NUMBER() OVER(PARTITION BY food_item_lower ORDER BY id) as rn
    FROM nutrition_data 
    ORDER BY food_item_lower;
    
    CREATE INDEX idx_cache_food ON food_search_cache (food_item_lower, rn);
    
    -- Stored procedure for ultra-fast food search
    CREATE OR REPLACE FUNCTION search_food(
        search_term TEXT,
        max_results INTEGER DEFAULT 10
    )
    RETURNS TABLE (
        id INTEGER,
        food_item TEXT,
        data_source CHAR(1),
        similarity_score REAL
    ) AS $$
    BEGIN
        RETURN QUERY
        WITH ranked_results AS (
            -- Exact match (highest priority)
            SELECT n.id, n.food_item, n.data_source, 1.0::real as score, 1 as match_type
            FROM nutrition_data n
            WHERE n.food_item_lower = LOWER(search_term)
            
            UNION ALL
            
            -- Starts with match
            SELECT n.id, n.food_item, n.data_source, 
                   similarity(n.food_item_lower, LOWER(search_term))::real as score, 2 as match_type
            FROM nutrition_data n
            WHERE n.food_item_lower LIKE LOWER(search_term) || '%'
            
            UNION ALL
            
            -- Contains match
            SELECT n.id, n.food_item, n.data_source,
                   similarity(n.food_item_lower, LOWER(search_term))::real as score, 3 as match_type
            FROM nutrition_data n
            WHERE n.food_item_lower LIKE '%' || LOWER(search_term) || '%'
              AND n.food_item_lower NOT LIKE LOWER(search_term) || '%'
            
            UNION ALL
            
            -- Trigram similarity match
            SELECT n.id, n.food_item, n.data_source,
                   similarity(n.food_item_lower, LOWER(search_term))::real as score, 4 as match_type
            FROM nutrition_data n
            WHERE similarity(n.food_item_lower, LOWER(search_term)) > 0.3
              AND n.food_item_lower NOT LIKE '%' || LOWER(search_term) || '%'
            
            UNION ALL
            
            -- Full-text search
            SELECT n.id, n.food_item, n.data_source,
                   ts_rank(n.search_vector, plainto_tsquery('english', search_term))::real as score, 5 as match_type
            FROM nutrition_data n
            WHERE n.search_vector @@ plainto_tsquery('english', search_term)
              AND similarity(n.food_item_lower, LOWER(search_term)) <= 0.3
        )
        SELECT r.id, r.food_item, r.data_source, r.score
        FROM ranked_results r
        ORDER BY r.match_type, r.score DESC, r.food_item
        LIMIT max_results;
    END;
    $$ LANGUAGE plpgsql;
    
    -- Stored procedure for nutrition calculation (all in SQL)
    CREATE OR REPLACE FUNCTION get_nutrition_for_portion(
        food_id INTEGER,
        portion_grams NUMERIC
    )
    RETURNS TABLE (
        food_name TEXT,
        portion_size NUMERIC,
        energy_kcal NUMERIC,
        protein_g NUMERIC,
        carbohydrate_g NUMERIC,
        total_fat_g NUMERIC,
        dietary_fibre_g NUMERIC,
        sugars_g NUMERIC,
        saturated_fat_g NUMERIC,
        trans_fat_g NUMERIC,
        cholesterol_mg NUMERIC,
        sodium_mg NUMERIC
    ) AS $$
    DECLARE
        multiplier NUMERIC;
    BEGIN
        multiplier := portion_grams / 100.0;
        
        RETURN QUERY
        SELECT 
            n.food_item,
            portion_grams,
            ROUND(COALESCE(n.energy_kcal, 0) * multiplier, 2),
            ROUND(COALESCE(n.protein_g, 0) * multiplier, 2),
            ROUND(COALESCE(n.carbohydrate_g, 0) * multiplier, 2),
            ROUND(COALESCE(n.total_fat_g, 0) * multiplier, 2),
            ROUND(COALESCE(n.dietary_fibre_g, 0) * multiplier, 2),
            ROUND(COALESCE(n.sugars_g, 0) * multiplier, 2),
            ROUND(COALESCE(n.saturated_fat_g, 0) * multiplier, 2),
            ROUND(COALESCE(n.trans_fat_g, 0) * multiplier, 2),
            ROUND(COALESCE(n.cholesterol_mg, 0) * multiplier, 2),
            ROUND(COALESCE(n.sodium_mg, 0) * multiplier, 2)
        FROM nutrition_data n
        WHERE n.id = food_id;
    END;
    $$ LANGUAGE plpgsql;
    """
    
    return schema_sql

def connect_to_postgres():
    """Connect to PostgreSQL database"""
    try:
        # Try to connect to the specific database
        conn = psycopg2.connect(**DB_CONFIG)
        print("✅ Connected to nutrition_db!")
        return conn
    except psycopg2.Error as e:
        if "does not exist" in str(e):
            print("🔄 Database doesn't exist, creating it...")
            # Connect to postgres database to create nutrition_db
            temp_config = DB_CONFIG.copy()
            temp_config['database'] = 'postgres'
            try:
                temp_conn = psycopg2.connect(**temp_config)
                temp_conn.autocommit = True
                cursor = temp_conn.cursor()
                cursor.execute("CREATE DATABASE nutrition_db")
                cursor.close()
                temp_conn.close()
                
                # Now connect to the new database
                conn = psycopg2.connect(**DB_CONFIG)
                print("✅ Created and connected to nutrition_db!")
                return conn
            except psycopg2.Error as create_error:
                print(f"❌ Error creating database: {create_error}")
                return None
        else:
            print(f"❌ Error connecting to PostgreSQL: {e}")
            print("💡 Make sure PostgreSQL is running and credentials are correct")
            return None

def migrate_data_optimized(df, conn):
    """High-performance data migration"""
    print(f"\n📦 Migrating {len(df):,} rows with optimized batch processing...")
    
    # Clean and prepare data
    df_clean = df.copy()
    
    # Map CSV columns to SQL columns
    column_mapping = {
        'Food Item': 'food_item',
        'Data Source': 'data_source', 
        'Portion': 'portion',
        'Energy (kcal)': 'energy_kcal',
        'Protein (g)': 'protein_g',
        'Carbohydrate (g)': 'carbohydrate_g',
        'Total Fat (g)': 'total_fat_g',
        'Dietary Fibre (g)': 'dietary_fibre_g',
        'Sugars (g)': 'sugars_g',
        'Saturated Fat (g)': 'saturated_fat_g',
        'Trans Fat (g)': 'trans_fat_g',
        'Cholesterol (mg)': 'cholesterol_mg',
        'Sodium (mg)': 'sodium_mg'
    }
    
    # Rename columns and handle missing values
    df_clean = df_clean.rename(columns=column_mapping)
    
    # Convert empty strings to None for proper NULL insertion
    for col in df_clean.columns:
        if col in ['energy_kcal', 'protein_g', 'carbohydrate_g', 'total_fat_g', 
                   'dietary_fibre_g', 'sugars_g', 'saturated_fat_g', 'trans_fat_g',
                   'cholesterol_mg', 'sodium_mg']:
            df_clean[col] = pd.to_numeric(df_clean[col], errors='coerce')
    
    df_clean = df_clean.replace({np.nan: None, '': None})
    
    try:
        cursor = conn.cursor()
        
        # Disable autocommit for faster bulk insert
        conn.autocommit = False
        
        # Prepare optimized insert
        columns = list(df_clean.columns)
        placeholders = ','.join(['%s'] * len(columns))
        columns_str = ','.join(columns)
        
        insert_sql = f"""
        INSERT INTO nutrition_data ({columns_str}) 
        VALUES %s
        """
        
        # Insert in large batches for maximum speed
        batch_size = 5000  # Larger batches for better performance
        total_inserted = 0
        
        for i in range(0, len(df_clean), batch_size):
            batch = df_clean.iloc[i:i+batch_size]
            values = [tuple(row) for row in batch.values]
            
            execute_values(
                cursor,
                insert_sql,
                values,
                template=None,
                page_size=batch_size
            )
            
            total_inserted += len(batch)
            print(f"   ⚡ Inserted {total_inserted:,} / {len(df_clean):,} rows ({total_inserted/len(df_clean)*100:.1f}%)")
        
        # Commit all changes
        conn.commit()
        cursor.close()
        
        print(f"✅ Successfully migrated {len(df_clean):,} rows!")
        
        # Update materialized view
        print("🔄 Refreshing search cache...")
        cursor = conn.cursor()
        cursor.execute("REFRESH MATERIALIZED VIEW food_search_cache")
        conn.commit()
        cursor.close()
        
    except psycopg2.Error as e:
        print(f"❌ Error during migration: {e}")
        conn.rollback()
        raise

def create_performance_monitoring():
    """Create views to monitor performance"""
    monitoring_sql = """
    -- Performance monitoring view
    CREATE OR REPLACE VIEW performance_stats AS
    SELECT 
        schemaname,
        tablename,
        attname,
        n_distinct,
        correlation
    FROM pg_stats 
    WHERE schemaname = 'public' AND tablename = 'nutrition_data';
    
    -- Query to check index usage
    CREATE OR REPLACE VIEW index_usage AS
    SELECT 
        schemaname,
        tablename,
        indexname,
        idx_scan as index_scans,
        idx_tup_read as tuples_read,
        idx_tup_fetch as tuples_fetched
    FROM pg_stat_user_indexes 
    WHERE schemaname = 'public';
    """
    
    return monitoring_sql

def main():
    print("⚡ High-Performance Nutrition Database Migration")
    print("=" * 55)
    
    # Check credentials
    if DB_CONFIG['password'] == 'your_password':
        print("❌ Please update DB_CONFIG with your PostgreSQL credentials!")
        print("   Edit the DB_CONFIG dictionary at the top of this file.")
        return
    
    # Step 1: Examine CSV
    df = examine_csv_structure()
    
    # Step 2: Connect to PostgreSQL
    conn = connect_to_postgres()
    if not conn:
        return
    
    # Step 3: Create optimized schema
    print("\n🏗️  Creating optimized database schema...")
    try:
        cursor = conn.cursor()
        schema_sql = create_optimized_schema()
        cursor.execute(schema_sql)
        conn.commit()
        cursor.close()
        print("✅ Schema created with performance optimizations!")
    except psycopg2.Error as e:
        print(f"❌ Error creating schema: {e}")
        return
    
    # Step 4: Migrate data
    migrate_data_optimized(df, conn)
    
    # Step 5: Create monitoring views
    print("\n📊 Setting up performance monitoring...")
    try:
        cursor = conn.cursor()
        monitoring_sql = create_performance_monitoring()
        cursor.execute(monitoring_sql)
        conn.commit()
        cursor.close()
        print("✅ Performance monitoring enabled!")
    except psycopg2.Error as e:
        print(f"⚠️  Warning: Could not create monitoring views: {e}")
    
    # Step 6: Test performance
    print("\n🧪 Testing search performance...")
    try:
        cursor = conn.cursor()
        import time
        
        test_queries = ['chicken', 'beef', 'rice', 'apple']
        for query in test_queries:
            start_time = time.time()
            cursor.execute("SELECT * FROM search_food(%s, 5)", (query,))
            results = cursor.fetchall()
            end_time = time.time()
            
            print(f"   '{query}': {len(results)} results in {(end_time - start_time)*1000:.1f}ms")
        
        cursor.close()
        
    except psycopg2.Error as e:
        print(f"⚠️  Could not run performance tests: {e}")
    
    conn.close()
    print("\n🎉 High-performance migration completed!")
    print("\n📋 Next steps:")
    print("   1. Run: python nutrition_lookup_sql.py")
    print("   2. Search will be optimized for sub-millisecond response times")
    print("   3. All calculations happen in PostgreSQL (minimal Python overhead)")

if __name__ == "__main__":
    main()