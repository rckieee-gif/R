import { useState, useEffect, useMemo, useRef } from 'react';
import { BAG_WEIGHT_KG, getAgeDay } from '../broilerTargets';

function createParticles() {
  return Array.from({ length: 8 }).map((_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    size: `${Math.random() * 3 + 2}px`,
    delay: `${Math.random() * 10}s`,
    duration: `${Math.random() * 10 + 15}s`,
  }));
}

export default function AntigravityAssistant({ 
  activeBatch, 
  logs = [], 
  transactions = [], 
  user,
  isZeroGravity
}) {
  const [isOpen, setIsOpen] = useState(false);
  const particles = useMemo(() => (isZeroGravity ? createParticles() : []), [isZeroGravity]);

  const userName = user?.name || 'Farmer';
  const [messages, setMessages] = useState(() => [
    {
      id: 'welcome',
      sender: 'assistant',
      text: `Greetings, Captain! 🧑‍🚀 I am the **Antigravity AI Assistant**. My thrusters are primed, and gravity sensors are set to normal.\n\nHow can I help you manage your space farm today? Choose a quick scan below or type a message.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
  ]);

  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef(null);

  // Scroll to bottom of chat
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
    }, 1200);
  };

  // Pre-compiled quick action handlers
  const handleFlockAnalysis = () => {
    if (!activeBatch) {
      simulateResponse(
        "Analyze Current Batch Health",
        "⚠️ **Diagnostic Failure**: No active batch found. Please go to the **Batches** tab to launch or select a poultry cycle before I can scan life-support metrics!"
      );
      return;
    }

    const actualLoaded = Number(activeBatch.totalChicksLoaded || 0);
    const totalMortality = logs.reduce((sum, log) => sum + Number(log.mortality || 0), 0);
    const liveBirds = Math.max(actualLoaded - totalMortality, 0);
    const mortalityPercent = actualLoaded > 0 ? (totalMortality / actualLoaded) * 100 : 0;
    
    // Find latest average weight
    const weightLog = logs.find(log => log.averageWeightGrams != null && Number(log.averageWeightGrams) > 0);
    const latestWeight = weightLog ? Number(weightLog.averageWeightGrams) : null;

    // Calculate FCR
    const totalFeedBags = logs.reduce((sum, log) => sum + Number(log.feed || 0), 0);
    const totalFeedKg = totalFeedBags * (BAG_WEIGHT_KG || 50);
    const totalWeightKg = latestWeight ? (liveBirds * latestWeight) / 1000 : 0;
    const fcr = totalWeightKg > 0 ? totalFeedKg / totalWeightKg : null;

    const age = activeBatch.startDate ? getAgeDay(activeBatch.startDate, new Date().toISOString().split('T')[0]) : 'unknown';

    let healthStatus = "Nominal 🟢";
    if (mortalityPercent > 5) healthStatus = "Warning: High Mortality 🟡";
    if (mortalityPercent > 10) healthStatus = "Critical Alert: Hull Breach 🔴";

    const response = `📊 **Flock Health Diagnostic Report**
* **Batch ID**: ${activeBatch.id}
* **Cycle Age**: Day ${age}
* **Flock Status**: ${healthStatus}
* **Live Birds**: ${liveBirds.toLocaleString()} / ${actualLoaded.toLocaleString()} (${(100 - mortalityPercent).toFixed(2)}% survival)
* **Mortality Rate**: ${mortalityPercent.toFixed(2)}% (${totalMortality.toLocaleString()} deceased)
* **Accumulated Feed**: ${totalFeedKg.toLocaleString()} kg (${totalFeedBags.toFixed(1)} bags)
* **Latest Weight**: ${latestWeight ? `${latestWeight}g` : 'No weigh-in data yet'}
* **Feed Conversion Ratio (FCR)**: ${fcr ? fcr.toFixed(2) : 'Awaiting weight logs'}

🤖 **Antigravity AI Assessment**:
${fcr && fcr < 1.6 
  ? "🚀 Excellent feed conversion! Your birds are defying gravity and growing efficiently." 
  : "🛸 Feed conversion is within normal parameters. Ensure water lines are flowing and light intensity is configured properly for Day " + age + "."
} Keep monitoring daily logs to prevent gravity drops!`;

    simulateResponse("Analyze Current Batch Health", response);
  };

  const handleFinancialAudit = () => {
    if (!activeBatch) {
      simulateResponse(
        "Financial Health Audit",
        "⚠️ **Scan Aborted**: No active batch. Ledgers are currently floating in deep space. Select an active batch first!"
      );
      return;
    }

    const income = transactions
      .filter(t => t.type === 'revenue' || t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const expenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const net = income - expenses;

    const response = `💸 **Financial System Scan**
* **Active Batch**: Batch ${activeBatch.id}
* **Total Credits (Income)**: $${income.toLocaleString(undefined, { minimumFractionDigits: 2 })}
* **Total Debits (Expenses)**: $${expenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
* **Net Cash Flow**: $${net.toLocaleString(undefined, { minimumFractionDigits: 2 })}

🤖 **Gravitational Fiscal Outlook**:
${net >= 0 
  ? "🟢 **Positive Orbit**: Your balance sheet is hovering comfortably above the ground. Frictional drag is low, and profitability is lifting off!"
  : "🔴 **Gravitational Pull Detected**: Net cash flow is currently negative. Watch out for heavy feed expenses pulling your budget down into a black hole."
}

*Recommendation*: Audit recent feed purchases and ensure flock mortality is kept to a minimum to maximize yield value at harvest.`;

    simulateResponse("Financial Health Audit", response);
  };

  const handleDiagnostics = () => {
    const systems = [
      { name: "Coop Gravity Dampeners", status: isZeroGravity ? "Enabled (0.0G)" : "Disabled (1.0G)", ok: true },
      { name: "Feed Silo Pressure", status: "720 kPa", ok: true },
      { name: "Feather Levitation Matrix", status: isZeroGravity ? "Calibrating..." : "Standby", ok: true },
      { name: "Automated Water Line Siphon", status: "Optimal Flow", ok: true },
      { name: "Inertial Chicken Dampeners", status: "Stable", ok: true },
    ];

    const sysList = systems.map(s => `* **${s.name}**: ${s.status} ${s.ok ? '🟢' : '🔴'}`).join('\n');

    const response = `🔋 **Zero-G Telemetry & Subsystem Diagnostics**
${sysList}

🤖 **Engine Room Memo**:
All telemetry indicators are green. The farm manager application is running on **Antigravity Core v1.0.0**. Booster engines are fueled by Vite and Tailwind CSS. We are ready for hyperdrive!`;

    simulateResponse("Zero-G Diagnostics Check", response);
  };

  const handleChickenLevitation = () => {
    const responses = [
      "🐔 **Levitation Simulation Launching...**\n\nResults: Chickens have discovered that wings are highly effective in zero-g. They are currently performing complex orbital maneuvers in Coop A. Feathers are floating everywhere. Water lines have been switched to bubble-suction mode so droplets don't float into the ventilation shafts!",
      "🐣 **Gravity Disabled in Incubator Coop...**\n\nThe chicks are floating around like fuzzy tennis balls! They seem to enjoy the lack of weight, but feed is drifting. Recommend attaching magnetic shoes or restoring 0.1G standard gravity so they can find the feeders.",
      "🐓 **Zero-Gravity Pecking Order Diagnostics...**\n\nWe have observed that in zero gravity, the dominant rooster cannot peck downwards effectively. This has led to an egalitarian cooperative society among the poultry. A true antigravity miracle!"
    ];
    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    simulateResponse("Chicken Levitation Test", randomResponse);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const query = inputValue;
    setInputValue('');

    let reply;
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('hello') || lowerQuery.includes('hi') || lowerQuery.includes('hey')) {
      reply = `Hello, Captain ${userName}! Always great to hear from you. Gravity sensors are reporting stable conditions. Ask me to perform a "Flock Health" or "Financial Audit" scan!`;
    } else if (lowerQuery.includes('fcr') || lowerQuery.includes('feed conversion')) {
      reply = `🌾 **Feed Conversion Ratio (FCR)** is calculated by dividing the total feed consumed (kg) by the total weight of the live birds (kg). A lower FCR means your birds convert feed into weight more efficiently! Try clicking the **Analyze Current Batch Health** button to compute your current FCR automatically.`;
    } else if (lowerQuery.includes('mortality') || lowerQuery.includes('die') || lowerQuery.includes('dead')) {
      reply = `⚠️ Mortality is a crucial metric. A rate below 5% for a full cycle is excellent. If you see spikes, check coop ventilation, heating, water supply, or consult a veterinarian immediately. Toggling **Zero-Gravity Mode** will not make them weightless in real life, but it certainly lifts the mood!`;
    } else if (lowerQuery.includes('joke') || lowerQuery.includes('funny')) {
      const jokes = [
        "Why did the chicken cross the road in zero gravity? To get to the other side... eventually!",
        "What do you call a chicken floating in outer space? An unidentified frying object! 🛸",
        "How do space chickens drink water? Out of zero-g floating droplets. It's bubble tea but for poultry!"
      ];
      reply = jokes[Math.floor(Math.random() * jokes.length)];
    } else if (lowerQuery.includes('gravity') || lowerQuery.includes('antigravity')) {
      reply = `**Antigravity Mode** allows the UI elements of this Farm Manager to break free from standard gravitational constraints. Use the Zero-Gravity switch in Settings under Interface Options to control the effect.`;
    } else {
      reply = `I've received your transmission, ${userName}! 🛰️ Regarding "${query}": I recommend checking your daily logs and financial ledgers to cross-reference trends. You can also try one of our telemetry quick scans above!`;
    }

    simulateResponse(query, reply);
  };

  return (
    <>
      {/* Particle Effect Overlay when Zero Gravity is Active */}
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

      {/* FLOATING ORB BUTTON */}
      <div className="no-print fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`h-14 w-14 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 hover:from-blue-500 hover:to-indigo-400 text-white shadow-[0_8px_32px_rgba(59,130,246,0.5)] flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 border-2 border-white/30 cursor-pointer ${
            isOpen ? 'rotate-90' : 'animate-bounce'
          }`}
          title="Toggle Antigravity AI Assistant"
          aria-label="Antigravity Assistant"
          style={{
            animationDuration: '3s'
          }}
        >
          {isOpen ? (
            // Close SVG
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            // Futuristic AI astronaut/gravitation helmet SVG
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          )}
        </button>
        {/* Unread badge if closed */}
        {!isOpen && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-cyan-500 text-[9px] font-bold text-slate-900 justify-center items-center">AG</span>
          </span>
        )}
      </div>

      {/* ASSISTANT CHAT DIALOG */}
      {isOpen && (
        <div className="no-print fixed bottom-24 right-6 z-50 w-[92vw] sm:w-[420px] h-[520px] rounded-3xl ag-glass shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden transition-all duration-300 animate-[fadeIn_0.2s_ease-out] border border-white/10">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-900/90 to-indigo-950/90 text-white p-4 flex items-center justify-between border-b border-white/10">
            <div className="flex items-center space-x-3">
              <div className="h-9 w-9 rounded-full bg-blue-500/20 border border-blue-400/50 flex items-center justify-center animate-pulse">
                <span>🛰️</span>
              </div>
              <div>
                <h3 className="text-sm font-black tracking-wider uppercase">Antigravity OS</h3>
                <div className="flex items-center space-x-1.5 mt-0.5">
                  <span className="h-2 w-2 rounded-full bg-green-400 animate-ping"></span>
                  <span className="text-[10px] text-gray-300 font-semibold uppercase">AI Assistant v1.0</span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 bg-black/35 py-1 px-2.5 rounded-full border border-white/5">
              <span
                className={`h-2 w-2 rounded-full ${
                  isZeroGravity ? 'bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]' : 'bg-gray-500'
                }`}
                aria-hidden="true"
              />
              <span className="text-[9px] font-black uppercase text-gray-300">
                {isZeroGravity ? 'Zero-G On' : 'Zero-G Off'}
              </span>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 ag-scrollbar bg-slate-950/25 dark:bg-black/10">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col max-w-[85%] ${
                  m.sender === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
                }`}
              >
                <div
                  className={`p-3 rounded-2xl text-xs leading-relaxed ${
                    m.sender === 'user'
                      ? 'bg-blue-600 text-white rounded-br-none shadow-sm'
                      : 'bg-white/95 dark:bg-slate-900/95 text-gray-800 dark:text-gray-100 rounded-bl-none shadow-md border border-neutral-border/20 dark:border-slate-800'
                  }`}
                >
                  {m.text.split('\n').map((line, idx) => {
                    const parts = line.split('**');
                    return (
                      <p key={idx} className={idx > 0 ? "mt-1.5" : ""}>
                        {parts.map((part, pIdx) => 
                          pIdx % 2 === 1 ? <strong key={pIdx} className="font-extrabold text-blue-600 dark:text-cyan-400">{part}</strong> : part
                        )}
                      </p>
                    );
                  })}
                </div>
                <span className="text-[9px] text-gray-400 font-bold mt-1 px-1">{m.timestamp}</span>
              </div>
            ))}

            {isTyping && (
              <div className="flex items-center space-x-1 bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-2xl rounded-bl-none max-w-[60px] shadow-sm border border-neutral-border/10">
                <span className="h-1.5 w-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="h-1.5 w-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="h-1.5 w-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick Scan Action Chips */}
          <div className="p-2 border-t border-white/5 bg-slate-900/40 dark:bg-black/25 flex space-x-1.5 overflow-x-auto whitespace-nowrap ag-scrollbar">
            <button
              onClick={handleFlockAnalysis}
              className="text-[10px] font-black py-1 px-2.5 rounded-full bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200 border border-neutral-border/30 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-slate-700 active:scale-95 transition-all cursor-pointer flex items-center space-x-1"
            >
              <span>📊</span> <span>Flock Health</span>
            </button>
            <button
              onClick={handleFinancialAudit}
              className="text-[10px] font-black py-1 px-2.5 rounded-full bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200 border border-neutral-border/30 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-slate-700 active:scale-95 transition-all cursor-pointer flex items-center space-x-1"
            >
              <span>💸</span> <span>Financials</span>
            </button>
            <button
              onClick={handleDiagnostics}
              className="text-[10px] font-black py-1 px-2.5 rounded-full bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200 border border-neutral-border/30 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-slate-700 active:scale-95 transition-all cursor-pointer flex items-center space-x-1"
            >
              <span>🔋</span> <span>Booster Telemetry</span>
            </button>
            <button
              onClick={handleChickenLevitation}
              className="text-[10px] font-black py-1 px-2.5 rounded-full bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200 border border-neutral-border/30 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-slate-700 active:scale-95 transition-all cursor-pointer flex items-center space-x-1"
            >
              <span>🐔</span> <span>Float Test</span>
            </button>
          </div>

          {/* Footer Form Input */}
          <form onSubmit={handleSendMessage} className="p-3 border-t border-white/10 bg-white/95 dark:bg-slate-900/95 flex items-center space-x-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask Antigravity..."
              className="flex-1 bg-neutral-light dark:bg-slate-800 text-xs py-2 px-3 rounded-xl border border-neutral-border dark:border-slate-700 focus:outline-none focus:border-blue-500 text-gray-900 dark:text-white"
            />
            <button
              type="submit"
              disabled={!inputValue.trim()}
              className="h-8 w-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md active:scale-95 disabled:opacity-40 disabled:scale-100 transition-all cursor-pointer"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
