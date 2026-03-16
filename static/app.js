
        // ══════════════════════════════════════
        //   DATA STORE
        // ══════════════════════════════════════
        let DB = {
    currentUser: null,
    currentRole: 'government',
    companies: [],
    problems: [],
    bids: [],
    notifications: [
        { id: 1, text: 'New problem statement PS004 posted by Highways Dept.', time: '2h ago', read: false },
        { id: 2, text: 'Your bid B001 for PS001 is under review.', time: '5h ago', read: false },
        { id: 3, text: 'Score updated after project completion: +3 pts', time: '1d ago', read: true },
    ]
};

async function fetchData() {
    try {
        let rs_comp = await fetch('/api/companies');
        DB.companies = await rs_comp.json();
        let rs_prob = await fetch('/api/problems');
        DB.problems = await rs_prob.json();
        let rs_bids = await fetch('/api/bids');
        DB.bids = await rs_bids.json();
    } catch(e) { console.error(e); }
}

        // ══════════════════════════════════════
        //   SCORE ENGINE
        // ══════════════════════════════════════
        function calcCompanyScore(c) {
            return Math.round(
                0.40 * c.ontime +
                0.30 * c.quality +
                0.20 * c.feedback +
                0.10 * Math.min(c.projects, 50) * 2
            );
        }

        function evalBid(bidAmt, maxBid, minBid, companyScore) {
            const range = maxBid - minBid || 1;
            const bidScore = ((maxBid - bidAmt) / range) * 100;
            return Math.round(0.60 * bidScore + 0.40 * companyScore);
        }

        function getScoreColor(s) {
            if (s >= 80) return '#1db87a';
            if (s >= 60) return '#e8a020';
            return '#c8330a';
        }

        function getPriorityOrder(companies) {
            return [...companies].sort((a, b) => b.score - a.score);
        }

        // ══════════════════════════════════════
        //   LOGIN
        // ══════════════════════════════════════
        function selectRole(role) {
            DB.currentRole = role;
            document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
            event.target.classList.add('active');
            const presets = {
                government: { user: 'tn_govt_01' },
                company: { user: 'C003' },
                admin: { user: 'admin_tn' }
            };
            document.getElementById('loginUser').value = presets[role].user;
        }

        async function doLogin() {
    let un = document.getElementById('loginUser').value;
    let pw = document.getElementById('loginPass').value;
    let res = await fetch('/api/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({username: un, password: pw})
    });
    let data = await res.json();
    if (data.success) {
        DB.currentUser = { role: data.role, name: data.name, id: data.id };
        DB.currentRole = data.role;
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('app').style.display = 'block';
        await fetchData();
        buildUI();
        showToast('✓ Logged in as ' + data.name);
    } else {
        showToast('⚠ Login Failed');
    }
}

        async function logout() {
    await fetch('/api/logout', {method:'POST'});
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
    DB.currentUser = null;
    showToast('✓ Logged out');
}

        // ══════════════════════════════════════
        //   BUILD UI
        // ══════════════════════════════════════
        function buildUI() {
            const role = DB.currentUser.role;
            const dotColors = { government: '#2d8ef0', company: '#1db87a', admin: '#e8a020' };
            document.getElementById('userDot').style.background = dotColors[role];
            document.getElementById('userLabel').textContent = DB.currentUser.name;

            const navs = {
                government: [
                    { icon: '📊', label: 'Dashboard', page: 'govDashboard' },
                    { icon: '📋', label: 'Post Problem', page: 'postProblem' },
                    { icon: '⚖️', label: 'Active Auctions', page: 'auctions', badge: 3 },
                    { icon: '📁', label: 'Problem Statements', page: 'problemList' },
                    { icon: '🏆', label: 'Evaluation Results', page: 'results' },
                ],
                company: [
                    { icon: '📊', label: 'My Dashboard', page: 'compDashboard' },
                    { icon: '🔔', label: 'Available Auctions', page: 'availAuctions', badge: 3 },
                    { icon: '📝', label: 'Submit Bid', page: 'submitBid' },
                    { icon: '📈', label: 'My Bids', page: 'myBids' },
                    { icon: '⭐', label: 'My Score Profile', page: 'scoreProfile' },
                ],
                admin: [
                    { icon: '📊', label: 'System Overview', page: 'adminDashboard' },
                    { icon: '🏢', label: 'Companies', page: 'companies' },
                    { icon: '📋', label: 'All Problems', page: 'allProblems' },
                    { icon: '⚙️', label: 'Score Management', page: 'scoreMgmt' },
                    { icon: '📊', label: 'Auction Monitor', page: 'auctionMonitor' },
                ]
            };

            const sidebar = document.getElementById('sidebar');
            sidebar.innerHTML = `<div class="nav-section-label">NAVIGATION</div>` +
                navs[role].map((n, i) =>
                    `<div class="nav-item${i === 0 ? ' active' : ''}" onclick="showPage('${n.page}',this)">
        <span class="nav-icon">${n.icon}</span>
        <span>${n.label}</span>
        ${n.badge ? `<span class="nav-badge">${n.badge}</span>` : ''}
      </div>`
                ).join('');

            // render first page
            showPage(navs[role][0].page, sidebar.querySelector('.nav-item'));
        }

        function showPage(pageId, el) {
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            if (el) el.classList.add('active');
            const main = document.getElementById('mainContent');
            main.innerHTML = '';

            const pages = {
                govDashboard, postProblem, auctions, problemList, results,
                compDashboard, availAuctions, submitBid, myBids, scoreProfile,
                adminDashboard, companies, allProblems, scoreMgmt, auctionMonitor
            };

            if (pages[pageId]) pages[pageId](main);
        }

        // ══════════════════════════════════════
        //   GOVERNMENT PAGES
        // ══════════════════════════════════════
        function govDashboard(el) {
            const open = DB.problems.filter(p => p.status === 'auction_open').length;
            const totalBids = DB.bids.length;
            const companies = DB.companies.length;

            el.innerHTML = `
  <div class="page-header">
    <div class="page-title">Government Dashboard</div>
    <div class="page-subtitle">Tamil Nadu Problem Statement Priority Auction System — Overview</div>
  </div>
  <div class="stat-grid">
    <div class="stat-card">
      <div class="stat-label">Active Auctions</div>
      <div class="stat-value" style="color:var(--primary-light)">${open}</div>
      <div class="stat-change">↑ 2 this week</div>
      <div class="stat-icon">⚖️</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Total Bids Received</div>
      <div class="stat-value">${totalBids}</div>
      <div class="stat-change">↑ 3 today</div>
      <div class="stat-icon">📝</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Registered Companies</div>
      <div class="stat-value">${companies}</div>
      <div class="stat-change">All verified TN</div>
      <div class="stat-icon">🏢</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Total Budget (₹ Cr)</div>
      <div class="stat-value" style="color:var(--gold)">2.42</div>
      <div class="stat-change">Across 5 projects</div>
      <div class="stat-icon">💰</div>
    </div>
  </div>

  <div class="card">
    <div class="card-header">
      <div class="card-title">📋 Recent Problem Statements</div>
      <span class="badge badge-blue">Live</span>
    </div>
    <div class="card-body" style="padding:0">
      <table class="data-table">
        <thead>
          <tr>
            <th>ID</th><th>Title</th><th>Category</th>
            <th>Budget</th><th>Priority</th><th>Status</th><th>Bids</th>
          </tr>
        </thead>
        <tbody>
          ${DB.problems.map(p => {
                const bidCount = DB.bids.filter(b => b.problemId === p.id).length;
                return `<tr>
              <td><span style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--primary-light)">${p.id}</span></td>
              <td style="color:var(--text);max-width:200px">${p.title}</td>
              <td><span class="badge badge-blue">${p.category}</span></td>
              <td style="font-family:'JetBrains Mono',monospace">₹${(p.budget / 100000).toFixed(1)}L</td>
              <td><span class="priority-tag ${p.priority === 'high' ? 'p-high' : p.priority === 'medium' ? 'p-medium' : 'p-low'}">${p.priority.toUpperCase()}</span></td>
              <td><span class="badge ${p.status === 'auction_open' ? 'badge-green' : p.status === 'auction_closed' ? 'badge-red' : 'badge-gold'}">${p.status.replace('_', ' ')}</span></td>
              <td style="font-family:'JetBrains Mono',monospace;color:var(--gold)">${bidCount}</td>
            </tr>`;
            }).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <div class="card">
    <div class="card-header">
      <div class="card-title">🏢 Top Performing Companies</div>
    </div>
    <div class="card-body">
      ${getPriorityOrder(DB.companies).slice(0, 4).map((c, i) => `
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px">
          <div class="rank-medal rank-${i < 3 ? i + 1 : 'other'}">${i + 1}</div>
          <div style="flex:1">
            <div style="font-size:13px;color:var(--text);margin-bottom:4px">${c.name}</div>
            <div class="score-bar-wrap">
              <div class="score-bar"><div class="score-fill" style="width:${c.score}%;background:${getScoreColor(c.score)}"></div></div>
              <div class="score-val">${c.score}</div>
            </div>
          </div>
          <span class="badge badge-green">${c.district}</span>
        </div>
      `).join('')}
    </div>
  </div>`;
        }

        function postProblem(el) {
            el.innerHTML = `
  <div class="page-header">
    <div class="page-title">Post New Problem Statement</div>
    <div class="page-subtitle">Submit a new problem for auction to registered Tamil Nadu companies</div>
  </div>

  <div class="formula-box">
    <span class="highlight">AUCTION FLOW:</span>
    Government Posts Problem → Companies Receive Notification → Bids Submitted →
    System Ranks by Score → <span class="value">Winner = 60% Bid Value + 40% Performance Score</span>
  </div>

  <div class="card">
    <div class="card-header"><div class="card-title">📋 Problem Statement Details</div></div>
    <div class="card-body">
      <div class="form-row single">
        <div class="field-group">
          <label class="field-label">Problem Title</label>
          <input class="field-input" id="ps_title" placeholder="e.g. Flood Management System – Chennai Basin"/>
        </div>
      </div>
      <div class="form-row">
        <div class="field-group">
          <label class="field-label">Department</label>
          <select class="field-select" id="ps_dept">
            <option>Public Works Department</option>
            <option>Agriculture Department</option>
            <option>Municipal Corporation</option>
            <option>Highways Department</option>
            <option>TANGEDCO</option>
            <option>Water Resources Department</option>
          </select>
        </div>
        <div class="field-group">
          <label class="field-label">Category</label>
          <select class="field-select" id="ps_cat">
            <option>Disaster Management</option>
            <option>Agriculture</option>
            <option>Waste Management</option>
            <option>Infrastructure</option>
            <option>Smart City</option>
            <option>Public Health</option>
          </select>
        </div>
      </div>
      <div class="form-row triple">
        <div class="field-group">
          <label class="field-label">District</label>
          <select class="field-select" id="ps_district">
            <option>Chennai</option><option>Coimbatore</option>
            <option>Madurai</option><option>Tiruchirappalli</option>
            <option>Salem</option><option>Thanjavur</option>
            <option>Vellore</option><option>Statewide</option>
          </select>
        </div>
        <div class="field-group">
          <label class="field-label">Budget (₹)</label>
          <input class="field-input" id="ps_budget" type="number" placeholder="e.g. 5000000"/>
        </div>
        <div class="field-group">
          <label class="field-label">Priority</label>
          <select class="field-select" id="ps_priority">
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="field-group">
          <label class="field-label">Auction Deadline</label>
          <input class="field-input" id="ps_deadline" type="date"/>
        </div>
        <div class="field-group">
          <label class="field-label">Minimum Score Eligibility</label>
          <input class="field-input" id="ps_minscore" type="number" placeholder="e.g. 60 (0 = All eligible)"/>
        </div>
      </div>
      <div class="form-row single">
        <div class="field-group">
          <label class="field-label">Problem Description</label>
          <textarea class="field-textarea" id="ps_desc" placeholder="Describe the problem in detail, scope of work, expected deliverables..."></textarea>
        </div>
      </div>
      <div style="display:flex;gap:10px;margin-top:8px">
        <button class="btn btn-primary" onclick="postProblemSubmit()">📤 POST TO AUCTION</button>
        <button class="btn btn-outline">SAVE AS DRAFT</button>
      </div>
    </div>
  </div>`;
        }

        async function postProblemSubmit() {
    const title = document.getElementById('ps_title').value.trim();
    if (!title) { showToast('⚠ Please enter a problem title'); return; }
    const newPs = {
        title,
        category: document.getElementById('ps_cat').value,
        district: document.getElementById('ps_district').value,
        budget: parseInt(document.getElementById('ps_budget').value) || 1000000,
        deadline: document.getElementById('ps_deadline').value || '2025-06-01',
        priority: document.getElementById('ps_priority').value,
        description: document.getElementById('ps_desc').value,
        postedDate: new Date().toISOString().split('T')[0]
    };
    await fetch('/api/problems', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(newPs)
    });
    await fetchData();
    showToast('✓ Problem Statement posted! Companies notified.');
    showPage('problemList', null);
}

        function auctions(el) {
            const open = DB.problems.filter(p => p.status === 'auction_open');
            el.innerHTML = `
  <div class="page-header">
    <div class="page-title">Active Auctions</div>
    <div class="page-subtitle">Live score-ranked bidding overview</div>
  </div>
  ${open.map(p => {
                const pBids = DB.bids.filter(b => b.problemId === p.id);
                const maxBid = Math.max(...pBids.map(b => b.amount), p.budget);
                const minBid = Math.min(...pBids.map(b => b.amount), 0);
                const ranked = pBids.map(b => {
                    const company = DB.companies.find(c => c.id === b.companyId);
                    const finalScore = evalBid(b.amount, maxBid, minBid, company.score);
                    return { ...b, company, finalScore };
                }).sort((a, b) => b.finalScore - a.finalScore);

                return `
    <div class="card" style="margin-bottom:24px">
      <div class="card-header">
        <div>
          <div class="card-title">${p.id} — ${p.title}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:3px">${p.dept} | ${p.district}</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <span class="priority-tag ${p.priority === 'high' ? 'p-high' : 'p-medium'}">${p.priority.toUpperCase()}</span>
          <span class="badge badge-green">OPEN</span>
        </div>
      </div>
      <div class="card-body">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:20px">
          <div>
            <div style="font-size:11px;color:var(--text-dim);letter-spacing:2px;text-transform:uppercase;margin-bottom:4px">Budget</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:16px;color:var(--gold)">₹${(p.budget / 100000).toFixed(1)}L</div>
          </div>
          <div>
            <div style="font-size:11px;color:var(--text-dim);letter-spacing:2px;text-transform:uppercase;margin-bottom:4px">Bids Received</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:16px;color:var(--text)">${pBids.length}</div>
          </div>
          <div>
            <div style="font-size:11px;color:var(--text-dim);letter-spacing:2px;text-transform:uppercase;margin-bottom:4px">Deadline</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:14px;color:var(--text-muted)">${p.deadline}</div>
          </div>
        </div>
        ${ranked.length > 0 ? `
        <div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--text-dim);margin-bottom:12px">
          PRIORITY RANKING (60% Bid + 40% Score)
        </div>
        <table class="data-table">
          <thead>
            <tr><th>Rank</th><th>Company</th><th>District</th>
                <th>Bid Amount</th><th>Perf. Score</th><th>Final Score</th></tr>
          </thead>
          <tbody>
            ${ranked.map((r, i) => `
              <tr>
                <td><div class="rank-medal rank-${i < 3 ? i + 1 : 'other'}">${i + 1}</div></td>
                <td style="color:var(--text)">${r.company.name}</td>
                <td><span class="badge badge-blue">${r.company.district}</span></td>
                <td style="font-family:'JetBrains Mono',monospace">₹${(r.amount / 100000).toFixed(1)}L</td>
                <td>
                  <div class="score-bar-wrap">
                    <div class="score-bar" style="width:80px"><div class="score-fill" style="width:${r.company.score}%;background:${getScoreColor(r.company.score)}"></div></div>
                    <div class="score-val">${r.company.score}</div>
                  </div>
                </td>
                <td>
                  <div style="display:flex;align-items:center;gap:8px">
                    <div class="score-bar" style="width:80px"><div class="score-fill" style="width:${r.finalScore}%;background:${getScoreColor(r.finalScore)}"></div></div>
                    <span style="font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:600;color:${i === 0 ? 'var(--gold)' : 'var(--text)'}">${r.finalScore}</span>
                    ${i === 0 ? '<span style="font-size:11px;color:var(--gold)">👑</span>' : ''}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div style="display:flex;justify-content:flex-end;margin-top:16px">
          <button class="btn btn-gold btn-sm" onclick="declareWinner('${p.id}')">🏆 DECLARE WINNER</button>
        </div>
        ` : `<div class="alert alert-warning">⏳ No bids received yet for this problem statement.</div>`}
      </div>
    </div>`;
            }).join('')}`;
        }

        async function declareWinner(psId) {
    let res = await fetch('/api/evaluate_auction', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({problemId: psId})
    });
    let data = await res.json();
    if(data.success) {
        await fetchData();
        showToast('🏆 Winner declared!');
        setTimeout(() => showPage('results', null), 800);
    }
}

        function problemList(el) {
            el.innerHTML = `
  <div class="page-header">
    <div class="page-title">All Problem Statements</div>
    <div class="page-subtitle">Complete list of posted problem statements</div>
  </div>
  <div style="display:flex;gap:10px;margin-bottom:20px">
    <button class="btn btn-primary btn-sm" onclick="showPage('postProblem',null)">+ POST NEW</button>
    <select class="field-select" style="padding:7px 12px;font-size:12px">
      <option>All Categories</option>
      <option>Disaster Management</option>
      <option>Agriculture</option>
      <option>Infrastructure</option>
    </select>
  </div>
  <div class="card">
    <div class="card-body" style="padding:0">
      <table class="data-table">
        <thead>
          <tr><th>ID</th><th>Title</th><th>Department</th><th>Budget</th>
              <th>Priority</th><th>Deadline</th><th>Status</th><th>Bids</th></tr>
        </thead>
        <tbody>
          ${DB.problems.map(p => `
          <tr>
            <td><span style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--primary-light)">${p.id}</span></td>
            <td style="color:var(--text)">${p.title}</td>
            <td style="font-size:12px">${p.dept}</td>
            <td style="font-family:'JetBrains Mono',monospace">₹${(p.budget / 100000).toFixed(1)}L</td>
            <td><span class="priority-tag ${p.priority === 'high' ? 'p-high' : p.priority === 'medium' ? 'p-medium' : 'p-low'}">${p.priority.toUpperCase()}</span></td>
            <td style="font-size:12px;color:var(--text-muted)">${p.deadline}</td>
            <td><span class="badge ${p.status === 'auction_open' ? 'badge-green' : p.status === 'auction_closed' ? 'badge-red' : 'badge-gold'}">${p.status.replace('_', ' ')}</span></td>
            <td style="font-family:'JetBrains Mono',monospace;color:var(--gold)">${DB.bids.filter(b => b.problemId === p.id).length}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
        }

        function results(el) {
            const closed = DB.problems.filter(p => p.status === 'auction_closed');
            el.innerHTML = `
  <div class="page-header">
    <div class="page-title">Evaluation Results</div>
    <div class="page-subtitle">Final winners declared after performance-weighted evaluation</div>
  </div>
  <div class="formula-box">
    <span class="highlight">EVALUATION FORMULA:</span>
    Final Score = <span class="value">60%</span> × Normalized Bid Score + <span class="value">40%</span> × Company Performance Score<br>
    Bid Score = (MaxBid − CompanyBid) / (MaxBid − MinBid) × 100 &nbsp;|&nbsp; Lower bid = higher score
  </div>
  ${closed.map(p => {
                const pBids = DB.bids.filter(b => b.problemId === p.id);
                if (!pBids.length) return '';
                const maxBid = Math.max(...pBids.map(b => b.amount));
                const minBid = Math.min(...pBids.map(b => b.amount));
                const ranked = pBids.map(b => {
                    const c = DB.companies.find(c => c.id === b.companyId);
                    return { ...b, company: c, finalScore: evalBid(b.amount, maxBid, minBid, c.score) };
                }).sort((a, b) => b.finalScore - a.finalScore);
                const winner = ranked[0];

                return `
    <div class="winner-card">
      <div class="winner-trophy">🏆</div>
      <div class="winner-info">
        <h3>${winner.company.name}</h3>
        <p>Won auction for: <strong style="color:var(--text)">${p.title}</strong></p>
        <p>Bid: ₹${(winner.amount / 100000).toFixed(1)}L &nbsp;|&nbsp;
           Performance Score: ${winner.company.score} &nbsp;|&nbsp;
           Final Score: <strong style="color:var(--gold-light)">${winner.finalScore}</strong></p>
      </div>
      <div style="margin-left:auto">
        <span class="badge badge-red">${p.id}</span>
      </div>
    </div>`;
            }).join('') || '<div class="alert alert-info">No closed auctions yet. Declare winners from the Active Auctions page.</div>'}`;
        }

        // ══════════════════════════════════════
        //   COMPANY PAGES
        // ══════════════════════════════════════
        function getMyCompany() { return DB.companies.find(c => c.id === DB.currentUser.id); }

        function compDashboard(el) {
            const myBidsList = DB.bids.filter(b => b.companyId === DB.currentUser.id);
            el.innerHTML = `
  <div class="page-header">
    <div class="page-title">Company Dashboard</div>
    <div class="page-subtitle">${getMyCompany().name} — ${getMyCompany().district}</div>
  </div>
  <div class="stat-grid">
    <div class="stat-card">
      <div class="stat-label">Performance Score</div>
      <div class="stat-value" style="color:var(--green)">${getMyCompany().score}</div>
      <div class="stat-change">↑ Top 1 of 6</div>
      <div class="stat-icon">⭐</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Active Bids</div>
      <div class="stat-value">${myBidsList.length}</div>
      <div class="stat-change">2 under review</div>
      <div class="stat-icon">📝</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Projects Done</div>
      <div class="stat-value">${getMyCompany().projects}</div>
      <div class="stat-change">All Tamil Nadu</div>
      <div class="stat-icon">✅</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">On-Time Rate</div>
      <div class="stat-value" style="color:var(--gold)">${getMyCompany().ontime}%</div>
      <div class="stat-change">↑ Above average</div>
      <div class="stat-icon">⏱️</div>
    </div>
  </div>

  <div class="card">
    <div class="card-header"><div class="card-title">⭐ Score Breakdown</div></div>
    <div class="card-body">
      ${[
                    { label: 'On-Time Completion', val: getMyCompany().ontime, weight: '40%', color: '#1db87a' },
                    { label: 'Project Quality Rating', val: getMyCompany().quality, weight: '30%', color: '#2d8ef0' },
                    { label: 'Client Feedback Score', val: getMyCompany().feedback, weight: '20%', color: '#e8a020' },
                    { label: 'Project Success History', val: Math.min(getMyCompany().projects, 50) * 2, weight: '10%', color: '#7c3aed' },
                ].map(s => `
        <div style="margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <span style="font-size:13px;color:var(--text)">${s.label}</span>
            <div style="display:flex;gap:10px">
              <span style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text-muted)">${s.weight} weight</span>
              <span style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:600;color:${s.color}">${s.val}</span>
            </div>
          </div>
          <div class="score-bar" style="height:8px">
            <div class="score-fill" style="width:${s.val}%;background:${s.color}"></div>
          </div>
        </div>
      `).join('')}
      <div style="margin-top:20px;padding:14px;background:var(--surface2);border-radius:2px;font-family:'JetBrains Mono',monospace;font-size:13px">
        Total Score = (40%×${getMyCompany().ontime}) + (30%×${getMyCompany().quality}) + (20%×${getMyCompany().feedback}) + (10%×${Math.min(getMyCompany().projects, 50) * 2})
        = <span style="color:var(--gold);font-size:16px;font-weight:700"> ${getMyCompany().score}</span>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-header"><div class="card-title">🔔 Notifications</div></div>
    <div class="card-body">
      ${DB.notifications.map(n => `
        <div style="display:flex;align-items:flex-start;gap:12px;padding:10px 0;border-bottom:1px solid var(--border2)">
          <span style="font-size:8px;margin-top:5px;color:${n.read ? 'var(--text-dim)' : 'var(--primary)'}">●</span>
          <div>
            <div style="font-size:13px;color:${n.read ? 'var(--text-muted)' : 'var(--text)'}">${n.text}</div>
            <div style="font-size:11px;color:var(--text-dim);margin-top:2px">${n.time}</div>
          </div>
        </div>
      `).join('')}
    </div>
  </div>`;
        }

        function availAuctions(el) {
            const open = DB.problems.filter(p => p.status === 'auction_open');
            el.innerHTML = `
  <div class="page-header">
    <div class="page-title">Available Auctions</div>
    <div class="page-subtitle">Open problem statements — your eligibility score: <strong style="color:var(--green)">${getMyCompany().score}/100</strong></div>
  </div>
  <div class="alert alert-info">📌 Your bidding priority is based on your performance score. Higher score = higher ranking in the auction system.</div>
  ${open.map(p => {
                const bids = DB.bids.filter(b => b.problemId === p.id);
                const alreadyBid = bids.find(b => b.companyId === getMyCompany().id);
                return `
    <div class="card" style="margin-bottom:16px">
      <div class="card-header">
        <div>
          <div class="card-title">${p.id} — ${p.title}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:3px">${p.dept} | ${p.district} | ${p.category}</div>
        </div>
        <span class="priority-tag ${p.priority === 'high' ? 'p-high' : p.priority === 'medium' ? 'p-medium' : 'p-low'}">${p.priority.toUpperCase()}</span>
      </div>
      <div class="card-body">
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px;line-height:1.6">${p.description}</p>
        <div style="display:flex;gap:24px;margin-bottom:16px">
          <div><div style="font-size:10px;color:var(--text-dim);letter-spacing:2px;text-transform:uppercase">Budget</div>
               <div style="font-family:'JetBrains Mono',monospace;color:var(--gold)">₹${(p.budget / 100000).toFixed(1)}L</div></div>
          <div><div style="font-size:10px;color:var(--text-dim);letter-spacing:2px;text-transform:uppercase">Deadline</div>
               <div style="font-family:'JetBrains Mono',monospace;color:var(--text-muted)">${p.deadline}</div></div>
          <div><div style="font-size:10px;color:var(--text-dim);letter-spacing:2px;text-transform:uppercase">Bids So Far</div>
               <div style="font-family:'JetBrains Mono',monospace;color:var(--text)">${bids.length}</div></div>
        </div>
        ${alreadyBid
                        ? `<span class="badge badge-green">✓ BID SUBMITTED — ₹${(alreadyBid.amount / 100000).toFixed(1)}L</span>`
                        : `<button class="btn btn-primary btn-sm" onclick="goSubmitBid('${p.id}')">📝 SUBMIT BID</button>`
                    }
      </div>
    </div>`;
            }).join('')}`;
        }

        function goSubmitBid(psId) {
            showPage('submitBid', null);
            setTimeout(() => {
                const sel = document.getElementById('bid_problem');
                if (sel) sel.value = psId;
            }, 100);
        }

        function submitBid(el) {
            el.innerHTML = `
  <div class="page-header">
    <div class="page-title">Submit a Bid</div>
    <div class="page-subtitle">Your performance score determines your bidding priority ranking</div>
  </div>

  <div class="card" style="margin-bottom:20px">
    <div class="card-header"><div class="card-title">🏢 Your Company Profile</div></div>
    <div class="card-body" style="display:flex;align-items:center;gap:20px">
      <div style="width:64px;height:64px;background:rgba(29,184,122,0.15);border:1px solid var(--green);border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:24px">🌿</div>
      <div style="flex:1">
        <div style="font-family:'Rajdhani',sans-serif;font-size:18px;font-weight:700;color:var(--text)">${getMyCompany().name}</div>
        <div style="font-size:12px;color:var(--text-muted)">ID: ${getMyCompany().id} | ${getMyCompany().district} | ${getMyCompany().projects} completed projects</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:11px;color:var(--text-dim);letter-spacing:2px;text-transform:uppercase;margin-bottom:4px">PERFORMANCE SCORE</div>
        <div style="font-family:'Rajdhani',sans-serif;font-size:36px;font-weight:700;color:var(--green)">${getMyCompany().score}</div>
        <div style="font-size:11px;color:var(--green)">🥇 HIGHEST RANKED</div>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-header"><div class="card-title">📝 Bid Details</div></div>
    <div class="card-body">
      <div class="form-row">
        <div class="field-group">
          <label class="field-label">Select Problem Statement</label>
          <select class="field-select" id="bid_problem">
            ${DB.problems.filter(p => p.status === 'auction_open').map(p => `
              <option value="${p.id}">${p.id} — ${p.title}</option>
            `).join('')}
          </select>
        </div>
        <div class="field-group">
          <label class="field-label">Bid Amount (₹)</label>
          <input class="field-input" id="bid_amount" type="number" placeholder="Enter your bid amount"/>
        </div>
      </div>
      <div class="form-row single">
        <div class="field-group">
          <label class="field-label">Technical Proposal Summary</label>
          <textarea class="field-textarea" id="bid_proposal" placeholder="Briefly describe your technical approach, timeline, and key deliverables..."></textarea>
        </div>
      </div>
      <div class="form-row">
        <div class="field-group">
          <label class="field-label">Estimated Timeline (months)</label>
          <input class="field-input" id="bid_timeline" type="number" placeholder="e.g. 6"/>
        </div>
        <div class="field-group">
          <label class="field-label">Team Size</label>
          <input class="field-input" id="bid_team" type="number" placeholder="e.g. 12"/>
        </div>
      </div>
      <div id="bidPreview" style="margin-bottom:16px"></div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-outline" onclick="previewBid()">👁 PREVIEW SCORE</button>
        <button class="btn btn-primary" onclick="submitBidFinal()">📤 SUBMIT BID</button>
      </div>
    </div>
  </div>`;
        }

        function previewBid() {
            const psId = document.getElementById('bid_problem').value;
            const amt = parseInt(document.getElementById('bid_amount').value);
            if (!amt) { showToast('⚠ Enter bid amount first'); return; }
            const pBids = DB.bids.filter(b => b.problemId === psId);
            const allAmounts = [...pBids.map(b => b.amount), amt];
            const maxBid = Math.max(...allAmounts);
            const minBid = Math.min(...allAmounts);
            const fs = evalBid(amt, maxBid, minBid, getMyCompany().score);
            document.getElementById('bidPreview').innerHTML = `
  <div class="alert alert-success">
    📊 <strong>Score Preview:</strong> At ₹${(amt / 100000).toFixed(1)}L bid →
    Bid Score component: ${Math.round(((maxBid - amt) / (maxBid - minBid || 1)) * 100)} &nbsp;+&nbsp;
    Perf Score component: ${getMyCompany().score} →
    <strong>Final Score: ${fs}</strong> (vs ${pBids.length} existing bids)
  </div>`;
        }

        async function submitBidFinal() {
    const psId = document.getElementById('bid_problem').value;
    const amt = parseInt(document.getElementById('bid_amount').value);
    if (!amt) { showToast('⚠ Enter bid amount'); return; }
    await fetch('/api/bids', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
            problemId: psId, companyId: DB.currentUser.id,
            amount: amt, submittedDate: new Date().toISOString().split('T')[0]
        })
    });
    await fetchData();
    showToast(`✓ Bid submitted for ${psId}!`);
    showPage('myBids', null);
}

        function myBids(el) {
            const mine = DB.bids.filter(b => b.companyId === DB.currentUser.id);
            el.innerHTML = `
  <div class="page-header">
    <div class="page-title">My Bids</div>
    <div class="page-subtitle">All submitted bids and current ranking positions</div>
  </div>
  <div class="card">
    <div class="card-body" style="padding:0">
      <table class="data-table">
        <thead>
          <tr><th>Bid ID</th><th>Problem</th><th>Amount</th><th>Date</th><th>Rank Position</th><th>Status</th></tr>
        </thead>
        <tbody>
          ${mine.map(b => {
                const p = DB.problems.find(x => x.id === b.problemId);
                const pBids = DB.bids.filter(x => x.problemId === b.problemId);
                const maxBid = Math.max(...pBids.map(x => x.amount));
                const minBid = Math.min(...pBids.map(x => x.amount));
                const ranked = pBids.map(x => {
                    const c = DB.companies.find(c => c.id === x.companyId);
                    return { ...x, finalScore: evalBid(x.amount, maxBid, minBid, c.score) };
                }).sort((a, x) => x.finalScore - a.finalScore);
                const pos = ranked.findIndex(x => x.companyId === getMyCompany().id) + 1;
                return `
            <tr>
              <td style="font-family:'JetBrains Mono',monospace;color:var(--primary-light)">${b.id}</td>
              <td style="color:var(--text);font-size:12px">${p ? p.title : '—'}</td>
              <td style="font-family:'JetBrains Mono',monospace">₹${(b.amount / 100000).toFixed(1)}L</td>
              <td style="font-size:12px;color:var(--text-muted)">${b.submittedDate}</td>
              <td><div class="rank-medal rank-${pos < 4 ? pos : 'other'}">${pos}</div></td>
              <td><span class="badge badge-gold">UNDER REVIEW</span></td>
            </tr>`;
            }).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
        }

        function scoreProfile(el) {
            el.innerHTML = `
  <div class="page-header">
    <div class="page-title">My Score Profile</div>
    <div class="page-subtitle">Performance metrics that determine your bidding priority</div>
  </div>
  <div class="card">
    <div class="card-header"><div class="card-title">🧮 Score Formula</div></div>
    <div class="card-body">
      <div class="formula-box">
        <span class="highlight">Company Score</span> =<br>
        (<span class="value">40%</span> × On-Time Completion Rate) +<br>
        (<span class="value">30%</span> × Project Quality Rating) +<br>
        (<span class="value">20%</span> × Client Feedback Score) +<br>
        (<span class="value">10%</span> × Normalized Project Count)<br><br>
        = (0.40 × <span class="value">${getMyCompany().ontime}</span>) + (0.30 × <span class="value">${getMyCompany().quality}</span>) + (0.20 × <span class="value">${getMyCompany().feedback}</span>) + (0.10 × <span class="value">${Math.min(getMyCompany().projects, 50) * 2}</span>)
        = <span class="highlight" style="font-size:18px">${getMyCompany().score}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        ${[
                    { k: 'On-Time Completion', v: getMyCompany().ontime, w: '40%', c: '#1db87a', ic: '⏱️' },
                    { k: 'Quality Rating', v: getMyCompany().quality, w: '30%', c: '#2d8ef0', ic: '📊' },
                    { k: 'Client Feedback', v: getMyCompany().feedback, w: '20%', c: '#e8a020', ic: '⭐' },
                    { k: 'Project History', v: getMyCompany().projects, w: '10%', c: '#7c3aed', ic: '📁' },
                ].map(s => `
          <div style="background:var(--surface2);padding:16px;border-radius:2px;border:1px solid var(--border2)">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px">
              <span style="font-size:13px;color:var(--text)">${s.ic} ${s.k}</span>
              <span style="font-size:11px;color:var(--text-dim)">${s.w}</span>
            </div>
            <div style="font-family:'Rajdhani',sans-serif;font-size:28px;font-weight:700;color:${s.c};margin-bottom:8px">${s.v}</div>
            <div class="score-bar"><div class="score-fill" style="width:${s.v}%;background:${s.c}"></div></div>
          </div>
        `).join('')}
      </div>
    </div>
  </div>`;
        }

        // ══════════════════════════════════════
        //   ADMIN PAGES
        // ══════════════════════════════════════
        function adminDashboard(el) {
            el.innerHTML = `
  <div class="page-header">
    <div class="page-title">System Overview</div>
    <div class="page-subtitle">TN-PSPAS Administrator Control Panel</div>
  </div>
  <div class="stat-grid">
    <div class="stat-card">
      <div class="stat-label">Total Companies</div>
      <div class="stat-value">${DB.companies.length}</div>
      <div class="stat-change">All TN verified</div>
      <div class="stat-icon">🏢</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Problem Statements</div>
      <div class="stat-value">${DB.problems.length}</div>
      <div class="stat-change">${DB.problems.filter(p => p.status === 'auction_open').length} active auctions</div>
      <div class="stat-icon">📋</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Total Bids</div>
      <div class="stat-value">${DB.bids.length}</div>
      <div class="stat-change">Across all auctions</div>
      <div class="stat-icon">📝</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Avg Performance</div>
      <div class="stat-value" style="color:var(--gold)">${Math.round(DB.companies.reduce((a, c) => a + c.score, 0) / DB.companies.length)}</div>
      <div class="stat-change">System average score</div>
      <div class="stat-icon">📊</div>
    </div>
  </div>

  <div class="card">
    <div class="card-header"><div class="card-title">📊 Company Score Rankings</div></div>
    <div class="card-body">
      ${getPriorityOrder(DB.companies).map((c, i) => `
        <div style="display:flex;align-items:center;gap:14px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.03)">
          <div class="rank-medal rank-${i < 3 ? i + 1 : 'other'}">${i + 1}</div>
          <div style="flex:1">
            <div style="font-size:13px;color:var(--text);margin-bottom:2px">${c.name}</div>
            <div style="font-size:11px;color:var(--text-dim)">${c.id} · ${c.district} · ${c.projects} projects</div>
          </div>
          <div class="score-bar-wrap" style="width:200px">
            <div class="score-bar"><div class="score-fill" style="width:${c.score}%;background:${getScoreColor(c.score)}"></div></div>
            <div class="score-val" style="color:${getScoreColor(c.score)}">${c.score}</div>
          </div>
          <span class="badge ${c.score >= 80 ? 'badge-green' : c.score >= 60 ? 'badge-gold' : 'badge-red'}">${c.score >= 80 ? 'HIGH' : c.score >= 60 ? 'MED' : 'LOW'}</span>
        </div>
      `).join('')}
    </div>
  </div>`;
        }

        function companies(el) {
            el.innerHTML = `
  <div class="page-header">
    <div class="page-title">Registered Companies</div>
    <div class="page-subtitle">All Tamil Nadu verified companies in the system</div>
  </div>
  <div class="card">
    <div class="card-body" style="padding:0">
      <table class="data-table">
        <thead>
          <tr><th>ID</th><th>Company Name</th><th>District</th>
              <th>Score</th><th>On-Time</th><th>Quality</th><th>Projects</th><th>Status</th></tr>
        </thead>
        <tbody>
          ${DB.companies.map(c => `
          <tr>
            <td style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--primary-light)">${c.id}</td>
            <td style="color:var(--text)">${c.name}</td>
            <td><span class="badge badge-blue">${c.district}</span></td>
            <td>
              <div class="score-bar-wrap">
                <div class="score-bar"><div class="score-fill" style="width:${c.score}%;background:${getScoreColor(c.score)}"></div></div>
                <div class="score-val">${c.score}</div>
              </div>
            </td>
            <td style="font-family:'JetBrains Mono',monospace">${c.ontime}%</td>
            <td style="font-family:'JetBrains Mono',monospace">${c.quality}</td>
            <td style="font-family:'JetBrains Mono',monospace">${c.projects}</td>
            <td><span class="badge badge-green">ACTIVE</span></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
        }

        function allProblems(el) { problemList(el); }

        function scoreMgmt(el) {
            el.innerHTML = `
  <div class="page-header">
    <div class="page-title">Score Management</div>
    <div class="page-subtitle">Update company performance scores after project completion</div>
  </div>
  <div class="formula-box">
    <span class="highlight">Auto-Update Rule:</span> Scores are recalculated after every project completion.
    Manual override available for admin with audit trail.
  </div>
  <div class="card">
    <div class="card-header"><div class="card-title">✏️ Update Company Score</div></div>
    <div class="card-body">
      <div class="form-row">
        <div class="field-group">
          <label class="field-label">Select Company</label>
          <select class="field-select" id="sc_company">
            ${DB.companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="field-group">
          <label class="field-label">Related Project</label>
          <input class="field-input" placeholder="e.g. PS003 — Coimbatore Waste Mgmt"/>
        </div>
      </div>
      <div class="form-row triple">
        <div class="field-group">
          <label class="field-label">On-Time Rate (0–100)</label>
          <input class="field-input" id="sc_ontime" type="number" min="0" max="100" placeholder="e.g. 88"/>
        </div>
        <div class="field-group">
          <label class="field-label">Quality Rating (0–100)</label>
          <input class="field-input" id="sc_quality" type="number" min="0" max="100" placeholder="e.g. 82"/>
        </div>
        <div class="field-group">
          <label class="field-label">Client Feedback (0–100)</label>
          <input class="field-input" id="sc_feedback" type="number" min="0" max="100" placeholder="e.g. 90"/>
        </div>
      </div>
      <div id="scoreCalcPreview"></div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-outline" onclick="calcScorePreview()">🧮 CALCULATE PREVIEW</button>
        <button class="btn btn-primary" onclick="updateScoreFinal()">✓ UPDATE SCORE</button>
      </div>
    </div>
  </div>`;
        }

        function calcScorePreview() {
            const ot = parseInt(document.getElementById('sc_ontime').value) || 0;
            const q = parseInt(document.getElementById('sc_quality').value) || 0;
            const f = parseInt(document.getElementById('sc_feedback').value) || 0;
            const cid = document.getElementById('sc_company').value;
            const c = DB.companies.find(x => x.id === cid);
            const newScore = Math.round(0.4 * ot + 0.3 * q + 0.2 * f + 0.1 * Math.min(c.projects, 50) * 2);
            document.getElementById('scoreCalcPreview').innerHTML = `
  <div class="alert alert-info" style="margin-bottom:16px">
    📊 New calculated score = (40%×${ot}) + (30%×${q}) + (20%×${f}) + (10%×${Math.min(c.projects, 50) * 2})
    = <strong>${newScore}</strong> (Current: ${c.score})
    ${newScore > c.score ? ' <span style="color:var(--green)">↑ Improvement</span>' : ' <span style="color:var(--primary-light)">↓ Decrease</span>'}
  </div>`;
        }

        async function updateScoreFinal() {
    const cid = document.getElementById('sc_company').value;
    const ot = parseInt(document.getElementById('sc_ontime').value) || 0;
    const q = parseInt(document.getElementById('sc_quality').value) || 0;
    const f = parseInt(document.getElementById('sc_feedback').value) || 0;
    
    if (ot && q && f) {
        let res = await fetch('/api/update_score', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({companyId: cid, ontime: ot, quality: q, feedback: f})
        });
        await fetchData();
        showToast(`✓ Score updated for company`);
    } else { showToast('⚠ Fill all score fields'); }
}

        function auctionMonitor(el) { auctions(el); }

        // ══════════════════════════════════════
        //   TOAST
        // ══════════════════════════════════════
        function showToast(msg) {
            const t = document.getElementById('toast');
            t.textContent = msg;
            t.classList.add('show');
            setTimeout(() => t.classList.remove('show'), 3500);
        }
    