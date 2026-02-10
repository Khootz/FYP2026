import pandas as pd
import re

def load_nutrition_data():
    """Load the CSV data"""

    try:
        # Try cleaned data first
        df = pd.read_csv("cfs_nutrient_data_cleaned.csv")
        return df
    except FileNotFoundError:
        try:
            # Fallback to original data
            df = pd.read_csv("cfs_nutrient_data.csv")
            print("Warning: Using original data. Consider running clean_duplicate_headers.py first.")
            return df
        except FileNotFoundError:
            print("Error: Neither cfs_nutrient_data_cleaned.csv nor cfs_nutrient_data.csv found. Run the scraper first!")
            return None

def search_food(df, food_name):
    """Search for food items by name (fuzzy matching)"""
    # Create a case-insensitive search
    mask = df['Food Item'].str.contains(food_name, case=False, na=False)
    results = df[mask]
    return results

def calculate_nutrition(row, portion_g):
    """Calculate nutrition for specific portion (data is per 100g)"""
    multiplier = portion_g / 100
    nutrition = {}
    
    # Skip non-numeric columns (updated for actual column structure)
    skip_cols = ['Food Item', 'Data Source', 'Portion']
    
    for col in row.index:
        if col not in skip_cols:
            try:
                value = pd.to_numeric(row[col], errors='coerce')
                if pd.notna(value):
                    nutrition[col] = round(value * multiplier, 2)
            except:
                pass
    
    return nutrition

def main():
    df = load_nutrition_data()
    if df is None:
        return
    
    print("=== Hong Kong Nutrition Database Lookup ===\n")
    
    while True:
        # Get food item
        food_name = input("Enter food name (or 'quit' to exit): ").strip()
        if food_name.lower() == 'quit':
            break
            
        # Search for food
        results = search_food(df, food_name)
        
        if results.empty:
            print(f"No food items found matching '{food_name}'\n")
            continue
        
        # Show matching foods
        print(f"\nFound {len(results)} matching food items:")
        for i, (idx, row) in enumerate(results.iterrows(), 1):
            # Use Data Source instead of Food Group/Subgroup since those columns don't exist
            data_source = row.get('Data Source', 'Unknown source')
            print(f"{i}. {row['Food Item']} (Source: {data_source})")
        
        # Let user select
        try:
            choice = int(input("\nSelect item number: ")) - 1
            if choice < 0 or choice >= len(results):
                print("Invalid selection\n")
                continue
            selected_row = results.iloc[choice]
        except ValueError:
            print("Invalid input\n")
            continue
        
        # Get portion size
        try:
            portion = float(input("Enter portion size in grams: "))
        except ValueError:
            print("Invalid portion size\n")
            continue
        
        # Calculate and display nutrition
        nutrition = calculate_nutrition(selected_row, portion)
        
        print(f"\n=== Nutrition for {portion}g of {selected_row['Food Item']} ===")
        for nutrient, value in nutrition.items():
            print(f"{nutrient}: {value}")
        print()

if __name__ == "__main__":
    main()