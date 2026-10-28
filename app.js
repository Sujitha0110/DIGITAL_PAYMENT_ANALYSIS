/**
 * Digital Payment Analysis - Analytics & ML Risk Intelligence
 * Interactive Application Engine
 */

(function () {
  'use strict';

  // Global State
  const state = {
    activePage: 'executive',
    data: null,
    filters: {
      gateway: 'all',
      method: 'all',
      timeline: 'all'
    },
    search: {
      unretried: '',
      pending: '',
      audit: '',
      predictions: ''
    },
    auditPriority: 'all',
    mlRiskFilter: 'all',
    mlScopeFilter: 'all',
    pendingDoubleDebitOnly: false,
    pagination: {
      pending: { page: 1, limit: 10 },
      audit: { page: 1, limit: 12 },
      predictions: { page: 1, limit: 10 }
    },
    charts: {}
  };

  // Currency & Number Formatters
  const fmtCurrency = (val) => {
    if (val === null || val === undefined || isNaN(val)) return '₹0.00';
    return '₹' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const fmtCompactCurrency = (val) => {
    if (val === null || val === undefined || isNaN(val)) return '₹0';
    const num = Number(val);
    if (num >= 10000000) return '₹' + (num / 10000000).toFixed(2) + ' Cr';
    if (num >= 100000) return '₹' + (num / 100000).toFixed(2) + ' L';
    if (num >= 1000) return '₹' + (num / 1000).toFixed(1) + 'K';
    return '₹' + num.toFixed(0);
  };

  const fmtPercent = (val) => {
    if (val === null || val === undefined || isNaN(val)) return '0.00%';
    return Number(val).toFixed(2) + '%';
  };

  const fmtInt = (val) => {
    if (val === null || val === undefined || isNaN(val)) return '0';
    return Number(val).toLocaleString('en-IN');
  };

  // Helper to destroy old charts on re-render
  function destroyChart(id) {
    if (state.charts[id]) {
      state.charts[id].destroy();
      delete state.charts[id];
    }
  }

  // Common Chart.js Default Settings for Dark Mode
  function getChartDefaults() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#94A3B8',
            font: { family: "'Plus Jakarta Sans', sans-serif", size: 12, weight: 600 }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(13, 19, 34, 0.95)',
          titleColor: '#FFFFFF',
          bodyColor: '#E2E8F0',
          borderColor: 'rgba(99, 102, 241, 0.3)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8,
          boxPadding: 6,
          usePointStyle: true
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94A3B8', font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 } }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94A3B8', font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 } }
        }
      }
    };
  }

  // =========================================================================
  // INITIALIZATION & DATA LOADING
  // =========================================================================
  async function initApp() {
    console.log("Initializing Digital Payment Analysis Dashboard...");
    
    // Check if data is already loaded in window
    if (window.DASHBOARD_DATA) {
      state.data = window.DASHBOARD_DATA;
    } else {
      try {
        const res = await fetch('dashboard_data.json');
        state.data = await res.json();
      } catch (err) {
        console.error("Failed to load dashboard_data.json", err);
        return;
      }
    }

    setupNavigation();
    setupGlobalFilters();
    setupEventListeners();

    // Ping live Python backend service
    fetch('/api/health')
      .then(r => r.ok ? r.json() : null)
      .then(health => {
        if (health && health.status === 'healthy') {
          const dot = document.getElementById('api-status-dot');
          const badge = document.getElementById('api-status-badge');
          const txt = document.getElementById('api-status-text');
          if (dot) dot.style.background = '#10B981';
          if (badge) { badge.textContent = 'ONLINE'; badge.style.color = '#10B981'; }
          if (txt) txt.textContent = `Python Web API v${health.version || '2.2'}`;
        }
      })
      .catch(() => {
        const badge = document.getElementById('api-status-badge');
        if (badge) { badge.textContent = 'CLIENT'; badge.style.color = 'var(--text-muted)'; }
      });

    // Initial render of current page
    renderActivePage();
  }

  // =========================================================================
  // NAVIGATION ROUTER
  // =========================================================================
  function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const pageViews = document.querySelectorAll('.page-view');
    const pageTitle = document.getElementById('current-page-title');
    const pageDesc = document.getElementById('current-page-desc');

    const pageMeta = {
      executive: {
        title: 'Executive Overview',
        desc: 'High-level payment volume, conversion rates, and revenue leakage waterfall'
      },
      failure: {
        title: 'Failure Analysis & Root Causes',
        desc: 'Error code distribution, gateway/method vulnerabilities, and processing latency'
      },
      retry: {
        title: 'Retry Recovery Analysis',
        desc: 'Recovered revenues, conversion lift, timing windows, and unretried opportunities'
      },
      pending: {
        title: 'Pending Monitoring & Double-Debit Hazard',
        desc: 'SLA threshold clocks, severity tracking, and unresolved customer exposures'
      },
      refund: {
        title: 'Refund & Settlement Reconciliation',
        desc: 'SLA aging, synthetic gateway payout gaps, and unified audit ledger'
      },
      ml: {
        title: 'Machine Learning Risk Analysis',
        desc: 'Logistic Regression vs Random Forest tournament, confusion matrix, and live simulator'
      },
      powerbi: {
        title: 'Power BI Data Model & DAX Integration',
        desc: 'Relational star schema design, DAX measures repository, and embedded BI report viewer'
      }
    };

    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const targetPage = item.getAttribute('data-page');
        if (!targetPage || targetPage === state.activePage) return;

        navItems.forEach(n => n.classList.remove('active'));
        item.classList.add('active');

        pageViews.forEach(pv => pv.classList.remove('active'));
        const activeView = document.getElementById(`page-${targetPage}`);
        if (activeView) activeView.classList.add('active');

        state.activePage = targetPage;
        if (pageMeta[targetPage]) {
          pageTitle.textContent = pageMeta[targetPage].title;
          pageDesc.textContent = pageMeta[targetPage].desc;
        }

        // Allow DOM reflow so Chart.js computes accurate canvas dimensions
        requestAnimationFrame(() => {
          setTimeout(() => {
            renderActivePage();
            window.dispatchEvent(new Event('resize'));
          }, 30);
        });
      });
    });
  }


  // =========================================================================
  // GLOBAL FILTERING ENGINE
  // =========================================================================
  // GLOBAL FILTERING ENGINE & HELPER
  // =========================================================================
  // Helper to test if a record satisfies active global filters
  function matchesFilters(r) {
    if (!r) return false;

    // Gateway Filter
    if (state.filters.gateway !== 'all') {
      const gw = r.gateway_name || r.gateway;
      if (gw && gw !== state.filters.gateway) return false;
    }

    // Payment Method Filter (supports GPay as well as legacy UPI)
    if (state.filters.method !== 'all') {
      let m = r.payment_method || r.method;
      if (m === 'UPI') m = 'GPay';
      if (m && m !== state.filters.method) return false;
    }

    // Timeline Filter (e.g. '2026-01')
    if (state.filters.timeline !== 'all') {
      const dt = r.created_at || r.txn_created_at || r.requested_at || r.event_time || r.txn_date || r.date || '';
      if (dt && !dt.startsWith(state.filters.timeline)) {
        return false;
      }
    }

    return true;
  }

  function setupGlobalFilters() {
    const gwSelect = document.getElementById('filter-gateway');
    const methodSelect = document.getElementById('filter-method');
    const timeSelect = document.getElementById('filter-timeline');
    const btnReset = document.getElementById('btn-reset-filters');

    function onFilterChange() {
      state.filters.gateway = gwSelect.value;
      state.filters.method = methodSelect.value;
      state.filters.timeline = timeSelect.value;
      state.pagination.pending.page = 1;
      state.pagination.audit.page = 1;
      state.pagination.predictions.page = 1;
      renderActivePage();
    }

    ['change', 'input'].forEach(evt => {
      gwSelect.addEventListener(evt, onFilterChange);
      methodSelect.addEventListener(evt, onFilterChange);
      timeSelect.addEventListener(evt, onFilterChange);
    });

    btnReset.addEventListener('click', () => {
      gwSelect.value = 'all';
      methodSelect.value = 'all';
      timeSelect.value = 'all';
      state.pendingDoubleDebitOnly = false;
      state.mlRiskFilter = 'all';
      state.mlScopeFilter = 'all';
      const rRisk = document.getElementById('filter-ml-risk');
      if (rRisk) rRisk.value = 'all';
      const rScope = document.getElementById('filter-ml-scope');
      if (rScope) rScope.value = 'all';
      onFilterChange();
    });
  }

  // Filter raw transactions based on global state
  function getFilteredTransactions() {
    if (!state.data || !state.data.transactions) return [];
    return state.data.transactions.filter(matchesFilters);
  }

  // Master Render Router
  function renderActivePage() {
    switch (state.activePage) {
      case 'executive':
        renderExecutivePage();
        break;
      case 'failure':
        renderFailurePage();
        break;
      case 'retry':
        renderRetryPage();
        break;
      case 'pending':
        renderPendingPage();
        break;
      case 'refund':
        renderRefundPage();
        break;
      case 'ml':
        renderMLPage();
        break;
      case 'powerbi':
        renderPowerBIPage();
        break;
    }
  }

  // =========================================================================
  // 1ST PAGE: EXECUTIVE OVERVIEW
  // =========================================================================
  function renderExecutivePage() {
    const txns = getFilteredTransactions();
    const totalCount = txns.length;
    
    let totalVol = 0;
    let succCount = 0;
    let succVol = 0;
    let failCount = 0;
    let failVol = 0;
    let pendingCount = 0;
    let pendingVol = 0;
    let recCount = 0;
    let recVol = 0;

    txns.forEach(t => {
      const amt = Number(t.amount) || 0;
      totalVol += amt;
      if (t.status === 'SUCCESS') {
        succCount++;
        succVol += amt;
      } else if (t.status === 'FAILED') {
        failCount++;
        failVol += amt;
      } else if (t.status === 'PENDING') {
        pendingCount++;
        pendingVol += amt;
      }
      if (t.is_recovered === 1) {
        recCount++;
        recVol += (Number(t.recovered_amount) || amt);
      }
    });

    const succRate = totalCount ? (succCount / totalCount) * 100 : 0;
    const failRate = totalCount ? (failCount / totalCount) * 100 : 0;
    const netLoss = Math.max(0, failVol - recVol);
    const recoveryLift = totalCount ? (recCount / totalCount) * 100 : 0;

    // Update KPI Card DOM
    const elVol = document.getElementById('kpi-exec-volume');
    if (elVol) elVol.textContent = fmtCompactCurrency(totalVol);

    const elTotalTxns = document.getElementById('kpi-exec-total-txns');
    if (elTotalTxns) elTotalTxns.textContent = fmtInt(totalCount) + ' txns';

    const elTotalSub = document.getElementById('kpi-exec-total-sub');
    if (elTotalSub) elTotalSub.textContent = `${fmtInt(succCount)} successful payments`;

    const elSuccRate = document.getElementById('kpi-exec-success-rate');
    if (elSuccRate) elSuccRate.textContent = fmtPercent(succRate);

    const elSuccTxns = document.getElementById('kpi-exec-success-txns');
    if (elSuccTxns) elSuccTxns.textContent = fmtInt(succCount) + ' txns';

    const elSuccVol = document.getElementById('kpi-exec-success-vol');
    if (elSuccVol) elSuccVol.textContent = `${fmtCompactCurrency(succVol)} captured`;

    const elFailRate = document.getElementById('kpi-exec-failure-rate');
    if (elFailRate) elFailRate.textContent = fmtPercent(failRate);

    const elFailTxns = document.getElementById('kpi-exec-failed-txns');
    if (elFailTxns) elFailTxns.textContent = fmtInt(failCount) + ' txns';

    const elFailVol = document.getElementById('kpi-exec-failed-vol');
    if (elFailVol) elFailVol.textContent = `${fmtCompactCurrency(failVol)} at risk`;

    const elRecVol = document.getElementById('kpi-exec-recovered-vol');
    if (elRecVol) elRecVol.textContent = fmtCompactCurrency(recVol);

    const elRecTxns = document.getElementById('kpi-exec-recovered-txns');
    if (elRecTxns) elRecTxns.textContent = fmtInt(recCount) + ' recovered';

    const elRecLift = document.getElementById('kpi-exec-recovered-lift');
    if (elRecLift) elRecLift.textContent = `Lift: +${recoveryLift.toFixed(2)}%`;

    const elNetLoss = document.getElementById('kpi-exec-net-loss');
    if (elNetLoss) elNetLoss.textContent = fmtCompactCurrency(netLoss);

    const elUnrecBadge = document.getElementById('kpi-exec-unrecovered-badge');
    if (elUnrecBadge) elUnrecBadge.textContent = 'Unrecovered';

    const elUnrecCount = document.getElementById('kpi-exec-unrecovered-count');
    if (elUnrecCount) elUnrecCount.textContent = `${fmtInt(Math.max(0, failCount - recCount))} unrecovered failures`;

    // Render Charts
    renderExecTrendChart(txns);
    renderExecWaterfallChart(failVol, recVol, netLoss);
    renderExecGatewayScorecard(txns);
    renderExecMethodsChart(txns);
  }

  function renderExecTrendChart(txns) {
    destroyChart('chart-exec-trend');
    const ctx = document.getElementById('chart-exec-trend');
    if (!ctx) return;

    let monthLabels, successData, failedData, pendingData;

    if (state.filters.timeline !== 'all') {
      monthLabels = ['Days 1–7', 'Days 8–14', 'Days 15–21', 'Days 22–End'];
      successData = [0, 0, 0, 0];
      failedData = [0, 0, 0, 0];
      pendingData = [0, 0, 0, 0];

      txns.forEach(t => {
        if (!t.created_at) return;
        const day = parseInt(t.created_at.substring(8, 10), 10);
        let idx = 0;
        if (day > 21) idx = 3;
        else if (day > 14) idx = 2;
        else if (day > 7) idx = 1;

        if (t.status === 'SUCCESS') successData[idx]++;
        else if (t.status === 'FAILED') failedData[idx]++;
        else if (t.status === 'PENDING') pendingData[idx]++;
      });
    } else {
      const months = ['2026-01', '2026-02', '2026-03', '2026-04'];
      monthLabels = ['Jan 2026', 'Feb 2026', 'Mar 2026', 'Apr 2026'];
      successData = [0, 0, 0, 0];
      failedData = [0, 0, 0, 0];
      pendingData = [0, 0, 0, 0];

      txns.forEach(t => {
        if (!t.created_at) return;
        const m = t.created_at.substring(0, 7);
        const idx = months.indexOf(m);
        if (idx !== -1) {
          if (t.status === 'SUCCESS') successData[idx]++;
          else if (t.status === 'FAILED') failedData[idx]++;
          else if (t.status === 'PENDING') pendingData[idx]++;
        }
      });
    }

    const cfg = getChartDefaults();
    state.charts['chart-exec-trend'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: monthLabels,
        datasets: [
          {
            label: 'Successful',
            data: successData,
            backgroundColor: '#10B981',
            borderRadius: 6
          },
          {
            label: 'Failed',
            data: failedData,
            backgroundColor: '#EF4444',
            borderRadius: 6
          },
          {
            label: 'Pending',
            data: pendingData,
            backgroundColor: '#F59E0B',
            borderRadius: 6
          }
        ]
      },
      options: {
        ...cfg,
        scales: {
          x: { ...cfg.scales.x, stacked: true },
          y: { ...cfg.scales.y, stacked: true }
        }
      }
    });
  }

  function renderExecWaterfallChart(failVol, recVol, netLoss) {
    destroyChart('chart-exec-waterfall');
    const ctx = document.getElementById('chart-exec-waterfall');
    if (!ctx) return;

    const cfg = getChartDefaults();
    state.charts['chart-exec-waterfall'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Gross Failure Loss', 'Retry Recovered', 'Net Revenue Leakage'],
        datasets: [{
          data: [failVol, recVol, netLoss],
          backgroundColor: ['#EF4444', '#10B981', '#F59E0B'],
          borderRadius: 8
        }]
      },
      options: {
        ...cfg,
        plugins: {
          ...cfg.plugins,
          legend: { display: false },
          tooltip: {
            ...cfg.plugins.tooltip,
            callbacks: {
              label: (ctx) => ' ' + fmtCurrency(ctx.parsed.y)
            }
          }
        },
        scales: {
          ...cfg.scales,
          y: {
            ...cfg.scales.y,
            ticks: {
              ...cfg.scales.y.ticks,
              callback: (val) => fmtCompactCurrency(val)
            }
          }
        }
      }
    });
  }

  function renderExecGatewayScorecard(txns) {
    const tbody = document.querySelector('#table-exec-gateways tbody');
    if (!tbody) return;

    const gwMap = {};
    txns.forEach(t => {
      const g = t.gateway_name || 'Other';
      if (!gwMap[g]) {
        gwMap[g] = { total: 0, succ: 0, vol: 0, latencies: [] };
      }
      gwMap[g].total++;
      gwMap[g].vol += Number(t.amount) || 0;
      if (t.status === 'SUCCESS') gwMap[g].succ++;
      if (t.processing_seconds !== undefined) gwMap[g].latencies.push(t.processing_seconds);
    });

    const rows = Object.keys(gwMap).map(g => {
      const item = gwMap[g];
      const rate = item.total ? (item.succ / item.total) * 100 : 0;
      item.latencies.sort((a, b) => a - b);
      const p50 = item.latencies.length ? item.latencies[Math.floor(item.latencies.length * 0.5)] : 0;
      return { gateway: g, total: item.total, rate, vol: item.vol, p50 };
    }).sort((a, b) => b.rate - a.rate);

    tbody.innerHTML = rows.map(r => `
      <tr>
        <td style="font-weight: 700; color: #fff;">${r.gateway}</td>
        <td>${fmtInt(r.total)}</td>
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-weight:700; color:${r.rate >= 70 ? 'var(--success-light)' : 'var(--warning-light)'}">${r.rate.toFixed(1)}%</span>
            <div class="progress-bar-wrap" style="width:70px;">
              <div class="progress-bar-fill" style="width:${r.rate}%; background:${r.rate >= 70 ? 'var(--success)' : 'var(--warning)'};"></div>
            </div>
          </div>
        </td>
        <td>${fmtCompactCurrency(r.vol)}</td>
        <td><span class="mono-tag">${r.p50}s</span></td>
      </tr>
    `).join('');
  }

  function renderExecMethodsChart(txns) {
    destroyChart('chart-exec-methods');
    const ctx = document.getElementById('chart-exec-methods');
    if (!ctx) return;

    const methods = state.filters.method !== 'all' ? [state.filters.method] : ['GPay', 'Credit Card', 'Debit Card', 'NetBanking', 'Wallet'];
    const counts = methods.map(() => 0);
    const succRates = methods.map(() => 0);
    const totalByM = methods.map(() => 0);

    txns.forEach(t => {
      let m = t.payment_method;
      if (m === 'UPI') m = 'GPay';
      const idx = methods.indexOf(m);
      if (idx !== -1) {
        totalByM[idx]++;
        if (t.status === 'SUCCESS') counts[idx]++;
      }
    });

    for (let i = 0; i < methods.length; i++) {
      succRates[i] = totalByM[i] ? (counts[i] / totalByM[i]) * 100 : 0;
    }

    const cfg = getChartDefaults();
    state.charts['chart-exec-methods'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: methods,
        datasets: [{
          label: 'Success Rate (%)',
          data: succRates,
          backgroundColor: '#6366F1',
          borderRadius: 6
        }]
      },
      options: {
        ...cfg,
        indexAxis: 'y',
        plugins: {
          ...cfg.plugins,
          legend: { display: false },
          tooltip: {
            ...cfg.plugins.tooltip,
            callbacks: {
              label: (ctx) => ` Success Rate: ${ctx.parsed.x.toFixed(1)}%`
            }
          }
        },
        scales: {
          x: {
            ...cfg.scales.x,
            min: 0,
            max: 100,
            ticks: { callback: (v) => v + '%' }
          }
        }
      }
    });
  }

  // =========================================================================
  // 2ND PAGE: FAILURE ANALYSIS
  // =========================================================================
  function renderFailurePage() {
    const txns = getFilteredTransactions();
    const failedTxns = txns.filter(t => t.status === 'FAILED');

    let failVol = 0;
    let timeouts = 0;
    let declines = 0;
    let customerFails = 0;

    failedTxns.forEach(t => {
      failVol += Number(t.amount) || 0;
      if (t.error_code === 'ERR_GATEWAY_TIMEOUT') timeouts++;
      else if (t.error_code === 'ERR_BANK_DECLINED') declines++;
      else if (t.error_code === 'ERR_INVALID_OTP' || t.error_code === 'ERR_INSUFFICIENT_FUNDS') customerFails++;
    });

    const totFails = failedTxns.length || 1;

    document.getElementById('kpi-fail-count').textContent = fmtInt(failedTxns.length);
    document.getElementById('kpi-fail-volume').textContent = fmtCurrency(failVol);
    document.getElementById('kpi-fail-timeouts').textContent = fmtInt(timeouts);
    document.getElementById('kpi-fail-declines').textContent = fmtInt(declines);
    document.getElementById('kpi-fail-customer').textContent = fmtInt(customerFails);

    const elTimeoutsPct = document.getElementById('kpi-fail-timeouts-pct');
    if (elTimeoutsPct) elTimeoutsPct.textContent = `${((timeouts / totFails) * 100).toFixed(1)}% of failures`;

    const elDeclinesPct = document.getElementById('kpi-fail-declines-pct');
    if (elDeclinesPct) elDeclinesPct.textContent = `${((declines / totFails) * 100).toFixed(1)}% of failures`;

    const elCustomerPct = document.getElementById('kpi-fail-customer-pct');
    if (elCustomerPct) elCustomerPct.textContent = `${((customerFails / totFails) * 100).toFixed(1)}% of failures`;

    renderFailParetoChart(failedTxns);
    renderFailCategoryChart(timeouts, declines, customerFails);
    renderFailHeatmap(txns);
    renderFailHourlyChart(txns);
    renderFailAmountChart(txns);
    renderFailLatencyChart(txns);
  }


  function renderFailParetoChart(failedTxns) {
    destroyChart('chart-fail-pareto');
    const ctx = document.getElementById('chart-fail-pareto');
    if (!ctx) return;

    const errorCounts = {};
    failedTxns.forEach(t => {
      const err = t.error_code || 'OTHER_ERROR';
      errorCounts[err] = (errorCounts[err] || 0) + 1;
    });

    const sorted = Object.entries(errorCounts).sort((a, b) => b[1] - a[1]);
    const labels = sorted.map(s => s[0].replace('ERR_', ''));
    const counts = sorted.map(s => s[1]);

    const cfg = getChartDefaults();
    state.charts['chart-fail-pareto'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Failure Count',
          data: counts,
          backgroundColor: '#EF4444',
          borderRadius: 6
        }]
      },
      options: {
        ...cfg,
        plugins: {
          ...cfg.plugins,
          legend: { display: false }
        }
      }
    });
  }

  function renderFailCategoryChart(timeouts, declines, customer) {
    destroyChart('chart-fail-category');
    const ctx = document.getElementById('chart-fail-category');
    if (!ctx) return;

    const cfg = getChartDefaults();
    state.charts['chart-fail-category'] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Customer Induced (OTP / Funds)', 'Issuer Bank Decline', 'Technical Gateway Timeout'],
        datasets: [{
          data: [customer, declines, timeouts],
          backgroundColor: ['#6366F1', '#F59E0B', '#EF4444'],
          borderWidth: 0
        }]
      },
      options: {
        ...cfg,
        cutout: '68%',
        plugins: {
          ...cfg.plugins,
          legend: { position: 'bottom' }
        }
      }
    });
  }

  function renderFailHeatmap(txns) {
    const table = document.getElementById('table-fail-heatmap');
    if (!table) return;

    const gateways = state.filters.gateway !== 'all' ? [state.filters.gateway] : ['Razorpay', 'Cashfree', 'PayU'];
    const methods = state.filters.method !== 'all' ? [state.filters.method] : ['GPay', 'Credit Card', 'Debit Card', 'NetBanking', 'Wallet'];

    const matrix = {};
    methods.forEach(m => {
      matrix[m] = {};
      gateways.forEach(g => {
        matrix[m][g] = { total: 0, failed: 0 };
      });
    });

    txns.forEach(t => {
      let m = t.payment_method;
      if (m === 'UPI') m = 'GPay';
      const g = t.gateway_name;
      if (matrix[m] && matrix[m][g]) {
        matrix[m][g].total++;
        if (t.status === 'FAILED') matrix[m][g].failed++;
      }
    });

    let html = `<thead><tr><th style="text-align:left;">Payment Method</th>`;
    gateways.forEach(g => {
      html += `<th>${g}</th>`;
    });
    html += `</tr></thead><tbody>`;

    methods.forEach(m => {
      html += `<tr><td class="row-header">${m}</td>`;
      gateways.forEach(g => {
        const cell = matrix[m][g];
        const rate = cell.total ? (cell.failed / cell.total) * 100 : 0;
        let bg = 'rgba(16, 185, 129, 0.15)';
        let color = '#34D399';
        let border = 'rgba(16, 185, 129, 0.3)';

        if (rate > 22) {
          bg = 'rgba(239, 68, 68, 0.25)';
          color = '#F87171';
          border = 'rgba(239, 68, 68, 0.4)';
        } else if (rate >= 15) {
          bg = 'rgba(245, 158, 11, 0.2)';
          color = '#FBBF24';
          border = 'rgba(245, 158, 11, 0.35)';
        }

        html += `<td style="background:${bg}; color:${color}; border:1px solid ${border};" title="${m} on ${g}: ${cell.failed} failed of ${cell.total} txns">
          ${rate.toFixed(1)}% <span style="font-size:10px; opacity:0.8;">(${cell.failed}/${cell.total})</span>
        </td>`;
      });
      html += `</tr>`;
    });
    html += `</tbody>`;
    table.innerHTML = html;
  }

  function renderFailHourlyChart(txns) {
    destroyChart('chart-fail-hourly');
    const ctx = document.getElementById('chart-fail-hourly');
    if (!ctx) return;

    const hourlyTotals = Array(24).fill(0);
    const hourlyFails = Array(24).fill(0);

    txns.forEach(t => {
      if (t.created_at) {
        const hr = new Date(t.created_at.replace(' ', 'T')).getHours();
        if (hr >= 0 && hr < 24) {
          hourlyTotals[hr]++;
          if (t.status === 'FAILED') hourlyFails[hr]++;
        }
      }
    });

    const rates = hourlyTotals.map((tot, hr) => tot ? (hourlyFails[hr] / tot) * 100 : 0);
    const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);

    const cfg = getChartDefaults();
    state.charts['chart-fail-hourly'] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Failure Rate (%)',
          data: rates,
          borderColor: '#EF4444',
          backgroundColor: 'rgba(239, 68, 68, 0.12)',
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 2
        }]
      },
      options: {
        ...cfg,
        plugins: {
          ...cfg.plugins,
          legend: { display: false }
        },
        scales: {
          y: {
            ...cfg.scales.y,
            ticks: { callback: v => v + '%' }
          }
        }
      }
    });
  }

  function renderFailAmountChart(txns) {
    destroyChart('chart-fail-amount');
    const ctx = document.getElementById('chart-fail-amount');
    if (!ctx) return;

    const bands = ['0-5K', '5K-10K', '10K-15K', '15K-20K', '20K-25K+'];
    const bandTotals = [0, 0, 0, 0, 0];
    const bandFails = [0, 0, 0, 0, 0];

    txns.forEach(t => {
      const amt = Number(t.amount) || 0;
      let bIdx = 0;
      if (amt >= 20000) bIdx = 4;
      else if (amt >= 15000) bIdx = 3;
      else if (amt >= 10000) bIdx = 2;
      else if (amt >= 5000) bIdx = 1;

      bandTotals[bIdx]++;
      if (t.status === 'FAILED') bandFails[bIdx]++;
    });

    const rates = bandTotals.map((tot, i) => tot ? (bandFails[i] / tot) * 100 : 0);

    const cfg = getChartDefaults();
    state.charts['chart-fail-amount'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: bands,
        datasets: [{
          label: 'Failure Rate %',
          data: rates,
          backgroundColor: '#A855F7',
          borderRadius: 6
        }]
      },
      options: {
        ...cfg,
        plugins: {
          ...cfg.plugins,
          legend: { display: false }
        },
        scales: {
          y: {
            ...cfg.scales.y,
            ticks: { callback: v => v + '%' }
          }
        }
      }
    });
  }

  function renderFailLatencyChart(txns) {
    destroyChart('chart-fail-latency');
    const ctx = document.getElementById('chart-fail-latency');
    if (!ctx) return;

    const gateways = state.filters.gateway !== 'all' ? [state.filters.gateway] : ['Razorpay', 'Cashfree', 'PayU'];
    const p50s = [];
    const p90s = [];

    gateways.forEach(g => {
      const lats = txns.filter(t => t.gateway_name === g && t.processing_seconds !== undefined)
        .map(t => t.processing_seconds)
        .sort((a, b) => a - b);
      if (lats.length) {
        p50s.push(lats[Math.floor(lats.length * 0.5)]);
        p90s.push(lats[Math.floor(lats.length * 0.9)]);
      } else {
        p50s.push(0);
        p90s.push(0);
      }
    });

    const cfg = getChartDefaults();
    state.charts['chart-fail-latency'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: gateways,
        datasets: [
          { label: 'P50 Median (sec)', data: p50s, backgroundColor: '#06B6D4', borderRadius: 6 },
          { label: 'P90 Spike (sec)', data: p90s, backgroundColor: '#EF4444', borderRadius: 6 }
        ]
      },
      options: cfg
    });
  }

  // =========================================================================
  // 3RD PAGE: RETRY RECOVERY
  // =========================================================================
  function renderRetryPage() {
    const txns = getFilteredTransactions();
    const totalCount = txns.length;
    const succCount = txns.filter(t => t.status === 'SUCCESS').length;
    const failedTxns = txns.filter(t => t.status === 'FAILED');
    const recoveredTxns = txns.filter(t => t.is_recovered === 1);

    const totalRecoveredAmt = recoveredTxns.reduce((sum, t) => sum + (Number(t.recovered_amount) || Number(t.amount) || 0), 0);
    const totalOrigFailed = failedTxns.length + recoveredTxns.length;
    const recRate = totalOrigFailed ? (recoveredTxns.length / totalOrigFailed) * 100 : 0;
    const unretriedCount = Math.max(0, failedTxns.length - recoveredTxns.length);
    const unretriedVol = failedTxns.filter(t => !t.is_recovered).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const baselineRate = totalCount ? (succCount / totalCount) * 100 : 0;
    const liftedRate = totalCount ? ((succCount + recoveredTxns.length) / totalCount) * 100 : 0;
    const liftDelta = liftedRate - baselineRate;

    document.getElementById('kpi-retry-recovered-amount').textContent = fmtCurrency(totalRecoveredAmt);
    document.getElementById('kpi-retry-rate').textContent = fmtPercent(recRate);
    document.getElementById('kpi-retry-missed').textContent = fmtCompactCurrency(unretriedVol);

    const elRecCount = document.getElementById('kpi-retry-recovered-count');
    if (elRecCount) elRecCount.textContent = `${fmtInt(recoveredTxns.length)} Success Retries`;

    const elRatio = document.getElementById('kpi-retry-rate-ratio');
    if (elRatio) elRatio.textContent = `${fmtInt(recoveredTxns.length)} / ${fmtInt(totalOrigFailed)} Failed Txns`;

    const elLiftVal = document.getElementById('kpi-retry-lift-val');
    if (elLiftVal) elLiftVal.textContent = `+${liftDelta.toFixed(2)}%`;

    const elLiftRange = document.getElementById('kpi-retry-lift-range');
    if (elLiftRange) elLiftRange.textContent = `${baselineRate.toFixed(2)}% → ${liftedRate.toFixed(2)}%`;

    const elUnretriedCount = document.getElementById('kpi-retry-unretried-count');
    if (elUnretriedCount) elUnretriedCount.textContent = `${fmtInt(unretriedCount)} Payments`;

    renderRetryLiftChart(txns);
    renderRetryReasonChart(txns);
    renderRetryTrendChart(txns);
    renderRetryDelayChart(recoveredTxns);
    renderUnretriedTable();
  }

  function renderRetryLiftChart(txns) {
    destroyChart('chart-retry-lift');
    const ctx = document.getElementById('chart-retry-lift');
    if (!ctx) return;

    const list = txns || getFilteredTransactions();
    const methods = state.filters.method !== 'all' ? [state.filters.method] : ['GPay', 'Credit Card', 'Debit Card', 'NetBanking', 'Wallet'];
    const baseline = [];
    const withRetries = [];

    methods.forEach(m => {
      const mList = list.filter(t => {
        let pm = t.payment_method;
        if (pm === 'UPI') pm = 'GPay';
        return pm === m;
      });
      const total = mList.length;
      const succ = mList.filter(t => t.status === 'SUCCESS').length;
      const rec = mList.filter(t => t.is_recovered === 1).length;
      baseline.push(total ? (succ / total) * 100 : 0);
      withRetries.push(total ? ((succ + rec) / total) * 100 : 0);
    });

    const cfg = getChartDefaults();
    state.charts['chart-retry-lift'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: methods,
        datasets: [
          { label: 'Baseline Success %', data: baseline, backgroundColor: '#475569', borderRadius: 6 },
          { label: 'After Retries % (Lifted)', data: withRetries, backgroundColor: '#10B981', borderRadius: 6 }
        ]
      },
      options: {
        ...cfg,
        scales: {
          y: {
            ...cfg.scales.y,
            min: 0,
            max: 100,
            ticks: { callback: v => v + '%' }
          }
        }
      }
    });
  }

  function renderRetryReasonChart(txns) {
    destroyChart('chart-retry-reason');
    const ctx = document.getElementById('chart-retry-reason');
    if (!ctx) return;

    const list = txns || getFilteredTransactions();
    const errorCounts = {};
    const errorRec = {};

    list.filter(t => t.status === 'FAILED' || t.is_recovered === 1).forEach(t => {
      const err = (t.error_code || 'OTHER_ERROR').replace('ERR_', '');
      errorCounts[err] = (errorCounts[err] || 0) + 1;
      if (t.is_recovered === 1) {
        errorRec[err] = (errorRec[err] || 0) + 1;
      }
    });

    const labels = Object.keys(errorCounts);
    const rates = labels.map(l => errorCounts[l] ? ((errorRec[l] || 0) / errorCounts[l]) * 100 : 0);

    const cfg = getChartDefaults();
    state.charts['chart-retry-reason'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels.length ? labels : ['No Errors'],
        datasets: [{
          label: 'Recovery Rate (%)',
          data: rates.length ? rates : [0],
          backgroundColor: '#06B6D4',
          borderRadius: 6
        }]
      },
      options: {
        ...cfg,
        plugins: {
          ...cfg.plugins,
          legend: { display: false }
        },
        scales: {
          y: {
            ...cfg.scales.y,
            ticks: { callback: v => v + '%' }
          }
        }
      }
    });
  }

  function renderRetryTrendChart(txns) {
    destroyChart('chart-retry-trend');
    const ctx = document.getElementById('chart-retry-trend');
    if (!ctx) return;

    const list = txns || getFilteredTransactions();
    let monthLabels, recovered;

    if (state.filters.timeline !== 'all') {
      monthLabels = ['Days 1–7', 'Days 8–14', 'Days 15–21', 'Days 22–End'];
      recovered = [0, 0, 0, 0];

      list.filter(t => t.is_recovered === 1).forEach(t => {
        if (!t.created_at) return;
        const day = parseInt(t.created_at.substring(8, 10), 10);
        let idx = 0;
        if (day > 21) idx = 3;
        else if (day > 14) idx = 2;
        else if (day > 7) idx = 1;
        recovered[idx] += (Number(t.recovered_amount) || Number(t.amount) || 0);
      });
    } else {
      const months = ['2026-01', '2026-02', '2026-03', '2026-04'];
      monthLabels = ['Jan 2026', 'Feb 2026', 'Mar 2026', 'Apr 2026'];
      recovered = [0, 0, 0, 0];

      list.filter(t => t.is_recovered === 1).forEach(t => {
        if (!t.created_at) return;
        const m = t.created_at.substring(0, 7);
        const idx = months.indexOf(m);
        if (idx !== -1) {
          recovered[idx] += (Number(t.recovered_amount) || Number(t.amount) || 0);
        }
      });
    }

    const cfg = getChartDefaults();
    state.charts['chart-retry-trend'] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: monthLabels,
        datasets: [{
          label: 'Recovered Amount (₹)',
          data: recovered,
          borderColor: '#10B981',
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 4
        }]
      },
      options: {
        ...cfg,
        scales: {
          y: {
            ...cfg.scales.y,
            ticks: { callback: v => fmtCompactCurrency(v) }
          }
        }
      }
    });
  }

  function renderRetryDelayChart(recoveredTxns) {
    destroyChart('chart-retry-delay');
    const ctx = document.getElementById('chart-retry-delay');
    if (!ctx) return;

    const list = recoveredTxns || (getFilteredTransactions().filter(t => t.is_recovered === 1));
    const labels = ['< 5 mins', '5 - 15 mins', '15 - 30 mins', '30 - 60 mins', '> 60 mins'];
    const values = [0, 0, 0, 0, 0];

    list.forEach(t => {
      const d = Number(t.last_retry_delay) || Number(t.processing_seconds) || 120;
      if (d <= 300) values[0]++;
      else if (d <= 900) values[1]++;
      else if (d <= 1800) values[2]++;
      else if (d <= 3600) values[3]++;
      else values[4]++;
    });

    const total = values.reduce((a, b) => a + b, 0);
    const displayValues = total > 0 ? values : [0, 0, 0, 0, 0];

    const cfg = getChartDefaults();
    state.charts['chart-retry-delay'] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: displayValues,
          backgroundColor: ['#10B981', '#06B6D4', '#6366F1', '#F59E0B', '#EF4444'],
          borderWidth: 0
        }]
      },
      options: {
        ...cfg,
        cutout: '65%',
        plugins: {
          ...cfg.plugins,
          legend: { position: 'right' }
        }
      }
    });
  }

  function renderUnretriedTable() {
    const tbody = document.querySelector('#table-unretried tbody');
    if (!tbody) return;

    let items = (state.data.unretried_high_value || []).filter(matchesFilters);
    const q = (state.search.unretried || '').toLowerCase();

    if (q) {
      items = items.filter(r => 
        (r.transaction_id && r.transaction_id.toLowerCase().includes(q)) ||
        (r.customer_id && r.customer_id.toLowerCase().includes(q)) ||
        (r.payment_method && r.payment_method.toLowerCase().includes(q)) ||
        (r.gateway_name && r.gateway_name.toLowerCase().includes(q))
      );
    }

    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--text-muted);">No unretried high-value transactions in this filter selection.</td></tr>`;
      return;
    }

    tbody.innerHTML = items.slice(0, 15).map(r => `
      <tr>
        <td><a class="mono-tag action-view-txn" data-id="${r.transaction_id}">${r.transaction_id}</a></td>
        <td><span style="font-weight:600;">${r.customer_id}</span></td>
        <td>${r.payment_method}</td>
        <td>${r.gateway_name}</td>
        <td style="font-weight:700; color:#EF4444;">${fmtCurrency(r.amount)}</td>
        <td><span class="badge badge-failed">${(r.error_code || 'FAILED').replace('ERR_', '')}</span></td>
        <td style="color:var(--text-muted); font-size:12px;">${r.created_at || '-'}</td>
        <td>
          <button class="btn-pill btn-action-recovery" data-txn="${r.transaction_id}" style="color:var(--accent-cyan); border-color:var(--accent-cyan);">
            Trigger Auto-Retry
          </button>
        </td>
      </tr>
    `).join('');

    // Attach listeners
    tbody.querySelectorAll('.action-view-txn').forEach(el => {
      el.addEventListener('click', () => showTxnModal(el.getAttribute('data-id')));
    });

    tbody.querySelectorAll('.btn-action-recovery').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-txn');
        alert(`Success: Initiated automated SMS/WhatsApp payment link for transaction ${id}!`);
      });
    });
  }

  // =========================================================================
  // =========================================================================
  // 4TH PAGE: PENDING MONITORING (REACTIVE TO SLICERS)
  // =========================================================================
  function getFilteredPendingRecords() {
    const records = state.data.pending_records || [];
    return records.filter(matchesFilters);
  }

  function renderPendingPage() {
    const filteredRecords = getFilteredPendingRecords();
    const totalCount = filteredRecords.length;
    const totalAmount = filteredRecords.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

    // SQL Section 5B: Action Required (>30 min)
    const over30List = filteredRecords.filter(r => r.over_30_min === 1 || (r.pending_minutes && r.pending_minutes > 30));
    const over30 = over30List.length;
    const over30Vol = over30List.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

    // SQL Section 5B: Jeopardy SLA (>15 min)
    const over15List = filteredRecords.filter(r => r.over_15_min === 1 || (r.pending_minutes && r.pending_minutes > 15));
    const over15 = over15List.length;
    const over15Vol = over15List.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

    const critical15to30 = over15 - over30;
    const doubleDebitList = filteredRecords.filter(r => r.paid_again_within_24h === 1);
    const doubleDebitVol = doubleDebitList.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const doubleDebitCount = doubleDebitList.length;

    // Update KPI Card DOM
    const elCount = document.getElementById('kpi-pending-count');
    if (elCount) elCount.textContent = fmtInt(totalCount);

    const elVol = document.getElementById('kpi-pending-volume');
    if (elVol) elVol.textContent = fmtCompactCurrency(totalAmount);

    const elStatusSub = document.getElementById('kpi-pending-status-sub');
    if (elStatusSub) elStatusSub.textContent = totalCount ? `${fmtCurrency(totalAmount)} locked in limbo` : 'No pending records';

    const elOver30 = document.getElementById('kpi-pending-over30');
    if (elOver30) elOver30.textContent = fmtInt(over30);

    const elOver30Badge = document.getElementById('kpi-pending-over30-badge');
    if (elOver30Badge) elOver30Badge.textContent = 'Exceeded SLA';

    const elOver30Sub = document.getElementById('kpi-pending-over30-sub');
    if (elOver30Sub) {
      const pct = totalCount ? ((over30 / totalCount) * 100).toFixed(1) : '0.0';
      elOver30Sub.textContent = `${pct}% of pending (${fmtCompactCurrency(over30Vol)})`;
    }

    const elOver15 = document.getElementById('kpi-pending-over15');
    if (elOver15) elOver15.textContent = fmtInt(over15);

    const elOver15Badge = document.getElementById('kpi-pending-over15-badge');
    if (elOver15Badge) elOver15Badge.textContent = 'Stalled';

    const elOver15Sub = document.getElementById('kpi-pending-over15-sub');
    if (elOver15Sub) {
      elOver15Sub.textContent = `${over30} Action + ${critical15to30} Critical (${fmtCompactCurrency(over15Vol)})`;
    }

    const elDoubleVal = document.getElementById('kpi-pending-double-val');
    if (elDoubleVal) elDoubleVal.textContent = fmtCurrency(doubleDebitVol);

    const elDoubleCount = document.getElementById('kpi-pending-double-count');
    if (elDoubleCount) elDoubleCount.textContent = `${doubleDebitCount} Customers`;

    const elDoubleSub = document.getElementById('kpi-pending-double-sub');
    if (elDoubleSub) elDoubleSub.textContent = 'Paid again within 24h';

    // Update Alert Banner dynamically
    const elHazardTitle = document.getElementById('hazard-banner-title');
    if (elHazardTitle) {
      if (doubleDebitCount > 0) {
        elHazardTitle.textContent = `CRITICAL HAZARD: ${doubleDebitCount} Double-Debit Risk Transactions Detected`;
      } else {
        elHazardTitle.textContent = `STATUS NORMAL: 0 Double-Debit Hazards in Current Filtered View`;
      }
    }
    const btnDouble = document.getElementById('btn-filter-double-debit');
    if (btnDouble) {
      btnDouble.textContent = state.pendingDoubleDebitOnly 
        ? `Showing ${doubleDebitCount} Double-Debit At-Risk` 
        : `Filter ${doubleDebitCount} At-Risk Txns`;
      btnDouble.disabled = doubleDebitCount === 0 && !state.pendingDoubleDebitOnly;
    }

    renderPendingGatewayChart(filteredRecords);
    renderPendingHourlyChart(filteredRecords);
    renderPendingTable(filteredRecords);
  }

  function renderPendingGatewayChart(records) {
    destroyChart('chart-pending-gateway');
    const ctx = document.getElementById('chart-pending-gateway');
    if (!ctx) return;

    const list = records || getFilteredPendingRecords();
    const gateways = state.filters.gateway !== 'all' ? [state.filters.gateway] : ['Razorpay', 'Cashfree', 'PayU'];
    const over30 = gateways.map(() => 0);
    const over15 = gateways.map(() => 0);
    const over5 = gateways.map(() => 0);
    const under5 = gateways.map(() => 0);

    list.forEach(r => {
      const idx = gateways.indexOf(r.gateway_name);
      if (idx !== -1) {
        if (r.over_30_min === 1 || (r.pending_minutes && r.pending_minutes > 30)) {
          over30[idx]++;
        } else if (r.over_15_min === 1 || (r.pending_minutes && r.pending_minutes > 15)) {
          over15[idx]++;
        } else if (r.over_5_min === 1 || (r.pending_minutes && r.pending_minutes > 5)) {
          over5[idx]++;
        } else {
          under5[idx]++;
        }
      }
    });

    const cfg = getChartDefaults();
    state.charts['chart-pending-gateway'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: gateways,
        datasets: [
          { label: 'Action (>30 min)', data: over30, backgroundColor: '#EF4444', borderRadius: 4 },
          { label: 'Critical (15-30 min)', data: over15, backgroundColor: '#F59E0B', borderRadius: 4 },
          { label: 'Warning (5-15 min)', data: over5, backgroundColor: '#6366F1', borderRadius: 4 },
          { label: 'OK (<=5 min)', data: under5, backgroundColor: '#10B981', borderRadius: 4 }
        ]
      },
      options: {
        ...cfg,
        scales: {
          x: { ...cfg.scales.x, stacked: true },
          y: { ...cfg.scales.y, stacked: true }
        }
      }
    });
  }

  function renderPendingHourlyChart(records) {
    destroyChart('chart-pending-hourly');
    const ctx = document.getElementById('chart-pending-hourly');
    if (!ctx) return;

    const list = records || getFilteredPendingRecords();
    const hourlyCounts = Array(24).fill(0);

    list.forEach(r => {
      let h = Number(r.txn_hour);
      if (isNaN(h) && r.created_at) {
        h = new Date(r.created_at.replace(' ', 'T')).getHours();
      }
      if (!isNaN(h) && h >= 0 && h < 24) hourlyCounts[h]++;
    });

    const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);

    const cfg = getChartDefaults();
    state.charts['chart-pending-hourly'] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Pending Inflow (Txns)',
          data: hourlyCounts,
          borderColor: '#F59E0B',
          backgroundColor: 'rgba(245, 158, 11, 0.15)',
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 3
        }]
      },
      options: cfg
    });
  }

  function renderPendingTable(records) {
    const tbody = document.querySelector('#table-pending tbody');
    if (!tbody) return;

    let items = records || getFilteredPendingRecords();
    const q = (state.search.pending || '').toLowerCase();

    if (state.pendingDoubleDebitOnly) {
      items = items.filter(r => r.paid_again_within_24h === 1);
    }

    if (q) {
      items = items.filter(r => 
        (r.transaction_id && r.transaction_id.toLowerCase().includes(q)) ||
        (r.customer_id && r.customer_id.toLowerCase().includes(q)) ||
        (r.gateway_name && r.gateway_name.toLowerCase().includes(q)) ||
        (r.payment_method && r.payment_method.toLowerCase().includes(q))
      );
    }

    const { page, limit } = state.pagination.pending;
    const total = items.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const safePage = Math.min(page, totalPages) || 1;
    const start = (safePage - 1) * limit;
    const paginated = items.slice(start, start + limit);

    if (paginated.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:32px; color:var(--text-muted);">No pending transactions match the current filter selection.</td></tr>`;
      renderPaginationDOM('pagination-pending', 0, 1, 1, () => {});
      return;
    }

    tbody.innerHTML = paginated.map(r => {
      const isDouble = r.paid_again_within_24h === 1;
      let badgeClass = 'badge-pending';
      if (r.severity && r.severity.includes('>30')) badgeClass = 'badge-failed';
      else if (r.severity && r.severity.includes('>15')) badgeClass = 'badge-pending';

      return `
        <tr>
          <td><a class="mono-tag action-view-txn" data-id="${r.transaction_id}">${r.transaction_id}</a></td>
          <td><span style="font-weight:600;">${r.customer_id}</span></td>
          <td>${r.gateway_name}</td>
          <td>${r.payment_method}</td>
          <td style="font-weight:700;">${fmtCurrency(r.amount)}</td>
          <td><span class="mono-tag">${r.pending_minutes || 0} min</span></td>
          <td>${r.unresolved_days_at_snapshot || 0} days ago</td>
          <td>
            ${isDouble ? '<span class="badge badge-priority-p1">⚠️ DOUBLE-DEBIT RISK</span>' : '<span style="color:var(--text-dim);">Normal</span>'}
          </td>
          <td><span class="badge ${badgeClass}">${r.severity || 'Normal'}</span></td>
        </tr>
      `;
    }).join('');

    renderPaginationDOM('pagination-pending', total, safePage, totalPages, (newPage) => {
      state.pagination.pending.page = newPage;
      renderPendingTable(records);
    });

    tbody.querySelectorAll('.action-view-txn').forEach(el => {
      el.addEventListener('click', () => showTxnModal(el.getAttribute('data-id')));
    });
  }

  // =========================================================================
  // 5TH PAGE: REFUND & SETTLEMENT
  // =========================================================================
  // =========================================================================
  // 5TH PAGE: REFUND & SETTLEMENT
  // =========================================================================
  function renderRefundPage() {
    const txns = getFilteredTransactions();
    const totalTxnVol = txns.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const filteredRefunds = (state.data.refund_records || []).filter(matchesFilters);
    const filteredGaps = (state.data.settlement_gap_records || []).filter(matchesFilters);
    const filteredAudits = (state.data.audit_records || []).filter(matchesFilters);

    const totalRefundAmt = filteredRefunds.reduce((sum, r) => sum + (Number(r.refund_amount) || Number(r.txn_amount) || 0), 0);
    const completedList = filteredRefunds.filter(r => r.refund_status === 'COMPLETED');
    const completedRefundAmt = completedList.reduce((sum, r) => sum + (Number(r.refund_amount) || 0), 0);
    const unsettledList = filteredRefunds.filter(r => r.settlement_status === 'UNSETTLED');
    const unsettledRefundAmt = unsettledList.reduce((sum, r) => sum + (Number(r.refund_amount) || 0), 0);
    const netGap = filteredGaps.reduce((sum, r) => sum + (Number(r.gap_amount) || (Number(r.expected_payout) - Number(r.payout_amount || 0))), 0);

    const elTotal = document.getElementById('kpi-refund-total');
    if (elTotal) elTotal.textContent = fmtCurrency(totalRefundAmt);

    const elCount = document.getElementById('kpi-refund-count');
    if (elCount) elCount.textContent = `${fmtInt(filteredRefunds.length)} Requests`;

    const elShare = document.getElementById('kpi-refund-share');
    if (elShare) {
      const share = totalTxnVol ? ((totalRefundAmt / totalTxnVol) * 100).toFixed(2) : '0.00';
      elShare.textContent = `${share}% of Volume`;
    }

    const elComp = document.getElementById('kpi-refund-completed');
    if (elComp) elComp.textContent = fmtCurrency(completedRefundAmt);

    const elCompCount = document.getElementById('kpi-refund-completed-count');
    if (elCompCount) elCompCount.textContent = `${fmtInt(completedList.length)} Completed`;

    const elUnsettled = document.getElementById('kpi-refund-unsettled');
    if (elUnsettled) elUnsettled.textContent = fmtCurrency(unsettledRefundAmt);

    const elUnsettledCount = document.getElementById('kpi-refund-unsettled-count');
    if (elUnsettledCount) elUnsettledCount.textContent = `${fmtInt(unsettledList.length)} Pending/Stuck`;

    const elGap = document.getElementById('kpi-settle-gap');
    if (elGap) elGap.textContent = fmtCurrency(netGap);

    const elGapCount = document.getElementById('kpi-settle-gap-count');
    if (elGapCount) elGapCount.textContent = `${fmtInt(filteredGaps.length)} Shortfall Events`;

    const elAudit = document.getElementById('kpi-audit-count');
    if (elAudit) elAudit.textContent = fmtInt(filteredAudits.length) + ' Items';

    renderRefundAgingChart(filteredRefunds);
    renderSettlementReconciliationChart(filteredGaps);
    renderAuditTable(filteredAudits);
  }

  function renderRefundAgingChart(records) {
    destroyChart('chart-refund-aging');
    const ctx = document.getElementById('chart-refund-aging');
    if (!ctx) return;

    const list = records || (state.data.refund_records || []).filter(matchesFilters);
    const buckets = {
      '0–7 days (In Progress)': 0,
      '8–14 days (At Risk)': 0,
      '15–30 days (Stalled)': 0,
      '31–60 days (Stuck)': 0,
      '> 60 days (Critical SLA)': 0
    };

    list.forEach(r => {
      const a = (r.refund_age_days !== undefined && r.refund_age_days !== null && !isNaN(Number(r.refund_age_days)))
        ? Number(r.refund_age_days)
        : (Number(r.business_days_open) || 0);

      if (a <= 7) buckets['0–7 days (In Progress)']++;
      else if (a <= 14) buckets['8–14 days (At Risk)']++;
      else if (a <= 30) buckets['15–30 days (Stalled)']++;
      else if (a <= 60) buckets['31–60 days (Stuck)']++;
      else buckets['> 60 days (Critical SLA)']++;
    });

    const cfg = getChartDefaults();
    state.charts['chart-refund-aging'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: Object.keys(buckets),
        datasets: [{
          label: 'Refund Requests Count',
          data: Object.values(buckets),
          backgroundColor: ['#10B981', '#06B6D4', '#F59E0B', '#EF4444', '#A855F7'],
          borderRadius: 6
        }]
      },
      options: {
        ...cfg,
        plugins: {
          ...cfg.plugins,
          legend: { display: false }
        }
      }
    });
  }

  function renderSettlementReconciliationChart(records) {
    destroyChart('chart-settlement-reconciliation');
    const ctx = document.getElementById('chart-settlement-reconciliation');
    if (!ctx) return;

    const gapRecords = records || (state.data.settlement_gap_records || []).filter(matchesFilters);
    const gateways = state.filters.gateway !== 'all' ? [state.filters.gateway] : ['Razorpay', 'Cashfree', 'PayU'];
    const expected = gateways.map(() => 0);
    const actual = gateways.map(() => 0);

    gapRecords.forEach(r => {
      const idx = gateways.indexOf(r.gateway_name);
      if (idx !== -1) {
        expected[idx] += Number(r.expected_payout) || 0;
        if (r.payout_amount !== null && r.payout_amount !== undefined) {
          actual[idx] += Number(r.payout_amount) || 0;
        }
      }
    });

    const cfg = getChartDefaults();
    state.charts['chart-settlement-reconciliation'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: gateways,
        datasets: [
          { label: 'Expected Payout (₹)', data: expected, backgroundColor: '#6366F1', borderRadius: 6 },
          { label: 'Actual Payout Received (₹)', data: actual, backgroundColor: '#10B981', borderRadius: 6 }
        ]
      },
      options: {
        ...cfg,
        scales: {
          y: {
            ...cfg.scales.y,
            ticks: { callback: v => fmtCompactCurrency(v) }
          }
        }
      }
    });
  }

  function renderAuditTable(records) {
    const tbody = document.querySelector('#table-audit tbody');

    if (!tbody) return;

    let items = records || (state.data.audit_records || []).filter(matchesFilters);
    const q = (state.search.audit || '').toLowerCase();

    if (state.auditPriority !== 'all') {
      items = items.filter(r => r.priority === state.auditPriority);
    }

    if (q) {
      items = items.filter(r => 
        (r.reference_id && r.reference_id.toLowerCase().includes(q)) ||
        (r.gateway_name && r.gateway_name.toLowerCase().includes(q)) ||
        (r.payment_method && r.payment_method.toLowerCase().includes(q)) ||
        (r.issue && r.issue.toLowerCase().includes(q))
      );
    }

    const { page, limit } = state.pagination.audit;
    const total = items.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const safePage = Math.min(page, totalPages) || 1;
    const start = (safePage - 1) * limit;
    const paginated = items.slice(start, start + limit);

    if (paginated.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:32px; color:var(--text-muted);">No reconciliation items match the current filter selection.</td></tr>`;
      renderPaginationDOM('pagination-audit', 0, 1, 1, () => {});
      return;
    }

    tbody.innerHTML = paginated.map(r => {
      let badgeClass = 'badge-priority-p3';
      if (r.priority === 'P1') badgeClass = 'badge-priority-p1';
      else if (r.priority === 'P2') badgeClass = 'badge-priority-p2';

      return `
        <tr>
          <td><span class="badge ${badgeClass}">${r.priority}</span></td>
          <td><span style="font-size:12px; font-weight:700;">${r.audit_type}</span></td>
          <td><span class="mono-tag">${r.reference_id}</span></td>
          <td>${r.gateway_name || '-'}</td>
          <td>${r.payment_method || '-'}</td>
          <td>${r.customer_id || '-'}</td>
          <td style="font-weight:700; color:#EF4444;">${fmtCurrency(r.amount_at_risk)}</td>
          <td>${r.age_days}d ago</td>
          <td style="max-width:280px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${r.issue}">${r.issue}</td>
        </tr>
      `;
    }).join('');

    renderPaginationDOM('pagination-audit', total, safePage, totalPages, (newPage) => {
      state.pagination.audit.page = newPage;
      renderAuditTable(records);
    });
  }

  // =========================================================================
  // 6TH PAGE: MACHINE LEARNING RISK ANALYSIS
  // =========================================================================
  function renderMLPage() {
    renderMLPredictionsTable();
    updateMLKpiCards();
    setupSimulator();
  }

  function updateMLKpiCards() {
    let items = (state.data.ml_risk && state.data.ml_risk.predictions) ? state.data.ml_risk.predictions : [];
    if (state.filters.gateway !== 'all' || state.filters.method !== 'all' || state.filters.timeline !== 'all') {
      items = items.filter(r => matchesFilters(r));
    }
    if (state.mlScopeFilter === 'test') {
      items = items.filter(r => r.is_test_sample);
    }
    const tot = items.length;
    const med = items.filter(r => r.risk_level === 'Medium').length;
    const low = items.filter(r => r.risk_level === 'Low').length;
    const high = items.filter(r => r.risk_level === 'High').length;
    const actualFails = items.filter(r => r.actual_status === 'FAILED');
    const caught = actualFails.filter(r => (Number(r.failure_probability) || 0) >= 0.5).length;

    const elTiers = document.getElementById('kpi-ml-tiers');
    if (elTiers) {
      elTiers.textContent = `${high} High / ${med} Med / ${low} Low`;
    }

    const elTiersSub = document.getElementById('kpi-ml-tiers-sub');
    if (elTiersSub) elTiersSub.textContent = `${tot.toLocaleString()} evaluated transactions`;

    const elRecall = document.getElementById('kpi-ml-recall');
    if (elRecall) {
      if (actualFails.length > 0) {
        elRecall.textContent = `${((caught / actualFails.length) * 100).toFixed(1)}%`;
      } else {
        elRecall.textContent = 'N/A';
      }
    }
    const elRecallSub = document.getElementById('kpi-ml-recall-sub');
    if (elRecallSub) {
      if (actualFails.length > 0) {
        elRecallSub.textContent = `Catches ${caught}/${actualFails.length} filtered failures`;
      } else {
        elRecallSub.textContent = '0 failures in active filter';
      }
    }
  }

  function setupSimulator() {
    const btnRun = document.getElementById('btn-run-simulation');
    if (!btnRun) return;

    btnRun.onclick = calculateSimulation;
    
    // Auto-calculate on input changes
    ['sim-amount', 'sim-method', 'sim-gateway', 'sim-hour', 'sim-cust-hist', 'sim-day'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', calculateSimulation);
    });

    calculateSimulation();
  }

  function calculateSimulation() {
    const amt = parseFloat(document.getElementById('sim-amount').value) || 10000;
    const method = document.getElementById('sim-method').value;
    const gateway = document.getElementById('sim-gateway').value;
    const hour = parseInt(document.getElementById('sim-hour').value) || 12;
    const custHist = parseFloat(document.getElementById('sim-cust-hist').value) || 0.0;
    const day = parseInt(document.getElementById('sim-day').value) || 0;

    // Logistic model simulation equation calibrated to match notebook distributions
    let z = -0.15; // base log-odds

    // Feature 1: Customer past failure rate (primary predictive driver)
    z += custHist * 1.85;

    // Feature 2: Amount scaling
    const normAmt = (amt - 10000) / 10000;
    z += normAmt * 0.22;

    // Feature 3: Method weights
    if (method === 'NetBanking') z += 0.38;
    else if (method === 'Credit Card') z += 0.25;
    else if (method === 'Debit Card') z += 0.15;
    else if (method === 'GPay' || method === 'UPI') z -= 0.10;
    else if (method === 'Wallet') z -= 0.05;

    // Feature 4: Gateway variations
    if (gateway === 'PayU') z += 0.18;
    else if (gateway === 'Razorpay') z -= 0.08;

    // Feature 5: Peak evening & night hours
    if (hour >= 18 && hour <= 21) z += 0.32; // peak hours
    else if (hour >= 23 || hour <= 4) z += 0.28; // night batch maintenance

    // Feature 6: Weekend
    if (day >= 5) z += 0.16;

    // Sigmoid function
    const prob = 1 / (1 + Math.exp(-z));
    const probPct = Math.min(99.0, Math.max(1.0, prob * 100)).toFixed(1);

    // Update Display
    const probDisplay = document.getElementById('sim-prob-display');
    const badge = document.getElementById('sim-risk-badge');
    const explanation = document.getElementById('sim-explanation');
    const circle = document.getElementById('sim-gauge-circle');

    probDisplay.innerHTML = `${probPct}<span>%</span>`;

    let tier = 'LOW RISK';
    let badgeClass = 'badge-priority-p3';
    let circleColor = 'rgba(16, 185, 129, 0.5)';
    let circleBg = 'rgba(16, 185, 129, 0.15)';

    if (probPct >= 70) {
      tier = 'CRITICAL / HIGH RISK';
      badgeClass = 'badge-priority-p1';
      circleColor = 'rgba(239, 68, 68, 0.8)';
      circleBg = 'rgba(239, 68, 68, 0.2)';
    } else if (probPct >= 35) {
      tier = 'MEDIUM RISK TIER';
      badgeClass = 'badge-priority-p2';
      circleColor = 'rgba(245, 158, 11, 0.7)';
      circleBg = 'rgba(245, 158, 11, 0.18)';
    }

    badge.className = `badge ${badgeClass}`;
    badge.textContent = tier;
    badge.style.fontSize = '13px';
    badge.style.padding = '5px 14px';

    circle.style.borderColor = circleColor;
    circle.style.background = `radial-gradient(circle, ${circleBg} 0%, transparent 70%)`;

    // Explainable AI text
    let driverDesc = [];
    if (custHist >= 0.5) driverDesc.push(`elevated customer failure history (${custHist})`);
    if (hour >= 18 && hour <= 21) driverDesc.push('peak shopping window traffic congestion (18:00 - 21:00)');
    if (method === 'NetBanking') driverDesc.push('inter-bank NetBanking redirect hops');
    if (amt > 20000) driverDesc.push('high-ticket size fraud threshold');
    if (day >= 5) driverDesc.push('weekend core banking system load');

    explanation.textContent = driverDesc.length 
      ? `Primary risk factors: ${driverDesc.join(', ')}.`
      : 'Transaction features are within normal operational stability limits with low historical risk.';

    // Query Python ML API asynchronously to verify live model inference
    if (window.fetch) {
      fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amt,
          payment_method: method,
          gateway_name: gateway,
          hour: hour,
          customer_previous_failure_rate: custHist,
          is_weekend: day >= 5 ? 1 : 0
        })
      })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.transaction_id) {
          const tagTxt = document.getElementById('sim-backend-text');
          if (tagTxt) {
            tagTxt.textContent = `Python Service: ${data.model} | Ref: ${data.transaction_id}`;
          }
        }
      })
      .catch(() => {
        // Silent fallback in client-only mode
      });
    }
  }

  function renderMLPredictionsTable() {
    const tbody = document.querySelector('#table-predictions tbody');
    if (!tbody) return;

    let items = (state.data.ml_risk && state.data.ml_risk.predictions) ? state.data.ml_risk.predictions : [];
    const q = state.search.predictions.toLowerCase();

    // Cross-match with filtered transactions if filters are active
    if (state.filters.gateway !== 'all' || state.filters.method !== 'all' || state.filters.timeline !== 'all') {
      items = items.filter(r => matchesFilters(r));
    }

    // Model Validation Scope Filter
    if (state.mlScopeFilter === 'test') {
      items = items.filter(r => r.is_test_sample);
    }

    if (state.mlRiskFilter !== 'all') {
      items = items.filter(r => r.risk_level === state.mlRiskFilter);
    }

    if (q) {
      items = items.filter(r => r.transaction_id && r.transaction_id.toLowerCase().includes(q));
    }

    const { page, limit } = state.pagination.predictions;
    const total = items.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const start = (page - 1) * limit;
    const paginated = items.slice(start, start + limit);

    // Dynamic title with scope & matching count
    const titleEl = document.getElementById('ml-explorer-title');
    if (titleEl) {
      const scopeLabel = state.mlScopeFilter === 'test' ? 'Test Validation Samples' : 'Evaluated Transactions';
      titleEl.textContent = `Payment Failure Model Predictions Explorer (${total.toLocaleString()} ${scopeLabel})`;
    }

    if (paginated.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; padding:36px; color:var(--text-muted);">
            No transactions match the selected filters. Try choosing "All Risk Levels" or resetting slicers.
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = paginated.map(r => {
        const prob = Number(r.failure_probability_pct) || 0;
        const isActualFail = r.actual_status === 'FAILED';
        const isMatch = (prob >= 50 && isActualFail) || (prob < 50 && !isActualFail);

        let badgeClass = 'badge-priority-p3';
        if (r.risk_level === 'High') badgeClass = 'badge-priority-p1';
        else if (r.risk_level === 'Medium') badgeClass = 'badge-priority-p2';

        return `
          <tr>
            <td><a class="mono-tag action-view-txn" data-id="${r.transaction_id}">${r.transaction_id}</a></td>
            <td>
              <div style="font-size:12px; font-weight:600; color:#fff;">${r.gateway_name || '-'}</div>
              <div style="font-size:11px; color:var(--text-muted);">${r.payment_method || '-'}</div>
            </td>
            <td><span class="badge ${isActualFail ? 'badge-failed' : (r.actual_status === 'PENDING' ? 'badge-pending' : 'badge-success')}">${r.actual_status}</span></td>
            <td>
              <div style="display:flex; align-items:center; gap:8px;">
                <span class="mono-tag">${Number(r.failure_probability).toFixed(4)}</span>
                <div class="progress-bar-wrap" style="width:70px;">
                  <div class="progress-bar-fill" style="width:${prob}%; background:${prob >= 52 ? 'var(--danger)' : (prob >= 48 ? 'var(--warning)' : 'var(--success)')};"></div>
                </div>
              </div>
            </td>
            <td style="font-weight:700;">${prob.toFixed(2)}%</td>
            <td><span class="badge ${badgeClass}">${r.risk_level}</span></td>
            <td>
              ${isMatch ? '<span style="color:var(--success-light); font-weight:600;">✓ Correct Risk Flag</span>' : '<span style="color:var(--text-dim);">Unmatched Class</span>'}
            </td>
          </tr>
        `;
      }).join('');
    }

    renderPaginationDOM('pagination-predictions', total, page, totalPages, (newPage) => {
      state.pagination.predictions.page = newPage;
      renderMLPredictionsTable();
    });

    tbody.querySelectorAll('.action-view-txn').forEach(el => {
      el.addEventListener('click', () => showTxnModal(el.getAttribute('data-id')));
    });
  }

  // =========================================================================
  // 7TH PAGE: POWER BI ARCHITECTURE & EMBED VIEWER
  // =========================================================================
  function renderPowerBIPage() {
    const btnLoad = document.getElementById('btn-load-powerbi');
    const inputUrl = document.getElementById('input-powerbi-url');
    const container = document.getElementById('powerbi-embed-container');
    const btnSample = document.getElementById('btn-powerbi-sample');

    if (btnLoad && !btnLoad._hasInit) {
      btnLoad._hasInit = true;
      btnLoad.addEventListener('click', () => {
        const url = (inputUrl ? inputUrl.value : '').trim();
        if (!url) {
          alert('Please enter a valid Power BI Publish-to-Web link.');
          return;
        }
        if (container) {
          container.innerHTML = `
            <iframe title="Power BI Payment Failure Report" width="100%" height="600" 
              src="${url}" frameborder="0" allowFullScreen="true" 
              style="border: none; border-radius: 8px;"></iframe>
          `;
        }
      });
    }

    if (btnSample && !btnSample._hasInit) {
      btnSample._hasInit = true;
      btnSample.addEventListener('click', () => {
        const txns = getFilteredTransactions();
        const total = txns.length;
        const failed = txns.filter(t => t.status === 'FAILED').length;
        const recovered = txns.filter(t => t.is_recovered).length;
        const rate = total ? ((failed / total) * 100).toFixed(2) : '0.00';
        
        if (container) {
          container.innerHTML = `
            <div style="width:100%; text-align:left; background:var(--bg-secondary); padding:20px; border-radius:8px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom:1px solid var(--border-subtle); padding-bottom:10px;">
                <h4 style="color:#fff; margin:0;">📊 Star Schema Live Data View (${total.toLocaleString()} rows)</h4>
                <span class="badge badge-success">SQL Views Connected</span>
              </div>
              <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:12px; margin-bottom:15px;">
                <div style="background:var(--bg-card); padding:10px; border-radius:6px;"><div style="font-size:11px; color:var(--text-muted);">DAX [Failure Rate %]</div><div style="font-size:18px; font-weight:700; color:var(--danger-light);">${rate}%</div></div>
                <div style="background:var(--bg-card); padding:10px; border-radius:6px;"><div style="font-size:11px; color:var(--text-muted);">DAX [Total Attempted]</div><div style="font-size:18px; font-weight:700; color:#fff;">${total.toLocaleString()}</div></div>
                <div style="background:var(--bg-card); padding:10px; border-radius:6px;"><div style="font-size:11px; color:var(--text-muted);">DAX [Recovered Count]</div><div style="font-size:18px; font-weight:700; color:var(--success-light);">${recovered.toLocaleString()}</div></div>
              </div>
              <p style="font-size:12px; color:var(--text-muted); margin:0;">
                💡 <em>Fact_Transactions</em> is dynamically filtered by the global slicers (Gateway, Method, Timeline) matching the Power BI Cross-Filtering engine.
              </p>
            </div>
          `;
        }
      });
    }
  }

  // =========================================================================
  // PAGINATION COMPONENT
  // =========================================================================
  function renderPaginationDOM(containerId, total, current, totalPages, onPageChange) {
    const el = document.getElementById(containerId);
    if (!el) return;

    el.innerHTML = `
      <div>Showing page <strong>${current}</strong> of <strong>${totalPages}</strong> (${total} total records)</div>
      <div class="pagination-controls">
        <button class="btn-page prev-page" ${current <= 1 ? 'disabled' : ''}>Previous</button>
        <button class="btn-page next-page" ${current >= totalPages ? 'disabled' : ''}>Next</button>
      </div>
    `;

    el.querySelector('.prev-page').onclick = () => onPageChange(current - 1);
    el.querySelector('.next-page').onclick = () => onPageChange(current + 1);
  }

  // =========================================================================
  // TRANSACTION DETAILS MODAL
  // =========================================================================
  function showTxnModal(txnId) {
    const modal = document.getElementById('modal-details');
    const content = document.getElementById('modal-content');
    const title = document.getElementById('modal-title');
    if (!modal || !content) return;

    const txns = state.data.transactions || [];
    const item = txns.find(t => t.transaction_id === txnId) || { transaction_id: txnId };

    title.textContent = `Transaction Inspection: ${txnId}`;
    content.innerHTML = `
      <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:16px; margin-bottom:18px;">
        <div class="form-field"><label>Transaction ID</label><div class="mono-tag" style="padding:6px;">${item.transaction_id}</div></div>
        <div class="form-field"><label>Customer ID</label><div style="font-weight:700; color:#fff;">${item.customer_id || '-'}</div></div>
        <div class="form-field"><label>Status</label><div><span class="badge ${item.status === 'SUCCESS' ? 'badge-success' : 'badge-failed'}">${item.status}</span></div></div>
        <div class="form-field"><label>Amount</label><div style="font-size:18px; font-weight:800; color:#fff;">${fmtCurrency(item.amount)}</div></div>
        <div class="form-field"><label>Payment Method</label><div>${item.payment_method || '-'}</div></div>
        <div class="form-field"><label>Gateway</label><div>${item.gateway_name || '-'}</div></div>
        <div class="form-field"><label>Error Code</label><div><span class="mono-tag">${item.error_code || 'None'}</span></div></div>
        <div class="form-field"><label>Latency</label><div>${item.processing_seconds !== undefined ? item.processing_seconds + ' seconds' : '-'}</div></div>
        <div class="form-field"><label>Created At</label><div style="color:var(--text-muted);">${item.created_at || '-'}</div></div>
        <div class="form-field"><label>Recovery Status</label><div>${item.is_recovered ? '<span class="badge badge-success">Recovered (₹' + item.recovered_amount + ')</span>' : '<span style="color:var(--text-dim);">Not Recovered</span>'}</div></div>
      </div>
    `;

    modal.classList.add('active');
  }

  function setupEventListeners() {
    // Modal Close
    const modal = document.getElementById('modal-details');
    const closeBtn = document.getElementById('modal-close-btn');
    const closeAction = document.getElementById('modal-close-action');

    if (closeBtn) closeBtn.onclick = () => modal.classList.remove('active');
    if (closeAction) closeAction.onclick = () => modal.classList.remove('active');
    if (modal) {
      modal.onclick = (e) => {
        if (e.target === modal) modal.classList.remove('active');
      };
    }

    // Double Debit Filter Button on Pending Page
    const btnDouble = document.getElementById('btn-filter-double-debit');
    if (btnDouble) {
      btnDouble.addEventListener('click', () => {
        state.pendingDoubleDebitOnly = !state.pendingDoubleDebitOnly;
        state.pagination.pending.page = 1;
        renderPendingPage();
      });
    }

    // Search Inputs
    const searchUnretried = document.getElementById('search-unretried');
    if (searchUnretried) {
      searchUnretried.addEventListener('input', (e) => {
        state.search.unretried = e.target.value;
        renderUnretriedTable();
      });
    }

    const searchPending = document.getElementById('search-pending');
    if (searchPending) {
      searchPending.addEventListener('input', (e) => {
        state.search.pending = e.target.value;
        state.pagination.pending.page = 1;
        renderPendingTable();
      });
    }

    const searchAudit = document.getElementById('search-audit');
    if (searchAudit) {
      searchAudit.addEventListener('input', (e) => {
        state.search.audit = e.target.value;
        state.pagination.audit.page = 1;
        renderAuditTable();
      });
    }

    const searchPred = document.getElementById('search-predictions');
    if (searchPred) {
      searchPred.addEventListener('input', (e) => {
        state.search.predictions = e.target.value;
        state.pagination.predictions.page = 1;
        renderMLPredictionsTable();
      });
    }

    // Priority filter for audit
    const filterAuditPriority = document.getElementById('filter-audit-priority');
    if (filterAuditPriority) {
      filterAuditPriority.addEventListener('change', (e) => {
        state.auditPriority = e.target.value;
        state.pagination.audit.page = 1;
        renderAuditTable();
      });
    }

    // ML Risk filter
    const filterMLRisk = document.getElementById('filter-ml-risk');
    if (filterMLRisk) {
      filterMLRisk.addEventListener('change', (e) => {
        state.mlRiskFilter = e.target.value;
        state.pagination.predictions.page = 1;
        renderMLPredictionsTable();
      });
    }

    // ML Scope filter
    const filterMLScope = document.getElementById('filter-ml-scope');
    if (filterMLScope) {
      filterMLScope.addEventListener('change', (e) => {
        state.mlScopeFilter = e.target.value;
        state.pagination.predictions.page = 1;
        renderMLPredictionsTable();
        updateMLKpiCards();
      });
    }

    // CSV Exporter
    const btnExport = document.getElementById('btn-export-data');
    if (btnExport) {
      btnExport.addEventListener('click', exportActiveDataset);
    }
  }

  // Generic CSV Export function
  function exportActiveDataset() {
    let rows = [];
    let filename = `nexuspay_${state.activePage}_export.csv`;

    if (state.activePage === 'executive' || state.activePage === 'failure') {
      rows = getFilteredTransactions();
    } else if (state.activePage === 'retry') {
      rows = (state.data.unretried_high_value || []).filter(matchesFilters);
    } else if (state.activePage === 'pending') {
      rows = getFilteredPendingRecords();
    } else if (state.activePage === 'refund') {
      rows = (state.data.audit_records || []).filter(matchesFilters);
    } else if (state.activePage === 'ml') {
      rows = (state.data.ml_risk && state.data.ml_risk.predictions) ? state.data.ml_risk.predictions : [];
      if (state.filters.gateway !== 'all' || state.filters.method !== 'all' || state.filters.timeline !== 'all') {
        const allowedTxnIds = new Set(getFilteredTransactions().map(t => t.transaction_id));
        rows = rows.filter(r => allowedTxnIds.has(r.transaction_id));
      }
    }

    if (!rows.length) {
      alert("No records to export.");
      return;
    }

    const headers = Object.keys(rows[0]);
    const csvContent = [
      headers.join(','),
      ...rows.map(row => headers.map(h => {
        const val = row[h] === null || row[h] === undefined ? '' : String(row[h]).replace(/"/g, '""');
        return `"${val}"`;
      }).join(','))
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // =========================================================================
  // THEME TOGGLE (Dark / Light)
  // =========================================================================
  function setupThemeToggle() {
    const btn = document.getElementById('btn-theme-toggle');
    if (!btn) return;

    // Restore saved theme (default: light)
    const saved = localStorage.getItem('dpa-theme') || 'light';
    applyTheme(saved);

    btn.addEventListener('click', () => {
      const isDark = document.body.classList.contains('dark-theme');
      applyTheme(isDark ? 'light' : 'dark');
    });
  }

  function applyTheme(theme) {
    const btn = document.getElementById('btn-theme-toggle');
    if (theme === 'dark') {
      document.body.classList.add('dark-theme');
      if (btn) btn.setAttribute('title', 'Switch to Light Mode');
    } else {
      document.body.classList.remove('dark-theme');
      if (btn) btn.setAttribute('title', 'Switch to Dark Mode');
    }
    localStorage.setItem('dpa-theme', theme);
  }

  // Launch app when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { initApp(); setupThemeToggle(); });
  } else {
    initApp();
    setupThemeToggle();
  }

})();

