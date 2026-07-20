import { JoinedRecord } from '../types';

export interface KPIStats {
  netSales: number;
  targetAchievement: number;
  atv: number; // Average Transaction Value
  conversionRate: number; // Conversion Rate
  returnRate: number; // Return Rate
  discountRate: number; // Discount Rate
  stockouts: number;
  targetSum: number;
  transactionsSum: number;
  footfallSum: number;
  returnsSum: number;
  discountSum: number;
  grossSalesSum: number;
}

export interface WeeklyTrendItem {
  week: string;
  Sales: number;
  Target: number;
}

export interface RegionSalesItem {
  region: string;
  Sales: number;
  percentage: number;
}

export interface CategoryPerformanceItem {
  category: string;
  Sales: number;
  ReturnRate: number;
}

export interface StoreLeaderboardItem {
  storeId: string;
  storeName: string;
  netSales: number;
  target: number;
  achievement: number; // %
}

export interface StockoutItem {
  name: string; // Store or Category name
  Stockouts: number;
}

export interface BusinessInsights {
  bestRegion: { name: string; sales: number } | null;
  worstRegion: { name: string; sales: number } | null;
  failingStores: StoreLeaderboardItem[];
  highReturnCategories: { category: string; returnRate: number }[];
}

export const calculateKPIs = (data: JoinedRecord[]): KPIStats => {
  let netSalesSum = 0;
  let targetSum = 0;
  let transactionsSum = 0;
  let footfallSum = 0;
  let returnsSum = 0;
  let discountSum = 0;
  let grossSalesSum = 0;
  let stockoutsSum = 0;

  for (const row of data) {
    netSalesSum += row.net_sales || 0;
    targetSum += row.sales_target || 0;
    transactionsSum += row.transactions || 0;
    footfallSum += row.footfall || 0;
    returnsSum += row.returns_amount || 0;
    discountSum += row.discount_amount || 0;
    grossSalesSum += row.gross_sales || 0;
    stockoutsSum += row.stockouts || 0;
  }

  // Handle case where gross sales is 0 but net sales + returns + discounts is positive
  if (grossSalesSum === 0 && (netSalesSum > 0 || discountSum > 0)) {
    grossSalesSum = netSalesSum + discountSum + returnsSum;
  }

  const targetAchievement = targetSum > 0 ? (netSalesSum / targetSum) * 100 : 0;
  const atv = transactionsSum > 0 ? netSalesSum / transactionsSum : 0;
  const conversionRate = footfallSum > 0 ? (transactionsSum / footfallSum) * 100 : 0;
  const returnRate = netSalesSum > 0 ? (returnsSum / netSalesSum) * 100 : 0;
  const discountRate = grossSalesSum > 0 ? (discountSum / grossSalesSum) * 100 : 0;

  return {
    netSales: netSalesSum,
    targetAchievement,
    atv,
    conversionRate,
    returnRate,
    discountRate,
    stockouts: stockoutsSum,
    targetSum,
    transactionsSum,
    footfallSum,
    returnsSum,
    discountSum,
    grossSalesSum,
  };
};

export const getWeeklyTrend = (data: JoinedRecord[]): WeeklyTrendItem[] => {
  const weeksMap: { [week: string]: { sales: number; target: number } } = {};

  for (const row of data) {
    const week = row.week_start_date;
    if (!weeksMap[week]) {
      weeksMap[week] = { sales: 0, target: 0 };
    }
    weeksMap[week].sales += row.net_sales || 0;
    weeksMap[week].target += row.sales_target || 0;
  }

  return Object.keys(weeksMap)
    .sort()
    .map((week) => ({
      week,
      Sales: Math.round(weeksMap[week].sales),
      Target: Math.round(weeksMap[week].target),
    }));
};

export const getRegionSales = (data: JoinedRecord[]): RegionSalesItem[] => {
  const regionMap: { [region: string]: number } = {};
  let totalSales = 0;

  for (const row of data) {
    const region = row.region || 'Unknown';
    regionMap[region] = (regionMap[region] || 0) + (row.net_sales || 0);
    totalSales += row.net_sales || 0;
  }

  return Object.keys(regionMap)
    .map((region) => ({
      region,
      Sales: Math.round(regionMap[region]),
      percentage: totalSales > 0 ? (regionMap[region] / totalSales) * 100 : 0,
    }))
    .sort((a, b) => b.Sales - a.Sales);
};

export const getCategoryPerformance = (data: JoinedRecord[]): CategoryPerformanceItem[] => {
  const catMap: { [cat: string]: { sales: number; returns: number } } = {};

  for (const row of data) {
    const cat = row.product_category || 'Unknown';
    if (!catMap[cat]) {
      catMap[cat] = { sales: 0, returns: 0 };
    }
    catMap[cat].sales += row.net_sales || 0;
    catMap[cat].returns += row.returns_amount || 0;
  }

  return Object.keys(catMap).map((category) => {
    const s = catMap[category].sales;
    const r = catMap[category].returns;
    return {
      category,
      Sales: Math.round(s),
      ReturnRate: s > 0 ? Number(((r / s) * 100).toFixed(2)) : 0,
    };
  }).sort((a, b) => b.Sales - a.Sales);
};

export const getStoreLeaderboard = (data: JoinedRecord[]): StoreLeaderboardItem[] => {
  const storeMap: { [id: string]: { name: string; sales: number; target: number } } = {};

  for (const row of data) {
    const id = row.store_id || 'Unknown';
    if (!storeMap[id]) {
      storeMap[id] = { name: row.store_name || id, sales: 0, target: 0 };
    }
    storeMap[id].sales += row.net_sales || 0;
    storeMap[id].target += row.sales_target || 0;
  }

  return Object.keys(storeMap).map((id) => {
    const s = storeMap[id].sales;
    const t = storeMap[id].target;
    return {
      storeId: id,
      storeName: storeMap[id].name,
      netSales: Math.round(s),
      target: Math.round(t),
      achievement: t > 0 ? Number(((s / t) * 100).toFixed(1)) : 0,
    };
  }).sort((a, b) => b.achievement - a.achievement); // sorted low to high (helpful for slicing)
};

export const getStockoutRisk = (data: JoinedRecord[], groupBy: 'category' | 'store'): StockoutItem[] => {
  const map: { [key: string]: number } = {};

  for (const row of data) {
    const key = groupBy === 'category' ? row.product_category : row.store_name;
    if (key) {
      map[key] = (map[key] || 0) + (row.stockouts || 0);
    }
  }

  return Object.keys(map)
    .map((key) => ({
      name: key,
      Stockouts: map[key],
    }))
    .sort((a, b) => b.Stockouts - a.Stockouts);
};

export const getAutomatedInsights = (data: JoinedRecord[]): BusinessInsights => {
  // 1. Regions Performance
  const regionSales = getRegionSales(data);
  const bestRegion = regionSales.length > 0 ? { name: regionSales[0].region, sales: regionSales[0].Sales } : null;
  const worstRegion = regionSales.length > 1 ? { name: regionSales[regionSales.length - 1].region, sales: regionSales[regionSales.length - 1].Sales } : null;

  // 2. Stores failing to reach target (< 100% Target Achievement)
  const leaderboard = getStoreLeaderboard(data);
  const failingStores = leaderboard.filter((s) => s.achievement < 100);

  // 3. Categories with high return rates (> 7.5%)
  const catPerformance = getCategoryPerformance(data);
  const highReturnCategories = catPerformance
    .filter((c) => c.ReturnRate > 7.5)
    .map((c) => ({ category: c.category, returnRate: c.ReturnRate }));

  return {
    bestRegion,
    worstRegion,
    failingStores,
    highReturnCategories,
  };
};

export const convertToCSV = (data: JoinedRecord[]): string => {
  if (data.length === 0) return '';
  
  const headers = [
    'Week Start Date',
    'Store ID',
    'Store Name',
    'Region',
    'City',
    'Store Format',
    'Product Category',
    'Net Sales ($)',
    'Sales Target ($)',
    'Transactions',
    'Footfall',
    'Returns Amount ($)',
    'Discount Amount ($)',
    'Gross Sales ($)',
    'Stockouts'
  ];

  const rows = data.map((d) => [
    d.week_start_date,
    `"${d.store_id}"`,
    `"${d.store_name.replace(/"/g, '""')}"`,
    `"${d.region}"`,
    `"${d.city}"`,
    `"${d.store_format}"`,
    `"${d.product_category}"`,
    d.net_sales,
    d.sales_target,
    d.transactions,
    d.footfall,
    d.returns_amount,
    d.discount_amount,
    d.gross_sales,
    d.stockouts
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
};
