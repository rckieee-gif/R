import { useState, useEffect, useMemo, useRef } from 'react';
import { BAG_WEIGHT_KG, getAgeDay } from '../utils/broilerTargets';
import { apiClient } from '../utils/apiClient';

const quickActionClass = "text-[10px] font-black py-1.5 px-2.5 rounded-full bg-app-card text-app-text border border-app-border hover:bg-app-bg hover:text-app-accent active:scale-95 transition-all cursor-pointer flex items-center space-x-1 shadow-sm";

function createParticles() {
  return Array.from({ length: 8 }).map((_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    size: `${Math.random() * 3 + 2}px`,
    delay: `${Math.random() * 10}s`,
    duration: `${Math.random() * 10 + 15}s`,
  }));
}

function todayInput() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateOnly(value) {
  if (!value) return null;
  const [year, month, day] = String(value).split('T')[0].split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function diffDays(left, right) {
  const leftDate = parseDateOnly(left);
  const rightDate = parseDateOnly(right);
  if (!leftDate || !rightDate) return null;
  return Math.round((leftDate - rightDate) / (24 * 60 * 60 * 1000));
}

function formatDate(value) {
  const date = parseDateOnly(value);
  if (!date) return '--';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatNumber(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '--';
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function listToSentence(items) {
  if (!items.length) return 'the screens available to your role';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;

  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function getLatestWeightLog(logs) {
  return [...logs]
    .filter((log) => Number(log.averageWeightGrams || 0) > 0)
    .sort((left, right) => String(right.date || '').localeCompare(String(left.date || '')))[0] || null;
}

function getWelcomeText({ isZeroGravity, userName, isPublicViewer, canViewFinancial, canEnterDaily, availableFlowText }) {
  const gravityLine = isZeroGravity
    ? 'Floating UI enabled. Farm checks stay grounded.'
    : 'Farm Mode is on. I will keep the guidance practical and flock-focused.';
  const accessLine = isPublicViewer
    ? 'You are in public viewer mode, so I will keep this to read-only flock, log, inventory, and analytics guidance.'
    : canViewFinancial
      ? 'Your role can review operations and finance, so Finance Pulse is available when a batch is selected.'
      : canEnterDaily
        ? 'Your role can work with daily operations, so I will focus on logs, feed, weather, inventory, and readiness.'
        : 'Your role is read-only, so I will avoid edit-only and finance workflows.';

  return `Good morning, ${userName}. I am **FlockOps Assistant**.\n\n${gravityLine} ${accessLine} Quick actions are limited to ${availableFlowText}.`;
}

export default function AntigravityAssistant({
  activeBatch,
  logs = [],
  transactions = [],
  user,
  isZeroGravity,
  allowedScreens = [],
  canEnterDaily = false,
  canViewFinancial = false,
  isPublicViewer = false,
  token = null
}) {
  const [isOpen, setIsOpen] = useState(false);
  const particles = useMemo(() => (isZeroGravity ? createParticles() : []), [isZeroGravity]);

  const userName = user?.name || 'Farmer';
  const today = todayInput();
  const allowedScreenSet = useMemo(() => new Set(allowedScreens), [allowedScreens]);
  const canOpenDailyLogs = allowedScreenSet.has('dailyLog');
  const canOpenInventory = allowedScreenSet.has('inventory');
  const canOpenAnalytics = allowedScreenSet.has('analytics');
  const canOpenBatches = allowedScreenSet.has('batches');
  const canOpenSettings = allowedScreenSet.has('settings');
  const canRunFinancePulse = canViewFinancial && (allowedScreenSet.has('ledger') || allowedScreenSet.has('statement'));
  const availableFlowText = listToSentence([
    canOpenAnalytics ? 'analytics' : null,
    canOpenDailyLogs ? (canEnterDaily ? 'daily logs' : 'read-only daily logs') : null,
    canOpenInventory ? 'inventory' : null,
    canOpenBatches ? 'batches' : null,
    canRunFinancePulse ? 'finance' : null
  ].filter(Boolean));
  const welcomeText = useMemo(() => getWelcomeText({
    isZeroGravity,
    userName,
    isPublicViewer,
    canViewFinancial: canRunFinancePulse,
    canEnterDaily,
    availableFlowText
  }), [availableFlowText, canEnterDaily, canRunFinancePulse, isPublicViewer, isZeroGravity, userName]);

  const [messages, setMessages] = useState(() => [
    {
      id: 'welcome',
      sender: 'assistant',
      text: welcomeText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
  ]);

  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef(null);

  const batchMetrics = useMemo(() => {
    const loaded = Number(activeBatch?.totalChicksLoaded || 0);
    const totalMortality = logs.reduce((sum, log) => sum + Number(log.mortality || 0), 0);
    const liveBirds = Math.max(loaded - totalMortality, 0);
    const mortalityPercent = loaded > 0 ? (totalMortality / loaded) * 100 : 0;
    const totalFeedBags = logs.reduce((sum, log) => sum + Number(log.feed || 0), 0);
    const totalFeedKg = totalFeedBags * (BAG_WEIGHT_KG || 50);
    const todayLogs = logs.filter((log) => log.date === today);
    const todayMortality = todayLogs.reduce((sum, log) => sum + Number(log.mortality || 0), 0);
    const todayFeedBags = todayLogs.reduce((sum, log) => sum + Number(log.feed || 0), 0);
    const latestWeightLog = getLatestWeightLog(logs);
    const latestWeight = Number(latestWeightLog?.averageWeightGrams || 0) || null;
    const totalWeightKg = latestWeight ? (liveBirds * latestWeight) / 1000 : 0;
    const fcr = totalWeightKg > 0 ? totalFeedKg / totalWeightKg : null;
    const age = activeBatch?.startDate ? getAgeDay(activeBatch.startDate, today) : null;
    const daysToHarvest = diffDays(activeBatch?.targetHarvestDate, today);

    return {
      loaded,
      totalMortality,
      liveBirds,
      mortalityPercent,
      totalFeedBags,
      totalFeedKg,
      todayLogs,
      todayMortality,
      todayFeedBags,
      latestWeight,
      latestWeightDate: latestWeightLog?.date || '',
      fcr,
      age,
      daysToHarvest
    };
  }, [activeBatch, logs, today]);

  const financialSummary = useMemo(() => {
    const income = transactions
      .filter((transaction) => ['revenue', 'income'].includes(String(transaction.type || '').toLowerCase()))
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
    const expenses = transactions
      .filter((transaction) => String(transaction.type || '').toLowerCase() === 'expense')
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

    return {
      income,
      expenses,
      net: income - expenses,
      transactionCount: transactions.length
    };
  }, [transactions]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const simulateResponse = (userInput, responseText) => {
    setMessages(prev => [
      ...prev,
      {
        id: String(Date.now()),
        sender: 'user',
        text: userInput,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);
      setMessages(prev => [
        ...prev,
        {
          id: String(Date.now() + 1),
          sender: 'assistant',
          text: responseText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }, 900);
  };

  const addUserMessage = (text) => {
    setMessages(prev => [
      ...prev,
      {
        id: String(Date.now()),
        sender: 'user',
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  const addAssistantMessage = (text) => {
    setMessages(prev => [
      ...prev,
      {
        id: String(Date.now() + 1),
        sender: 'assistant',
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  const buildFlockOpsContext = () => ({
    isZeroGravity,
    availableFlows: quickActions.map((action) => action.label),
    activeBatch: activeBatch
      ? {
          id: activeBatch.id,
          batchCode: activeBatch.batchCode,
          startDate: activeBatch.startDate,
          targetHarvestDate: activeBatch.targetHarvestDate,
          status: activeBatch.status,
          totalChicksLoaded: activeBatch.totalChicksLoaded,
          plannedFlock: activeBatch.plannedFlock,
          targetFeedKg: activeBatch.targetFeedKg
        }
      : null,
    metrics: {
      ...batchMetrics,
      todayLogCount: batchMetrics.todayLogs.length,
      todayLogs: undefined
    },
    recentLogs: [...logs]
      .sort((left, right) => String(right.date || '').localeCompare(String(left.date || '')))
      .slice(0, 6)
      .map((log) => ({
        date: log.date,
        building: log.building,
        mortality: log.mortality,
        feed: log.feed,
        averageWeightGrams: log.averageWeightGrams,
        remarks: log.remarks
      })),
    financials: canRunFinancePulse ? financialSummary : null
  });

  const pauseForBatch = (actionName) => {
    simulateResponse(
      actionName,
      canOpenBatches
        ? `**Batch needed**: Open **Batches** and select an active flock cycle first. Then I can give you a clean ${actionName.toLowerCase()}.`
        : `**Batch needed**: No active batch is available in this session. I can still help with ${availableFlowText}.`
    );
  };

  const handleFlockBriefing = () => {
    if (!activeBatch) {
      pauseForBatch("Flock Briefing");
      return;
    }

    const healthStatus = batchMetrics.mortalityPercent > 10
      ? 'Critical mortality pressure'
      : batchMetrics.mortalityPercent > 5
        ? 'Watch mortality closely'
        : 'Flock looks steady';

    const response = `🌾 **Flock Briefing**
* **Batch**: ${activeBatch.id}
* **Age**: Day ${batchMetrics.age || '--'}
* **Live estimate**: ${formatNumber(batchMetrics.liveBirds)} / ${formatNumber(batchMetrics.loaded)} birds
* **Mortality**: ${formatNumber(batchMetrics.totalMortality)} total (${formatNumber(batchMetrics.mortalityPercent, 2)}%)
* **Feed used**: ${formatNumber(batchMetrics.totalFeedBags, 1)} bags / ${formatNumber(batchMetrics.totalFeedKg)} kg
* **Latest weight**: ${batchMetrics.latestWeight ? `${formatNumber(batchMetrics.latestWeight)}g on ${formatDate(batchMetrics.latestWeightDate)}` : 'No weigh-in yet'}
* **FCR**: ${batchMetrics.fcr ? formatNumber(batchMetrics.fcr, 2) : 'Awaiting weight logs'}

**FlockOps read**: ${healthStatus}. ${canOpenDailyLogs ? (canEnterDaily ? 'Keep today’s logs current before evening closeout.' : 'Review the log history for trend changes.') : 'Use analytics for the next trend check.'}`;

    simulateResponse("Flock Briefing", response);
  };

  const handleTodayChecks = () => {
    if (!activeBatch) {
      pauseForBatch("Today's Checks");
      return;
    }

    const response = `✅ **Today's Checks**
* **Logs today**: ${batchMetrics.todayLogs.length}
* **Feed today**: ${formatNumber(batchMetrics.todayFeedBags, 1)} bags
* **Mortality today**: ${formatNumber(batchMetrics.todayMortality)}
* **Batch age**: Day ${batchMetrics.age || '--'}

**Next move**: ${batchMetrics.todayLogs.length
      ? 'Feed and mortality entries are coming in. Scan for unusual spikes before closeout.'
      : canOpenDailyLogs
        ? (canEnterDaily ? 'Open **Daily Logs** and record today’s feed, mortality, water, and weight updates.' : 'Open **Daily Logs** to review whether today has entries.')
        : 'Use the available operations views to confirm today’s activity.'}`;

    simulateResponse("Today's Checks", response);
  };

  const handleFeedInventory = () => {
    if (!activeBatch) {
      pauseForBatch("Feed & Inventory");
      return;
    }

    const response = `📦 **Feed & Inventory**
* **Feed logged this cycle**: ${formatNumber(batchMetrics.totalFeedBags, 1)} bags
* **Feed logged today**: ${formatNumber(batchMetrics.todayFeedBags, 1)} bags
* **Feed equivalent**: ${formatNumber(batchMetrics.totalFeedKg)} kg

**FlockOps read**: ${canOpenInventory
      ? 'Open **Inventory** to compare these logs against feed stock and movement history.'
      : canOpenAnalytics
        ? 'Use **Analytics** to compare feed usage against growth trends.'
        : `Stay within ${availableFlowText} for the current session.`}`;

    simulateResponse("Feed & Inventory", response);
  };

  const handleWeatherWatch = () => {
    const response = `🌦️ **Weather Watch**
* **Hot afternoon**: check water pressure, cooling, and ventilation.
* **Heavy rain**: check drainage, litter moisture, and access paths.
* **High humidity**: watch ammonia smell and respiratory comfort.

**FlockOps read**: Keep an eye on the Home weather forecast before assigning field work. Weather may affect ventilation today.`;

    simulateResponse("Weather Watch", response);
  };

  const handleHarvestReadiness = () => {
    if (!activeBatch) {
      pauseForBatch("Harvest Readiness");
      return;
    }

    const days = batchMetrics.daysToHarvest;
    const harvestLine = days === null
      ? 'No target harvest date found.'
      : days < 0
        ? `Target harvest was ${formatDate(activeBatch.targetHarvestDate)} (${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} late).`
        : days === 0
          ? 'Target harvest is today.'
          : `Target harvest is ${formatDate(activeBatch.targetHarvestDate)} (${days} day${days === 1 ? '' : 's'} away).`;
    const response = `🌽 **Harvest Readiness**
* **Batch**: ${activeBatch.id}
* **Harvest timing**: ${harvestLine}
* **Live estimate**: ${formatNumber(batchMetrics.liveBirds)}
* **Latest weight**: ${batchMetrics.latestWeight ? `${formatNumber(batchMetrics.latestWeight)}g` : 'No weigh-in yet'}

**Next move**: ${canViewFinancial && allowedScreenSet.has('harvest')
      ? 'Open **Harvest** when actual sold birds and kilos are ready to record.'
      : canOpenAnalytics
        ? 'Review **Analytics** for weight and feed trends before harvest decisions.'
        : 'Use your available batch views to confirm harvest timing.'}`;

    simulateResponse("Harvest Readiness", response);
  };

  const handleFinancePulse = () => {
    if (!canRunFinancePulse) {
      simulateResponse(
        "Finance Pulse",
        `**Access limited**: Finance Pulse is available only to roles that can open financial screens. I can still help with ${availableFlowText}.`
      );
      return;
    }

    if (!activeBatch) {
      pauseForBatch("Finance Pulse");
      return;
    }

    const income = transactions
      .filter(t => t.type === 'revenue' || t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const expenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const net = income - expenses;

    const response = `💰 **Finance Pulse**
* **Batch**: ${activeBatch.id}
* **Income**: ${formatNumber(income, 2)}
* **Expenses**: ${formatNumber(expenses, 2)}
* **Net**: ${formatNumber(net, 2)}

**FlockOps read**: ${net >= 0 ? 'Cash flow is positive for the current ledger view.' : 'Expenses are ahead of income in the current ledger view.'} Review feed purchases and harvest proceeds before final closeout.`;

    simulateResponse("Finance Pulse", response);
  };

  const handleGravityStatus = () => {
    const response = isZeroGravity
      ? `**Zero-G Farm Mode**: Floating UI enabled. Farm checks stay grounded. ${canOpenSettings ? 'Settings can return the interface to Farm Mode when needed.' : 'Your current access can view this state but cannot change it.'}`
      : `**Farm Mode**: Standard interface behavior is active. ${canOpenSettings ? 'Settings can enable Zero-G Farm Mode when you want the floating effect.' : 'Your current access can view this state but cannot change it.'}`;

    simulateResponse(isZeroGravity ? "Zero-G Farm Mode" : "Farm Mode", response);
  };

  const quickActions = [
    { key: 'briefing', label: 'Flock Briefing', icon: 'egg_alt', onClick: handleFlockBriefing },
    { key: 'checks', label: "Today's Checks", icon: 'fact_check', onClick: handleTodayChecks },
    { key: 'feed', label: 'Feed & Inventory', icon: 'inventory_2', onClick: handleFeedInventory },
    { key: 'weather', label: 'Weather Watch', icon: 'thermostat', onClick: handleWeatherWatch },
    { key: 'harvest', label: 'Harvest Readiness', icon: 'agriculture', onClick: handleHarvestReadiness },
    ...(canRunFinancePulse ? [{ key: 'finance', label: 'Finance Pulse', icon: 'payments', onClick: handleFinancePulse }] : [])
  ];

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isTyping) return;

    const query = inputValue.trim();
    setInputValue('');

    if (token && !isPublicViewer) {
      addUserMessage(query);
      setIsTyping(true);

      try {
        const payload = await apiClient.post('/api/flockops-chat', {
          message: query,
          context: buildFlockOpsContext()
        });

        addAssistantMessage(payload.reply || 'FlockOps is online, but I did not receive a usable reply. Try a shorter farm operations question.');
      } catch (error) {
        addAssistantMessage(`FlockOps AI is offline right now: ${error.message}\n\nTry the quick actions below for farm-safe guidance while the backend catches up.`);
      } finally {
        setIsTyping(false);
      }

      return;
    }

    let reply;
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('hello') || lowerQuery.includes('hi') || lowerQuery.includes('hey')) {
      reply = `Good to see you, ${userName}. ${isZeroGravity ? 'Zero-G Farm Mode is active.' : 'Farm Mode is active.'} Try ${quickActions.map((action) => action.label).join(', ')}.`;
    } else if (lowerQuery.includes('weather') || lowerQuery.includes('rain') || lowerQuery.includes('heat') || lowerQuery.includes('humidity')) {
      reply = 'Use **Weather Watch** for farm-specific reminders. For heat, prioritize water and ventilation. For rain, check drainage and litter moisture.';
    } else if (lowerQuery.includes('fcr') || lowerQuery.includes('feed conversion')) {
      reply = '🌾 **Feed Conversion Ratio (FCR)** is feed consumed in kg divided by estimated live weight in kg. Use **Flock Briefing** to estimate it from the logs available to your role.';
    } else if (lowerQuery.includes('mortality') || lowerQuery.includes('die') || lowerQuery.includes('dead')) {
      reply = `⚠️ Mortality is a crucial metric. If you see spikes, check ventilation, heating, water supply, and litter conditions. ${canOpenDailyLogs ? (canEnterDaily ? 'Record unusual mortality in **Daily Logs**.' : 'Review **Daily Logs** for the latest mortality pattern.') : 'Use the flock views available to your role for the latest pattern.'}`;
    } else if (lowerQuery.includes('harvest')) {
      reply = 'Use **Harvest Readiness** to check timing, latest weight, and live estimate. I will only suggest the Harvest screen when your role can open it.';
    } else if (lowerQuery.includes('finance') || lowerQuery.includes('ledger') || lowerQuery.includes('cost')) {
      reply = canRunFinancePulse
        ? 'Use **Finance Pulse** for a quick income, expense, and net view of the current batch.'
        : `Finance screens are not available to your current role. I can still help with ${availableFlowText}.`;
    } else if (lowerQuery.includes('gravity') || lowerQuery.includes('zero')) {
      reply = canOpenSettings
        ? `**${isZeroGravity ? 'Zero-G Farm Mode' : 'Farm Mode'}** is currently active. Settings can change the floating interface effect.`
        : `**${isZeroGravity ? 'Zero-G Farm Mode' : 'Farm Mode'}** is currently active. Your current access can view the mode, but Settings is not available in this session.`;
    } else {
      reply = `I’m on it, ${userName}. For "${query}", I’d cross-check ${availableFlowText}. The best quick actions here are ${quickActions.map((action) => action.label).join(', ')}.`;
    }

    simulateResponse(query, reply);
  };

  return (
    <>
      {isZeroGravity && (
        <div className="ag-particles" aria-hidden="true">
          {particles.map(p => (
            <div
              key={p.id}
              className="ag-particle"
              style={{
                left: p.left,
                width: p.size,
                height: p.size,
                animationDelay: p.delay,
                animationDuration: p.duration,
              }}
            />
          ))}
        </div>
      )}

      <div className="no-print fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`h-14 w-14 rounded-full bg-app-accent text-app-on-accent shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 border-2 border-app-card cursor-pointer overflow-hidden ${
            isOpen ? 'rotate-90' : 'animate-assistant-pulse'
          }`}
          title="Toggle FlockOps Assistant"
          aria-label="FlockOps Assistant"
          style={{
            animationDuration: '3s'
          }}
        >
          {isOpen ? (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <model-viewer
              src="/Egg.glb"
              auto-rotate
              interaction-prompt="none"
              style={{ width: '100%', height: '100%', pointerEvents: 'none', backgroundColor: 'transparent' }}
            />
          )}
        </button>
        {!isOpen && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-app-warning opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-app-warning text-[8px] font-black text-app-bg justify-center items-center">FO</span>
          </span>
        )}
      </div>

      {isOpen && (
        <div className="no-print fixed bottom-24 right-6 z-50 w-[92vw] sm:w-[420px] h-[520px] rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 animate-[fadeIn_0.2s_ease-out] border border-app-border bg-app-card/95 backdrop-blur-xl">
          <div className="absolute inset-0 pointer-events-none opacity-30 bg-app-accent/5" aria-hidden="true" />
          <div className="relative bg-app-accent text-app-on-accent p-4 flex items-center justify-between border-b border-app-border">
            <div className="flex items-center space-x-3">
              <div className="h-9 w-9 rounded-full bg-app-on-accent/15 border border-app-on-accent/30 flex items-center justify-center overflow-hidden">
                <model-viewer
                  src="/Egg.glb"
                  auto-rotate
                  interaction-prompt="none"
                  style={{ width: '100%', height: '100%', pointerEvents: 'none', backgroundColor: 'transparent' }}
                />
              </div>
              <div>
                <h3 className="text-sm font-black tracking-wider uppercase">FlockOps Assistant</h3>
                <div className="flex items-center space-x-1.5 mt-0.5">
                  <span className="h-2 w-2 rounded-full bg-app-success"></span>
                  <span className="text-[10px] text-app-on-accent/80 font-semibold uppercase">Ops Online</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGravityStatus}
              className="flex items-center space-x-2 bg-app-on-accent/10 py-1 px-2.5 rounded-full border border-app-on-accent/20 active:scale-95 transition cursor-pointer"
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  isZeroGravity ? 'bg-app-success shadow-[0_0_10px_var(--app-success)]' : 'bg-app-warning'
                }`}
                aria-hidden="true"
              />
              <span className="text-[9px] font-black uppercase text-app-on-accent/85">
                {isZeroGravity ? 'Zero-G Farm Mode' : 'Farm Mode'}
              </span>
            </button>
          </div>

          <div className="relative flex-1 overflow-y-auto p-4 space-y-4 ag-scrollbar bg-app-bg/70">
            {messages.map((m) => {
              const messageText = m.id === 'welcome' ? welcomeText : m.text;

              return (
                <div
                  key={m.id}
                  className={`flex flex-col max-w-[86%] ${
                    m.sender === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
                  }`}
                >
                  <div
                    className={`p-3 rounded-2xl text-xs leading-relaxed ${
                      m.sender === 'user'
                        ? 'bg-app-accent text-app-on-accent rounded-br-none shadow-sm'
                        : 'bg-app-card text-app-text rounded-bl-none shadow-md border border-app-border'
                    }`}
                  >
                    {messageText.split('\n').map((line, idx) => {
                      const parts = line.split('**');
                      return (
                        <p key={idx} className={idx > 0 ? "mt-1.5" : ""}>
                          {parts.map((part, pIdx) =>
                            pIdx % 2 === 1 ? <strong key={pIdx} className={`font-extrabold ${m.sender === 'user' ? 'text-app-on-accent' : 'text-app-accent'}`}>{part}</strong> : part
                          )}
                        </p>
                      );
                    })}
                  </div>
                  <span className="text-[9px] text-app-text-secondary font-bold mt-1 px-1">{m.timestamp}</span>
                </div>
              );
            })}

            {isTyping && (
              <div className="flex items-center space-x-1 bg-app-card p-2.5 rounded-2xl rounded-bl-none max-w-[60px] shadow-sm border border-app-border">
                <span className="h-1.5 w-1.5 bg-app-accent rounded-full animate-assistant-dot" style={{ animationDelay: '0ms' }}></span>
                <span className="h-1.5 w-1.5 bg-app-accent rounded-full animate-assistant-dot" style={{ animationDelay: '150ms' }}></span>
                <span className="h-1.5 w-1.5 bg-app-accent rounded-full animate-assistant-dot" style={{ animationDelay: '300ms' }}></span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="relative p-2 border-t border-app-border bg-app-bg/85 flex space-x-1.5 overflow-x-auto whitespace-nowrap ag-scrollbar">
            {quickActions.map((action) => (
              <button
                key={action.key}
                type="button"
                onClick={action.onClick}
                className={quickActionClass}
              >
                <span className="material-symbols-outlined text-sm" aria-hidden="true">{action.icon}</span>
                <span>{action.label}</span>
              </button>
            ))}
          </div>

          <form onSubmit={handleSendMessage} className="relative p-3 border-t border-app-border bg-app-card/95 flex items-center space-x-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask FlockOps..."
              className="flex-1 bg-app-bg text-xs py-2 px-3 rounded-xl border border-app-border focus:outline-none focus:border-app-accent focus:ring-2 focus:ring-app-accent/20 text-app-text placeholder-app-text-secondary"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isTyping}
              className="h-8 w-8 rounded-xl bg-app-accent text-app-on-accent flex items-center justify-center shadow-md active:scale-95 disabled:opacity-40 disabled:scale-100 transition-all cursor-pointer"
              aria-label="Send message"
            >
              <span className="material-symbols-outlined text-lg" aria-hidden="true">arrow_forward</span>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
