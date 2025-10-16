'''
Web application for University of Oregon 
student/advisor ticketing system and graduation planner
'''

from flask import Flask, request, render_template, redirect, url_for
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)

# Configure PostgreSQL connection
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://kyran@localhost/atgs'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# Define user model that matches database table
class User(db.Model):
    __tablename__ = 'users'

    user_id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False)
    display_name = db.Column(db.String(100), nullable=False)
    role = db.Column(db.String(50), default='student')
    created_at = db.Column(db.DateTime)

@app.route('/')
def home():
    # For now, just show users to confirm connection
    users = User.query.all()
    return '<br>'.join([f'{u.display_name} ({u.email})' for u in users])

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

if __name__ == '__main__':
    app.run(debug=True)