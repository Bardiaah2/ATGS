
#!/usr/bin/env python3
"""seed.py

Idempotent seeding script for development.
- Reads DATABASE_URL from the environment (falls back to local postgres).
- Will only insert users/tickets if the database appears empty (both users and tickets tables have zero rows).
- Inserts three admins (keeps the given real admin emails), a few test advisors and students (fake emails),
  and 10 tickets with varied created_at / last_updated / status / priority values for sorting tests.

Written in collaboration with ChatGPT.
"""

import os
import random
from datetime import datetime, timedelta
from sqlalchemy import create_engine, text

# Use container-aware DATABASE_URL when available
DB_URL = os.getenv('DATABASE_URL', 'postgresql://localhost/atgs')

USERS = [
    # Admins (real as requested)
    {"email": "kyran@uoregon.edu", "display_name": "Kyran McCown", "role": "admin"},
    {"email": "bardiaah@uoregon.edu", "display_name": "Bardia Ahmadi Dafchahi", "role": "admin"},
    {"email": "mmelner@uoregon.edu", "display_name": "Max Melner", "role": "admin"},
    # Advisors (generic test accounts)
    {"email": "advisor1@test.local", "display_name": "Test Advisor 1", "role": "advisor"},
    {"email": "advisor2@test.local", "display_name": "Test Advisor 2", "role": "advisor"},
    {"email": "advisor3@test.local", "display_name": "Test Advisor 3", "role": "advisor"},
    # Students (generic test accounts)
    {"email": "student1@test.local", "display_name": "Test Student 1", "role": "student"},
    {"email": "student2@test.local", "display_name": "Test Student 2", "role": "student"},
    {"email": "student3@test.local", "display_name": "Test Student 3", "role": "student"},
    {"email": "student4@test.local", "display_name": "Test Student 4", "role": "student"},
    {"email": "student5@test.local", "display_name": "Test Student 5", "role": "student"},
]

TICKET_STATUSES = ["open", "in progress", "closed"]
DEPARTMENTS = ["Tykeson", "Computer Science", "Financial Aid", "Housing"]

INSERT_USER_SQL = text(
    """
    INSERT INTO users (email, display_name, role)
    VALUES (:email, :display_name, :role)
    ON CONFLICT (email) DO NOTHING
    RETURNING user_id, role
    """
)

INSERT_TICKET_SQL = text(
    """
    INSERT INTO tickets (author, assignee, department, priority, subject, message, status, created_at, last_updated)
    VALUES (:author, :assignee, :department, :priority, :subject, :message, :status, :created_at, :last_updated)
    RETURNING ticket_id
    """
)

SELECT_COUNT_USERS = text("SELECT COUNT(*) FROM users")
SELECT_COUNT_TICKETS = text("SELECT COUNT(*) FROM tickets")


def main():
    engine = create_engine(DB_URL)
    with engine.begin() as conn:
        # Check if database is empty (no users and no tickets)
        try:
            users_count = conn.execute(SELECT_COUNT_USERS).scalar()
        except Exception:
            users_count = 0
        try:
            tickets_count = conn.execute(SELECT_COUNT_TICKETS).scalar()
        except Exception:
            tickets_count = 0

        if users_count > 0 or tickets_count > 0:
            print(f"Database not empty (users={users_count}, tickets={tickets_count}) — skipping seed.")
            return

        print("Seeding users...")
        inserted_users = 0
        for u in USERS:
            result = conn.execute(INSERT_USER_SQL, u)
            if result.rowcount and result.rowcount > 0:
                inserted_users += 1

        print(f"Inserted {inserted_users} users (duplicates ignored).")

        # Fetch advisor and student ids for ticket creation
        advisor_rows = conn.execute(text("SELECT user_id FROM users WHERE role = 'advisor' ORDER BY user_id")).fetchall()
        student_rows = conn.execute(text("SELECT user_id FROM users WHERE role = 'student' ORDER BY user_id")).fetchall()
        advisor_ids = [r[0] for r in advisor_rows]
        student_ids = [r[0] for r in student_rows]

        if not student_ids:
            print("No student users found after seeding — aborting ticket creation.")
            return

        print("Seeding tickets...")
        now = datetime.utcnow()
        inserted_tickets = 0

        for i in range(10):
            author = random.choice(student_ids)
            assignee = random.choice(advisor_ids) if advisor_ids and random.random() < 0.6 else None
            department = random.choice(DEPARTMENTS)
            # Randomly make some priorities null
            priority = random.choice([None, 1, 2, 3])
            status = random.choice(TICKET_STATUSES)

            # Spread creation times over the past 30 days
            created_at = now - timedelta(days=random.randint(0, 30), hours=random.randint(0, 23))
            # last_updated is at or after created_at
            last_updated = created_at + timedelta(hours=random.randint(0, 72))

            subject = f"Test Ticket {i+1} — {status}"
            message = f"This is a seeded test ticket number {i+1}. Status: {status}. Department: {department}."

            params = {
                'author': author,
                'assignee': assignee,
                'department': department,
                'priority': priority,
                'subject': subject,
                'message': message,
                'status': status,
                'created_at': created_at,
                'last_updated': last_updated,
            }

            conn.execute(INSERT_TICKET_SQL, params)
            inserted_tickets += 1

        print(f"Inserted {inserted_tickets} tickets.")

    print("Seeding complete!")


if __name__ == '__main__':
    main()