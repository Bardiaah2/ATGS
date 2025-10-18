# Use official lightweight Python image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Copy dependency list and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy project files
COPY . /app

# Expose port 5000 (Flask default)
EXPOSE 5000

# Set environment variables
ENV FLASK_RUN_HOST=0.0.0.0

# Copy entrypoint script
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Use entrypoint instead of CMD
ENTRYPOINT ["/app/entrypoint.sh"]