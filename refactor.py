import re
import os

with open('templates/index.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

script_match = re.search(r'<script>(.*?)</script>', html_content, re.DOTALL)
if script_match:
    js_content = script_match.group(1)
    
    # Replace the data store with an async version
    data_store_regex = r'(const DB = \{[\s\S]*?\]\n        \};)'
    new_data_store = '''let DB = {
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
}'''
    js_content = re.sub(data_store_regex, new_data_store, js_content)
    
    # Replace doLogin and logout
    dologin_regex = r'function doLogin\(\) \{[\s\S]*?showToast\([^\)]+\);\n        \}'
    new_dologin = '''async function doLogin() {
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
}'''
    js_content = re.sub(dologin_regex, new_dologin, js_content)
    
    logout_regex = r'function logout\(\) \{[\s\S]*?\}'
    new_logout = '''async function logout() {
    await fetch('/api/logout', {method:'POST'});
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
    DB.currentUser = null;
    showToast('✓ Logged out');
}'''
    js_content = js_content.replace('function logout() {\n            document.getElementById(\'loginScreen\').style.display = \'flex\';\n            document.getElementById(\'app\').style.display = \'none\';\n        }', new_logout)

    # Replace postProblemSubmit
    post_prob_regex = r'function postProblemSubmit\(\) \{[\s\S]*?showPage\(\'problemList\', null\);\n        \}'
    new_post_prob = '''async function postProblemSubmit() {
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
}'''
    js_content = re.sub(post_prob_regex, new_post_prob, js_content)

    # Replace declareWinner
    declare_winner_regex = r'function declareWinner\(psId\) \{[\s\S]*?setTimeout\(\(\) => showPage\(\'results\', null\), 800\);\n        \}'
    new_declare_winner = '''async function declareWinner(psId) {
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
}'''
    js_content = re.sub(declare_winner_regex, new_declare_winner, js_content)

    # Replace submitBidFinal
    submit_bid_regex = r'function submitBidFinal\(\) \{[\s\S]*?showPage\(\'myBids\', null\);\n        \}'
    new_submit_bid = '''async function submitBidFinal() {
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
}'''
    js_content = re.sub(submit_bid_regex, new_submit_bid, js_content)

    # Replace updateScoreFinal
    update_score_regex = r'function updateScoreFinal\(\) \{[\s\S]*?\} else \{ showToast\(\'⚠ Fill all score fields\'\); \}\n        \}'
    new_update_score = '''async function updateScoreFinal() {
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
}'''
    js_content = re.sub(update_score_regex, new_update_score, js_content)

    # Replace hardcoded myCompany in GUI logic
    js_content = js_content.replace("const myCompany = DB.companies.find(c => c.id === 'C003');", "function getMyCompany() { return DB.companies.find(c => c.id === DB.currentUser.id); }")
    js_content = js_content.replace("myCompany.name", "getMyCompany().name")
    js_content = js_content.replace("myCompany.district", "getMyCompany().district")
    js_content = js_content.replace("myCompany.score", "getMyCompany().score")
    js_content = js_content.replace("myCompany.projects", "getMyCompany().projects")
    js_content = js_content.replace("myCompany.ontime", "getMyCompany().ontime")
    js_content = js_content.replace("myCompany.quality", "getMyCompany().quality")
    js_content = js_content.replace("myCompany.feedback", "getMyCompany().feedback")
    js_content = js_content.replace("myCompany.id", "getMyCompany().id")
    js_content = js_content.replace("DB.bids.filter(b => b.companyId === 'C003')", "DB.bids.filter(b => b.companyId === DB.currentUser.id)")

    with open('static/app.js', 'w', encoding='utf-8') as f:
        f.write(js_content)

    new_html = html_content[:script_match.start()] + '<script src="{{ url_for(\'static\', filename=\'app.js\') }}"></script>\n' + html_content[script_match.end():]
    
    # We also need to fix url_for since we're using flask. 
    # Flask templates need {{ url_for('static', filename='app.js') }}
    # We did that.

    with open('templates/index.html', 'w', encoding='utf-8') as f:
        f.write(new_html)
    
    print("JS extracted, refactored, and HTML updated.")
else:
    print("Could not find script block")
