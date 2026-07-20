export interface WeeklySalesRecord {
  week_start_date: string;
  store_id: string;
  product_category: string;
  net_sales: number;
  sales_target: number;
  transactions: number;
  footfall: number;
  returns_amount: number;
  discount_amount: number;
  gross_sales: number;
  stockouts: number;
}

export interface StoreMasterRecord {
  store_id: string;
  store_name: string;
  region: string;
  city: string;
  store_format: string;
}

export interface JoinedRecord {
  id: string; // Unique row ID (combine store_id + category + week)
  week_start_date: string;
  store_id: string;
  store_name: string;
  region: string;
  city: string;
  store_format: string;
  product_category: string;
  net_sales: number;
  sales_target: number;
  transactions: number;
  footfall: number;
  returns_amount: number;
  discount_amount: number;
  gross_sales: number;
  stockouts: number;
}

export interface FilterState {
  week_start_dates: string[];
  regions: string[];
  store_names: string[];
  cities: string[];
  store_formats: string[];
  product_categories: string[];
}
