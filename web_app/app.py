'''
Web application for University of Oregon 
student/advisor ticketing system and graduation planner
'''

from flask import Flask 

app = Flask(__name__)

@app.route('/')
def home():
    return "Hello from ATGS!"

if __name__ == '__main__':
    app.run(debug=True)