#!/bin/sh
# entrypoint.sh — Written in collaboration with ChatGPT

# Exit immediately if a command fails
set -e

# Wait for the database to be ready
echo "Waiting for database..."
until python -c "import socket; s=socket.socket(); s.settimeout(1); s.connect(('db', 5432))" 2>/dev/null; do
  sleep 1
done
echo "Database is up!"

# Move into the app directory
cd web_app

# Run migrations
echo "Running database migrations..."
flask db upgrade

# Seed the database
echo "Seeding database..."
python seed.py

# Start Flask
echo "Starting Flask server..."
exec flask run --host=0.0.0.0 --port=5000