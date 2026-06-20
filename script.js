// Application Memory Arrays Module Elements Tracking
let activeInputString = "";
let selectedLanguage = "en";
let historicalLogs = [];
let angleMode = "deg"; // 'deg' or 'rad'
let justEvaluated = false;

const mathConversionMatrix = {
    area: {
        units: { acres: "Acres", sqm: "Square Metres" },
        convert: (v, f, t) => f === t ? v : (f === "acres" ? v * 4046.856 : v / 4046.856)
    },
    length: {
        units: { km: "Kilometers", miles: "Miles" },
        convert: (v, f, t) => f === t ? v : (f === "km" ? v * 0.621371 : v / 0.621371)
    },
    temp: {
        units: { c: "Celsius", f: "Fahrenheit" },
        convert: (v, f, t) => f === t ? v : (f === "c" ? (v * 9 / 5) + 32 : (v - 32) * 5 / 9)
    }
};

/* ===========================================================
   SAFE EXPRESSION PARSER
   A small recursive-descent parser + evaluator. Replaces the
   previous new Function()/eval-based evaluation so no arbitrary
   JS can ever run from calculator input.
   Supports: + - * / ^ ( ) unary minus, decimals, pi, and the
   function calls sin( cos( tan( sqrt( log( ln(
   =========================================================== */
function evaluateMathExpression(raw) {
    let i = 0;
    const src = raw;

    function peek() { return src[i]; }
    function error(msg) { throw new Error(msg || "Invalid expression"); }

    function parseExpression() {
        let value = parseTerm();
        while (peek() === '+' || peek() === '-') {
            const op = src[i++];
            const rhs = parseTerm();
            value = op === '+' ? value + rhs : value - rhs;
        }
        return value;
    }

    function parseTerm() {
        let value = parseFactor();
        while (peek() === '*' || peek() === '/') {
            const op = src[i++];
            const rhs = parseFactor();
            if (op === '/') {
                if (rhs === 0) error("DivByZero");
                value = value / rhs;
            } else {
                value = value * rhs;
            }
        }
        return value;
    }

    function parseFactor() {
        if (peek() === '-') { i++; return -parseFactor(); }
        if (peek() === '+') { i++; return parseFactor(); }
        return parsePower();
    }

    function parsePower() {
        let base = parseAtom();
        if (peek() === '^') {
            i++;
            const exp = parseFactor();
            return Math.pow(base, exp);
        }
        return base;
    }

    function matchWord(word) {
        if (src.slice(i, i + word.length).toLowerCase() === word) {
            i += word.length;
            return true;
        }
        return false;
    }

    function parseAtom() {
        if (peek() === '(') {
            i++;
            const v = parseExpression();
            if (peek() !== ')') error("Mismatched parentheses");
            i++;
            return v;
        }

        const funcs = [
            ["sqrt", v => { if (v < 0) error("Invalid input"); return Math.sqrt(v); }],
            ["sin", v => Math.sin(toRadiansIfNeeded(v))],
            ["cos", v => Math.cos(toRadiansIfNeeded(v))],
            ["tan", v => Math.tan(toRadiansIfNeeded(v))],
            ["log", v => { if (v <= 0) error("Invalid input"); return Math.log10(v); }],
            ["ln", v => { if (v <= 0) error("Invalid input"); return Math.log(v); }],
        ];
        for (const [name, fn] of funcs) {
            if (matchWord(name)) {
                if (peek() !== '(') error("Expected (");
                i++;
                const arg = parseExpression();
                if (peek() !== ')') error("Mismatched parentheses");
                i++;
                return fn(arg);
            }
        }

        if (matchWord("pi")) return Math.PI;
        if (peek() === 'π') { i++; return Math.PI; }

        const start = i;
        while (i < src.length && /[0-9.]/.test(src[i])) i++;
        if (i === start) error("Unexpected character: " + (peek() ?? "end of input"));
        const numStr = src.slice(start, i);
        if ((numStr.match(/\./g) || []).length > 1) error("Invalid number");
        const num = parseFloat(numStr);
        if (Number.isNaN(num)) error("Invalid number");
        return num;
    }

    function toRadiansIfNeeded(v) {
        return angleMode === "deg" ? (v * Math.PI / 180) : v;
    }

    if (!src || !src.trim()) error("Empty expression");
    const result = parseExpression();
    if (i !== src.length) error("Unexpected trailing characters");
    if (typeof result !== "number" || Number.isNaN(result)) error("Invalid expression");
    return result;
}

// Converts the internal storage string (which used Math.sin( etc as
// legacy markers) into the parser's expected tokens.
function normalizeForParser(s) {
    return s
        .replace(/Math\.sin\(/g, "sin(")
        .replace(/Math\.cos\(/g, "cos(")
        .replace(/Math\.tan\(/g, "tan(")
        .replace(/Math\.sqrt\(/g, "sqrt(")
        .replace(/Math\.log10\(/g, "log(")
        .replace(/Math\.log\(/g, "ln(")
        .replace(/Math\.PI/g, "pi")
        .replace(/\*\*/g, "^");
}

function safeEval(s) {
    return evaluateMathExpression(normalizeForParser(s));
}

// Text to Speech Voice Reader Engine Hook
function runAudioSpeechFeedback(phrase) {
    const toggle = document.getElementById('audioToggle');
    if (!toggle || !toggle.checked) return;
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    const voiceAnnouncer = new SpeechSynthesisUtterance(phrase);
    voiceAnnouncer.lang = (selectedLanguage === 'hi') ? 'hi-IN' : 'en-US';
    voiceAnnouncer.rate = 1.1;
    window.speechSynthesis.speak(voiceAnnouncer);
}

// Swaps functional working sub-views containers panels tabs
function changeTab(tabName) {
    const mainBox = document.querySelector('.app-container');

    mainBox.classList.remove('mode-standard', 'mode-scientific');
    document.querySelectorAll('.menu-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
    });

    document.getElementById('math-grid').classList.add('hidden');
    document.getElementById('converter-panel').classList.add('hidden');
    document.getElementById('history-panel').classList.add('hidden');
    document.getElementById('angle-toggle').classList.add('hidden');

    const activeBtn = document.getElementById(`btn-${tabName}`);
    activeBtn.classList.add('active');
    activeBtn.setAttribute('aria-selected', 'true');
    const headerTitle = document.getElementById('view-title');

    if (tabName === 'standard') {
        mainBox.classList.add('mode-standard');
        document.getElementById('math-grid').classList.remove('hidden');
        headerTitle.setAttribute('data-en', 'Standard Mode');
        headerTitle.setAttribute('data-hi', 'साधारण मोड');
    } else if (tabName === 'scientific') {
        mainBox.classList.add('mode-scientific');
        document.getElementById('math-grid').classList.remove('hidden');
        document.getElementById('angle-toggle').classList.remove('hidden');
        headerTitle.setAttribute('data-en', 'Scientific Engine');
        headerTitle.setAttribute('data-hi', 'वैज्ञानिक इंजन');
    } else if (tabName === 'converter') {
        document.getElementById('converter-panel').classList.remove('hidden');
        headerTitle.setAttribute('data-en', 'Unit Converter');
        headerTitle.setAttribute('data-hi', 'इकाई परिवर्तक');
        setupUnitDropdowns();
    } else if (tabName === 'history') {
        document.getElementById('history-panel').classList.remove('hidden');
        headerTitle.setAttribute('data-en', 'Calculations History');
        headerTitle.setAttribute('data-hi', 'इतिहास रिकॉर्ड');
        buildHistoryListView();
    }

    updateLanguage();
}

const MAX_INPUT_LENGTH = 60;

// Custom Key Input Sequences Logic Processing Block
function appendInput(val, audioLabel) {
    if (document.getElementById('calc-screen').value === "Error") clearAll();
    if (activeInputString.length >= MAX_INPUT_LENGTH) return;

    if (justEvaluated && /[0-9.(]/.test(val)) {
        activeInputString = "";
    }
    justEvaluated = false;

    if (val === '.') {
        const lastSegment = activeInputString.split(/[\+\-\*\/\(\)]/).pop();
        if (lastSegment.includes('.')) return;
        if (lastSegment === '') val = '0.';
    }

    activeInputString += val;
    refreshScreenElements();

    if (audioLabel) {
        runAudioSpeechFeedback(audioLabel);
    }
}

function clearAll() {
    activeInputString = "";
    justEvaluated = false;
    document.getElementById('preview-screen').innerText = "";
    document.getElementById('calc-screen').value = "0";
    runAudioSpeechFeedback(selectedLanguage === 'hi' ? "साफ़" : "Clear");
}

function dropLastChar() {
    if (document.getElementById('calc-screen').value === "Error") { clearAll(); return; }
    activeInputString = activeInputString.slice(0, -1);
    refreshScreenElements();
    runAudioSpeechFeedback(selectedLanguage === 'hi' ? "हटाया" : "Backspace");
}

function negateInput() {
    if (!activeInputString) return;
    activeInputString = activeInputString.startsWith('-') ? activeInputString.slice(1) : '-' + activeInputString;
    refreshScreenElements();
}

function addSciOp(type) {
    if (document.getElementById('calc-screen').value === "Error") clearAll();
    justEvaluated = false;
    const map = { sin: 'sin(', cos: 'cos(', tan: 'tan(', sqrt: 'sqrt(', log: 'log(', ln: 'ln(' };
    activeInputString += map[type] || `${type}(`;
    refreshScreenElements();
    runAudioSpeechFeedback(type);
}

function toggleAngleMode() {
    angleMode = angleMode === 'deg' ? 'rad' : 'deg';
    const btn = document.getElementById('angle-toggle');
    btn.textContent = angleMode === 'deg' ? 'DEG' : 'RAD';
    refreshScreenElements();
}

// UI Refresh Loop
function refreshScreenElements() {
    const monitor = document.getElementById('calc-screen');
    const preMonitor = document.getElementById('preview-screen');

    monitor.value = activeInputString.replace(/\*/g, '×').replace(/\//g, '÷') || "0";

    const lastChar = activeInputString.slice(-1);
    if (activeInputString && !['+', '-', '*', '/', '.', '('].includes(lastChar)) {
        try {
            const evalOutput = safeEval(activeInputString);
            if (isFinite(evalOutput) && String(evalOutput) !== activeInputString) {
                preMonitor.innerText = "= " + formatResult(evalOutput);
            } else {
                preMonitor.innerText = "";
            }
        } catch (err) {
            preMonitor.innerText = "";
        }
    } else {
        preMonitor.innerText = "";
    }
}

function formatResult(n) {
    if (Number.isInteger(n)) return String(n);
    return String(Math.round(n * 1e10) / 1e10);
}

function evaluateExpression() {
    if (!activeInputString) return;
    const monitor = document.getElementById('calc-screen');
    try {
        const outputVal = safeEval(activeInputString);

        if (!isFinite(outputVal)) {
            monitor.value = "Error";
            document.getElementById('preview-screen').innerText = "";
            activeInputString = "";
            return;
        }

        const formatted = formatResult(outputVal);

        historicalLogs.unshift({
            expr: activeInputString.replace(/\*/g, '×').replace(/\//g, '÷'),
            result: formatted,
            time: new Date().toLocaleString(selectedLanguage === 'hi' ? 'hi-IN' : 'en-US', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })
        });
        if (historicalLogs.length > 100) historicalLogs.pop();

        activeInputString = formatted;
        monitor.value = formatted;
        justEvaluated = true;
        document.getElementById('preview-screen').innerText = "";

        runAudioSpeechFeedback(`${selectedLanguage === 'hi' ? 'बराबर है' : 'equals'} ${formatted}`);
    } catch (e) {
        monitor.value = "Error";
        document.getElementById('preview-screen').innerText = "";
        activeInputString = "";
    }
}

// Clean Theme Profile Swapper Mapping
function updateTheme() {
    const chosenTheme = document.getElementById('themeMenu').value;
    document.body.className = (chosenTheme === 'light') ? "light-mode" : "dark-mode";
    try { localStorage.setItem('calc-theme', chosenTheme); } catch (e) { /* storage unavailable */ }
}

function updateLanguage() {
    selectedLanguage = document.getElementById('langMenu').value;
    document.querySelectorAll('[data-en]').forEach(node => {
        const text = node.getAttribute(`data-${selectedLanguage}`);
        if (text !== null) node.innerText = text;
    });
}

// Unit Converters Block Logic
function setupUnitDropdowns() {
    const cat = document.getElementById('unitType').value;
    const fSelect = document.getElementById('fromUnit');
    const tSelect = document.getElementById('toUnit');

    fSelect.innerHTML = ""; tSelect.innerHTML = "";
    Object.entries(mathConversionMatrix[cat].units).forEach(([k, v]) => {
        fSelect.options.add(new Option(v, k));
        tSelect.options.add(new Option(v, k));
    });
    if (tSelect.options.length > 1) tSelect.selectedIndex = 1;
    runConversion();
}

function runConversion() {
    const cat = document.getElementById('unitType').value;
    const fUnit = document.getElementById('fromUnit').value;
    const tUnit = document.getElementById('toUnit').value;
    const rawInput = document.getElementById('fromAmount').value;
    const valIn = rawInput === "" ? 0 : parseFloat(rawInput);

    if (Number.isNaN(valIn)) {
        document.getElementById('toAmount').innerText = "—";
        return;
    }

    const outputRes = mathConversionMatrix[cat].convert(valIn, fUnit, tUnit);
    document.getElementById('toAmount').innerText = outputRes.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function swapConverterUnits() {
    const fSelect = document.getElementById('fromUnit');
    const tSelect = document.getElementById('toUnit');
    const tmp = fSelect.value;
    fSelect.value = tSelect.value;
    tSelect.value = tmp;
    runConversion();
}

// Dynamic Calculation Logs View Builders Node Items
function buildHistoryListView() {
    const frame = document.getElementById('history-container');
    frame.innerHTML = "";

    if (!historicalLogs.length) {
        const empty = document.createElement('div');
        empty.className = "history-empty";
        empty.innerText = selectedLanguage === 'hi' ? 'कोई इतिहास रिकॉर्ड नहीं है।' : 'No historical logs found.';
        frame.appendChild(empty);
        return;
    }
    historicalLogs.forEach(entry => {
        const row = document.createElement('div');
        row.className = "history-item";

        const left = document.createElement('div');
        left.className = "history-item-main";
        const exprSpan = document.createElement('span');
        exprSpan.className = "expr";
        exprSpan.textContent = entry.expr;
        const timeSpan = document.createElement('span');
        timeSpan.className = "time";
        timeSpan.textContent = entry.time || "";
        left.appendChild(exprSpan);
        left.appendChild(timeSpan);

        const resSpan = document.createElement('span');
        resSpan.className = "res";
        resSpan.textContent = "= " + entry.result;

        row.appendChild(left);
        row.appendChild(resSpan);

        row.addEventListener('click', () => {
            activeInputString = String(entry.result);
            justEvaluated = true;
            changeTab('standard');
            refreshScreenElements();
        });

        frame.appendChild(row);
    });
}
function flushLogs() { historicalLogs = []; buildHistoryListView(); }

function copyToClipboard() {
    const val = document.getElementById('calc-screen').value;
    const statusMsg = document.getElementById('app-status');
    const finish = () => {
        const original = statusMsg.innerText;
        statusMsg.innerText = selectedLanguage === 'hi' ? 'कॉपी हो गया!' : 'Copied!';
        setTimeout(() => { statusMsg.innerText = original; }, 1200);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(val).then(finish).catch(() => fallbackCopy(val, finish));
    } else {
        fallbackCopy(val, finish);
    }
}

function fallbackCopy(text, cb) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); cb(); } catch (e) { /* clipboard unavailable */ }
    document.body.removeChild(ta);
}

// Hardware Keys Mapping Events Listeners
document.addEventListener('keydown', (evt) => {
    if (document.activeElement && document.activeElement.tagName === 'SELECT') return;
    if (!document.getElementById('math-grid').classList.contains('hidden')) {
        if (evt.key >= '0' && evt.key <= '9') appendInput(evt.key, evt.key);
        else if (evt.key === '.') appendInput('.', 'point');
        else if (evt.key === '+') appendInput('+', 'plus');
        else if (evt.key === '-') appendInput('-', 'minus');
        else if (evt.key === '*') appendInput('*', 'multiplied by');
        else if (evt.key === '/') { evt.preventDefault(); appendInput('/', 'divided by'); }
        else if (evt.key === '(' || evt.key === ')') appendInput(evt.key, evt.key === '(' ? 'open bracket' : 'close bracket');
        else if (evt.key === '^') appendInput('^', 'power');
        else if (evt.key === 'Backspace') dropLastChar();
        else if (evt.key === 'Escape') clearAll();
        else if (evt.key === 'Enter' || evt.key === '=') { evt.preventDefault(); evaluateExpression(); }
    }
});

// REAL-TIME Web Audio Voice Dictation Streaming Processing Loop Interface Engine
function handleVoiceInput() {
    const SpeechAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    const statusMsg = document.getElementById('app-status');
    const previewBox = document.getElementById('preview-screen');
    const micIndicator = document.getElementById('mic-btn');

    if (!SpeechAPI) {
        statusMsg.innerText = selectedLanguage === 'hi'
            ? "इस ब्राउज़र में वॉइस इनपुट उपलब्ध नहीं है"
            : "Voice input isn't supported in this browser";
        return;
    }

    const processorInstance = new SpeechAPI();
    processorInstance.continuous = true;
    processorInstance.interimResults = true;
    processorInstance.lang = (selectedLanguage === 'hi') ? 'hi-IN' : 'en-US';

    const resetUI = () => {
        statusMsg.style.color = "var(--text-muted)";
        statusMsg.innerText = (selectedLanguage === 'hi') ? "तैयार" : "Ready";
        micIndicator.style.background = "var(--key-bg)";
        micIndicator.classList.remove('listening');
    };

    statusMsg.innerText = (selectedLanguage === 'hi') ? "सुन रहा हूँ... बोलिए" : "Listening... Speak now";
    statusMsg.style.color = "#ef4444";
    micIndicator.style.background = "rgba(239, 68, 68, 0.15)";
    micIndicator.classList.add('listening');

    try {
        processorInstance.start();
    } catch (e) {
        resetUI();
        statusMsg.innerText = selectedLanguage === 'hi' ? "माइक्रोफ़ोन शुरू नहीं हो सका" : "Couldn't start the microphone";
        return;
    }

    processorInstance.onresult = (event) => {
        let liveTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            liveTranscript += event.results[i][0].transcript;
        }

        previewBox.innerText = `[${selectedLanguage === 'hi' ? 'लाइव वॉइस' : 'Live Voice'}]: "${liveTranscript}"`;

        let filteredMathFormula = liveTranscript.toLowerCase()
            .replace(/plus|and|और|प्लस|जोड़/g, '+')
            .replace(/minus|घटाओ|माइनस/g, '-')
            .replace(/times|into|multiplied by|गुना|गुणा/g, '*')
            .replace(/divided by|divide|भाग/g, '/')
            .replace(/[^0-9\+\-\*\/\(\)\.]/g, '');

        if (filteredMathFormula && event.results[event.results.length - 1].isFinal) {
            activeInputString = filteredMathFormula;
            justEvaluated = false;
            refreshScreenElements();
            setTimeout(() => {
                evaluateExpression();
                try { processorInstance.stop(); } catch (e) { /* already stopped */ }
            }, 500);
        }
    };

    processorInstance.onerror = (event) => {
        resetUI();
        if (event.error === 'not-allowed' || event.error === 'permission-denied') {
            statusMsg.innerText = selectedLanguage === 'hi' ? "माइक्रोफ़ोन की अनुमति नहीं मिली" : "Microphone permission denied";
        } else if (event.error === 'no-speech') {
            statusMsg.innerText = selectedLanguage === 'hi' ? "कुछ सुनाई नहीं दिया" : "Didn't catch that — try again";
        } else {
            statusMsg.innerText = selectedLanguage === 'hi' ? "तैयार" : "Ready";
        }
    };

    processorInstance.onend = resetUI;
}

// Bootstrap Initialization Standard Interface
(function init() {
    try {
        const savedTheme = localStorage.getItem('calc-theme');
        if (savedTheme) {
            document.getElementById('themeMenu').value = savedTheme;
            updateTheme();
        }
    } catch (e) { /* storage unavailable, ignore */ }
    changeTab('standard');
})();