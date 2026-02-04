document.addEventListener('DOMContentLoaded', () => {
    // Estado
    let currentPin = '';
    const MAX_PIN = 4;
    let isAuthenticated = false;
    let refreshInterval = 5000; // Padrão, será atualizado pela API
    let refreshTimer = null;

    // URL base da API
    const baseUrl = window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '');
    const API_URL = baseUrl + '/api.php';

    // Elementos DOM
    const loginScreen = document.getElementById('login-screen');
    const dashboardScreen = document.getElementById('dashboard-screen');
    const pinDots = document.querySelectorAll('.pin-dot');
    const loginMsg = document.getElementById('login-msg');
    const themeBtn = document.getElementById('theme-toggle');

    // Google Charts
    let chartsLoaded = false;
    let cpuGauge, memGauge, arrayGauge, cacheGauge;
    let cpuData, memData, arrayData, cacheData;
    let cpuOptions, memOptions, arrayOptions, cacheOptions;

    // Carregar Google Charts
    google.charts.load('current', { packages: ['gauge'] });
    google.charts.setOnLoadCallback(() => {
        chartsLoaded = true;
        initGauges();
    });

    function initGauges() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

        // CPU Gauge
        cpuData = google.visualization.arrayToDataTable([
            ['Label', 'Value'],
            ['CPU', 0]
        ]);
        cpuOptions = {
            width: 120, height: 120,
            redFrom: 80, redTo: 100,
            yellowFrom: 60, yellowTo: 80,
            greenFrom: 0, greenTo: 60,
            minorTicks: 5,
            max: 100
        };
        const cpuContainer = document.getElementById('cpu-gauge');
        if (cpuContainer && chartsLoaded) {
            cpuGauge = new google.visualization.Gauge(cpuContainer);
            cpuGauge.draw(cpuData, cpuOptions);
        }

        // Memory Gauge
        memData = google.visualization.arrayToDataTable([
            ['Label', 'Value'],
            ['RAM', 0]
        ]);
        memOptions = {
            width: 120, height: 120,
            redFrom: 90, redTo: 100,
            yellowFrom: 75, yellowTo: 90,
            greenFrom: 0, greenTo: 75,
            minorTicks: 5,
            max: 100
        };
        const memContainer = document.getElementById('mem-gauge');
        if (memContainer && chartsLoaded) {
            memGauge = new google.visualization.Gauge(memContainer);
            memGauge.draw(memData, memOptions);
        }

        // Array Storage Gauge
        arrayData = google.visualization.arrayToDataTable([
            ['Label', 'Value'],
            ['Array', 0]
        ]);
        arrayOptions = {
            width: 120, height: 120,
            redFrom: 90, redTo: 100,
            yellowFrom: 75, yellowTo: 90,
            greenFrom: 0, greenTo: 75,
            minorTicks: 5,
            max: 100
        };
        const arrayContainer = document.getElementById('array-gauge');
        if (arrayContainer && chartsLoaded) {
            arrayGauge = new google.visualization.Gauge(arrayContainer);
            arrayGauge.draw(arrayData, arrayOptions);
        }

        // Cache Storage Gauge
        cacheData = google.visualization.arrayToDataTable([
            ['Label', 'Value'],
            ['Cache', 0]
        ]);
        cacheOptions = {
            width: 120, height: 120,
            redFrom: 90, redTo: 100,
            yellowFrom: 75, yellowTo: 90,
            greenFrom: 0, greenTo: 75,
            minorTicks: 5,
            max: 100
        };
        const cacheContainer = document.getElementById('cache-gauge');
        if (cacheContainer && chartsLoaded) {
            cacheGauge = new google.visualization.Gauge(cacheContainer);
            cacheGauge.draw(cacheData, cacheOptions);
        }
    }

    function updateGauges(cpuPercent, memPercent, arrayPercent, cachePercent) {
        if (!chartsLoaded) {
            console.warn('Charts not loaded yet');
            return;
        }

        console.log('updateGauges called:', { cpuPercent, memPercent, arrayPercent, cachePercent });
        console.log('Gauge objects:', { cpuGauge: !!cpuGauge, memGauge: !!memGauge, arrayGauge: !!arrayGauge, cacheGauge: !!cacheGauge });

        if (cpuGauge && cpuData) {
            cpuData.setValue(0, 1, cpuPercent);
            cpuGauge.draw(cpuData, cpuOptions);
        }
        if (memGauge && memData) {
            memData.setValue(0, 1, memPercent);
            memGauge.draw(memData, memOptions);
        }
        if (arrayGauge && arrayData && arrayPercent !== undefined) {
            console.log('Updating array gauge to:', arrayPercent);
            arrayData.setValue(0, 1, arrayPercent);
            arrayGauge.draw(arrayData, arrayOptions);
        } else {
            console.warn('Array gauge not ready:', { arrayGauge: !!arrayGauge, arrayData: !!arrayData, arrayPercent });
        }
        if (cacheGauge && cacheData && cachePercent !== undefined) {
            console.log('Updating cache gauge to:', cachePercent);
            cacheData.setValue(0, 1, cachePercent);
            cacheGauge.draw(cacheData, cacheOptions);
        } else {
            console.warn('Cache gauge not ready:', { cacheGauge: !!cacheGauge, cacheData: !!cacheData, cachePercent });
        }
    }

    // --- INICIALIZAÇÃO ---
    fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'public_info' })
    })
    .then(res => res.json())
    .then(data => {
        if (data.server_name) {
            const title = document.getElementById('server-title');
            if (title) title.innerText = data.server_name;
        }
        if (data.refresh_interval) {
            refreshInterval = data.refresh_interval;
        }
    })
    .catch(err => console.error('Init error:', err));

    // --- TEMAS ---
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme');
            const next = current === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('theme', next);
            updateThemeIcon(next);
        });
    }

    function updateThemeIcon(theme) {
        if (themeBtn) themeBtn.innerText = theme === 'light' ? '☾' : '☀';
    }

    // --- LOGIN / PIN ---
    document.querySelectorAll('.key[data-num]').forEach(btn => {
        btn.addEventListener('click', () => {
            if (currentPin.length < MAX_PIN) {
                currentPin += btn.dataset.num;
                updatePinDisplay();
                if (currentPin.length === MAX_PIN) {
                    verifyPin();
                }
            }
        });
    });

    const backspace = document.getElementById('backspace');
    if (backspace) {
        backspace.addEventListener('click', () => {
            currentPin = currentPin.slice(0, -1);
            if (loginMsg) loginMsg.innerText = '';
            updatePinDisplay();
        });
    }

    function updatePinDisplay() {
        pinDots.forEach((dot, idx) => {
            if (idx < currentPin.length) dot.classList.add('filled');
            else dot.classList.remove('filled');
        });
    }

    async function verifyPin() {
        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin: currentPin, action: 'login' })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                loginSuccess();
            } else {
                showError('PIN Incorreto');
                resetPin();
            }
        } catch (e) {
            showError('Erro de conexão');
            resetPin();
        }
    }

    function showError(msg) {
        if (loginMsg) loginMsg.innerText = msg;
    }

    function resetPin() {
        setTimeout(() => {
            currentPin = '';
            updatePinDisplay();
        }, 500);
    }

    function loginSuccess() {
        isAuthenticated = true;
        loginScreen.classList.add('hidden');
        dashboardScreen.style.display = 'flex';
        dashboardScreen.classList.add('fade-in');

        // Inicializar gauges se ainda não foram
        if (chartsLoaded && !cpuGauge) {
            initGauges();
        } else if (chartsLoaded && (!arrayGauge || !cacheGauge)) {
            // Se os gauges já existem mas array/cache não, inicializar apenas eles
            if (!arrayGauge) {
                arrayData = google.visualization.arrayToDataTable([
                    ['Label', 'Value'],
                    ['Array', 0]
                ]);
                arrayOptions = {
                    width: 120, height: 120,
                    redFrom: 90, redTo: 100,
                    yellowFrom: 75, yellowTo: 90,
                    greenFrom: 0, greenTo: 75,
                    minorTicks: 5,
                    max: 100
                };
                const arrayContainer = document.getElementById('array-gauge');
                if (arrayContainer) {
                    arrayGauge = new google.visualization.Gauge(arrayContainer);
                    arrayGauge.draw(arrayData, arrayOptions);
                }
            }
            if (!cacheGauge) {
                cacheData = google.visualization.arrayToDataTable([
                    ['Label', 'Value'],
                    ['Cache', 0]
                ]);
                cacheOptions = {
                    width: 120, height: 120,
                    redFrom: 90, redTo: 100,
                    yellowFrom: 75, yellowTo: 90,
                    greenFrom: 0, greenTo: 75,
                    minorTicks: 5,
                    max: 100
                };
                const cacheContainer = document.getElementById('cache-gauge');
                if (cacheContainer) {
                    cacheGauge = new google.visualization.Gauge(cacheContainer);
                    cacheGauge.draw(cacheData, cacheOptions);
                }
            }
        }

        fetchData();
        refreshTimer = setInterval(fetchData, refreshInterval);
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            isAuthenticated = false;
            currentPin = '';
            updatePinDisplay();
            dashboardScreen.style.display = 'none';
            loginScreen.classList.remove('hidden');
            if (refreshTimer) {
                clearInterval(refreshTimer);
                refreshTimer = null;
            }
        });
    }

    // --- DASHBOARD DATA ---
    async function fetchData() {
        if (!isAuthenticated) return;

        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin: currentPin })
            });

            if (!res.ok) {
                if (res.status === 401 && logoutBtn) {
                    logoutBtn.click();
                }
                return;
            }

            const json = await res.json();

            if (json.success && json.data) {
                // Atualizar intervalo se mudou
                if (json.data.refresh_interval && json.data.refresh_interval !== refreshInterval) {
                    refreshInterval = json.data.refresh_interval;
                    if (refreshTimer) {
                        clearInterval(refreshTimer);
                        refreshTimer = setInterval(fetchData, refreshInterval);
                    }
                }
                updateUI(json.data);
            }
        } catch (e) {
            console.error('Fetch error:', e);
        }
    }

    function updateUI(data) {
        // Server Name
        if (data.server_name) {
            const title = document.getElementById('server-title');
            if (title) title.innerText = data.server_name;
        }

        // CPU & Memory
        if (data.system) {
            // CPU
            const cpuTemp = document.getElementById('cpu-temp');
            if (cpuTemp) {
                cpuTemp.innerText = data.system.cpu_temp;
                cpuTemp.style.color = data.system.cpu_temp > 70 ? 'var(--danger-color)' : 'var(--accent-color)';
            }

            // Memory
            const memDetail = document.getElementById('mem-detail');
            if (memDetail) memDetail.innerText = `${data.system.mem_used} / ${data.system.mem_total} GB`;
        }

        // Array Storage
        let arrayPercent = 0;
        if (data.array_storage) {
            console.log('Array Storage Data:', data.array_storage);
            arrayPercent = data.array_storage.percent || 0;
            const arrayDetail = document.getElementById('array-detail');
            if (arrayDetail) {
                arrayDetail.innerText = `${data.array_storage.used} / ${data.array_storage.total} TB`;
                console.log('Array Detail Updated:', arrayDetail.innerText);
            } else {
                console.error('array-detail element not found!');
            }
        } else {
            console.warn('No array_storage data received');
        }

        // Cache Storage
        let cachePercent = 0;
        if (data.cache_storage) {
            console.log('Cache Storage Data:', data.cache_storage);
            cachePercent = data.cache_storage.percent || 0;
            const cacheDetail = document.getElementById('cache-detail');
            if (cacheDetail) {
                cacheDetail.innerText = `${data.cache_storage.used} / ${data.cache_storage.total} TB`;
                console.log('Cache Detail Updated:', cacheDetail.innerText);
            } else {
                console.error('cache-detail element not found!');
            }
        } else {
            console.warn('No cache_storage data received');
        }

        // Update Gauges
        console.log('Updating gauges - CPU:', data.system?.cpu_percent, 'MEM:', data.system?.mem_percent, 'Array:', arrayPercent, 'Cache:', cachePercent);
        if (data.system) {
            updateGauges(
                data.system.cpu_percent || 0,
                data.system.mem_percent || 0,
                arrayPercent,
                cachePercent
            );
        }

        // Disks
        const diskList = document.getElementById('disk-list');
        if (diskList && data.disks) {
            diskList.innerHTML = '';

            data.disks.forEach(disk => {
                const diskEl = document.createElement('div');
                diskEl.className = 'disk-item';

                // Ícone baseado no tipo
                let icon = '💾';
                if (disk.type === 'parity') icon = '🛡️';
                else if (disk.type === 'cache') icon = '⚡';

                const temp = disk.temp || 0;
                const tempClass = temp > 45 ? 'temp-hot' : '';
                const fill = disk.fill || 0;

                // Mostrar barra apenas se tiver uso
                const progressBar = fill > 0
                    ? `<div class="disk-progress"><div class="disk-progress-fill" style="width: ${fill}%"></div></div>
                       <div class="disk-meta">${fill}% usado</div>`
                    : `<div class="disk-meta">${disk.type === 'parity' ? 'Paridade' : ''}</div>`;

                diskEl.innerHTML = `
                    <span class="disk-icon">${icon}</span>
                    <div class="disk-info">
                        <div class="disk-name">${disk.name}</div>
                        ${progressBar}
                    </div>
                    <div class="disk-temp ${tempClass}">${temp}°C</div>
                `;
                diskList.appendChild(diskEl);
            });
        }
    }
});
