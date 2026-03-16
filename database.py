from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin

db = SQLAlchemy()

class Company(db.Model, UserMixin):
    __tablename__ = 'Companies'
    id = db.Column(db.String(50), primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    email = db.Column(db.String(120), unique=True)
    password_hash = db.Column(db.String(256))
    role = db.Column(db.String(20), nullable=False, default='company') # 'government', 'company', 'admin'
    district = db.Column(db.String(100))
    status = db.Column(db.String(20), default='active')
    
    score = db.relationship('CompanyScore', backref='company', uselist=False, cascade="all, delete-orphan")
    bids = db.relationship('Bid', backref='company', lazy=True)
    past_projects = db.relationship('PastProject', backref='company', lazy=True)

class CompanyScore(db.Model):
    __tablename__ = 'Company_Score'
    id = db.Column(db.Integer, primary_key=True)
    company_id = db.Column(db.String(50), db.ForeignKey('Companies.id'))
    ontime_score = db.Column(db.Integer, default=0)
    quality_score = db.Column(db.Integer, default=0)
    feedback_score = db.Column(db.Integer, default=0)
    projects_count = db.Column(db.Integer, default=0)
    total_score = db.Column(db.Integer, default=0)

class ProblemStatement(db.Model):
    __tablename__ = 'Problem_Statements'
    id = db.Column(db.String(50), primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    government_dept_id = db.Column(db.String(50)) # Matches government dept
    category = db.Column(db.String(100))
    district = db.Column(db.String(100))
    budget = db.Column(db.Float)
    deadline = db.Column(db.String(50))
    priority = db.Column(db.String(20))
    status = db.Column(db.String(50), default='auction_open')
    posted_date = db.Column(db.String(50))
    
    bids = db.relationship('Bid', backref='problem', lazy=True)

class Bid(db.Model):
    __tablename__ = 'Bids'
    id = db.Column(db.String(50), primary_key=True)
    problem_statement_id = db.Column(db.String(50), db.ForeignKey('Problem_Statements.id'))
    company_id = db.Column(db.String(50), db.ForeignKey('Companies.id'))
    bid_value = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(50), default='submitted')
    submitted_at = db.Column(db.String(50))
    proposal = db.Column(db.Text)
    timeline = db.Column(db.Integer)
    team_size = db.Column(db.Integer)
    
    evaluation = db.relationship('EvaluationResult', backref='bid', uselist=False, cascade="all, delete-orphan")

class EvaluationResult(db.Model):
    __tablename__ = 'Evaluation_Results'
    id = db.Column(db.Integer, primary_key=True)
    bid_id = db.Column(db.String(50), db.ForeignKey('Bids.id'))
    evaluation_score = db.Column(db.Float)
    selected_status = db.Column(db.String(20), default='pending')
    feedback = db.Column(db.Text)

class PastProject(db.Model):
    __tablename__ = 'Past_Projects'
    id = db.Column(db.Integer, primary_key=True)
    company_id = db.Column(db.String(50), db.ForeignKey('Companies.id'))
    title = db.Column(db.String(200))
    completion_status = db.Column(db.String(50))
    quality_rating = db.Column(db.Integer)
