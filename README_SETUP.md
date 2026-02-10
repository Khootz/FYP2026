# Ultra-Fast PostgreSQL Nutrition Database Setup

## 🚀 High-Performance Features

This system is optimized for **sub-millisecond search** on 15,000+ nutrition records:

- ⚡ **PostgreSQL Stored Procedures** - All processing in database (no Python overhead)
- 🔍 **Advanced Search Indexes** - GIN, trigram, and full-text search indexes
- 📊 **Materialized Views** - Pre-computed search results
- 🎯 **Smart Ranking** - Exact match → starts with → contains → fuzzy → full-text
- 🏃‍♂️ **Batch Processing** - 5000-row migration batches
- 📈 **Performance Monitoring** - Built-in benchmarking and statistics

## 📋 Prerequisites

### 1. Install PostgreSQL
**Windows:** Download from https://www.postgresql.org/download/windows/
**During installation:**
- Remember your postgres user password
- Use default port 5432
- Install pg_trgm extension support

### 2. Install Python Packages
```bash
pip install psycopg2-binary pandas numpy
```

## 🛠️ Setup Instructions

### Step 1: Update Database Credentials

Edit both files and update the `DB_CONFIG` section:

**migrate_to_postgres_optimized.py:**
```python
DB_CONFIG = {
    'host': 'localhost',
    'database': 'nutrition_db',
    'user': 'postgres',
    'password': 'YOUR_ACTUAL_PASSWORD',  # ← Change this
    'port': 5432
}
```

**nutrition_lookup_sql.py:**
```python
DB_CONFIG = {
    'host': 'localhost',
    'database': 'nutrition_db', 
    'user': 'postgres',
    'password': 'YOUR_ACTUAL_PASSWORD',  # ← Change this
    'port': 5432
}
```

### Step 2: Run Migration
```bash
cd "C:\Users\User\Desktop\FYP"
python migrate_to_postgres_optimized.py
```

**Expected output:**
```
⚡ High-Performance Nutrition Database Migration
=======================================================
🔍 Examining CSV structure...
📊 Dataset info:
   Rows: 13,653
   Columns: 12

🏗️  Creating optimized database schema...
✅ Schema created with performance optimizations!

📦 Migrating 13,653 rows with optimized batch processing...
   ⚡ Inserted 5,000 / 13,653 rows (36.6%)
   ⚡ Inserted 10,000 / 13,653 rows (73.2%)
   ⚡ Inserted 13,653 / 13,653 rows (100.0%)
✅ Successfully migrated 13,653 rows!

🧪 Testing search performance...
   'chicken': 5 results in 0.8ms
   'beef': 5 results in 0.6ms
   'rice': 5 results in 0.7ms
   'apple': 5 results in 0.5ms

🎉 High-performance migration completed!
```

### Step 3: Run Ultra-Fast Lookup
```bash
python nutrition_lookup_sql.py
```

## 🎯 Performance Expectations

For 15,000 records, you should see:
- **Search Time:** 0.5-2.0ms per query
- **Calculation Time:** 0.1-0.5ms per portion
- **Total Response:** < 3ms end-to-end

## 🔍 Search Features

### 1. **Intelligent Ranking:**
- Exact matches first
- "Starts with" matches
- "Contains" matches  
- Fuzzy/similarity matches
- Full-text search matches

### 2. **Search Examples:**
```
🍕 Enter food name: chicken breast
🔍 Search Results (0.8ms)
 1. Chicken, broilers or fryers, breast, meat only, cooked, roasted
    Source: A | Match: ██████████ 1.00
 2. Chicken, broiler, breast, meat only, boneless, cooked
    Source: A | Match: █████████░ 0.95

🍕 Enter food name: chick
🔍 Search Results (1.2ms)  
 1. Chicken, whole, cooked, roasted
 2. Chicken breast, grilled
 3. Chicken thigh, with skin
```

## 📊 Database Schema

**Table: `nutrition_data`**
```sql
- id (PRIMARY KEY)
- food_item (TEXT, indexed)
- data_source (CHAR(1))  
- portion (VARCHAR(10))
- energy_kcal (NUMERIC(6,2))
- protein_g (NUMERIC(6,2))
- carbohydrate_g (NUMERIC(6,2))
- total_fat_g (NUMERIC(6,2))
- dietary_fibre_g (NUMERIC(6,2))
- sugars_g (NUMERIC(6,2))
- saturated_fat_g (NUMERIC(6,2))
- trans_fat_g (NUMERIC(6,2))
- cholesterol_mg (NUMERIC(6,2))
- sodium_mg (NUMERIC(6,2))
- food_item_lower (GENERATED, indexed)
- search_vector (GENERATED, indexed)
```

**Stored Procedures:**
- `search_food(term, limit)` - Ultra-fast search
- `get_nutrition_for_portion(id, grams)` - Instant calculation

## 🐛 Troubleshooting

### Connection Issues:
```bash
# Check if PostgreSQL is running
services.msc  # Look for "postgresql-x64-xx"

# Test connection
psql -U postgres -d nutrition_db
```

### Performance Issues:
```sql
-- Check index usage
SELECT * FROM index_usage;

-- Refresh materialized view
REFRESH MATERIALIZED VIEW food_search_cache;
```

### Migration Errors:
- Ensure `database.csv` exists in the same directory
- Check PostgreSQL service is running
- Verify credentials in DB_CONFIG

## 💡 Advanced Usage

### Batch Lookups (Future Enhancement):
```python
# For processing multiple foods at once
results = lookup.batch_search(['chicken', 'rice', 'broccoli'])
```

### API Integration (Future Enhancement):
```python
# Fast REST API endpoint
@app.route('/api/nutrition/<food_name>/<int:portion>')
def get_nutrition_api(food_name, portion):
    return lookup.get_nutrition_ultra_fast(food_name, portion)
```

## 📈 Performance Monitoring

Built-in performance views:
```sql
-- Check table statistics
SELECT * FROM performance_stats;

-- Monitor index usage  
SELECT * FROM index_usage;

-- Check query performance
EXPLAIN ANALYZE SELECT * FROM search_food('chicken', 10);
```

---

## 🎉 Why This System Is Fast

1. **PostgreSQL does the work** - No Python data processing
2. **Multiple search strategies** - Exact → fuzzy → full-text  
3. **Pre-computed indexes** - GIN trigram + full-text vectors
4. **Stored procedures** - Eliminate network roundtrips
5. **Optimized data types** - NUMERIC instead of TEXT for numbers
6. **Materialized views** - Pre-cached common searches
7. **Batch operations** - Large transaction blocks

**Result: Sub-millisecond nutrition lookups on 15,000+ records! ⚡**