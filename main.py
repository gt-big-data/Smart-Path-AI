from flask import Flask, render_template
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Routes
@app.route('/')
def index():
    #return render_template('index.html')
    return "Flask server called successfully"

if __name__ == '__main__':
    app.run(debug=True)
