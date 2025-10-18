# ATGS
Academic Ticketing and Graduation system

## Getting Started

To run the ATGS application locally using Docker:

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/ATGS.git
   cd ATGS
   ```

2. **Build and run the containers**:
   ```bash
   docker-compose up --build
   ```

3. **Access the app**:
   Open your browser and go to [http://localhost:5001](http://localhost:5001)

> Note: Port 5001 is mapped to the container's internal port 5000. If you modify this mapping in `docker-compose.yml`, update the URL accordingly.

4. **Environment Variables**:
   Make sure your `.env` file is located in the `web_app/` directory and contains:
   ```
   FLASK_APP=app.py
   FLASK_ENV=development
   DATABASE_URL=postgresql://postgres:postgres@db:5432/atgs
   ```

5. **Database Migrations**:
   Migrations and seeding are automatically handled when the container starts. If you need to rerun them manually:
   ```bash
   docker-compose exec web flask db upgrade
   docker-compose exec web python seed.py
   ```

## Development

All development should be done in containers. Avoid running database or Flask services directly on your host unless debugging migration issues.
