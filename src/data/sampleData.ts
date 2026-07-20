import { WeeklySalesRecord, StoreMasterRecord, JoinedRecord } from '../types';

export const DEFAULT_STORE_MASTER: StoreMasterRecord[] = [
  { store_id: 'S001', store_name: 'Metropolis Center', region: 'East', city: 'New York', store_format: 'Flagship' },
  { store_id: 'S002', store_name: 'Pacific Mall', region: 'West', city: 'Los Angeles', store_format: 'Supermarket' },
  { store_id: 'S003', store_name: 'Lone Star Outlets', region: 'South', city: 'Houston', store_format: 'Express' },
  { store_id: 'S004', store_name: 'Northwinds Plaza', region: 'North', city: 'Chicago', store_format: 'Flagship' },
  { store_id: 'S005', store_name: 'Sunshine Square', region: 'South', city: 'Miami', store_format: 'Boutique' },
  { store_id: 'S006', store_name: 'Express Hub NY', region: 'East', city: 'New York', store_format: 'Express' },
  { store_id: 'S007', store_name: 'Boutique Boston', region: 'East', city: 'Boston', store_format: 'Boutique' },
  { store_id: 'S008', store_name: 'Valley Superstore', region: 'West', city: 'San Francisco', store_format: 'Supermarket' }
];

export const generateSampleWeeklySales = (): WeeklySalesRecord[] => {
  const weeks = ['2026-06-01', '2026-06-08', '2026-06-15', '2026-06-22', '2026-06-29', '2026-07-06', '2026-07-13'];
  const categories = ['Apparel', 'Electronics', 'Home & Kitchen', 'Beauty', 'Groceries'];
  const sales: WeeklySalesRecord[] = [];

  // Deterministic seed generation so numbers are realistic and stable
  let seed = 42;
  const random = () => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };

  for (const week of weeks) {
    for (const store of DEFAULT_STORE_MASTER) {
      for (const category of categories) {
        // Base modifiers depending on category
        let baseSales = 15000;
        let baseTarget = 16000;
        let baseTransactions = 400;
        let baseFootfall = 1200;
        let baseReturns = 300;
        let baseDiscounts = 1000;
        let baseStockouts = 1;

        if (category === 'Electronics') {
          baseSales = 35000;
          baseTarget = 33000; // Strong category
          baseTransactions = 150; // High ATV, low volume
          baseFootfall = 900;
          baseReturns = 1400; // 4%
          baseDiscounts = 2500;
          baseStockouts = Math.floor(random() * 4); // High stockouts
        } else if (category === 'Apparel') {
          baseSales = 22000;
          baseTarget = 24000;
          baseTransactions = 350;
          baseFootfall = 1500;
          baseReturns = 2400; // High returns (> 10%)
          baseDiscounts = 3500; // Heavy discounts
          baseStockouts = Math.floor(random() * 2);
        } else if (category === 'Groceries') {
          baseSales = 18000;
          baseTarget = 17500;
          baseTransactions = 650; // Low ATV, high transaction count
          baseFootfall = 1800; // High footfall
          baseReturns = 150; // Very low returns
          baseDiscounts = 500;
          baseStockouts = Math.floor(random() * 3);
        } else if (category === 'Beauty') {
          baseSales = 12000;
          baseTarget = 11000;
          baseTransactions = 200;
          baseFootfall = 800;
          baseReturns = 200; // Low returns
          baseDiscounts = 800;
          baseStockouts = Math.floor(random() * 1.5);
        }

        // Store performance modifiers
        let storeMod = 1.0;
        if (store.store_id === 'S001') storeMod = 1.25; // Outperformer
        if (store.store_id === 'S005') storeMod = 0.72; // Underperformer
        if (store.store_id === 'S007') storeMod = 0.81; // Underperformer
        if (store.store_id === 'S008') storeMod = 1.15; // Outperformer

        // Weekly variation modifier
        const weekIndex = weeks.indexOf(week);
        const weekMod = 0.9 + (weekIndex * 0.05) + (random() * 0.15 - 0.075); // Gradual growth trend

        // Final random wiggle
        const wiggle = 0.92 + random() * 0.16;

        const netSales = Math.round(baseSales * storeMod * weekMod * wiggle);
        const target = Math.round(baseTarget * storeMod * weekMod * (0.95 + random() * 0.1));
        const transactions = Math.round(baseTransactions * storeMod * weekMod * wiggle);
        const footfall = Math.round(baseFootfall * storeMod * weekMod * (0.98 + random() * 0.04));
        
        // Return rates
        let returnsAmount = 0;
        if (category === 'Apparel') {
          // apparel returns rate: high (~9-12%)
          returnsAmount = Math.round(netSales * (0.09 + random() * 0.04));
        } else if (category === 'Electronics') {
          returnsAmount = Math.round(netSales * (0.03 + random() * 0.02));
        } else {
          returnsAmount = Math.round(netSales * (0.005 + random() * 0.015));
        }

        // Gross sales is Net Sales + Returns + Discounts (or net sales with markup)
        const discountAmount = Math.round(baseDiscounts * storeMod * weekMod * wiggle);
        const grossSales = netSales + discountAmount + returnsAmount;

        const stockouts = baseStockouts;

        sales.push({
          week_start_date: week,
          store_id: store.store_id,
          product_category: category,
          net_sales: netSales,
          sales_target: target,
          transactions: transactions,
          footfall: footfall,
          returns_amount: returnsAmount,
          discount_amount: discountAmount,
          gross_sales: grossSales,
          stockouts: stockouts
        });
      }
    }
  }

  return sales;
};

// Generates the fully joined record dataset
export const getInitialJoinedData = (): JoinedRecord[] => {
  const sales = generateSampleWeeklySales();
  return sales.map((sale) => {
    const store = DEFAULT_STORE_MASTER.find((s) => s.store_id === sale.store_id)!;
    return {
      id: `${sale.store_id}-${sale.product_category}-${sale.week_start_date}`,
      ...sale,
      store_name: store.store_name,
      region: store.region,
      city: store.city,
      store_format: store.store_format
    };
  });
};
