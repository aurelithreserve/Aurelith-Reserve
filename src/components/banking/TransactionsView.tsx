import React, { useState, useMemo } from 'react';
import {
  History,
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  FileText,
  ArrowLeft,
  Calendar,
  ChevronDown,
  ChevronUp,
  BarChart3,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Info,
} from 'lucide-react';
import { useBankingAuth } from '../../context/BankingAuthContext';
import { BankTransaction } from '../../types/banking';
import { BankingTab } from './BankingLayout';
import {
  calculateYearlyLedgerSummaries,
  TARGET_CLIENT_ID,
  ACTUAL_CLIENT_ID,
  INITIAL_OPENING_BALANCE,
} from '../../data/simulatedLedgerAR6F7079';

interface TransactionsViewProps {
  onOpenDetails: (tx: BankTransaction) => void;
  onSelectTab?: (tab: BankingTab) => void;
  onOpenStatements?: () => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  onOpenDetails,
  onSelectTab,
  onOpenStatements,
}) => {
  const { transactions, user } = useBankingAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [directionFilter, setDirectionFilter] = useState<'all' | 'debit' | 'credit'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'amount_high'>('newest');

  // Date Range Filtering
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  // Expandable Yearly Summary Ledger
  const [showYearlySummary, setShowYearlySummary] = useState(false);

  // Pagination Controls
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Check if viewing target client account AR-70363A (or legacy AR-6F7079)
  const isTargetAccount =
    user?.clientId === 'AR-70363A' ||
    user?.clientId === 'AR-6F7079' ||
    user?.firstName === 'Thane';

  // Categories present in transactions
  const categories = Array.from(new Set(transactions.map((t) => t.category)));

  // Filtered & Sorted Transactions
  const filtered = useMemo(() => {
    return transactions
      .filter((t) => {
        if (directionFilter !== 'all' && t.direction !== directionFilter) return false;
        if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
        if (startDateFilter) {
          const txDate = t.timestamp.slice(0, 10);
          if (txDate < startDateFilter) return false;
        }
        if (endDateFilter) {
          const txDate = t.timestamp.slice(0, 10);
          if (txDate > endDateFilter) return false;
        }
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          return (
            t.description.toLowerCase().includes(q) ||
            t.category.toLowerCase().includes(q) ||
            t.reference.toLowerCase().includes(q) ||
            (t.senderName && t.senderName.toLowerCase().includes(q)) ||
            (t.senderBank && t.senderBank.toLowerCase().includes(q)) ||
            (t.recipientName && t.recipientName.toLowerCase().includes(q)) ||
            (t.recipientBank && t.recipientBank.toLowerCase().includes(q))
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        if (sortBy === 'oldest') return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        if (sortBy === 'amount_high') return b.amount - a.amount;
        return 0;
      });
  }, [transactions, directionFilter, categoryFilter, startDateFilter, endDateFilter, searchTerm, sortBy]);

  // Derived Yearly Summaries from Ledger
  const yearlySummaries = useMemo(() => {
    return calculateYearlyLedgerSummaries(
      transactions,
      isTargetAccount ? INITIAL_OPENING_BALANCE : (transactions[transactions.length - 1]?.balanceAfter || 0)
    );
  }, [transactions, isTargetAccount]);

  // Paginated Slicing
  const totalPages = pageSize === -1 ? 1 : Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedTransactions = useMemo(() => {
    if (pageSize === -1) return filtered;
    const startIdx = (currentPage - 1) * pageSize;
    return filtered.slice(startIdx, startIdx + pageSize);
  }, [filtered, currentPage, pageSize]);

  // Handle Preset Ranges
  const handleSetPreset = (preset: 'all' | '2018-2026' | '2026' | 'last30') => {
    setCurrentPage(1);
    if (preset === 'all') {
      setStartDateFilter('');
      setEndDateFilter('');
    } else if (preset === '2018-2026') {
      setStartDateFilter('2018-09-02');
      setEndDateFilter('2026-10-28');
    } else if (preset === '2026') {
      setStartDateFilter('2026-01-01');
      setEndDateFilter('2026-10-28');
    } else if (preset === 'last30') {
      const now = new Date();
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      setStartDateFilter(past.toISOString().slice(0, 10));
      setEndDateFilter(now.toISOString().slice(0, 10));
    }
  };

  const exportCSV = () => {
    const headers = ['Reference,Date,Type,Category,Description,SenderName,SenderBank,RecipientName,RecipientBank,Amount,Fee,Direction,Status,BalanceAfter\n'];
    const rows = filtered.map((t) => {
      return `"${t.reference}","${t.timestamp}","${t.type}","${t.category}","${(t.description || '').replace(/"/g, '""')}","${(t.senderName || '').replace(/"/g, '""')}","${(t.senderBank || '').replace(/"/g, '""')}","${(t.recipientName || '').replace(/"/g, '""')}","${(t.recipientBank || '').replace(/"/g, '""')}","${t.amount}","${t.fee || 0}","${t.direction}","${t.status}","${t.balanceAfter}"\n`;
    });
    const blob = new Blob([...headers, ...rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Aurelith_Reserve_Ledger_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleGoToStatements = () => {
    if (onOpenStatements) {
      onOpenStatements();
    } else if (onSelectTab) {
      onSelectTab('statements');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn">
      {/* Title & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          {onSelectTab && (
            <button
              onClick={() => onSelectTab('home')}
              className="inline-flex items-center space-x-1.5 text-xs font-bold text-[#1C2B4C] dark:text-slate-300 hover:text-[#C8102E] dark:hover:text-red-400 transition-colors mb-2 cursor-pointer group"
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              <span>Back to Home</span>
            </button>
          )}
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold tracking-tight text-[#1C2B4C] dark:text-white">Transaction Ledger</h1>
            {isTargetAccount && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 rounded border border-amber-300 dark:border-amber-800">
                Demo Ledger • AR-6F7079
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time audit log of all debits, deposits, transfers, allocations, and custodial charges.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Yearly Summaries Toggle */}
          <button
            onClick={() => setShowYearlySummary((prev) => !prev)}
            className={`inline-flex items-center space-x-1.5 px-3 py-2 text-xs font-bold rounded-full transition-colors cursor-pointer border ${
              showYearlySummary
                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-50'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Yearly Summaries</span>
            {showYearlySummary ? <ChevronUp className="w-3.5 h-3.5 ml-0.5" /> : <ChevronDown className="w-3.5 h-3.5 ml-0.5" />}
          </button>

          {/* Account Statement Action */}
          <button
            onClick={handleGoToStatements}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-[#1C2B4C] hover:bg-[#152033] dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-bold rounded-full transition-colors cursor-pointer shadow-xs active:scale-95"
          >
            <FileText className="w-4 h-4 text-white" />
            <span>Account Statement</span>
          </button>

          <button
            onClick={exportCSV}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-full transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Target Account Demonstration Banner (for client ID AR-6F7079 / Thane Rivers) */}
      {isTargetAccount && (
        <div className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200">
          <div className="flex items-start space-x-3">
            <Info className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="font-bold">
                Client ID AR-6F7079 (Account Holder: Thane Rivers) — Reconciled Historical Ledger
              </div>
              <p className="text-[11px] text-amber-800/90 dark:text-amber-300/80">
                Period: September 2, 2018 → October 28, 2026 • Opening: $200,000.00 • Authoritative Closing: $3,800,000.00.
                Reconciliation Target: $3,782,685.00 (Discrepancy: -$17,315.00 subject to authorized adjustment).
              </p>
            </div>
          </div>
          <div className="inline-flex items-center space-x-1 font-mono text-[11px] font-bold text-amber-900 dark:text-amber-100 px-2.5 py-1 bg-amber-100/80 dark:bg-amber-900/50 rounded-lg shrink-0">
            <span>52 Audited Records</span>
          </div>
        </div>
      )}

      {/* Expandable Yearly Summaries Card */}
      {showYearlySummary && (
        <div className="bg-white dark:bg-[#152033] rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-[#1C2B4C] dark:text-white flex items-center space-x-2">
                <BarChart3 className="w-4 h-4 text-[#C8102E] dark:text-red-400" />
                <span>Yearly Ledger Summaries &amp; Reconciliation Balance</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Every year-end closing balance equals the succeeding year's opening balance, calculated dynamically from the underlying ledger.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="pb-2.5">Year</th>
                  <th className="pb-2.5 text-right">Opening Balance</th>
                  <th className="pb-2.5 text-right text-emerald-600 dark:text-emerald-400">Total Credits</th>
                  <th className="pb-2.5 text-right text-red-600 dark:text-red-400">Total Debits</th>
                  <th className="pb-2.5 text-right">Net Activity</th>
                  <th className="pb-2.5 text-right font-bold text-slate-900 dark:text-white">Closing Balance</th>
                  <th className="pb-2.5 text-center">Tx Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                {yearlySummaries.map((yr) => (
                  <tr key={yr.year} className="hover:bg-slate-50 dark:hover:bg-[#10192A] transition-colors">
                    <td className="py-2.5 font-bold text-slate-800 dark:text-slate-200">{yr.year}</td>
                    <td className="py-2.5 text-right text-slate-600 dark:text-slate-300">
                      ${yr.openingBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 text-right text-emerald-600 dark:text-emerald-400 font-semibold">
                      +${yr.totalCredits.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      <span className="text-[9px] text-slate-400 ml-1">({yr.creditCount})</span>
                    </td>
                    <td className="py-2.5 text-right text-red-600 dark:text-red-400 font-semibold">
                      -${yr.totalDebits.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      <span className="text-[9px] text-slate-400 ml-1">({yr.debitCount})</span>
                    </td>
                    <td className="py-2.5 text-right font-medium text-slate-700 dark:text-slate-300">
                      {yr.netChange >= 0 ? '+' : '-'}${Math.abs(yr.netChange).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 text-right font-bold text-[#1C2B4C] dark:text-white">
                      ${yr.closingBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 text-center text-slate-500 dark:text-slate-400 font-sans text-xs">
                      {yr.transactionCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Filter & Controls Card */}
      <div className="bg-white dark:bg-[#152033] rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
        {/* Row 1: Search, Category, Sort */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Search */}
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search description, reference, or category..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-[#10192A] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-xs font-medium focus:bg-white dark:focus:bg-[#0B111E] focus:outline-none focus:ring-2 focus:ring-[#1C2B4C] dark:focus:ring-slate-600"
            />
          </div>

          {/* Category Filter */}
          <div className="sm:col-span-3">
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#10192A] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold focus:bg-white dark:focus:bg-[#0B111E] focus:outline-none cursor-pointer"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By */}
          <div className="sm:col-span-3">
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#10192A] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold focus:bg-white dark:focus:bg-[#0B111E] focus:outline-none cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First (Chronological)</option>
              <option value="amount_high">Highest Amount</option>
            </select>
          </div>
        </div>

        {/* Row 2: Date-Range Filtering */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center space-x-1.5 text-xs text-slate-600 dark:text-slate-300">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-semibold">Date Range:</span>
            </div>
            <input
              type="date"
              value={startDateFilter}
              onChange={(e) => {
                setStartDateFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1 bg-slate-50 dark:bg-[#10192A] border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none"
              placeholder="From"
            />
            <span className="text-slate-400 text-xs">to</span>
            <input
              type="date"
              value={endDateFilter}
              onChange={(e) => {
                setEndDateFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1 bg-slate-50 dark:bg-[#10192A] border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none"
              placeholder="To"
            />
            {(startDateFilter || endDateFilter) && (
              <button
                onClick={() => handleSetPreset('all')}
                className="text-[11px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline cursor-pointer ml-1"
              >
                Clear
              </button>
            )}
          </div>

          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => handleSetPreset('2018-2026')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                startDateFilter === '2018-09-02' && endDateFilter === '2026-10-28'
                  ? 'bg-[#1C2B4C] dark:bg-slate-700 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              2018–2026 Reconciled
            </button>
            <button
              onClick={() => handleSetPreset('2026')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                startDateFilter === '2026-01-01' && endDateFilter === '2026-10-28'
                  ? 'bg-[#1C2B4C] dark:bg-slate-700 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              2026 YTD
            </button>
            <button
              onClick={() => handleSetPreset('all')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                !startDateFilter && !endDateFilter
                  ? 'bg-[#1C2B4C] dark:bg-slate-700 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              All Records
            </button>
          </div>
        </div>

        {/* Direction Switcher Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold pt-1 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex gap-2">
            <button
              onClick={() => {
                setDirectionFilter('all');
                setCurrentPage(1);
              }}
              className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                directionFilter === 'all'
                  ? 'bg-[#1C2B4C] dark:bg-slate-700 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              All Activity ({filtered.length})
            </button>

            <button
              onClick={() => {
                setDirectionFilter('credit');
                setCurrentPage(1);
              }}
              className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                directionFilter === 'credit'
                  ? 'bg-emerald-600 dark:bg-emerald-700 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Deposits &amp; Credits
            </button>

            <button
              onClick={() => {
                setDirectionFilter('debit');
                setCurrentPage(1);
              }}
              className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                directionFilter === 'debit'
                  ? 'bg-[#C8102E] text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Withdrawals &amp; Debits
            </button>
          </div>

          {/* Page Size Selector */}
          <div className="flex items-center space-x-1.5 text-[11px] text-slate-500">
            <span>Show:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-slate-50 dark:bg-[#10192A] border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value={15}>15</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={-1}>All ({filtered.length})</option>
            </select>
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white dark:bg-[#152033] rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400 dark:text-slate-500 space-y-2">
            <History className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 stroke-[1.5]" />
            <div className="text-sm font-semibold">No transactions match your query</div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Try adjusting your date range, search criteria, or category filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">
                  <th className="pb-3 pl-2">Type</th>
                  <th className="pb-3">Description &amp; Counterparty</th>
                  <th className="pb-3 hidden sm:table-cell">Category</th>
                  <th className="pb-3 hidden md:table-cell">Reference</th>
                  <th className="pb-3">Date &amp; Time</th>
                  <th className="pb-3 text-right hidden lg:table-cell">Fee</th>
                  <th className="pb-3 text-center hidden sm:table-cell">Status</th>
                  <th className="pb-3 text-right">Amount</th>
                  <th className="pb-3 text-right pr-2">Ledger Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedTransactions.map((tx) => {
                  const isCredit = tx.direction === 'credit';
                  const counterpartyLabel = isCredit
                    ? (tx.senderName ? `From: ${tx.senderName}${tx.senderBank ? ` (${tx.senderBank})` : ''}` : '')
                    : (tx.recipientName ? `To: ${tx.recipientName}${tx.recipientBank ? ` (${tx.recipientBank})` : ''}` : '');

                  return (
                    <tr
                      key={tx.id}
                      onClick={() => onOpenDetails(tx)}
                      className="hover:bg-slate-50 dark:hover:bg-[#10192A] transition-colors cursor-pointer group"
                    >
                      <td className="py-3 pl-2">
                        <div className="flex items-center space-x-1.5">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                              isCredit
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                                : 'bg-red-100 dark:bg-red-950/60 text-[#C8102E] dark:text-red-400'
                            }`}
                          >
                            {isCredit ? (
                              <ArrowDownLeft className="w-3.5 h-3.5 stroke-[2.2]" />
                            ) : (
                              <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.2]" />
                            )}
                          </div>
                          <span className={`text-[10px] font-bold uppercase hidden xl:inline ${
                            isCredit ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'
                          }`}>
                            {isCredit ? 'In' : 'Out'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 font-semibold text-slate-800 dark:text-slate-200 group-hover:text-[#C8102E] dark:group-hover:text-red-400 transition-colors">
                        <div className="flex items-center space-x-1.5 flex-wrap">
                          <span>{tx.description}</span>
                        </div>
                        {counterpartyLabel && (
                          <div className={`text-[11px] font-medium mt-0.5 ${
                            isCredit ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
                          }`}>
                            {counterpartyLabel}
                          </div>
                        )}
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-normal sm:hidden mt-0.5">{tx.category}</div>
                      </td>
                      <td className="py-3 text-slate-500 dark:text-slate-400 hidden sm:table-cell font-medium">
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md text-[10px] text-slate-700 dark:text-slate-300 font-medium">
                          {tx.category}
                        </span>
                      </td>
                      <td className="py-3 font-mono text-[11px] text-slate-400 dark:text-slate-500 hidden md:table-cell">
                        {tx.reference}
                      </td>
                      <td className="py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap font-medium text-[11px]">
                        <div>
                          {new Date(tx.timestamp).toLocaleDateString([], {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="py-3 text-right font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap text-[11px] hidden lg:table-cell">
                        {tx.fee && tx.fee > 0 ? `$${tx.fee.toFixed(2)}` : '$0.00'}
                      </td>
                      <td className="py-3 text-center whitespace-nowrap hidden sm:table-cell">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          {tx.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 text-right font-mono font-bold whitespace-nowrap">
                        <span className={isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}>
                          {isCredit ? '+' : '-'}${tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="py-3 text-right pr-2 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap font-medium">
                        ${tx.balanceAfter.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Strip */}
        {filtered.length > 0 && pageSize !== -1 && totalPages > 1 && (
          <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
            <div>
              Showing {Math.min(filtered.length, (currentPage - 1) * pageSize + 1)} to{' '}
              {Math.min(filtered.length, currentPage * pageSize)} of {filtered.length} entries
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer disabled:cursor-not-allowed"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-semibold">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer disabled:cursor-not-allowed"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
