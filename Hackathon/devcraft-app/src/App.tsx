// src/App.tsx
import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db/db';
import { QueryService } from './services/queryService';
import { createOrUpdateOrder, softDeleteOrder, ingestParsedMessage } from './services/orderService';
import { applyRemoteOperations, exportLocalOperations, initializeLiveSync } from './services/syncEngine';
import { parseOrder } from './services/parseOrder';
import { v4 as uuidv4 } from 'uuid';
import { 
  AlertTriangle, 
  Clock, 
  DollarSign, 
  Plus, 
  Wifi, 
  WifiOff, 
  Trash2, 
  ArrowUpDown, 
  Check, 
  Search,
  History,
  Sparkles,
  Send
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'all' | 'due' | 'debts' | 'capacity' | 'history' | 'conflicts' | 'sync'>('all');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Unstructured Message Intake State (Unified parse_order wrapper)
  const [rawMessageInput, setRawMessageInput] = useState('');
  const [isParsing, setIsParsing] = useState(false);

  // Sync & Search States
  const [syncPayload, setSyncPayload] = useState('');
  const [syncSuccessMsg, setSyncSuccessMsg] = useState('');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');

  // Manual Quick-form States
  const [custName, setCustName] = useState('');
  const [itemDesc, setItemDesc] = useState('');
  const [itemQty, setItemQty] = useState(1);
  const [amount, setAmount] = useState<number | ''>('');
  const [dueDate, setDueDate] = useState('');

  // Live Queries from Local IndexedDB (Dexie)
  const orders = useLiveQuery(() => db.orders.filter(o => !o.deleted).reverse().toArray(), []);
  const conflicts = useLiveQuery(() => db.conflicts.filter(c => !c.resolved).toArray(), []);

  // Operational Metrics (Objective 4)
  const [dueMetrics, setDueMetrics] = useState<{ dueToday: any[]; overdue: any[] }>({ dueToday: [], overdue: [] });
  const [debtMetrics, setDebtMetrics] = useState<{ unpaid: any[]; totalOwed: number }>({ unpaid: [], totalOwed: 0 });
  const [capacityMetrics, setCapacityMetrics] = useState<{ orderCount: number; totalItems: number }>({ orderCount: 0, totalItems: 0 });

  useEffect(() => {
    // Start peer / multi-tab background sync listener
    initializeLiveSync();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const refreshMetrics = async () => {
      setDueMetrics(await QueryService.getDueAndOverdue());
      setDebtMetrics(await QueryService.getOutstandingBalances());
      const cap = await QueryService.getWeeklyCapacity();
      setCapacityMetrics({ orderCount: cap.orderCount, totalItems: cap.totalItems });
    };

    refreshMetrics();
    const interval = setInterval(refreshMetrics, 2000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [orders]);

  // Primary Path: Unstructured Message Ingestion (Auto online/offline)
  const handleProcessRawMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawMessageInput.trim() || isParsing) return;

    setIsParsing(true);
    try {
      // Calls unified abstraction: api_parser if online, local_parser if offline
      const parsedOutput = await parseOrder(rawMessageInput);
      await ingestParsedMessage(parsedOutput);
      setRawMessageInput('');
    } catch (err) {
      console.error('Failed to parse and save message:', err);
      alert('Error parsing message. Please verify input.');
    } finally {
      setIsParsing(false);
    }
  };

  // Fallback Path: Manual Order Creation
  const handleManualCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim() && !itemDesc.trim()) return;

    await createOrUpdateOrder({
      id: uuidv4(),
      customer: custName || 'Walk-in Customer',
      items: [{ description: itemDesc || 'General Order', quantity: Number(itemQty) || 1, attributes: {} }],
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      amount: amount !== '' ? Number(amount) : null,
      is_paid: false,
      status: 'pending'
    });

    setCustName('');
    setItemDesc('');
    setItemQty(1);
    setAmount('');
    setDueDate('');
  };

  const handleExportOps = async () => {
    const ops = await exportLocalOperations();
    setSyncPayload(JSON.stringify(ops, null, 2));
  };

  const handleImportOps = async () => {
    if (!syncPayload.trim()) return;
    try {
      const ops = JSON.parse(syncPayload);
      await applyRemoteOperations(ops);
      setSyncSuccessMsg('Operations merged deterministically!');
      setTimeout(() => setSyncSuccessMsg(''), 3000);
    } catch {
      alert('Invalid operation log JSON payload.');
    }
  };

  const handleResolveConflict = async (conflictId: string) => {
    await db.conflicts.update(conflictId, { resolved: true });
  };

  const getDisplayedOrders = () => {
    if (!orders) return [];
    if (activeTab === 'due') {
      const today = new Date().toISOString().split('T')[0];
      return orders.filter(o => o.due_date && o.due_date.split('T')[0] <= today && o.status !== 'completed');
    }
    if (activeTab === 'debts') {
      return orders.filter(o => !o.is_paid && (o.amount ?? 0) > 0);
    }
    if (activeTab === 'history') {
      if (!customerSearchQuery.trim()) return [];
      return orders.filter(o => o.customer && o.customer.toLowerCase().includes(customerSearchQuery.toLowerCase()));
    }
    return orders;
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-6 max-w-4xl mx-auto font-sans">
      {/* Header & Network Indicator */}
      <header className="flex justify-between items-center pb-4 border-b border-slate-700">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-indigo-400">DevCraft Order Desk</h1>
          <p className="text-xs text-slate-400">Single-Operator Offline Console</p>
        </div>
        <div className="flex items-center gap-2">
          {isOnline ? (
            <span className="flex items-center gap-1 text-xs bg-emerald-950 text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-800 font-medium">
              <Wifi size={14} /> Online
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs bg-amber-950 text-amber-400 px-2.5 py-1 rounded-full border border-amber-800 font-medium">
              <WifiOff size={14} /> Airplane Mode
            </span>
          )}
          {conflicts && conflicts.length > 0 && (
            <button
              onClick={() => setActiveTab('conflicts')}
              className="flex items-center gap-1 text-xs bg-rose-950 text-rose-300 px-2.5 py-1 rounded-full border border-rose-800 animate-pulse font-medium">
              <AlertTriangle size={14} /> {conflicts.length} Conflicts
            </button>
          )}
        </div>
      </header>

      {/* Operational Metrics Cards (Objective 4) */}
      <div className="grid grid-cols-3 gap-2 my-4">
        <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
          <span className="text-[11px] text-slate-400 block">Overdue / Due Today</span>
          <span className="text-lg font-bold text-rose-400">{dueMetrics.overdue.length}</span>
          <span className="text-xs text-slate-500"> / {dueMetrics.dueToday.length} today</span>
        </div>
        <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
          <span className="text-[11px] text-slate-400 block">Total Unpaid</span>
          <span className="text-lg font-bold text-amber-400">₹{debtMetrics.totalOwed}</span>
          <span className="text-xs text-slate-500"> ({debtMetrics.unpaid.length} orders)</span>
        </div>
        <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
          <span className="text-[11px] text-slate-400 block">Week Committed Items</span>
          <span className="text-lg font-bold text-indigo-400">{capacityMetrics.totalItems}</span>
          <span className="text-xs text-slate-500"> across {capacityMetrics.orderCount} jobs</span>
        </div>
      </div>

      {/* PRIMARY SECTION: Unstructured WhatsApp/Hinglish Message Intake */}
      <form onSubmit={handleProcessRawMessage} className="bg-indigo-950/40 border border-indigo-700/60 p-3 rounded-lg mb-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
            <Sparkles size={14} className="text-indigo-400" />
            Unstructured Message Intake (Auto Online/Offline Parser)
          </span>
          <span className="text-[10px] text-indigo-400/80 font-mono">
            {isOnline ? 'Hosted Model' : 'Local Fallback'}
          </span>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder='e.g., "bhaiya 2 kurta chahiye navy blue, chest 40, parso tak ho jayega kya?"'
            value={rawMessageInput}
            onChange={e => setRawMessageInput(e.target.value)}
            disabled={isParsing}
            className="flex-1 bg-slate-900 border border-indigo-800/80 rounded px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={isParsing || !rawMessageInput.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium px-4 py-2 rounded text-xs flex items-center gap-1.5 transition-colors">
            <Send size={13} /> {isParsing ? 'Parsing...' : 'Parse & Save'}
          </button>
        </div>
      </form>

      {/* FALLBACK SECTION: Manual Order Entry Form */}
      <details className="bg-slate-800/60 border border-slate-700/80 p-2.5 rounded-lg mb-4 group">
        <summary className="text-xs font-medium text-slate-400 cursor-pointer select-none hover:text-slate-200">
          + Manual Order Entry (Optional Direct Form)
        </summary>
        <form onSubmit={handleManualCreate} className="mt-3 space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <input
              type="text"
              placeholder="Customer Name"
              value={custName}
              onChange={e => setCustName(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white placeholder-slate-500"
            />
            <input
              type="text"
              placeholder="Item Description"
              value={itemDesc}
              onChange={e => setItemDesc(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white placeholder-slate-500"
            />
            <input
              type="number"
              min="1"
              placeholder="Qty"
              value={itemQty}
              onChange={e => setItemQty(Number(e.target.value) || 1)}
              className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white placeholder-slate-500"
            />
            <input
              type="number"
              placeholder="Amount (₹)"
              value={amount}
              onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
              className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white placeholder-slate-500"
            />
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
            />
          </div>
          <button type="submit" className="w-full bg-slate-700 hover:bg-slate-600 text-white font-medium py-1.5 rounded text-xs flex items-center justify-center gap-1 transition-colors">
            <Plus size={14} /> Add Order to Local Store
          </button>
        </form>
      </details>

      {/* Query Tabs Navigation */}
      <nav className="flex gap-2 mb-3 text-xs overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-3 py-1.5 rounded-md ${activeTab === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'}`}>
          All Orders ({orders?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('due')}
          className={`px-3 py-1.5 rounded-md flex items-center gap-1 ${activeTab === 'due' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'}`}>
          <Clock size={12} /> Due/Overdue ({dueMetrics.dueToday.length + dueMetrics.overdue.length})
        </button>
        <button
          onClick={() => setActiveTab('debts')}
          className={`px-3 py-1.5 rounded-md flex items-center gap-1 ${activeTab === 'debts' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'}`}>
          <DollarSign size={12} /> Unpaid ({debtMetrics.unpaid.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-3 py-1.5 rounded-md flex items-center gap-1 ${activeTab === 'history' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'}`}>
          <History size={12} /> Customer Specs
        </button>
        <button
          onClick={() => setActiveTab('sync')}
          className={`px-3 py-1.5 rounded-md flex items-center gap-1 ${activeTab === 'sync' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'}`}>
          <ArrowUpDown size={12} /> Sync / Op-Log
        </button>
        {conflicts && conflicts.length > 0 && (
          <button
            onClick={() => setActiveTab('conflicts')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1 ${activeTab === 'conflicts' ? 'bg-rose-700 text-white' : 'bg-rose-950 text-rose-300'}`}>
            Conflicts ({conflicts.length})
          </button>
        )}
      </nav>

      {/* Customer Prior History Search View */}
      {activeTab === 'history' && (
        <div className="space-y-3 mb-4">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search customer name to inspect past order specs..."
              value={customerSearchQuery}
              onChange={e => setCustomerSearchQuery(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500"
            />
          </div>
          {customerSearchQuery && (
            <div className="text-xs text-slate-400">
              Found {getDisplayedOrders().length} previous job(s) for &quot;{customerSearchQuery}&quot;
            </div>
          )}
        </div>
      )}

      {/* Sync / Operation Log View (Test C Determinism Engine) */}
      {activeTab === 'sync' && (
        <div className="bg-slate-800 border border-slate-700 p-4 rounded-lg space-y-3 mb-4">
          <h3 className="text-sm font-semibold text-slate-200">Test C Sync Simulation (Deterministic Op-Log Transfer)</h3>
          <p className="text-xs text-slate-400">Export mutation log to another device or paste remote operations here to merge deterministically.</p>
          <div className="flex gap-2">
            <button onClick={handleExportOps} className="bg-indigo-600 hover:bg-indigo-500 text-xs px-3 py-1.5 rounded text-white font-medium transition-colors">
              Export My Op-Log
            </button>
            <button onClick={handleImportOps} className="bg-emerald-600 hover:bg-emerald-500 text-xs px-3 py-1.5 rounded text-white font-medium transition-colors">
              Apply Remote Op-Log
            </button>
          </div>
          {syncSuccessMsg && <div className="text-xs text-emerald-400 font-medium">{syncSuccessMsg}</div>}
          <textarea
            rows={5}
            value={syncPayload}
            onChange={e => setSyncPayload(e.target.value)}
            placeholder="Op-log JSON payload appears here..."
            className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs font-mono text-slate-200"
          />
        </div>
      )}

      {/* Conflicts View (Surfaces concurrent writes without silent data loss) */}
      {activeTab === 'conflicts' && (
        <div className="space-y-2 mb-4">
          {conflicts?.map(c => (
            <div key={c.id} className="bg-rose-950/40 border border-rose-800/80 p-3 rounded-lg text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-rose-300">Concurrent Edit Conflict on Order: {c.order_id}</span>
                <button
                  onClick={() => handleResolveConflict(c.id)}
                  className="bg-emerald-800 hover:bg-emerald-700 text-white text-[10px] px-2 py-1 rounded flex items-center gap-1 transition-colors">
                  <Check size={12} /> Mark Acknowledged
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 bg-slate-900/60 p-2 rounded text-[11px] font-mono">
                <div>
                  <span className="text-slate-400 block font-bold mb-1">Local State:</span>
                  <pre className="text-slate-300 overflow-x-auto">{JSON.stringify(c.local_value, null, 2)}</pre>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold mb-1">Remote State:</span>
                  <pre className="text-slate-300 overflow-x-auto">{JSON.stringify(c.remote_value, null, 2)}</pre>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main Order List */}
      {activeTab !== 'sync' && activeTab !== 'conflicts' && (
        <main className="space-y-2">
          {getDisplayedOrders().length === 0 && (
            <div className="text-center py-8 text-slate-500 text-xs">
              {activeTab === 'history' ? 'Type a customer name above to query previous specs.' : 'No orders found in local IndexedDB storage.'}
            </div>
          )}

          {getDisplayedOrders().map(order => (
            <div key={order.id} className="bg-slate-800 border border-slate-700/80 p-3 rounded-lg flex flex-col justify-between gap-2 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-semibold text-slate-200 text-sm">{order.customer || 'Unknown Customer'}</span>
                  {order.needs_clarification && (
                    <span className="ml-2 text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/40">
                      Needs Clarification
                    </span>
                  )}
                  {order.references_prior_order && (
                    <span className="ml-2 text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/40">
                      Repeat Customer
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-300">₹{order.amount ?? 0}</span>
                  <button
                    onClick={() => createOrUpdateOrder({ id: order.id, is_paid: !order.is_paid })}
                    className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                      order.is_paid 
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-800' 
                        : 'bg-slate-700 text-slate-400 border-slate-600'
                    }`}>
                    {order.is_paid ? 'Paid' : 'Unpaid'}
                  </button>
                </div>
              </div>

              {/* Parsed Items & Specifications */}
              <div className="text-xs text-slate-400 space-y-0.5">
                {order.items?.map((it, idx) => (
                  <div key={idx}>
                    • <span className="text-slate-200">{it.quantity}x</span> {it.description}{' '}
                    {Object.keys(it.attributes || {}).length > 0 && (
                      <span className="text-indigo-300 font-mono text-[11px]">
                        [{Object.entries(it.attributes).map(([k, v]) => `${k}: ${v}`).join(', ')}]
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Order Footer Details */}
              <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1 border-t border-slate-700/40">
                <span>Due: {order.due_date ? order.due_date.split('T')[0] : 'No date set'}</span>
                <button
                  onClick={() => softDeleteOrder(order.id)}
                  className="text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors">
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </div>
          ))}
        </main>
      )}
    </div>
  );
}