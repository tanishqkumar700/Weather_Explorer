// Enhanced Weather Explorer with OpenWeather and beautiful UI

// OpenWeather API config
const OPENWEATHER_API_KEY = '28d883ee24da2a16329f5fa6d2ddc264'; // replace if needed
const OPENWEATHER_BASE = 'https://api.openweathermap.org/data/2.5';

// App state
let currentUnit = (typeof localStorage !== 'undefined' && localStorage.getItem('unit')) || 'C';
let lastCity = (typeof localStorage !== 'undefined' && localStorage.getItem('lastCity')) || 'Seattle';
let lastData = null;

// Helpers: unit conversion and formatting
function toFahrenheit(celsius) {
    return (celsius * 9) / 5 + 32;
}

function formatTemp(celsius) {
    if (celsius === undefined || celsius === null || isNaN(celsius)) return '--°';
    const val = currentUnit === 'F' ? toFahrenheit(celsius) : celsius;
    return `${Math.round(val)}°`;
}

function formatWind(speedMs) {
    if (speedMs === undefined || speedMs === null || isNaN(speedMs)) return '--';
    if (currentUnit === 'F') {
        const mph = speedMs * 2.23694;
        return `${Math.round(mph)} mph`;
    }
    return `${Math.round(speedMs)} m/s`;
}

function setUnitButtonsActive() {
    const cBtn = document.getElementById('celsiusBtn');
    const fBtn = document.getElementById('fahrenheitBtn');
    if (!cBtn || !fBtn) return;
    if (currentUnit === 'C') {
        cBtn.classList.add('active');
        fBtn.classList.remove('active');
    } else {
        fBtn.classList.add('active');
        cBtn.classList.remove('active');
    }
}

// Weather icon mapping based on conditions
const getWeatherIcon = (temp, humidity, description = '') => {
    const desc = description.toLowerCase();
    if (desc.includes('rain') || desc.includes('drizzle')) return '🌧️';
    if (desc.includes('snow')) return '❄️';
    if (desc.includes('cloud')) return '☁️';
    if (temp > 25) return '☀️';
    if (temp > 15) return '🌤️';
    if (humidity > 80) return '🌦️';
    return '🌈';
};

// Add loading animation to elements
function addLoadingAnimation(element) {
    if (element) {
        element.classList.add('loading');
        element.style.opacity = '0.6';
    }
}

function removeLoadingAnimation(element) {
    if (element) {
        element.classList.remove('loading');
        element.style.opacity = '1';
    }
}

// Enhanced weather fetching function
async function getWeather(cityParam) {
    const cityInput = document.getElementById('city');
    const cityFromInput = cityInput ? cityInput.value.trim() : '';
    // Priority: explicit param > input > lastCity > default
    const targetCity = (cityParam && cityParam.trim()) || cityFromInput || lastCity || 'Seattle';
    lastCity = targetCity;
    try { localStorage.setItem('lastCity', lastCity); } catch (e) {}
    
    // Show loading state
    showLoadingState();
    
    // Build OpenWeather URLs (metric; we'll convert locally for °F)
    const currentUrl = `${OPENWEATHER_BASE}/weather?q=${encodeURIComponent(targetCity)}&appid=${OPENWEATHER_API_KEY}&units=metric`;
    const forecastUrl = `${OPENWEATHER_BASE}/forecast?q=${encodeURIComponent(targetCity)}&appid=${OPENWEATHER_API_KEY}&units=metric`;

    try {
        console.log(`Fetching weather for ${targetCity}...`);
        
        // Fetch current weather
        const currentResp = await fetch(currentUrl);
        if (!currentResp.ok) throw new Error(`Current weather error: ${currentResp.status} ${currentResp.statusText}`);
        const currentRaw = await currentResp.json();
        console.log('Current weather data (raw):', currentRaw);
        const current = normalizeOpenWeatherCurrent(currentRaw);

        // Update the UI with normalized data
        updateWeatherDisplay(current, targetCity);
        lastData = current;

        // Try to fetch forecast; on failure, fall back to synthetic
        try {
            const forecastResp = await fetch(forecastUrl);
            if (!forecastResp.ok) throw new Error(`Forecast error: ${forecastResp.status}`);
            const forecastRaw = await forecastResp.json();
            console.log('Forecast data (raw):', forecastRaw);
            generateForecastFromOpenWeather(forecastRaw);
        } catch (fe) {
            console.warn('Forecast fetch failed, using synthetic forecast.', fe);
            generateForecast(current);
        }

    // Update background based on weather (await to ensure proper selection)
    await changeBackground(current);
        
    } catch (error) {
        console.error('Error fetching weather data:', error);
        showErrorState(targetCity, error.message);
    }
}

// Normalize OpenWeather current weather payload to our internal shape
function normalizeOpenWeatherCurrent(raw) {
    const weather0 = (raw.weather && raw.weather[0]) || {};
    const main = raw.main || {};
    const wind = raw.wind || {};
    const clouds = raw.clouds || {};
    const sys = raw.sys || {};
    return {
        temp: toNumber(main.temp),
        feels_like: toNumber(main.feels_like),
        min_temp: toNumber(main.temp_min),
        max_temp: toNumber(main.temp_max),
        humidity: toNumber(main.humidity),
        wind_speed: toNumber(wind.speed),
        cloud_pct: toNumber(clouds.all),
        sunrise: toNumber(sys.sunrise),
        sunset: toNumber(sys.sunset),
        description: weather0.description || '',
        main: weather0.main || ''
    };
}

function toNumber(v) {
    const n = Number(v);
    return isNaN(n) ? undefined : n;
}

// Function to show loading state
function showLoadingState() {
    const elements = {
        cityName: document.getElementById('cityName'),
        temperature: document.getElementById('temperature'),
        description: document.getElementById('description'),
        icon: document.querySelector('.current-weather .icon')
    };
    
    if (elements.cityName) elements.cityName.textContent = 'Loading...';
    if (elements.temperature) elements.temperature.textContent = '--°';
    if (elements.description) elements.description.textContent = 'Fetching weather data...';
    if (elements.icon) elements.icon.textContent = '⏳';
    
    // Add loading animation to current weather card
    const weatherCard = document.querySelector('.current-weather');
    addLoadingAnimation(weatherCard);
}

// Function to show error state
function showErrorState(city, errorMessage) {
    const elements = {
        cityName: document.getElementById('cityName'),
        temperature: document.getElementById('temperature'),
        description: document.getElementById('description'),
        icon: document.querySelector('.current-weather .icon')
    };
    
    if (elements.cityName) elements.cityName.textContent = city;
    if (elements.temperature) elements.temperature.textContent = 'Error';
    if (elements.description) elements.description.textContent = `Failed to load data: ${errorMessage}`;
    if (elements.icon) elements.icon.textContent = '❌';
    
    const weatherCard = document.querySelector('.current-weather');
    removeLoadingAnimation(weatherCard);
}

// Function to update the main weather display
function updateWeatherDisplay(data, cityName) {
    const elements = {
        cityName: document.getElementById('cityName'),
        temperature: document.getElementById('temperature'),
        description: document.getElementById('description'),
        icon: document.querySelector('.current-weather .icon')
    };
    
    // Update city name
    if (elements.cityName) {
        elements.cityName.textContent = cityName.charAt(0).toUpperCase() + cityName.slice(1);
    }
    
    // Update temperature
    if (elements.temperature) {
        elements.temperature.textContent = `${formatTemp(data.temp)}${currentUnit}`;
    }
    
    // Update description with multiple weather details
    if (elements.description) {
        const details = [
            data.description ? data.description.charAt(0).toUpperCase() + data.description.slice(1) : null,
            `Feels like: ${formatTemp(data.feels_like)}${currentUnit}`,
            `Humidity: ${data.humidity}%`,
            `Wind: ${formatWind(data.wind_speed)}`
        ].filter(Boolean).join(' • ');
        elements.description.textContent = details;
    }
    
    // Update weather icon
    if (elements.icon) {
        elements.icon.textContent = getWeatherIcon(data.temp, data.humidity, data.description || '');
        elements.icon.style.fontSize = '4rem';
    }

    // Populate extra metrics if present
    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setText('feels-like', `${formatTemp(data.feels_like)}${currentUnit}`);
    setText('humidity', `${data.humidity ?? '--'}%`);
    setText('wind', formatWind(data.wind_speed));
    setText('cloud-pct', `${data.cloud_pct ?? '--'}%`);
    if (typeof data.min_temp !== 'undefined') setText('min-temp', `${formatTemp(data.min_temp)}${currentUnit}`);
    if (typeof data.max_temp !== 'undefined') setText('max-temp', `${formatTemp(data.max_temp)}${currentUnit}`);
    // Populate separate sunrise and sunset buttons (AM/PM format)
    if (typeof data.sunrise !== 'undefined' || typeof data.sunset !== 'undefined') {
        const srDate = (typeof data.sunrise !== 'undefined') ? new Date((Number(data.sunrise) || 0) * 1000) : null;
        const ssDate = (typeof data.sunset !== 'undefined') ? new Date((Number(data.sunset) || 0) * 1000) : null;
    // Format times and ensure AM/PM stays on same line by using a non-breaking space before AM/PM
    let srText = (srDate && !isNaN(srDate.getTime())) ? srDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '--';
    let ssText = (ssDate && !isNaN(ssDate.getTime())) ? ssDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '--';
    // Replace the normal space before AM/PM with a non-breaking space to prevent wrapping in narrow buttons
    srText = srText.replace(/\s+(AM|PM|am|pm)$/, '\u00A0$1');
    ssText = ssText.replace(/\s+(AM|PM|am|pm)$/, '\u00A0$1');
        const srBtn = document.getElementById('sunriseBtn');
        const ssBtn = document.getElementById('sunsetBtn');
        if (srBtn) { srBtn.textContent = srText; srBtn.title = `Sunrise: ${srText}`; srBtn.dataset.time = srDate ? srDate.toISOString() : ''; srBtn.dataset.last = srText; }
        if (ssBtn) { ssBtn.textContent = ssText; ssBtn.title = `Sunset: ${ssText}`; ssBtn.dataset.time = ssDate ? ssDate.toISOString() : ''; ssBtn.dataset.last = ssText; }
    }
    // Update last updated display and store the fetch time
    const lastEl = document.getElementById('lastUpdated');
    if (lastEl) {
        const now = new Date();
        lastEl.textContent = now.toLocaleString();
        // keep a machine-readable last-fetched timestamp so we can show relative time or use it elsewhere
        lastEl.dataset.lastFetched = now.toISOString();
    }
    
    // Remove loading animation
    const weatherCard = document.querySelector('.current-weather');
    removeLoadingAnimation(weatherCard);
    
    console.log(`Weather display updated for ${cityName}`);
}

// Generate forecast based on current weather (since API doesn't provide forecast)
function generateForecast(currentData) {
    const forecastDays = document.querySelectorAll('.forecast .day');
    const days = ['Today', 'Tomorrow', 'Day 3', 'Day 4', 'Day 5'];
    
    forecastDays.forEach((day, index) => {
        const weekdayEl = day.querySelector('.weekday');
        const iconEl = day.querySelector('.icon');
        const tempEl = day.querySelector('.temp');
        
        if (weekdayEl && iconEl && tempEl) {
            // Generate realistic forecast variations
            const tempVariation = (Math.random() - 0.5) * 8; // ±4°C variation
            const forecastTempC = currentData && typeof currentData.temp === 'number' ? currentData.temp + tempVariation : 20 + tempVariation;
            const humidityVariation = (Math.random() - 0.5) * 20; // ±10% variation
            const forecastHumidity = Math.max(0, Math.min(100, (currentData.humidity || 60) + humidityVariation));
            
            weekdayEl.textContent = days[index] || `Day ${index + 1}`;
            iconEl.textContent = getWeatherIcon(forecastTempC, forecastHumidity);
            tempEl.textContent = `${formatTemp(forecastTempC)}${currentUnit}`;
            
            // Add hover effect
            day.addEventListener('mouseenter', () => {
                day.style.transform = 'translateY(-3px)';
            });
            day.addEventListener('mouseleave', () => {
                day.style.transform = 'translateY(0)';
            });
        }
    });
}

// Real forecast from OpenWeather
function generateForecastFromOpenWeather(forecastRaw) {
    const list = Array.isArray(forecastRaw.list) ? forecastRaw.list : [];
    // Group entries by date and choose the one closest to midday
    const groups = new Map();
    list.forEach(item => {
        const dtTxt = item.dt_txt || '';
        const [date, time] = dtTxt.split(' ');
        if (!date || !time) return;
        const hour = parseInt(time.slice(0, 2), 10) || 0;
        const score = Math.abs(hour - 12);
        if (!groups.has(date) || score < groups.get(date).score) {
            groups.set(date, { item, score });
        }
    });
    const today = new Date().toISOString().slice(0, 10);
    const ordered = [...groups.entries()]
        .map(([d, obj]) => ({ date: d, item: obj.item }))
        .filter(e => e.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date));

    const dayEls = document.querySelectorAll('.forecast .day');
    let visualIndex = 0;
    for (const el of dayEls) {
        const dataEntry = ordered[visualIndex] || null;
        if (!dataEntry) break;
        const dateObj = new Date(dataEntry.item.dt_txt);
        const weekday = isNaN(dateObj.getTime()) ? 'Day' : dateObj.toLocaleDateString(undefined, { weekday: 'short' });
        const main = dataEntry.item.main || {};
        const weather0 = (dataEntry.item.weather && dataEntry.item.weather[0]) || {};
        const tempC = toNumber(main.temp);
        const humidity = toNumber(main.humidity);
        const desc = weather0.description || '';
        const weekdayEl = el.querySelector('.weekday');
        const iconEl = el.querySelector('.icon');
        const tempEl = el.querySelector('.temp');
        if (weekdayEl) weekdayEl.textContent = weekday;
        if (iconEl) iconEl.textContent = getWeatherIcon(tempC, humidity, desc);
        if (tempEl) tempEl.textContent = `${formatTemp(tempC)}${currentUnit}`;
        visualIndex++;
    }
}

// Setup unit toggle and favorites
function setupUnitToggle() {
    const cBtn = document.getElementById('celsiusBtn');
    const fBtn = document.getElementById('fahrenheitBtn');
    if (cBtn) cBtn.addEventListener('click', () => {
        currentUnit = 'C';
        try { localStorage.setItem('unit', currentUnit); } catch (e) {}
        setUnitButtonsActive();
        // Re-render if we have data
        if (lastData && lastCity) updateWeatherDisplay(lastData, lastCity);
        generateForecast(lastData || { temp: 20, humidity: 60 });
    });
    if (fBtn) fBtn.addEventListener('click', () => {
        currentUnit = 'F';
        try { localStorage.setItem('unit', currentUnit); } catch (e) {}
        setUnitButtonsActive();
        if (lastData && lastCity) updateWeatherDisplay(lastData, lastCity);
        generateForecast(lastData || { temp: 20, humidity: 60 });
    });
}

function setupFavorites() {
    const favs = document.querySelectorAll('.fav-btn[data-city]');
    favs.forEach(btn => {
        btn.addEventListener('click', () => {
            const city = btn.getAttribute('data-city');
            const input = document.getElementById('city');
            if (input) input.value = city;
            getWeather(city);
        });
    });
}
// Enhanced background changing function
async function changeBackground(weatherData) {
    const body = document.body;
    const temp = Number(weatherData.temp);
    const humidity = Number(weatherData.humidity);
    const desc = (weatherData.description || '').toLowerCase();
    const main = (weatherData.main || '').toLowerCase();

    // Generate slug variants from description/main
    const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const rawParts = [desc, main].filter(Boolean);
    const tokens = Array.from(new Set(rawParts.flatMap(p => p.split(/\s+/)))).filter(Boolean);

    // Condition buckets
    let condition = 'default';
    if (tokens.some(t => /snow|sleet|blizzard|ice/.test(t))) condition = 'snow';
    else if (tokens.some(t => /rain|drizzle|shower|showers|thunder|storm/.test(t))) condition = 'rain';
    else if (tokens.some(t => /mist|fog/.test(t))) condition = 'fog';
    else if (tokens.some(t => /cloud|overcast/.test(t))) condition = 'cloudy';
    else if (tokens.some(t => /clear|sunny/.test(t))) condition = 'clear';

    if (!isNaN(temp)) {
        if (temp >= 32) condition = 'hot';
        else if (temp <= 3) condition = 'cold';
    }

    // Existing filenames in your images folder (without extension) for direct preference
    const existingBases = [
        'blizzard','clear','cloudy','drizzle','fog','ice','mist','overcast','rain','shower','showers','sleet','snow','sunny','thunder',
        // add hybrids we might want to use even if not present yet
        'storm','thunderstorm','light-rain','heavy-rain','light-snow','heavy-snow','freezing','very-hot','hot','cold','default'
    ];

    // Candidate filenames ordered by specificity
    const candidates = [];
    // Full description slug (e.g., light-rain)
    if (desc) candidates.push(slugify(desc));
    // Individual token slugs
    candidates.push(...tokens.map(slugify));
    // Condition bucket
    candidates.push(slugify(condition));
    // Temperature buckets
    if (!isNaN(temp)) {
        if (temp >= 35) candidates.push('very-hot');
        if (temp >= 30) candidates.push('hot');
        if (temp <= 0) candidates.push('freezing');
        if (temp <= 3) candidates.push('cold');
    }
    // Add existing base names (ensures we try them)
    candidates.push(...existingBases);
    // Generic fallbacks
    candidates.push('default');

    // Map candidate to possible extensions
    const exts = ['jpeg','jpg','png','webp'];
    const withExt = [];
    candidates.forEach(base => exts.forEach(ext => withExt.push(`${base}.${ext}`)));

    // Deduplicate preserving order
    const seen = new Set();
    const orderedFiles = withExt.filter(f => { if (seen.has(f)) return false; seen.add(f); return true; });

    // Attempt to load first existing image via Image object
    const overlay = 'linear-gradient(rgba(0,0,0,0.30), rgba(0,0,0,0.30))';

    const loadImage = (file) => new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve(file);
        img.onerror = () => resolve(null);
        img.src = `images/${file}`;
    });

    let chosen = null;
    const fadeLayer = document.getElementById('bgFadeLayer');
    for (const file of orderedFiles) {
        // Stop early if we already picked a high confidence one
        // Try loading
        /* eslint-disable no-await-in-loop */
        const ok = await loadImage(file);
        if (ok) { chosen = ok; break; }
    }

    if (!chosen) {
        console.warn('No matching background image found. Ensure images folder has appropriate files.');
        chosen = 'default.jpg';
    }

    // Choose a color gradient based on condition to be used as the primary background color
    let colorGradient = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    switch (condition) {
        case 'clear':
        case 'sunny':
            colorGradient = 'linear-gradient(135deg,#FFD27F 0%, #FF7A18 100%)';
            break;
        case 'cloudy':
            colorGradient = 'linear-gradient(135deg,#dfe9f3 0%, #c5d5f1 100%)';
            break;
        case 'rain':
            colorGradient = 'linear-gradient(135deg,#89f7fe 0%, #66a6ff 100%)';
            break;
        case 'fog':
            colorGradient = 'linear-gradient(135deg,#cfd9df 0%, #e2ebf0 100%)';
            break;
        case 'snow':
            colorGradient = 'linear-gradient(135deg,#e0f7ff 0%, #cdefff 100%)';
            break;
        case 'hot':
        case 'very-hot':
            colorGradient = 'linear-gradient(135deg,#ff9a9e 0%, #fecfef 100%)';
            break;
        case 'cold':
        case 'freezing':
            colorGradient = 'linear-gradient(135deg,#a1c4fd 0%, #c2e9fb 100%)';
            break;
        default:
            colorGradient = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    }

    // Apply with fade: layer a dark overlay, the color gradient, and then the photo (if any)
    const colorLayer = colorGradient;
    if (fadeLayer) {
        const current = body.dataset.bgImage;
        if (current) {
            fadeLayer.style.backgroundImage = `${overlay}, ${colorLayer}, url('images/${current}')`;
            body.classList.add('bg-fading');
            // force reflow for transition reliability
            void fadeLayer.offsetWidth;
        }
    }

    // Compose layered background: overlay (darken), color gradient, image
    body.style.backgroundImage = `${overlay}, ${colorLayer}, url('images/${chosen}')`;
    body.dataset.bgImage = chosen;
    // Also set background color property (fallback for no-image scenarios)
    body.style.backgroundColor = colorLayer;

    setTimeout(() => { body.classList.remove('bg-fading'); if (fadeLayer) fadeLayer.style.backgroundImage = 'none'; }, 800);
    console.log(`Background updated: condition=${condition} chosen=${chosen}`);
}

// Enhanced search functionality
function setupEnhancedSearch() {
    const cityInput = document.getElementById('city');
    if (cityInput) {
        // Add Enter key support
        cityInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                getWeather();
            }
        });
        
        // Add input styling and placeholder
        cityInput.style.transition = 'all 0.3s ease';
        cityInput.placeholder = 'Enter city name (e.g., Seattle, Tokyo, London)...';
        
        // Add focus effects
        cityInput.addEventListener('focus', function() {
            this.style.transform = 'scale(1.02)';
        });
        
        cityInput.addEventListener('blur', function() {
            this.style.transform = 'scale(1)';
        });
    }
    
    // Enhance search button
    const searchButton = document.querySelector('.search-container button');
    if (searchButton) {
        searchButton.addEventListener('click', getWeather);
    }
}

// Add click animations to weather cards
function addCardAnimations() {
    const weatherCard = document.querySelector('.current-weather');
    const forecastCard = document.querySelector('.forecast');
    
    [weatherCard, forecastCard].forEach(card => {
        if (card) {
            card.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-2px)';
            });
            
            card.addEventListener('mouseleave', function() {
                this.style.transform = 'translateY(0)';
            });
        }
    });
}

// Setup click handlers for sunrise/sunset buttons (copy time to clipboard)
function setupSunButtons() {
    const sr = document.getElementById('sunriseBtn');
    const ss = document.getElementById('sunsetBtn');
    const attach = (btn) => {
        if (!btn) return;
        btn.addEventListener('click', async () => {
            const txt = btn.dataset.last || btn.textContent || '';
            if (!txt) return;
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(txt);
                    const prev = btn.textContent;
                    btn.textContent = 'Copied';
                    setTimeout(() => { btn.textContent = btn.dataset.last || prev; }, 1000);
                } else {
                    // Fallback: select and copy via execCommand
                    const ta = document.createElement('textarea');
                    ta.value = txt;
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand('copy');
                    document.body.removeChild(ta);
                }
            } catch (e) {
                console.log('Copy failed', e);
            }
        });
    };
    attach(sr);
    attach(ss);
}

// Smooth analog clock updater (drives hands if present in the DOM)
function startAnalogClock() {
    // Try several common selectors for hour/minute/second hands
    const second = document.querySelector('.second-hand, #second-hand, .hand.second, .hand--second');
    const minute = document.querySelector('.minute-hand, #minute-hand, .hand.minute, .hand--minute');
    const hour = document.querySelector('.hour-hand, #hour-hand, .hand.hour, .hand--hour');
    // If no second hand, nothing to do
    if (!second && !minute && !hour) return;

    // Ensure immediate transforms (disable CSS transition that causes ticking/jump)
    [second, minute, hour].forEach(h => { if (h) h.style.transition = 'transform 0s linear'; });

    function update() {
        const now = new Date();
        const ms = now.getMilliseconds();
        const s = now.getSeconds() + ms / 1000; // fractional seconds for smooth motion
        const m = now.getMinutes() + s / 60;
        const h = (now.getHours() % 12) + m / 60;

        if (second) second.style.transform = `rotate(${s * 6}deg)`; // 360/60 = 6deg per sec
        if (minute) minute.style.transform = `rotate(${m * 6}deg)`; // 6deg per minute
        if (hour) hour.style.transform = `rotate(${h * 30}deg)`; // 360/12 = 30deg per hour

        requestAnimationFrame(update);
    }

    requestAnimationFrame(update);
}

// Live digital clock updater: keeps a target element showing the running (current) time
let __liveClockIntervalId = null;
function startLiveClock(targetId = 'lastUpdated') {
    const el = document.getElementById(targetId);
    if (!el) return; // nothing to do if element not present

    // Clear any previous interval we started
    if (__liveClockIntervalId) {
        clearInterval(__liveClockIntervalId);
        __liveClockIntervalId = null;
    }

    const tick = () => {
        // Show current local time; keep the same formatting used elsewhere
        el.textContent = new Date().toLocaleString();
    };

    // Initial tick and then update every second
    tick();
    __liveClockIntervalId = setInterval(tick, 1000);

    // Stop updates when page is unloaded to avoid leaked intervals
    window.addEventListener('unload', () => {
        if (__liveClockIntervalId) clearInterval(__liveClockIntervalId);
    }, { once: true });
}

// Initialize the enhanced weather app
function initWeatherApp() {
    console.log('🌤️ Weather Explorer Enhanced - Initializing...');
    
    // Setup enhanced search functionality
    setupEnhancedSearch();

    // Setup unit toggle and favorites
    setupUnitToggle();
    setupFavorites();
    setUnitButtonsActive();
    
    // Add card animations
    addCardAnimations();
    // Start the analog clock animation if clock elements exist
    try { startAnalogClock(); } catch (e) { /* noop */ }
    // Start the live digital time updater for '#lastUpdated' if present
    try { startLiveClock(); } catch (e) { /* noop */ }
    // Attach sunrise/sunset button handlers
    try { setupSunButtons(); } catch (e) { /* noop */ }
    
    // Load Seattle weather by default
    setTimeout(() => {
        const input = document.getElementById('city');
        if (input) input.value = lastCity;
        getWeather(lastCity);
    }, 300);
    
    console.log('✅ Weather Explorer Enhanced - Ready!');
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWeatherApp);
} else {
    initWeatherApp();
}