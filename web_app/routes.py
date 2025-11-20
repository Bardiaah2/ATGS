from http import HTTPStatus
from flask import Blueprint, Flask, jsonify, request, render_template, redirect, url_for, session
from sqlalchemy import case, or_, Integer, cast
from sqlalchemy.orm import joinedload, aliased
from web_app.app import db
from datetime import datetime
from web_app.models import Department, Major, Minor, User, Ticket, TicketStatus

bp = Blueprint('main', __name__)

@bp.route('/')
def home():
    # For now, just show users to confirm connection
    users = User.query.all()
    return render_template('home.html', users=users)

@bp.route('/login/<int:user_id>')
def login(user_id):
    session['user_id'] = user_id
    return redirect(url_for('main.submit_ticket'))

@bp.route('/api/signup', methods=['GET', 'POST'])
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

        new_user = User(email=email, display_name=name, role=role) # type:ignore
        new_user.dbwrite() # now using new dbwrite method

        return redirect(url_for('main.home'))  # go back to homepage after signing up

    # If it's a GET request, show the signup form
    return render_template('signup.html')

@bp.route('/api/submit_ticket', methods=['POST'])
def submit_ticket():
    user_id = session.get('user_id')
    data = request.get_json()

    if not user_id:
        return jsonify({"message": "No user logged in"}), HTTPStatus.UNAUTHORIZED
    
    author = session.get('user_id')
    department = data.get('department')
    subject = data.get('subject')
    message = data.get('message')

    if not all([department, subject, message]):
        return jsonify({"message": "Incomplete ticket structure"}), HTTPStatus.BAD_REQUEST
   
   
    new_ticket = Ticket(author=author, department=department, subject=subject, message=message) # type:ignore
    
    try:
        new_ticket.dbwrite()
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Error committing ticket to database", "error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR

    
    return jsonify({"message": "Ticket submitted successfully", "ticket": new_ticket.to_dict()}), HTTPStatus.CREATED
    
@bp.route('/api/current_user', methods = ['GET'])
def current_user():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"message": "No user logged in"}), HTTPStatus.UNAUTHORIZED
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({"message": "User not found"}), HTTPStatus.NOT_FOUND

    return jsonify(user.to_dict()), HTTPStatus.OK

@bp.route('/api/get_tickets', methods = ['GET'])
def tickets():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"message": "No user logged in"}), HTTPStatus.UNAUTHORIZED
    
    current_user = User.query.get(user_id)

    # Order by status priority: OPEN (1) first, then AWAITING_ASSIGNEE (3), then AWAITING_AUTHOR (2), then CLOSED (0)
    # Cast status to integer since the database column is text type (migration issue)
    status_order = case(
        (cast(Ticket.status, Integer) == 1, 1), # OPEN
        (cast(Ticket.status, Integer) == 3, 2), # AWAITING_ASSIGNEE
        (cast(Ticket.status, Integer) == 2, 3), # AWAITING_AUTHOR
        (cast(Ticket.status, Integer) == 0, 4), # CLOSED
        else_=5
    )

    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)

    query = Ticket.query

    if 'status' in request.args:
        query = query.filter(cast(Ticket.status, Integer) == int(request.args['status']))
        
    if 'department' in request.args:
        query = query.filter(Ticket.department == int(request.args['department']))

    if 'priority' in request.args:
        query = query.filter(Ticket.priority == int(request.args['priority']))
    
    if 'created' in request.args:
        created = datetime.strptime(request.args['created'], "%Y-%m-%d")
        query = query.filter(Ticket.created_at == created)

    if 'updated' in request.args:
        updated = datetime.strptime(request.args['updated'], "%Y-%m-%d")
        query = query.filter(Ticket.last_updated == updated)

    if 'text' in request.args:
        search_term = request.args['text']
        terms = search_term.split()

        author_alias = aliased(User)
        assignee_alias = aliased(User)

        query = query.join(author_alias, Ticket.author_user) # type:ignore
        query = query.join(assignee_alias, Ticket.assignee_user) # type:ignore
        query = query.filter(
            or_(
                *[Ticket.subject.ilike(f"%{term}%") for term in terms],
                *[Ticket.message.ilike(f"%{term}%") for term in terms],
                author_alias.display_name.ilike(f"%{search_term}%"),
                assignee_alias.display_name.ilike(f"%{search_term}%"),
            )
        )
    
    if current_user.role in ['advisor', 'admin']: # type:ignore
        # Fetch all tickets from the database
        pagination = query.order_by(status_order, Ticket.last_updated.desc()).options(
            joinedload(Ticket.author_user),
            joinedload(Ticket.assignee_user)
        ).paginate(page=page, per_page=per_page)  # type:ignore
        tickets = pagination.items
    else:
        # Fetch only tickets authored by the student
        pagination = query.order_by(status_order, Ticket.last_updated.desc()).filter_by(author=user_id).options(
            joinedload(Ticket.author_user),
            joinedload(Ticket.assignee_user)
        ).paginate(page=page, per_page=per_page)  # type:ignore
        tickets = pagination.items

    # Enhance ticket data with author and assignee names
    tickets_data = []
    for t in tickets:
        ticket_dict = t.to_dict()
        ticket_dict['author_name'] = t.author_user.display_name if t.author_user else None  # type:ignore
        ticket_dict['assignee_name'] = t.assignee_user.display_name if t.assignee_user else None  # type:ignore
        tickets_data.append(ticket_dict)

    response = {
        "tickets": tickets_data,
        "page": pagination.page,
        "per_page": pagination.per_page,
        "total_pages": pagination.pages,
        "total_items": pagination.total,
        "has_next": pagination.has_next,
        "has_prev": pagination.has_prev,
        "next_page": pagination.next_num,
        "prev_page": pagination.prev_num
    }
   
    return jsonify(response), HTTPStatus.OK

@bp.route("/api/ticket_details", methods=['GET'])
def ticket_details():
    response: dict[str, str | None] = {'ticket_id': None,
                'author': None,
                'assignee': None,
                'department': None,
                'priority': None,
                'subject': None,
                'body': None,
                'status': None,
                'created_at': None,
                'last_updated': None,
                
                'message': None,
                'error': None}
    
    ticket_id = request.args.get('ticket_id')
    if not ticket_id:
        response['error'] = "Missing required query parameter: 'ticket_id'"
        return jsonify(response), HTTPStatus.BAD_REQUEST
    
    response['ticket_id'] = ticket_id
    user_id = session.get('user_id')

    if not user_id:
        response['error'] = "No user logged in"
        return jsonify(response), HTTPStatus.UNAUTHORIZED
    
    ticket = Ticket.query.filter_by(ticket_id=ticket_id).first()
    if not ticket:
        response['error'] = "Ticket not found"
        return jsonify(response), HTTPStatus.NOT_FOUND
    
    response.update({
    'author': ticket.author_user.display_name if ticket.author_user else None,
    'assignee': ticket.assignee_user.display_name if ticket.assignee_user else None,
    'department': ticket.dept_name.name if ticket.dept_name else None,
    'priority': ticket.priority,
    'subject': ticket.subject,
    'body': ticket.message,
    'status': TicketStatus(ticket.status).name if ticket.status is not None else None,
    'created_at': ticket.created_at.isoformat() if ticket.created_at else None,
    'last_updated': ticket.last_updated.isoformat() if ticket.last_updated else None,
})