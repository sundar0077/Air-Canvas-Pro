from flask import Flask, request, jsonify, send_from_directory, session
from flask_cors import CORS
import os
import base64
from datetime import datetime

app = Flask(__name__, static_folder='../')
app.secret_key = "aircanvas_secret_key_2025"
CORS(app)

SAVE_FOLDER = 'saved_artworks'
os.makedirs(SAVE_FOLDER, exist_ok=True)

# Simple User Database (for demo)
users = {
    "demo": "1234",
    "admin": "admin123"
}

@app.route('/')
def serve_frontend():
    return send_from_directory('../', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('../', path)

# ====================== AUTHENTICATION ======================
@app.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if username in users and users[username] == password:
        session['user'] = username
        return jsonify({"status": "success", "message": "Login successful"})
    return jsonify({"status": "error", "message": "Invalid credentials"}), 401

@app.route('/logout')
def logout():
    session.pop('user', None)
    return jsonify({"status": "success"})

# ====================== SAVE ARTWORK ======================
@app.route('/save', methods=['POST'])
def save_artwork():
    if 'user' not in session:
        return jsonify({"status": "error", "message": "Please login first"}), 401
    
    try:
        data = request.json
        image_data = data['image'].split(',')[1]
        filename = f"{session['user']}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
        
        filepath = os.path.join(SAVE_FOLDER, filename)
        
        with open(filepath, "wb") as f:
            f.write(base64.b64decode(image_data))
        
        return jsonify({
            "status": "success",
            "filename": filename,
            "message": "Artwork saved successfully!"
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    print("🚀 AirCanvas Pro Backend Running on http://localhost:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)