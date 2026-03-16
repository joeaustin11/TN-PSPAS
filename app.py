from flask import Flask, request, jsonify, render_template, session
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
import os

from database import db, Company, CompanyScore, ProblemStatement, Bid, EvaluationResult, PastProject
from utils import calc_company_score, eval_bid

app = Flask(__name__)
app.config['SECRET_KEY'] = 'dev_secret_key'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///tn_pspas.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

login_manager = LoginManager()
login_manager.init_app(app)

@login_manager.user_loader
def load_user(user_id):
    return Company.query.get(user_id)

def init_db():
    with app.app_context():
        db.create_all()
        if not Company.query.first():
            # Init roles
            govt = Company(id='tn_govt_01', name='Government — TN Dept.', role='government', password_hash=generate_password_hash('pass123'))
            admin = Company(id='admin_tn', name='System Administrator', role='admin', password_hash=generate_password_hash('pass123'))
            db.session.add(govt)
            db.session.add(admin)
            
            companies_data = [
                { 'id': 'C001', 'name': 'SunTech Solutions Pvt Ltd', 'district': 'Chennai', 'ontime': 92, 'quality': 88, 'feedback': 85, 'projects': 24 },
                { 'id': 'C002', 'name': 'TamilBuild Infrastructure Ltd', 'district': 'Coimbatore', 'ontime': 78, 'quality': 72, 'feedback': 76, 'projects': 18 },
                { 'id': 'C003', 'name': 'GreenPath Agritech', 'district': 'Madurai', 'ontime': 95, 'quality': 90, 'feedback': 93, 'projects': 31 },
                { 'id': 'C004', 'name': 'SmartCity Innovators', 'district': 'Tiruchirappalli', 'ontime': 70, 'quality': 65, 'feedback': 72, 'projects': 12 },
                { 'id': 'C005', 'name': 'Delta Water Systems', 'district': 'Salem', 'ontime': 85, 'quality': 80, 'feedback': 84, 'projects': 20 },
                { 'id': 'C006', 'name': 'RoadFirst Engineering', 'district': 'Trichy', 'ontime': 80, 'quality': 78, 'feedback': 80, 'projects': 15 }
            ]
            for c_data in companies_data:
                c = Company(
                    id=c_data['id'], 
                    name=c_data['name'], 
                    district=c_data['district'], 
                    role='company', 
                    password_hash=generate_password_hash('pass123')
                )
                db.session.add(c)
                total_score = calc_company_score(c_data['ontime'], c_data['quality'], c_data['feedback'], c_data['projects'])
                c_score = CompanyScore(
                    company_id=c.id, 
                    ontime_score=c_data['ontime'], 
                    quality_score=c_data['quality'], 
                    feedback_score=c_data['feedback'], 
                    projects_count=c_data['projects'],
                    total_score=total_score
                )
                db.session.add(c_score)
                db.session.flush()

            problems = [
                { 'id': 'PS001', 'title': 'Flood Management System - Chennai Basin', 'dept': 'Public Works Department', 'category': 'Disaster Management', 'district': 'Chennai', 'budget': 8500000, 'deadline': '2025-03-15', 'priority': 'high', 'status': 'auction_open', 'description': 'Design and implement an early warning + drainage...', 'posted_date': '2025-01-10' },
                { 'id': 'PS002', 'title': 'Smart Irrigation Network - Kaveri Delta', 'dept': 'Agriculture Department', 'category': 'Agriculture', 'district': 'Thanjavur', 'budget': 3200000, 'deadline': '2025-04-20', 'priority': 'high', 'status': 'auction_open', 'description': 'IoT-based sensor network...', 'posted_date': '2025-01-14' },
                { 'id': 'PS003', 'title': 'Solid Waste Management - Coimbatore City', 'dept': 'Municipal Corporation', 'category': 'Waste Management', 'district': 'Coimbatore', 'budget': 5600000, 'deadline': '2025-05-10', 'priority': 'medium', 'status': 'auction_closed', 'description': 'End-to-end waste collection...', 'posted_date': '2025-01-05' },
                { 'id': 'PS004', 'title': 'Road Infrastructure Monitoring System', 'dept': 'Highways Department', 'category': 'Infrastructure', 'district': 'Statewide', 'budget': 4100000, 'deadline': '2025-06-01', 'priority': 'medium', 'status': 'auction_open', 'description': 'AI-powered pothole detection...', 'posted_date': '2025-01-18' }
            ]
            for p_data in problems:
                ps = ProblemStatement(
                    id=p_data['id'],
                    title=p_data['title'],
                    government_dept_id='tn_govt_01',
                    category=p_data['category'],
                    district=p_data['district'],
                    budget=p_data['budget'],
                    deadline=p_data['deadline'],
                    priority=p_data['priority'],
                    status=p_data['status'],
                    description=p_data['description'],
                    posted_date=p_data['posted_date']
                )
                db.session.add(ps)
                
            bids = [
                { 'id': 'B001', 'problemId': 'PS001', 'companyId': 'C001', 'amount': 7800000, 'submittedDate': '2025-01-15', 'status': 'submitted' },
                { 'id': 'B002', 'problemId': 'PS001', 'companyId': 'C003', 'amount': 8200000, 'submittedDate': '2025-01-16', 'status': 'submitted' },
                { 'id': 'B003', 'problemId': 'PS001', 'companyId': 'C005', 'amount': 7500000, 'submittedDate': '2025-01-17', 'status': 'submitted' },
                { 'id': 'B005', 'problemId': 'PS002', 'companyId': 'C003', 'amount': 2900000, 'submittedDate': '2025-01-18', 'status': 'submitted' }
            ]
            for b_data in bids:
                bid = Bid(
                    id=b_data['id'],
                    problem_statement_id=b_data['problemId'],
                    company_id=b_data['companyId'],
                    bid_value=b_data['amount'],
                    submitted_at=b_data['submittedDate'],
                    status=b_data['status']
                )
                db.session.add(bid)

            db.session.commit()

init_db()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    user_id = data.get('username')
    password = data.get('password')
    user = Company.query.get(user_id)
    if user and check_password_hash(user.password_hash, password):
        login_user(user)
        return jsonify({'success': True, 'role': user.role, 'name': user.name, 'id': user.id})
    return jsonify({'success': False, 'message': 'Invalid credentials'}), 401

@app.route('/api/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({'success': True})

@app.route('/api/user')
def get_user():
    if current_user.is_authenticated:
        return jsonify({'id': current_user.id, 'role': current_user.role, 'name': current_user.name})
    return jsonify(None)

@app.route('/api/companies')
def get_companies():
    companies = Company.query.filter_by(role='company').all()
    out = []
    for c in companies:
        score = c.score.total_score if c.score else 0
        ontime = c.score.ontime_score if c.score else 0
        quality = c.score.quality_score if c.score else 0
        feedback = c.score.feedback_score if c.score else 0
        projects = c.score.projects_count if c.score else 0
        out.append({'id': c.id, 'name': c.name, 'district': c.district, 'score': score, 
                    'ontime': ontime, 'quality': quality, 'feedback': feedback, 'projects': projects, 'status': c.status})
    return jsonify(out)

@app.route('/api/problems', methods=['GET', 'POST'])
def problems():
    if request.method == 'POST':
        data = request.json
        count = ProblemStatement.query.count()
        new_id = f'PS{count+1:03d}'
        new_ps = ProblemStatement(
            id=new_id,
            title=data.get('title'),
            government_dept_id='tn_govt_01',
            category=data.get('category'),
            district=data.get('district'),
            budget=data.get('budget'),
            deadline=data.get('deadline'),
            priority=data.get('priority'),
            description=data.get('description'),
            posted_date=data.get('postedDate')
        )
        db.session.add(new_ps)
        db.session.commit()
        return jsonify({'id': new_id, 'success': True})
    else:
        ps_list = ProblemStatement.query.order_by(ProblemStatement.id.desc()).all()
        return jsonify([{
            'id': p.id, 'title': p.title, 'dept': 'Government Dept.', 'category': p.category, 
            'district': p.district, 'budget': p.budget, 'deadline': p.deadline, 
            'priority': p.priority, 'status': p.status, 'description': p.description, 'postedDate': p.posted_date
        } for p in ps_list])

@app.route('/api/bids', methods=['GET', 'POST'])
def handle_bids():
    if request.method == 'POST':
        data = request.json
        count = Bid.query.count()
        new_id = f'B{count+1:03d}'
        new_bid = Bid(
            id=new_id,
            problem_statement_id=data.get('problemId'),
            company_id=data.get('companyId'),
            bid_value=data.get('amount'),
            submitted_at=data.get('submittedDate')
        )
        db.session.add(new_bid)
        db.session.commit()
        return jsonify({'id': new_id, 'success': True})
    else:
        bids = Bid.query.all()
        return jsonify([{
            'id': b.id, 'problemId': b.problem_statement_id, 'companyId': b.company_id, 
            'amount': b.bid_value, 'submittedDate': b.submitted_at, 'status': b.status
        } for b in bids])

@app.route('/api/evaluate_auction', methods=['POST'])
def evaluate_auction():
    data = request.json
    ps_id = data.get('problemId')
    bids = Bid.query.filter_by(problem_statement_id=ps_id).all()
    ps = ProblemStatement.query.get(ps_id)
    if not bids:
        return jsonify({'success': False, 'message': 'No bids'})
        
    max_bid = max(b.bid_value for b in bids)
    min_bid = min(b.bid_value for b in bids)
    
    ranked = []
    for b in bids:
        c = Company.query.get(b.company_id)
        c_score = c.score.total_score if c.score else 0
        final_score = eval_bid(b.bid_value, max_bid, min_bid, c_score)
        ranked.append((b, final_score))
        
    ranked.sort(key=lambda x: x[1], reverse=True)
    winner_bid = ranked[0][0]
    
    ps.status = 'auction_closed'
    
    res = EvaluationResult(bid_id=winner_bid.id, evaluation_score=ranked[0][1], selected_status='winner')
    db.session.add(res)
    db.session.commit()
    
    return jsonify({'success': True, 'winnerCompanyId': winner_bid.company_id})

@app.route('/api/update_score', methods=['POST'])
def update_score():
    data = request.json
    c_id = data.get('companyId')
    c_score = CompanyScore.query.filter_by(company_id=c_id).first()
    if c_score:
        c_score.ontime_score = data.get('ontime')
        c_score.quality_score = data.get('quality')
        c_score.feedback_score = data.get('feedback')
        c_score.total_score = calc_company_score(c_score.ontime_score, c_score.quality_score, c_score.feedback_score, c_score.projects_count)
        db.session.commit()
        return jsonify({'success': True, 'new_score': c_score.total_score})
    return jsonify({'success': False})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
