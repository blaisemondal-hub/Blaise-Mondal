import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  TrendingUp,
  TrendingDown,
  UploadCloud,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Download,
  Info,
  Calendar,
  Building2,
  MapPin,
  Map,
  Tag,
  Clock,
  Layers,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart as RechartsPieChart,
  Pie,
  Cell
} from 'recharts';

import { StoreMasterRecord, WeeklySalesRecord, JoinedRecord } from './types';
import { DEFAULT_STORE_MASTER, generateSampleWeeklySales, getInitialJoinedData } from './data/sampleData';
import { MultiSelectDropdown } from './components/MultiSelectDropdown';
import {
  calculateKPIs,
  getWeeklyTrend,
  getRegionSales,
  getCategoryPerformance,
  getStoreLeaderboard,
  getStockoutRisk,
  getAutomatedInsights,
  convertToCSV
} from './utils/analytics';

export default function App() {
  // --- Data State ---
  const [storeMaster, setStoreMaster] = useState<StoreMasterRecord[]>(DEFAULT_STORE_MASTER);
  const [weeklySales, setWeeklySales] = useState<WeeklySalesRecord[]>([]);
  const [joinedData, setJoinedData] = useState<JoinedRecord[]>([]);
  const [isDemo, setIsDemo] = useState(true);

  // File Upload state
  const [salesFileName, setSalesFileName] = useState<string>('');
  const [storeFileName, setStoreFileName] = useState<string>('');
  const [salesDragActive, setSalesDragActive] = useState(false);
  const [storeDragActive, setStoreDragActive] = useState(false);

  // --- Dynamic Filter States ---
  const [selectedWeeks, setSelectedWeeks] = useState<string[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [selectedStoreNames, setSelectedStoreNames] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [selectedStoreFormats, setSelectedStoreFormats] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // --- Chart UI Toggles ---
  const [regionChartType, setRegionChartType] = useState<'donut' | 'bar'>('donut');
  const [stockoutGroupBy, setStockoutGroupBy] = useState<'category' | 'store'>('category');

  // --- Load Initial Sample Dataset on Mount ---
  useEffect(() => {
    const initialSales = generateSampleWeeklySales();
    const initialJoined = getInitialJoinedData();
    setWeeklySales(initialSales);
    setJoinedData(initialJoined);
  }, []);

  // --- Recompute Joined Records Reactively ---
  useEffect(() => {
    if (weeklySales.length === 0) return;
    
    const joined = weeklySales.map((sale) => {
      const store = storeMaster.find((s) => s.store_id === sale.store_id);
      return {
        id: `${sale.store_id}-${sale.product_category}-${sale.week_start_date}`,
        ...sale,
        store_name: store ? store.store_name : `Store ID: ${sale.store_id}`,
        region: store ? store.region : 'Unmapped Region',
        city: store ? store.city : 'Unmapped City',
        store_format: store ? store.store_format : 'Unmapped Format',
      };
    });
    setJoinedData(joined);
  }, [weeklySales, storeMaster]);

  // --- Excel Normalization Helper ---
  const normalizeKey = (key: string): string => {
    return key.toLowerCase().replace(/[\s_-]+/g, '');
  };

  const mapRowToWeeklySales = (row: any): WeeklySalesRecord => {
    const normalizedRow: any = {};
    Object.keys(row).forEach((key) => {
      normalizedRow[normalizeKey(key)] = row[key];
    });

    const getNum = (keys: string[], dft = 0) => {
      for (const k of keys) {
        if (normalizedRow[k] !== undefined && normalizedRow[k] !== null) {
          const val = Number(normalizedRow[k]);
          return isNaN(val) ? dft : val;
        }
      }
      return dft;
    };

    const getStr = (keys: string[], dft = '') => {
      for (const k of keys) {
        if (normalizedRow[k] !== undefined && normalizedRow[k] !== null) {
          return String(normalizedRow[k]).trim();
        }
      }
      return dft;
    };

    let weekStartDate = getStr(['weekstartdate', 'date', 'week', 'weekstart']);
    
    // Handle Excel Serial Date
    if (/^\d{5}$/.test(weekStartDate)) {
      const serial = parseInt(weekStartDate, 10);
      const utcDays = serial - 25569;
      const dateInfo = new Date(utcDays * 86400 * 1000);
      weekStartDate = dateInfo.toISOString().split('T')[0];
    }

    return {
      week_start_date: weekStartDate || new Date().toISOString().split('T')[0],
      store_id: getStr(['storeid', 'store']),
      product_category: getStr(['productcategory', 'category', 'prodcat', 'prodcategory']),
      net_sales: getNum(['netsales', 'sales', 'net']),
      sales_target: getNum(['salestarget', 'target', 'salestargets']),
      transactions: getNum(['transactions', 'txns', 'txncount', 'trans']),
      footfall: getNum(['footfall', 'footfalls', 'traffic', 'visitors']),
      returns_amount: getNum(['returnsamount', 'returns', 'return', 'returnsvalue']),
      discount_amount: getNum(['discountamount', 'discounts', 'discount', 'discountvalue']),
      gross_sales: getNum(['grosssales', 'gross']),
      stockouts: getNum(['stockouts', 'stockout', 'outofstock']),
    };
  };

  const mapRowToStoreMaster = (row: any): StoreMasterRecord => {
    const normalizedRow: any = {};
    Object.keys(row).forEach((key) => {
      normalizedRow[normalizeKey(key)] = row[key];
    });

    const getStr = (keys: string[], dft = '') => {
      for (const k of keys) {
        if (normalizedRow[k] !== undefined && normalizedRow[k] !== null) {
          return String(normalizedRow[k]).trim();
        }
      }
      return dft;
    };

    return {
      store_id: getStr(['storeid', 'store']),
      store_name: getStr(['storename', 'name', 'store']),
      region: getStr(['region', 'reg']),
      city: getStr(['city']),
      store_format: getStr(['storeformat', 'format']),
    };
  };

  // --- Dynamic Filter Option Gatherers (from unfiltered dataset) ---
  const filterOptions = useMemo(() => {
    const weeks = new Set<string>();
    const regions = new Set<string>();
    const names = new Set<string>();
    const cities = new Set<string>();
    const formats = new Set<string>();
    const categories = new Set<string>();

    for (const d of joinedData) {
      if (d.week_start_date) weeks.add(d.week_start_date);
      if (d.region) regions.add(d.region);
      if (d.store_name) names.add(d.store_name);
      if (d.city) cities.add(d.city);
      if (d.store_format) formats.add(d.store_format);
      if (d.product_category) categories.add(d.product_category);
    }

    return {
      weeks: Array.from(weeks).sort(),
      regions: Array.from(regions).sort(),
      names: Array.from(names).sort(),
      cities: Array.from(cities).sort(),
      formats: Array.from(formats).sort(),
      categories: Array.from(categories).sort(),
    };
  }, [joinedData]);

  // --- Apply Multi-filters to obtain Filtered Data ---
  const filteredData = useMemo(() => {
    return joinedData.filter((d) => {
      if (selectedWeeks.length > 0 && !selectedWeeks.includes(d.week_start_date)) return false;
      if (selectedRegions.length > 0 && !selectedRegions.includes(d.region)) return false;
      if (selectedStoreNames.length > 0 && !selectedStoreNames.includes(d.store_name)) return false;
      if (selectedCities.length > 0 && !selectedCities.includes(d.city)) return false;
      if (selectedStoreFormats.length > 0 && !selectedStoreFormats.includes(d.store_format)) return false;
      if (selectedCategories.length > 0 && !selectedCategories.includes(d.product_category)) return false;
      return true;
    });
  }, [
    joinedData,
    selectedWeeks,
    selectedRegions,
    selectedStoreNames,
    selectedCities,
    selectedStoreFormats,
    selectedCategories
  ]);

  // --- Calculated Dashboard Metrics ---
  const stockoutRiskGroupBy = stockoutGroupBy;

  const kpis = useMemo(() => calculateKPIs(filteredData), [filteredData]);
  const weeklyTrend = useMemo(() => getWeeklyTrend(filteredData), [filteredData]);
  const regionSales = useMemo(() => getRegionSales(filteredData), [filteredData]);
  const categoryPerformance = useMemo(() => getCategoryPerformance(filteredData), [filteredData]);
  const leaderboard = useMemo(() => getStoreLeaderboard(filteredData), [filteredData]);
  const stockoutRisk = useMemo(() => getStockoutRisk(filteredData, stockoutGroupBy), [filteredData, stockoutGroupBy]);
  const automatedInsights = useMemo(() => getAutomatedInsights(filteredData), [filteredData]);

  // Leaders / Laggards slice
  const topStores = useMemo(() => [...leaderboard].reverse().slice(0, 5), [leaderboard]);
  const bottomStores = useMemo(() => leaderboard.slice(0, 5), [leaderboard]);

  // --- Reset All Filter Fields ---
  const clearAllFilters = () => {
    setSelectedWeeks([]);
    setSelectedRegions([]);
    setSelectedStoreNames([]);
    setSelectedCities([]);
    setSelectedStoreFormats([]);
    setSelectedCategories([]);
  };

  // --- Restore Demo Dataset ---
  const handleResetToDemo = () => {
    setStoreMaster(DEFAULT_STORE_MASTER);
    setWeeklySales(generateSampleWeeklySales());
    setSalesFileName('');
    setStoreFileName('');
    setIsDemo(true);
    clearAllFilters();
  };

  // --- File Drag & Drop Event Handlers ---
  const handleDrag = (e: React.DragEvent, type: 'sales' | 'store', active: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'sales') {
      setSalesDragActive(active);
    } else {
      setStoreDragActive(active);
    }
  };

  const handleDrop = (e: React.DragEvent, type: 'sales' | 'store') => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'sales') {
      setSalesDragActive(false);
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        parseWeeklySales(e.dataTransfer.files[0]);
      }
    } else {
      setStoreDragActive(false);
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        parseStoreMaster(e.dataTransfer.files[0]);
      }
    }
  };

  // --- Core Excel Parsers ---
  const parseWeeklySales = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet);

        if (rawJson.length === 0) {
          alert('Error: The weekly sales Excel sheet appears to contain no data rows.');
          return;
        }

        const parsed = rawJson.map((row) => mapRowToWeeklySales(row));
        setWeeklySales(parsed);
        setSalesFileName(file.name);
        setIsDemo(false);
        clearAllFilters();
      } catch (err) {
        console.error('Weekly Sales Parse Error:', err);
        alert('Failed to parse weekly sales sheet. Please check the columns and try again.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const parseStoreMaster = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet);

        if (rawJson.length === 0) {
          alert('Error: The store master Excel sheet appears to contain no data rows.');
          return;
        }

        const parsed = rawJson.map((row) => mapRowToStoreMaster(row));
        setStoreMaster(parsed);
        setStoreFileName(file.name);
        setIsDemo(false);
        clearAllFilters();
      } catch (err) {
        console.error('Store Master Parse Error:', err);
        alert('Failed to parse store master sheet. Please check the columns and try again.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // --- CSV Export Handler ---
  const handleCSVExport = () => {
    const csvContent = convertToCSV(filteredData);
    if (!csvContent) {
      alert('No data available to export.');
      return;
    }
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `retail_filtered_sales_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Excel Sample Template Generators ---
  const downloadSampleWeeklySalesFile = () => {
    const samples = generateSampleWeeklySales();
    const worksheet = XLSX.utils.json_to_sheet(samples);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Weekly Sales');
    XLSX.writeFile(workbook, 'retail_weekly_sales_template.xlsx');
  };

  const downloadSampleStoreMasterFile = () => {
    const worksheet = XLSX.utils.json_to_sheet(DEFAULT_STORE_MASTER);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Store Master');
    XLSX.writeFile(workbook, 'store_master_template.xlsx');
  };

  // Colors for donut chart
  const DONUT_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#14b8a6', '#6366f1'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#312e81] text-slate-200 font-sans antialiased pb-12 selection:bg-blue-500/30 selection:text-white" id="retail-intelligence-app">
      
      {/* HEADER BAR */}
      <header className="sticky top-0 z-40 bg-slate-950/40 backdrop-blur-xl border-b border-white/10 px-6 py-4 shadow-lg" id="app-header">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-md shadow-blue-500/20">
              <Layers size={22} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">Retail Sales Intelligence</h1>
                <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                  isDemo 
                    ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20' 
                    : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                }`}>
                  {isDemo ? 'Demo Dataset Live' : 'Custom Dataset Loaded'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Enterprise retail metrics parsing, filtering, and visual execution engine</p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2.5">
            {!isDemo && (
              <button
                type="button"
                onClick={handleResetToDemo}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg cursor-pointer transition-all duration-200"
                id="reset-demo-btn"
              >
                <RotateCcw size={14} />
                Restore Demo Data
              </button>
            )}
            <button
              type="button"
              onClick={handleCSVExport}
              disabled={filteredData.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:bg-white/5 disabled:text-slate-500 disabled:border-white/5 disabled:cursor-not-allowed rounded-lg shadow-md shadow-blue-500/10 border border-blue-400/20 cursor-pointer transition-all duration-200"
              id="export-csv-btn"
            >
              <Download size={14} />
              Export to CSV ({filteredData.length})
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 mt-6 space-y-6" id="dashboard-main">
        
        {/* FILE UPLOAD ZONE CARD */}
        <section className="frosted-glass rounded-2xl p-5" id="file-upload-section">
          <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 pb-4 border-b border-white/10">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <UploadCloud size={16} className="text-blue-400" />
                Data Ingestion Engine
              </h2>
              <p className="text-xs text-slate-400 mt-1">Upload your store directories and sales records to update the telemetry dashboards instantly</p>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={downloadSampleWeeklySalesFile}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 hover:text-white rounded-md text-[11px] font-semibold transition-colors cursor-pointer"
                title="Download formatted sample sales Excel"
              >
                <Download size={12} />
                Sample Sales Template
              </button>
              <button
                type="button"
                onClick={downloadSampleStoreMasterFile}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 hover:text-white rounded-md text-[11px] font-semibold transition-colors cursor-pointer"
                title="Download formatted store master Excel"
              >
                <Download size={12} />
                Store Master Template
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
            {/* WEEKLY SALES UPLOADER */}
            <div
              onDragOver={(e) => handleDrag(e, 'sales', true)}
              onDragLeave={(e) => handleDrag(e, 'sales', false)}
              onDrop={(e) => handleDrop(e, 'sales')}
              className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center transition-all duration-200 ${
                salesDragActive 
                  ? 'border-blue-500 bg-blue-500/10 scale-[0.99]' 
                  : salesFileName 
                  ? 'border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10' 
                  : 'border-white/10 hover:border-blue-400/50 hover:bg-white/5'
              }`}
              id="weekly-sales-uploader"
            >
              <input
                type="file"
                id="sales-file-input"
                accept=".xlsx,.xls"
                onChange={(e) => e.target.files && parseWeeklySales(e.target.files[0])}
                className="hidden"
              />
              <label htmlFor="sales-file-input" className="cursor-pointer flex flex-col items-center">
                <div className={`p-3 rounded-full mb-3 ${salesFileName ? 'bg-emerald-500/15 text-emerald-400' : 'bg-blue-500/15 text-blue-400'}`}>
                  <FileSpreadsheet size={24} />
                </div>
                {salesFileName ? (
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-200 break-all max-w-[280px]">{salesFileName}</p>
                    <p className="text-[10px] text-emerald-400 font-bold flex items-center justify-center gap-1">
                      <CheckCircle2 size={11} />
                      Sales Sheet Loaded ({weeklySales.length} records)
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-200">Weekly Sales File <span className="text-rose-500">*</span></p>
                    <p className="text-[11px] text-slate-400 font-semibold">Drag-and-drop or <span className="text-blue-400 font-bold underline">browse</span> for <code className="bg-white/5 px-1.5 py-0.5 rounded border border-white/5">retail_weekly_sales.xlsx</code></p>
                  </div>
                )}
              </label>
            </div>

            {/* STORE MASTER UPLOADER */}
            <div
              onDragOver={(e) => handleDrag(e, 'store', true)}
              onDragLeave={(e) => handleDrag(e, 'store', false)}
              onDrop={(e) => handleDrop(e, 'store')}
              className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center transition-all duration-200 ${
                storeDragActive 
                  ? 'border-blue-500 bg-blue-500/10 scale-[0.99]' 
                  : storeFileName 
                  ? 'border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10' 
                  : 'border-white/10 hover:border-blue-400/50 hover:bg-white/5'
              }`}
              id="store-master-uploader"
            >
              <input
                type="file"
                id="store-file-input"
                accept=".xlsx,.xls"
                onChange={(e) => e.target.files && parseStoreMaster(e.target.files[0])}
                className="hidden"
              />
              <label htmlFor="store-file-input" className="cursor-pointer flex flex-col items-center">
                <div className={`p-3 rounded-full mb-3 ${storeFileName ? 'bg-emerald-500/15 text-emerald-400' : 'bg-blue-500/15 text-blue-400'}`}>
                  <Building2 size={24} />
                </div>
                {storeFileName ? (
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-200 break-all max-w-[280px]">{storeFileName}</p>
                    <p className="text-[10px] text-emerald-400 font-bold flex items-center justify-center gap-1">
                      <CheckCircle2 size={11} />
                      Store Master Loaded ({storeMaster.length} records)
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-200">Store Master File</p>
                    <p className="text-[11px] text-slate-400 font-semibold">Drag-and-drop or <span className="text-blue-400 font-bold underline">browse</span> for <code className="bg-white/5 px-1.5 py-0.5 rounded border border-white/5">store_master.xlsx</code></p>
                  </div>
                )}
              </label>
            </div>
          </div>
        </section>

        {/* GLOBAL DYNAMIC FILTER COCKPIT */}
        <section className="frosted-glass rounded-2xl p-5" id="filter-cockpit">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping"></span>
              Global Dynamic Filters
            </h2>
            
            {(selectedWeeks.length > 0 ||
              selectedRegions.length > 0 ||
              selectedStoreNames.length > 0 ||
              selectedCities.length > 0 ||
              selectedStoreFormats.length > 0 ||
              selectedCategories.length > 0) && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-[11px] font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer transition-colors"
                id="clear-filters-btn"
              >
                <XCircle size={12} />
                Clear All Selections
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mt-4" id="filter-grid">
            <MultiSelectDropdown
              label="Week Start Date"
              options={filterOptions.weeks}
              selected={selectedWeeks}
              onChange={setSelectedWeeks}
              placeholder="Search weeks..."
              id="week-filter"
            />
            <MultiSelectDropdown
              label="Region"
              options={filterOptions.regions}
              selected={selectedRegions}
              onChange={setSelectedRegions}
              placeholder="Search regions..."
              id="region-filter"
            />
            <MultiSelectDropdown
              label="Store Name"
              options={filterOptions.names}
              selected={selectedStoreNames}
              onChange={setSelectedStoreNames}
              placeholder="Search stores..."
              id="store-filter"
            />
            <MultiSelectDropdown
              label="City"
              options={filterOptions.cities}
              selected={selectedCities}
              onChange={setSelectedCities}
              placeholder="Search cities..."
              id="city-filter"
            />
            <MultiSelectDropdown
              label="Store Format"
              options={filterOptions.formats}
              selected={selectedStoreFormats}
              onChange={setSelectedStoreFormats}
              placeholder="Search formats..."
              id="format-filter"
            />
            <MultiSelectDropdown
              label="Product Category"
              options={filterOptions.categories}
              selected={selectedCategories}
              onChange={setSelectedCategories}
              placeholder="Search categories..."
              id="category-filter"
            />
          </div>

          {/* Active filter pills */}
          <div className="flex flex-wrap gap-1.5 mt-4 items-center" id="active-filter-pills">
            {selectedWeeks.length > 0 ||
            selectedRegions.length > 0 ||
            selectedStoreNames.length > 0 ||
            selectedCities.length > 0 ||
            selectedStoreFormats.length > 0 ||
            selectedCategories.length > 0 ? (
              <>
                <span className="text-[11px] font-semibold text-slate-400 mr-1 flex items-center gap-1">
                  Active Filters:
                </span>
                {selectedWeeks.map((w) => (
                  <span key={w} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 text-blue-300 text-xs font-semibold rounded-md border border-blue-500/20">
                    <Calendar size={10} />
                    {w}
                    <button type="button" onClick={() => setSelectedWeeks(selectedWeeks.filter(x => x !== w))} className="hover:text-blue-100 cursor-pointer ml-1">×</button>
                  </span>
                ))}
                {selectedRegions.map((r) => (
                  <span key={r} className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-500/10 text-purple-300 text-xs font-semibold rounded-md border border-purple-500/20">
                    <Map size={10} />
                    {r}
                    <button type="button" onClick={() => setSelectedRegions(selectedRegions.filter(x => x !== r))} className="hover:text-purple-100 cursor-pointer ml-1">×</button>
                  </span>
                ))}
                {selectedStoreNames.map((n) => (
                  <span key={n} className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-500/10 text-indigo-300 text-xs font-semibold rounded-md border border-indigo-500/20">
                    <Building2 size={10} />
                    {n}
                    <button type="button" onClick={() => setSelectedStoreNames(selectedStoreNames.filter(x => x !== n))} className="hover:text-indigo-100 cursor-pointer ml-1">×</button>
                  </span>
                ))}
                {selectedCities.map((c) => (
                  <span key={c} className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal-500/10 text-teal-300 text-xs font-semibold rounded-md border border-teal-500/20">
                    <MapPin size={10} />
                    {c}
                    <button type="button" onClick={() => setSelectedCities(selectedCities.filter(x => x !== c))} className="hover:text-teal-100 cursor-pointer ml-1">×</button>
                  </span>
                ))}
                {selectedStoreFormats.map((f) => (
                  <span key={f} className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 text-amber-300 text-xs font-semibold rounded-md border border-amber-500/20">
                    <Layers size={10} />
                    {f}
                    <button type="button" onClick={() => setSelectedStoreFormats(selectedStoreFormats.filter(x => x !== f))} className="hover:text-amber-100 cursor-pointer ml-1">×</button>
                  </span>
                ))}
                {selectedCategories.map((cat) => (
                  <span key={cat} className="inline-flex items-center gap-1 px-2 py-0.5 bg-pink-500/10 text-pink-300 text-xs font-semibold rounded-md border border-pink-500/20">
                    <Tag size={10} />
                    {cat}
                    <button type="button" onClick={() => setSelectedCategories(selectedCategories.filter(x => x !== cat))} className="hover:text-pink-100 cursor-pointer ml-1">×</button>
                  </span>
                ))}
              </>
            ) : (
              <span className="text-xs text-slate-400 font-semibold italic">Showing full unfiltered aggregations. Click any dropdown above to narrow analysis.</span>
            )}
          </div>
        </section>

        {/* METRICS / KPI SECTION */}
        <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4" id="kpi-cards-grid">
          
          {/* NET SALES */}
          <div className="frosted-glass frosted-glass-hover rounded-xl p-4 flex flex-col justify-between transition-all duration-200" id="kpi-net-sales">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Net Sales</span>
            <div className="mt-2.5">
              <span className="text-lg md:text-xl font-extrabold tracking-tight text-white block" id="net-sales-val">
                ${kpis.netSales.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold block mt-1">
                Gross: ${kpis.grossSalesSum.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>

          {/* TARGET ACHIEVEMENT */}
          <div className="frosted-glass frosted-glass-hover rounded-xl p-4 flex flex-col justify-between transition-all duration-200" id="kpi-target-achievement">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Target Achievement</span>
            <div className="mt-2.5">
              <div className="flex items-center gap-1.5">
                <span className={`text-lg md:text-xl font-extrabold tracking-tight block ${
                  kpis.targetAchievement >= 100 
                    ? 'text-emerald-400' 
                    : kpis.targetAchievement >= 90 
                    ? 'text-amber-400' 
                    : 'text-rose-400'
                }`} id="target-achievement-val">
                  {kpis.targetAchievement.toFixed(1)}%
                </span>
                {kpis.targetAchievement >= 100 ? (
                  <ArrowUpRight size={16} className="text-emerald-400 shrink-0" />
                ) : (
                  <ArrowDownRight size={16} className="text-rose-400 shrink-0" />
                )}
              </div>
              <div className="w-full bg-white/5 h-1.5 rounded-full mt-2 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    kpis.targetAchievement >= 100 
                      ? 'bg-emerald-400' 
                      : kpis.targetAchievement >= 90 
                      ? 'bg-amber-400' 
                      : 'bg-rose-400'
                  }`}
                  style={{ width: `${Math.min(kpis.targetAchievement, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* AVERAGE TRANSACTION VALUE (ATV) */}
          <div className="frosted-glass frosted-glass-hover rounded-xl p-4 flex flex-col justify-between transition-all duration-200" id="kpi-atv">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Avg Ticket (ATV)</span>
            <div className="mt-2.5">
              <span className="text-lg md:text-xl font-extrabold tracking-tight text-white block" id="atv-val">
                ${kpis.atv.toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold block mt-1">
                {kpis.transactionsSum.toLocaleString()} txs
              </span>
            </div>
          </div>

          {/* CONVERSION RATE */}
          <div className="frosted-glass frosted-glass-hover rounded-xl p-4 flex flex-col justify-between transition-all duration-200" id="kpi-conversion">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Conversion Rate</span>
            <div className="mt-2.5">
              <span className="text-lg md:text-xl font-extrabold tracking-tight text-white block" id="conversion-val">
                {kpis.conversionRate.toFixed(2)}%
              </span>
              <span className="text-[10px] text-slate-400 font-semibold block mt-1">
                {kpis.footfallSum.toLocaleString()} visitors
              </span>
            </div>
          </div>

          {/* RETURN RATE */}
          <div className="frosted-glass frosted-glass-hover rounded-xl p-4 flex flex-col justify-between transition-all duration-200" id="kpi-returns">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Return Rate</span>
            <div className="mt-2.5">
              <span className={`text-lg md:text-xl font-extrabold tracking-tight block ${
                kpis.returnRate > 7.5 ? 'text-rose-400' : 'text-white'
              }`} id="return-rate-val">
                {kpis.returnRate.toFixed(2)}%
              </span>
              <span className="text-[10px] text-slate-400 font-semibold block mt-1">
                Returns: ${kpis.returnsSum.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>

          {/* DISCOUNT RATE */}
          <div className="frosted-glass frosted-glass-hover rounded-xl p-4 flex flex-col justify-between transition-all duration-200" id="kpi-discounts">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Discount Rate</span>
            <div className="mt-2.5">
              <span className="text-lg md:text-xl font-extrabold tracking-tight text-white block" id="discount-val">
                {kpis.discountRate.toFixed(2)}%
              </span>
              <span className="text-[10px] text-slate-400 font-semibold block mt-1">
                Given: ${kpis.discountSum.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>

          {/* STOCKOUTS */}
          <div className="frosted-glass frosted-glass-hover rounded-xl p-4 flex flex-col justify-between transition-all duration-200" id="kpi-stockouts">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Stockouts</span>
            <div className="mt-2.5">
              <span className={`text-lg md:text-xl font-extrabold tracking-tight block ${
                kpis.stockouts > 0 ? 'text-amber-400' : 'text-emerald-400'
              }`} id="stockout-val">
                {kpis.stockouts} Instances
              </span>
              <span className="text-[10px] text-slate-400 font-semibold block mt-1">
                Shortage risk alerts
              </span>
            </div>
          </div>

        </section>

        {/* VISUAL ANALYTICS CORE SECTION */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="visual-analytics-dashboard">
          
          {/* WEEKLY TREND CHART CARD */}
          <div className="frosted-glass rounded-2xl p-5 flex flex-col" id="chart-weekly-trend">
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Weekly Revenue Trend</h3>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">Aggregated actual net sales vs targets chronological trajectory</p>
              </div>
              <TrendingUp size={16} className="text-blue-400" />
            </div>

            <div className="h-64 w-full">
              {weeklyTrend.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs italic bg-white/5 rounded-xl">
                  No data to plot. Check your filters.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeklyTrend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                    <XAxis 
                      dataKey="week" 
                      tick={{ fill: '#94a3b8', fontSize: 10 }} 
                      tickLine={false} 
                      axisLine={false}
                    />
                    <YAxis 
                      tick={{ fill: '#94a3b8', fontSize: 10 }} 
                      tickLine={false} 
                      axisLine={false}
                      tickFormatter={(value) => `$${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`}
                    />
                    <Tooltip 
                      formatter={(value) => [`$${Number(value).toLocaleString()}`, '']}
                      contentStyle={{ background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '12px', fontSize: '12px', color: '#f8fafc', backdropFilter: 'blur(8px)' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px', color: '#cbd5e1' }} />
                    <Line 
                      type="monotone" 
                      dataKey="Sales" 
                      stroke="#60a5fa" 
                      strokeWidth={2.5} 
                      dot={{ r: 4, strokeWidth: 1.5, fill: '#1e1b4b' }} 
                      activeDot={{ r: 6 }} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="Target" 
                      stroke="#34d399" 
                      strokeWidth={1.5} 
                      strokeDasharray="4 4" 
                      dot={false} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* REGION PERFORMANCE CHART CARD */}
          <div className="frosted-glass rounded-2xl p-5 flex flex-col" id="chart-region-sales">
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Sales by Region</h3>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">Geographic revenue dispersion and market share</p>
              </div>
              
              <div className="flex items-center bg-white/5 p-0.5 rounded-lg border border-white/10">
                <button
                  type="button"
                  onClick={() => setRegionChartType('donut')}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-md cursor-pointer transition-colors ${
                    regionChartType === 'donut' 
                      ? 'bg-white/10 text-white shadow-md' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Donut
                </button>
                <button
                  type="button"
                  onClick={() => setRegionChartType('bar')}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-md cursor-pointer transition-colors ${
                    regionChartType === 'bar' 
                      ? 'bg-white/10 text-white shadow-md' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Bar
                </button>
              </div>
            </div>

            <div className="h-64 w-full relative">
              {regionSales.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs italic bg-white/5 rounded-xl">
                  No data to plot. Check your filters.
                </div>
              ) : regionChartType === 'donut' ? (
                <div className="grid grid-cols-1 md:grid-cols-12 h-full items-center">
                  <div className="md:col-span-7 h-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={regionSales}
                          cx="50%"
                          cy="50%"
                          innerRadius={65}
                          outerRadius={90}
                          paddingAngle={3}
                          dataKey="Sales"
                          nameKey="region"
                        >
                          {regionSales.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Sales']} />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                    {/* Centered label inside donut */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 md:-translate-x-[85%] -translate-y-1/2 text-center pointer-events-none">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Sales</span>
                      <span className="text-md font-bold text-slate-100 block">
                        ${kpis.netSales.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                  <div className="md:col-span-5 flex flex-col gap-2.5 max-h-full overflow-y-auto pr-2">
                    {regionSales.map((item, idx) => (
                      <div key={item.region} className="flex items-center justify-between text-xs font-semibold">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: DONUT_COLORS[idx % DONUT_COLORS.length] }}></span>
                          <span className="text-slate-300 truncate max-w-[100px]">{item.region}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-100 block font-bold">${item.Sales.toLocaleString()}</span>
                          <span className="text-[10px] text-slate-400 font-bold block">{item.percentage.toFixed(1)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={regionSales} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                    <XAxis 
                      dataKey="region" 
                      tick={{ fill: '#94a3b8', fontSize: 10 }} 
                      tickLine={false} 
                      axisLine={false}
                    />
                    <YAxis 
                      tick={{ fill: '#94a3b8', fontSize: 10 }} 
                      tickLine={false} 
                      axisLine={false}
                      tickFormatter={(value) => `$${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`}
                    />
                    <Tooltip 
                      formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Sales']}
                      contentStyle={{ background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '12px', fontSize: '12px', color: '#f8fafc', backdropFilter: 'blur(8px)' }}
                    />
                    <Bar dataKey="Sales" fill="#a78bfa" radius={[4, 4, 0, 0]} barSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* CATEGORY PERFORMANCE CHART CARD */}
          <div className="frosted-glass rounded-2xl p-5 flex flex-col" id="chart-category-performance">
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Category Revenue & Returns</h3>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">Primary sales contribution (Blue, bottom) against average return rates (Rose, top)</p>
              </div>
              <Tag size={16} className="text-blue-400" />
            </div>

            <div className="h-64 w-full">
              {categoryPerformance.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs italic bg-white/5 rounded-xl">
                  No data to plot. Check your filters.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryPerformance} layout="vertical" margin={{ left: 15, right: 15, top: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" horizontal={false} />
                    <XAxis 
                      type="number" 
                      xAxisId="sales" 
                      stroke="#60a5fa" 
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: '#60a5fa', fontSize: 10 }}
                      tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} 
                    />
                    <XAxis 
                      type="number" 
                      xAxisId="returns" 
                      orientation="top" 
                      stroke="#f43f5e" 
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: '#f43f5e', fontSize: 10 }}
                      unit="%" 
                      domain={[0, 15]} 
                    />
                    <YAxis 
                      dataKey="category" 
                      type="category" 
                      width={90} 
                      tickLine={false} 
                      axisLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 500 }} 
                    />
                    <Tooltip 
                      formatter={(value, name) => 
                        name === 'Sales' 
                          ? [`$${Number(value).toLocaleString()}`, 'Net Sales'] 
                          : [`${Number(value).toFixed(2)}%`, 'Avg Return Rate']
                      }
                      contentStyle={{ background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '12px', fontSize: '11px', color: '#f8fafc', backdropFilter: 'blur(8px)' }}
                    />
                    <Bar dataKey="Sales" xAxisId="sales" fill="#60a5fa" barSize={10} radius={[0, 4, 4, 0]} name="Sales" />
                    <Bar dataKey="ReturnRate" xAxisId="returns" fill="#f43f5e" barSize={10} radius={[0, 4, 4, 0]} name="ReturnRate" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* STOCKOUT RISK CHART CARD */}
          <div className="frosted-glass rounded-2xl p-5 flex flex-col" id="chart-stockout-risk">
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Stockout Shortage risk</h3>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">Shortage alerts count pointing to inventory gaps</p>
              </div>

              <div className="flex items-center bg-white/5 p-0.5 rounded-lg border border-white/10">
                <button
                  type="button"
                  onClick={() => setStockoutGroupBy('category')}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-md cursor-pointer transition-colors ${
                    stockoutGroupBy === 'category' 
                      ? 'bg-white/10 text-white shadow-md' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  By Category
                </button>
                <button
                  type="button"
                  onClick={() => setStockoutGroupBy('store')}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-md cursor-pointer transition-colors ${
                    stockoutGroupBy === 'store' 
                      ? 'bg-white/10 text-white shadow-md' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  By Store
                </button>
              </div>
            </div>

            <div className="h-64 w-full">
              {stockoutRisk.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs italic bg-white/5 rounded-xl">
                  No stockouts recorded in current filtered partition. Good job!
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stockoutRisk.slice(0, 8)} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 500 }} 
                      tickLine={false} 
                      axisLine={false}
                    />
                    <YAxis 
                      tick={{ fill: '#94a3b8', fontSize: 10 }} 
                      tickLine={false} 
                      axisLine={false}
                    />
                    <Tooltip 
                      formatter={(value) => [`${value} instances`, 'Stockouts']}
                      contentStyle={{ background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '12px', fontSize: '11px', color: '#f8fafc', backdropFilter: 'blur(8px)' }}
                    />
                    <Bar dataKey="Stockouts" fill="#fbbf24" radius={[4, 4, 0, 0]} barSize={26} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

        </section>

        {/* STORE LEADERBOARD SECTION */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="leaderboard-insights-section">
          
          {/* LEADERBOARD CARD */}
          <div className="frosted-glass rounded-2xl p-5 flex flex-col lg:col-span-2" id="store-leaderboard-card">
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Store Target Achievement Leaderboard</h3>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">Top 5 and Bottom 5 store performers evaluated by Target Achievement %</p>
              </div>
              <Building2 size={16} className="text-slate-400" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="leaderboard-grids-split">
              {/* TOP 5 */}
              <div>
                <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 mb-3 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-md w-fit">
                  <CheckCircle2 size={12} />
                  Top 5 Overachievers
                </h4>
                {topStores.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No stores evaluated.</p>
                ) : (
                  <div className="space-y-3.5">
                    {topStores.map((store, idx) => (
                      <div key={store.storeId} className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold text-slate-200">
                          <span className="truncate max-w-[180px]">{idx + 1}. {store.storeName}</span>
                          <span className="text-emerald-400 font-bold">{store.achievement.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden flex">
                          <div 
                            className="bg-emerald-400 h-full rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(store.achievement, 100)}%` }}
                          ></div>
                          {store.achievement > 100 && (
                            <div 
                              className="bg-teal-400 h-full transition-all duration-300"
                              style={{ width: `${Math.min(store.achievement - 100, 20)}%` }}
                            ></div>
                          )}
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                          <span>Sales: ${store.netSales.toLocaleString()}</span>
                          <span>Target: ${store.target.toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* BOTTOM 5 */}
              <div>
                <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5 mb-3 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-md w-fit">
                  <XCircle size={12} className="text-rose-400" />
                  Bottom 5 Laggards
                </h4>
                {bottomStores.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No stores evaluated.</p>
                ) : (
                  <div className="space-y-3.5">
                    {bottomStores.map((store, idx) => (
                      <div key={store.storeId} className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold text-slate-200">
                          <span className="truncate max-w-[180px]">{idx + 1}. {store.storeName}</span>
                          <span className="text-rose-400 font-bold">{store.achievement.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-rose-500 h-full rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(store.achievement, 100)}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                          <span>Sales: ${store.netSales.toLocaleString()}</span>
                          <span>Target: ${store.target.toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* AUTOMATED BUSINESS INSIGHTS SUMMARY CARD */}
          <div className="frosted-glass rounded-2xl p-5 flex flex-col justify-between" id="automated-insights-card">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                    Automated Business Insights
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">Real-time analytical trends generated from active data matrix</p>
                </div>
                <Info size={16} className="text-blue-400 shrink-0" />
              </div>

              {/* INSIGHT 1: REGIONS */}
              <div className="space-y-2" id="insight-regions">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Regional Performance</span>
                <div className="grid grid-cols-2 gap-2.5">
                  {automatedInsights.bestRegion ? (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl space-y-0.5">
                      <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">Top Performer</span>
                      <p className="text-xs font-bold text-slate-200 truncate">{automatedInsights.bestRegion.name}</p>
                      <p className="text-[10px] font-bold text-emerald-400">${automatedInsights.bestRegion.sales.toLocaleString()}</p>
                    </div>
                  ) : (
                    <div className="bg-white/5 border border-white/15 p-2 text-center text-[10px] text-slate-400">N/A</div>
                  )}

                  {automatedInsights.worstRegion ? (
                    <div className="bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl space-y-0.5">
                      <span className="text-[9px] font-bold text-rose-400 uppercase tracking-wider">Lowest Performer</span>
                      <p className="text-xs font-bold text-slate-200 truncate">{automatedInsights.worstRegion.name}</p>
                      <p className="text-[10px] font-bold text-rose-400">${automatedInsights.worstRegion.sales.toLocaleString()}</p>
                    </div>
                  ) : (
                    <div className="bg-white/5 border border-white/15 p-2.5 text-center text-[10px] text-slate-400 rounded-xl">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Lowest Performer</span>
                      <p className="text-xs font-medium text-slate-300 mt-1">Single Region</p>
                    </div>
                  )}
                </div>
              </div>

              {/* INSIGHT 2: FAILING STORES */}
              <div className="space-y-2" id="insight-failing-stores">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Stores Missing Target (&lt;100%)</span>
                {automatedInsights.failingStores.length === 0 ? (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-2.5 rounded-xl flex items-center gap-2 text-xs font-semibold text-emerald-400">
                    <CheckCircle2 size={13} className="shrink-0" />
                    All stores reaching 100% of target!
                  </div>
                ) : (
                  <div className="max-h-24 overflow-y-auto space-y-1.5 pr-1" id="failing-stores-list">
                    {automatedInsights.failingStores.map((store) => (
                      <div key={store.storeId} className="flex items-center justify-between px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg text-xs font-semibold text-slate-200 transition-colors">
                        <span className="truncate max-w-[160px]">{store.storeName}</span>
                        <span className="text-rose-400 shrink-0 font-bold bg-rose-500/15 px-1.5 py-0.5 rounded-md text-[10px]">{store.achievement.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* INSIGHT 3: HIGH RETURNS */}
              <div className="space-y-2" id="insight-high-returns">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">High Return Risk Categories (&gt;7.5%)</span>
                {automatedInsights.highReturnCategories.length === 0 ? (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-2.5 rounded-xl flex items-center gap-2 text-xs font-semibold text-emerald-400">
                    <CheckCircle2 size={13} className="shrink-0" />
                    All return rates safely below 7.5%.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5" id="high-returns-tags">
                    {automatedInsights.highReturnCategories.map((c) => (
                      <div key={c.category} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs font-bold text-rose-400">
                        <AlertTriangle size={12} className="text-rose-400" />
                        <span>{c.category}</span>
                        <span className="bg-rose-500/20 text-rose-200 px-1 rounded-sm text-[10px] font-extrabold">{c.returnRate.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            <div className="pt-4 border-t border-white/10 mt-4 text-[10px] text-slate-500 font-semibold flex items-center gap-1.5">
              <Clock size={12} />
              Re-calculated automatically upon filter adjustments
            </div>
          </div>

        </section>

        {/* BOTTOM PARTITION - ACTIVE TABLE PREVIEW */}
        <section className="frosted-glass rounded-2xl p-5" id="table-preview-section">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10 mb-4">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Filtered Records Inspect Table</h3>
              <p className="text-xs text-slate-400 mt-1">Granular database view. Inspect matching transaction entries</p>
            </div>
            
            <div className="text-xs text-slate-400 font-semibold">
              Showing <span className="text-blue-400 font-extrabold">{filteredData.length}</span> of <span className="text-white font-extrabold">{joinedData.length}</span> records
            </div>
          </div>

          <div className="overflow-x-auto border border-white/10 rounded-xl" id="table-wrapper">
            <table className="w-full text-left text-xs font-medium border-collapse">
              <thead>
                <tr className="bg-white/5 border-b border-white/10 text-slate-300 uppercase text-[10px] font-bold tracking-wider divide-x divide-white/5">
                  <th className="px-4 py-3">Week Start</th>
                  <th className="px-4 py-3">Store Name</th>
                  <th className="px-4 py-3">Region</th>
                  <th className="px-4 py-3">City</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">Net Sales</th>
                  <th className="px-4 py-3 text-right">Target</th>
                  <th className="px-4 py-3 text-center">Stockouts</th>
                  <th className="px-4 py-3 text-right">Returns</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 text-slate-300 font-semibold">
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-400 italic font-medium">
                      No records match the active filter criteria. Clear some filters to view records.
                    </td>
                  </tr>
                ) : (
                  filteredData.slice(0, 50).map((row) => {
                    const achievement = row.sales_target > 0 ? (row.net_sales / row.sales_target) * 100 : 0;
                    return (
                      <tr key={row.id} className="hover:bg-white/5 transition-colors divide-x divide-white/5">
                        <td className="px-4 py-3 whitespace-nowrap text-slate-400 text-[11px] font-mono">{row.week_start_date}</td>
                        <td className="px-4 py-3 truncate max-w-[150px] text-white">{row.store_name}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-[11px] text-slate-300">{row.region}</td>
                        <td className="px-4 py-3 truncate max-w-[110px] text-slate-400 font-medium">{row.city}</td>
                        <td className="px-4 py-3 truncate max-w-[120px]">
                          <span className="px-2 py-0.5 bg-white/5 text-slate-300 rounded-sm text-[10px] font-bold border border-white/5">{row.product_category}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-white">${row.net_sales.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-slate-400 font-medium">${row.sales_target.toLocaleString()}</td>
                        <td className="px-4 py-3 text-center">
                          {row.stockouts > 0 ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 bg-amber-500/10 text-amber-400 text-[10px] font-bold rounded-sm border border-amber-500/20">
                              {row.stockouts}
                            </span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-400 font-medium">${row.returns_amount.toLocaleString()}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {filteredData.length > 50 && (
            <div className="text-center pt-4 text-xs font-bold text-slate-400">
              ... and {filteredData.length - 50} more records. Narrow filters or use the <span className="text-blue-400">Export to CSV</span> option for the complete spreadsheet download.
            </div>
          )}
        </section>

      </main>
    </div>
  );
}
