'''
Web application for University of Oregon 
student/advisor ticketing system and graduation planner
'''

from shlex import join
from flask import Flask, request, render_template, redirect, url_for, session
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import case
from sqlalchemy.orm import joinedload

app = Flask(__name__)

# Configure PostgreSQL connection
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://kyran@localhost/atgs'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = 'dev' # TODO: Temporary, replace later

db = SQLAlchemy(app)

# Define user model that matches database table
class User(db.Model):
    __tablename__ = 'users'

    user_id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False)
    display_name = db.Column(db.String(100), nullable=False)
    role = db.Column(db.String(50), default='student')
    created_at = db.Column(db.DateTime)

# Define ticket model that matches database table
class Ticket(db.Model):
    __tablename__ = 'tickets'

    # Database table fields
    ticket_id = db.Column(db.Integer, primary_key=True)
    author = db.Column(db.ForeignKey('users.user_id'))
    assignee = db.Column(db.ForeignKey('users.user_id'))
    department = db.Column(db.String(50), default="Tykeson")
    priority = db.Column(db.Integer)
    subject = db.Column(db.String(255), nullable=False)
    message = db.Column(db.Text, nullable=False)
    status = db.Column(db.Text, default='open')
    created_at = db.Column(db.DateTime)
    last_updated = db.Column(db.DateTime)

    # Relationships
    author_user = db.relationship('User', foreign_keys=[author], backref='authored_tickets')
    assignee_user = db.relationship('User', foreign_keys=[assignee], backref='assigned_tickets')

@app.route('/')
def home():
    # For now, just show users to confirm connection
    users = User.query.all()
    return render_template('home.html', users=users)

@app.route('/login/<int:user_id>')
def login(user_id):
    session['user_id'] = user_id
    return redirect(url_for('submit_ticket'))

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        email = request.form.get('email')
        name = request.form.get('name')
        role = request.form.get('role', 'student')

        if not email or not name:
            return "Error: Email and name are required.", 400

        existing = User.query.filter_by(email=email).first()
        if existing:
            return f"User with email {email} already exists.", 400

        new_user = User(email=email, display_name=name, role=role)
        db.session.add(new_user)
        db.session.commit()

        return redirect(url_for('home'))  # go back to homepage after signing up

    # If it's a GET request, show the signup form
    return render_template('signup.html')

@app.route('/submit_ticket', methods=['GET', 'POST'])
def submit_ticket():
    user_id = session.get('user_id')
    if not user_id:
        return redirect(url_for('home'))
    
    current_user = User.query.get(user_id)

    if request.method == 'POST':
        author = session.get('user_id')
        department = request.form.get('department')
        subject = request.form.get('subject')
        message = request.form.get('message')

        new_ticket = Ticket(author=author, department=department, subject=subject, message=message)
        db.session.add(new_ticket)
        db.session.commit()

        return "Ticket created successfully"
    
    return render_template('submit_ticket.html', current_user=current_user)

@app.route('/tickets')
def tickets():
    user_id = session.get('user_id')
    if not user_id:
        return redirect(url_for('home'))
    
    current_user = User.query.get(user_id)

    status_order = case(
        (Ticket.status == 'open', 1),
        (Ticket.status == 'in progress', 2),
        (Ticket.status == 'closed', 3),
    )

    if current_user.role in ['advisor', 'admin']:
        tickets = Ticket.query.order_by(status_order, Ticket.last_updated.desc()).options(joinedload(Ticket.author_user)).all()  # Fetch all tickets from the database
    else:
        tickets = Ticket.query.order_by(status_order, Ticket.last_updated.desc()).filter_by(author=user_id).options(joinedload(Ticket.author_user)).all()
    
    return render_template('tickets.html', tickets=tickets)


if __name__ == '__main__':
    app.run(debug=True)