"""
Quick setup script to verify everything is ready for the ultra-fast nutrition lookup
"""

def check_requirements():
    """Check if all requirements are met"""
    print("🔍 Checking Requirements...")
    print("=" * 40)
    
    # Check Python packages
    try:
        import psycopg2
        print("✅ psycopg2: OK")
    except ImportError:
        print("❌ psycopg2: Missing - Run: pip install psycopg2-binary")
        return False
    
    try:
        import pandas
        print("✅ pandas: OK")
    except ImportError:
        print("❌ pandas: Missing - Run: pip install pandas")
        return False
    
    try:
        import numpy
        print("✅ numpy: OK")
    except ImportError:
        print("❌ numpy: Missing - Run: pip install numpy")
        return False
    
    # Check database.csv
    import os
    if os.path.exists("database.csv"):
        print("✅ database.csv: Found")
        
        # Show file info
        df = pandas.read_csv("database.csv")
        print(f"   📊 {len(df):,} rows, {len(df.columns)} columns")
    else:
        print("❌ database.csv: Missing")
        return False
    
    return True

def check_postgresql():
    """Check PostgreSQL connection"""
    print("\n🐘 Checking PostgreSQL...")
    print("=" * 40)
    
    # These are placeholder credentials - user needs to update them
    DB_CONFIG = {
        'host': 'localhost',
        'database': 'postgres',  # Connect to default DB first
        'user': 'postgres',
        'password': 'your_password',  # USER MUST CHANGE THIS
        'port': 5432
    }
    
    if DB_CONFIG['password'] == 'your_password':
        print("⚠️  PostgreSQL credentials not configured")
        print("📝 Next steps:")
        print("   1. Install PostgreSQL from: https://www.postgresql.org/download/")
        print("   2. Remember your postgres user password")
        print("   3. Update DB_CONFIG in migrate_to_postgres_optimized.py")
        print("   4. Update DB_CONFIG in nutrition_lookup_sql.py")
        return False
    
    try:
        import psycopg2
        conn = psycopg2.connect(**DB_CONFIG)
        conn.close()
        print("✅ PostgreSQL: Connection successful")
        return True
    except psycopg2.Error as e:
        print(f"❌ PostgreSQL: Connection failed - {e}")
        print("💡 Make sure PostgreSQL is running and credentials are correct")
        return False

def main():
    print("⚡ Ultra-Fast Nutrition Database Setup Check")
    print("=" * 50)
    
    # Check requirements
    req_ok = check_requirements()
    
    # Check PostgreSQL (will show setup instructions)
    pg_ok = check_postgresql()
    
    print("\n🎯 Setup Status")
    print("=" * 20)
    
    if req_ok and pg_ok:
        print("🎉 Ready to migrate! Run:")
        print("   python migrate_to_postgres_optimized.py")
    elif req_ok:
        print("📋 Python packages ready!")
        print("⚠️  PostgreSQL setup needed")
        print("\n📝 To complete setup:")
        print("   1. Install PostgreSQL")
        print("   2. Update passwords in both .py files")
        print("   3. Run: python migrate_to_postgres_optimized.py")
    else:
        print("❌ Requirements missing")
        print("   Run: pip install psycopg2-binary pandas numpy")
    
    print(f"\n📄 Read README_SETUP.md for detailed instructions")

if __name__ == "__main__":
    main()