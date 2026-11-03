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
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  RotateCcw,
  Filter as FilterIcon,
} from 'lucide-react';
import { useBankingAuth } from '../../context/BankingAuthContext';
import { BankTransaction } from '../../types/banking';
import { BankingTab } from './BankingLayout';
import {
  exportTransactionsCsv,
  exportTransactionsPdf,
  formatUtcDateTime,
} from '../../utils/transactionHistoryExport';

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
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'amount_high'>('newest');

  // Date Range input state (interactive form fields)
  const [startDateInput, setStartDateInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');

  // Applied Date Range state (updated strictly upon clicking the Filter button)
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');
  const [dateError, setDateError] = useState('');

  // Pagination Controls
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Apply Filter Action
  const handleApplyFilter = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (startDateInput && endDateInput && startDateInput > endDateInput) {
      setDateError('Start date must be before or equal to end date.');
      return;
    }
    setDateError('');
    setAppliedStartDate(startDateInput);
    setAppliedEndDate(endDateInput);
    setCurrentPage(1);
  };

  // Reset / Clear Filter Action
  const handleResetFilter = () => {
    setStartDateInput('');
    setEndDateInput('');
    setAppliedStartDate('');
    setAppliedEndDate('');
    setDateError('');
    setSearchTerm('');
    setCurrentPage(1);
  };

  // Filtered & Chronologically Sorted Transactions
  const filtered = useMemo(() => {
    return transactions
      .filter((t) => {
        // Date range filtering
        if (appliedStartDate) {
          const txDate = t.timestamp.slice(0, 10);
          if (txDate < appliedStartDate) return false;
        }
        if (appliedEndDate) {
          const txDate = t.timestamp.slice(0, 10);
          if (txDate > appliedEndDate) return false;
        }

        // Search query filtering
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          return (
            t.description.toLowerCase().includes(q) ||
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
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();

        if (sortBy === 'newest') {
          if (timeB !== timeA) return timeB - timeA;
          return b.reference.localeCompare(a.reference);
        }
        if (sortBy === 'oldest') {
          if (timeA !== timeB) return timeA - timeB;
          return a.reference.localeCompare(b.reference);
        }
        if (sortBy === 'amount_high') {
          if (b.amount !== a.amount) return b.amount - a.amount;
          return timeB - timeA;
        }
        return timeB - timeA;
      });
  }, [transactions, appliedStartDate, appliedEndDate, searchTerm, sortBy]);

  // Paginated Slicing
  const totalPages = pageSize === -1 ? 1 : Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedTransactions = useMemo(() => {
    if (pageSize === -1) return filtered;
    const startIdx = (currentPage - 1) * pageSize;
    return filtered.slice(startIdx, startIdx + pageSize);
  }, [filtered, currentPage, pageSize]);

  // Reporting period descriptor for exports
  const reportingPeriod = useMemo(() => {
    if (appliedStartDate && appliedEndDate) {
      return `${appliedStartDate} to ${appliedEndDate}`;
    }
    if (appliedStartDate) {
      return `From ${appliedStartDate}`;
    }
    if (appliedEndDate) {
      return `Until ${appliedEndDate}`;
    }
    return 'All Available Records';
  }, [appliedStartDate, appliedEndDate]);

  // Export PDF (strictly omits account balance per privacy guidelines)
  const handleExportPdf = () => {
    const fullName = user ? `${user.firstName} ${user.lastName}` : undefined;
    exportTransactionsPdf(filtered, reportingPeriod, fullName);
  };

  // Export CSV (strictly omits account balance per privacy guidelines)
  const handleExportCsv = () => {
    exportTransactionsCsv(filtered);
  };

  const handleGoToStatements = () => {
    if (onOpenStatements) {
      onOpenStatements();
    } else if (onSelectTab) {
      onSelectTab('statements');
    }
  };

  const isFiltered = Boolean(appliedStartDate || appliedEndDate || searchTerm.trim());

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn">
      {/* 1. Header Bar & Navigation */}
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
          <h1 className="text-2xl font-bold tracking-tight text-[#1C2B4C] dark:text-white">Transaction History</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Verified electronic records and settlement history.
          </p>
        </div>

        {/* Action Buttons: PDF & CSV Exports */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleGoToStatements}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-full transition-colors cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
            <span>Statements</span>
          </button>
          <button
            onClick={handleExportPdf}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-[#1C2B4C] hover:bg-[#152033] dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-bold rounded-full transition-colors cursor-pointer shadow-xs active:scale-95"
          >
            <Download className="w-3.5 h-3.5 text-white" />
            <span>Export PDF</span>
          </button>
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-full transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 2. Simplified Date-Range Selection & Filter Area */}
      <div className="bg-white dark:bg-[#152033] rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
        {/* Date Filter Controls Row */}
        <form onSubmit={handleApplyFilter} className="space-y-3">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
            {/* Start Date & End Date Pickers */}
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  Start Date
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={startDateInput}
                    onChange={(e) => {
                      setStartDateInput(e.target.value);
                      if (dateError) setDateError('');
                    }}
                    className="px-3 py-2 bg-slate-50 dark:bg-[#10192A] border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:bg-white dark:focus:bg-[#0B111E] focus:outline-none focus:ring-2 focus:ring-[#1C2B4C] dark:focus:ring-slate-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  End Date
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={endDateInput}
                    onChange={(e) => {
                      setEndDateInput(e.target.value);
                      if (dateError) setDateError('');
                    }}
                    className="px-3 py-2 bg-slate-50 dark:bg-[#10192A] border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:bg-white dark:focus:bg-[#0B111E] focus:outline-none focus:ring-2 focus:ring-[#1C2B4C] dark:focus:ring-slate-600"
                  />
                </div>
              </div>

              {/* Dedicated Filter Button */}
              <div className="pt-5 flex items-center space-x-2">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#C8102E] hover:bg-[#A00B22] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer active:scale-95"
                >
                  <FilterIcon className="w-3.5 h-3.5" />
                  <span>Filter</span>
                </button>

                {(startDateInput || endDateInput || appliedStartDate || appliedEndDate) && (
                  <button
                    type="button"
                    onClick={handleResetFilter}
                    className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition-colors flex items-center space-x-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Clear</span>
                  </button>
                )}
              </div>
            </div>

            {/* Search & Sort Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search records..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-[#10192A] border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:bg-white dark:focus:bg-[#0B111E] focus:outline-none focus:ring-2 focus:ring-[#1C2B4C] dark:focus:ring-slate-600"
                />
              </div>

              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 bg-slate-50 dark:bg-[#10192A] border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="amount_high">Highest Amount</option>
              </select>
            </div>
          </div>

          {/* Inline Validation Error */}
          {dateError && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl text-red-700 dark:text-red-300 text-xs flex items-center space-x-2 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
              <span>{dateError}</span>
            </div>
          )}

          {/* Active Filter Status Indicator */}
          {isFiltered && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>
                Showing {filtered.length} matching record{filtered.length === 1 ? '' : 's'}
                {appliedStartDate && appliedEndDate && ` between ${appliedStartDate} and ${appliedEndDate}`}
                {appliedStartDate && !appliedEndDate && ` starting from ${appliedStartDate}`}
                {!appliedStartDate && appliedEndDate && ` up to ${appliedEndDate}`}
                {searchTerm.trim() && ` matching "${searchTerm}"`}
              </span>
              <button
                type="button"
                onClick={handleResetFilter}
                className="text-xs font-semibold text-[#C8102E] hover:underline cursor-pointer"
              >
                Show all records
              </button>
            </div>
          )}
        </form>
      </div>

      {/* 3. Transaction Records Table */}
      <div className="bg-white dark:bg-[#152033] rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400 dark:text-slate-500 space-y-2">
            <History className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 stroke-[1.5]" />
            <div className="text-sm font-semibold">No records match your selected filter</div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Please adjust your date range or search query.
            </p>
            {isFiltered && (
              <button
                onClick={handleResetFilter}
                className="mt-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Show all records
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">
                  <th className="pb-3 pl-2">Flow</th>
                  <th className="pb-3">Description &amp; Counterparty</th>
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
                    ? tx.senderName
                      ? `From: ${tx.senderName}${tx.senderBank ? ` (${tx.senderBank})` : ''}`
                      : ''
                    : tx.recipientName
                    ? `To: ${tx.recipientName}${tx.recipientBank ? ` (${tx.recipientBank})` : ''}`
                    : '';

                  const { dateStr, timeStr } = formatUtcDateTime(tx.timestamp);

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
                          <span
                            className={`text-[10px] font-bold uppercase hidden xl:inline ${
                              isCredit ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {isCredit ? 'In' : 'Out'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 font-semibold text-slate-800 dark:text-slate-200 group-hover:text-[#C8102E] dark:group-hover:text-red-400 transition-colors">
                        <div className="flex items-center space-x-1.5 flex-wrap">
                          <span>{tx.description}</span>
                        </div>
                        {counterpartyLabel && (
                          <div
                            className={`text-[11px] font-medium mt-0.5 ${
                              isCredit ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {counterpartyLabel}
                          </div>
                        )}
                      </td>
                      <td className="py-3 font-mono text-[11px] text-slate-400 dark:text-slate-500 hidden md:table-cell">
                        {tx.reference}
                      </td>
                      <td className="py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap font-medium text-[11px]">
                        <div>{dateStr}</div>
                        {timeStr && <div className="text-[10px] text-slate-400">{timeStr}</div>}
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
                          {isCredit ? '+' : '-'}$
                          {tx.amount.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </td>
                      <td className="py-3 text-right pr-2 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap font-medium">
                        $
                        {tx.balanceAfter.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
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
